"""LIVE analysis: the evidence comes from what the user submits, never from fixtures.

  content (text / document / image / audio / video)
    -> extract text (OCR, transcription, document reader)
    -> extract claims (Gemini, or simple rules)
    -> gather evidence: (a) Tavily web search per important factual claim
                        (b) optional reference documents the user supplies
    -> classify each evidence item SUPPORTS / CONTRADICTS / NEUTRAL (Gemini, with reasons)
    -> hand a "raw case" to pipeline.build_case(), which runs the rule-based scoring engine.

Every step degrades gracefully and records a warning instead of crashing.
"""
import base64
import io
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from services import claim_extractor, document_service, local_stt, media_processor, ocr_service
from services import gemini_service as gem
from services import fallback_search as wiki
from services import tavily_service as tav
from services.pipeline import build_case

STOP = set("the a an of in on at to for and or is are was were be been by with from that this it as has have had its their his her not no will would".split())
MAX_CLAIMS = 6
MAX_REF_CHARS = 60000
MAX_VIDEO_TEXT_CHARS = 60000
MAX_VIDEO_FRAME_PREVIEWS = 12


class LiveError(Exception):
    """User-facing failure. status 400 = bad input, 503 = services not configured."""

    def __init__(self, message: str, status: int = 400, code: str = "bad_input"):
        super().__init__(message)
        self.status, self.code = status, code


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ensure_services():
    if not gem.is_configured() and not tav.is_configured():
        raise LiveError("Neither GEMINI_API_KEY nor TAVILY_API_KEY is set, so live analysis cannot run. "
                        "Add the keys to backend/.env, or use a demo scenario.", 503, "live_not_configured")


# ----------------------------------------------------------- reference documents
def _tokens(s: str) -> set:
    return {w for w in re.findall(r"[a-z0-9]{3,}", s.lower()) if w not in STOP}


def _excerpts(claim: str, text: str, k: int = 2, size: int = 700) -> List[str]:
    """Pick the k passages of a user document that share the most words with the claim."""
    ct = _tokens(claim)
    paras = [p.strip() for p in re.split(r"\n\s*\n|(?<=[.!?])\s{2,}", text) if len(p.strip()) > 30] or [text]
    windows = []
    for i in range(len(paras)):
        w = " ".join(paras[i:i + 2])[:size]
        windows.append((len(ct & _tokens(w)), w))
    windows.sort(key=lambda x: -x[0])
    return [w for score, w in windows[:k] if score >= max(2, len(ct) // 4)]


def build_reference_items(claim: str, refs: List[Dict]) -> List[Dict]:
    items = []
    for ref in refs:
        for n, ex in enumerate(_excerpts(claim, ref["text"]), 1):
            items.append({"title": f"{ref['name']} (excerpt {n})", "url": None, "domain": f"user-provided:{ref['name']}",
                          "snippet": ex, "content_type": "user-supplied document",
                          "processing_method": f"{ref['method']} + keyword excerpt match", "retrieved_at": ref["added_at"]})
    return items


def read_refs(raw_refs: List[Tuple[str, bytes]], pasted: str = "") -> Tuple[List[Dict], List[str]]:
    refs, warns = [], []
    for name, data in raw_refs:
        try:
            text, method = document_service.extract_text(name, data)
            refs.append({"name": name, "text": text[:MAX_REF_CHARS], "method": method, "added_at": now()})
        except ValueError as e:
            warns.append(f"Reference file '{name}' skipped: {e}")
    if pasted.strip():
        refs.append({"name": "pasted reference text", "text": pasted[:MAX_REF_CHARS],
                     "method": "Pasted by user", "added_at": now()})
    return refs, warns


# ------------------------------------------------------------------ core engine
def _classify(claim: str, items: List[Dict], warns: List[str]) -> None:
    for n, it in enumerate(items, 1):
        it["id"] = it.get("id") or f"e{n}"
    if not items:
        return
    try:
        if not gem.is_configured():
            raise gem.GeminiError("not_configured", "GEMINI_API_KEY is not set")
        res = gem.classify_evidence(claim, items)
        for it in items:
            r = res.get(it["id"])
            it["classification"] = r["classification"] if r else "NEUTRAL"
            it["reasoning"] = r["reasoning"] if r else "Gemini gave no label for this snippet, so it is treated as neutral."
            it["processing_method"] += " + Gemini evidence classification"
        return
    except gem.GeminiError as e:
        msg = f"Evidence could not be classified by Gemini ({e}); items were left NEUTRAL, which cannot support a verdict."
        if msg not in warns:
            warns.append(msg)
    for it in items:
        it["classification"] = "NEUTRAL"
        it["reasoning"] = "Not classified: Gemini was unavailable. A source must be read before it can support or contradict."


def _own_domains(text: str) -> List[str]:
    """Domains mentioned in the submitted content. A claim cannot be verified by the page it came from."""
    from urllib.parse import urlparse
    out = []
    for u in re.findall(r"https?://[^\s)>\]\"']+", text or ""):
        d = urlparse(u).netloc.lower()
        if d and d not in out:
            out.append(d)
    return out


def _web_search(c: Dict, own: List[str], warns: List[str], state: Dict) -> List[Dict]:
    """Tavily first; Wikipedia (free, no key) when Tavily is missing, failing or empty."""
    query = c.get("search_query") or c["claim"]
    if tav.is_configured() and not state["tavily_down"]:
        try:
            res = tav.search(query, max_results=5, exclude_domains=own)
            state["tavily"] += 1
            if res:
                return [{**r, "content_type": "web page", "processing_method": "Tavily web search"} for r in res]
        except tav.TavilyError as e:
            state["tavily_down"] = True
            warns.append(f"Tavily failed ({e}).")
    if not wiki.enabled():
        return []
    try:
        res = [r for r in wiki.search(query, max_results=2) if not any(o in r["domain"] for o in own)]
    except Exception as e:  # noqa: BLE001 - network, JSON, anything
        if not state["wiki_failed"]:
            warns.append(f"Backup search (Wikipedia) also failed ({type(e).__name__}). Only user-supplied evidence was used.")
        state["wiki_failed"] = True
        return []
    state["wiki"] += 1
    state["wiki_used"] = True
    return [{**r, "content_type": "encyclopedia article", "processing_method": "Wikipedia API backup search"} for r in res]


def run_claims(claims: List[Dict], refs: List[Dict], warns: List[str], source_text: str = "") -> Dict:
    """Gather + classify evidence for each factual claim. Returns timing/search info."""
    t = {"searched": now()}
    factual = [c for c in claims if c["type"] == "factual"]
    order = sorted(factual, key=lambda c: {"high": 0, "medium": 1, "low": 2}[c["importance"]])
    budget = tav.max_searches()
    to_search = {c["id"] for c in order[:budget]}
    if len(factual) > budget:
        warns.append(f"MAX_SEARCHES_PER_CASE is {budget}, so only the {budget} most important factual claims were searched. "
                     "Raise it in backend/.env to search every factual claim.")
    if not tav.is_configured():
        warns.append("TAVILY_API_KEY is not set." + (" The free Wikipedia backup search was used instead." if wiki.enabled()
                     else " No web search was done."))
    own = _own_domains(source_text)
    state = {"tavily": 0, "wiki": 0, "tavily_down": False, "wiki_failed": False, "wiki_used": False}
    n_web = 0
    for c in claims:
        c["evidence"] = []
        if c["type"] != "factual":
            continue
        items = build_reference_items(c["claim"], refs)
        if c["id"] in to_search:
            found = _web_search(c, own, warns, state)
            n_web += len(found)
            items += found
        items = [i for i in items if i["snippet"]]
        _classify(c["claim"], items, warns)
        c["evidence"] = items
    if state["wiki_used"] and state["tavily_down"]:
        warns.append("Evidence from Wikipedia was used because Tavily was unavailable. Wikipedia is crowd-edited "
                     "and weighted lower than news or official sources.")
    t["classified"] = now()
    t["note"] = (f"{state['tavily']} Tavily and {state['wiki']} Wikipedia backup search(es) run, {n_web} sources retrieved"
                 + (f"; {len(refs)} user reference document(s) checked" if refs else "") + ".")
    return t


def _finish(kind: str, inp: Dict, claims: List[Dict], info: Dict, refs: List[Dict], warns: List[str],
            indicators: List[Dict], applicable: bool, manip_note: str, ts: Dict) -> Dict:
    ts["extracted"] = ts.get("extracted") or now()
    if info.get("warning"):
        warns.append(info["warning"])
    ts["claims"] = now()
    src = " ".join(str(inp.get(k, "")) for k in ("text", "ocr_text", "transcript"))
    timing = run_claims(claims, refs, warns, src)
    ts["checked"] = now()
    for c in claims:
        c.setdefault("search_query", None)
    raw = {"input": inp, "claims": claims, "warnings": warns, "search_note": timing["note"],
           "manipulation": {"applicable": applicable, "indicators": indicators, "note": manip_note}}
    raw["trail_ts"] = [ts["start"], ts["extracted"], ts["claims"], timing["searched"], timing["classified"],
                       ts["checked"], ts["checked"], now()]
    case = build_case(raw, mode="live")
    case["input"]["claim_extraction"] = info.get("method")
    return case


def _preview(image_bytes: bytes, size: int = 480) -> Optional[str]:
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img.thumbnail((size, size))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=80)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:  # noqa: BLE001
        return None


# -------------------------------------------------------------------- entry points
def analyze_text(text: str, refs: List[Dict], warns: List[str], title: str = "Pasted text",
                 method: str = "Pasted text (no extraction needed)") -> Dict:
    text = (text or "").strip()
    if len(text) < 15:
        raise LiveError("Please provide a longer statement or document to check.")
    ensure_services()
    ts = {"start": now()}
    claims, info = claim_extractor.extract(text, max_claims=MAX_CLAIMS)
    inp = {"type": "text", "title": title, "text": text[:4000], "extraction_method": method,
           "metadata": {"Characters": str(len(text))}}
    return _finish("text", inp, claims, info, refs, warns, [], False,
                   "Plain text has no media to analyse, so this signal is skipped and its weight is redistributed.", ts)


def analyze_document(filename: str, data: bytes, refs: List[Dict], warns: List[str]) -> Dict:
    try:
        text, method = document_service.extract_text(filename, data)
    except ValueError as e:
        raise LiveError(str(e))
    return analyze_text(text, refs, warns, title=f"Document: {filename}", method=method)


def analyze_image(data: bytes, filename: str, mime: str, caption: str, refs: List[Dict], warns: List[str]) -> Dict:
    ensure_services()
    ts = {"start": now()}
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(data))
        meta = {"File name": filename, "Format": img.format or "unknown", "Dimensions": f"{img.width} x {img.height}"}
    except Exception:  # noqa: BLE001
        raise LiveError("That file could not be opened as an image.")
    ocr = ocr_service.extract(data)
    ocr_text = ocr["text"]
    ocr_note = (f"OCR unavailable ({ocr['error']}); continuing with visual analysis" if ocr["error"]
                else ocr["method"] if ocr_text else "Tesseract OCR found no readable text")
    if ocr_text and ocr["confidence"] is not None:
        meta["OCR confidence"] = f"{ocr['confidence']:.0f}% average over {ocr['words']} words"
        if ocr["confidence"] < ocr_service.LOW_CONFIDENCE:
            warns.append(f"OCR confidence is low ({ocr['confidence']:.0f}%), so the text read from the image may contain "
                         "mistakes. Check the extracted text and add a caption if it is wrong.")
    indicators: List[Dict] = []
    try:
        indicators = media_processor.image_indicators(data)
    except Exception as e:  # noqa: BLE001
        warns.append(f"OpenCV analysis failed ({type(e).__name__}); manipulation indicators are incomplete.")
    description, visible = "", ""
    if gem.is_configured():
        try:
            d = gem.describe_image(data, mime or "image/jpeg")
            description, visible = d.get("description", ""), d.get("visible_text", "")
            indicators += media_processor.ai_anomaly_indicators(d.get("visual_anomalies", []))
        except gem.GeminiError as e:
            warns.append(f"Gemini image inspection unavailable ({e}). Only local OpenCV indicators were used.")
    text_parts = [p for p in (caption, ocr_text or visible) if p]
    if not ocr_text and visible:
        ocr_note = "Visible text read by Gemini (Tesseract found none)"
    if "unavailable" in ocr_note:
        warns.append(ocr_note + ".")
    extra = f"Image description: {description}" if description else ""
    claims, info = claim_extractor.extract("\n".join(text_parts), files=[{"mime": mime or "image/jpeg", "data": data}]
                                           if gem.is_configured() else None, max_claims=MAX_CLAIMS, extra=extra)
    if not text_parts and not description:
        warns.append("No text could be read from the image. Add a caption describing the claim the image makes.")
    inp = {"type": "image", "title": f"Image: {filename}", "text": caption, "ocr_text": ocr_text or visible,
           "extraction_method": f"{ocr_note}; image sent to Gemini with the extracted text" if gem.is_configured() else ocr_note,
           "metadata": {**meta, **({"AI description": description} if description else {})}, "preview": _preview(data)}
    ts["extracted"] = now()
    return _finish("image", inp, claims, info, refs, warns, indicators, True,
                   "Indicators are signals worth checking. They are not proof of tampering or of authenticity.", ts)


def _transcribe(wav_or_audio: bytes, mime: str, manual: str, warns: List[str]) -> Tuple[str, str]:
    """Manual transcript > Gemini (free tier) > optional local Whisper > nothing (ask the user)."""
    if manual.strip():
        return manual.strip(), "Manual transcript typed by the user"
    problem = "GEMINI_API_KEY is not set"
    if gem.is_configured():
        try:
            d = gem.transcribe(wav_or_audio, mime)
            text = str(d.get("transcript", "")).strip()
            if text:
                return text, "Gemini speech-to-text"
            problem = "Gemini heard no speech"
        except gem.GeminiError as e:
            problem = f"Gemini transcription failed ({e})"
    if local_stt.available():
        try:
            text = local_stt.transcribe(wav_or_audio)
            if text:
                warns.append(f"{problem}; the free local Whisper model was used instead.")
                return text, "Local Whisper speech-to-text (faster-whisper, offline)"
        except Exception as e:  # noqa: BLE001 - model download blocked, decode error...
            problem += f"; local Whisper failed ({type(e).__name__})"
    warns.append(f"{problem}. Paste a transcript to continue.")
    return "", "No transcript"


def _duration_note(info: Dict, warns: List[str]) -> None:
    d = info.get("duration")
    if d and d > media_processor.MAX_SECONDS:
        warns.append(f"The file is {media_processor.fmt_time(d)} long. To keep analysis fast, only the first "
                     f"{media_processor.MAX_SECONDS // 60} minutes were used.")


def analyze_audio(data: bytes, filename: str, mime: str, transcript: str, refs: List[Dict], warns: List[str]) -> Dict:
    ensure_services()
    ts = {"start": now()}
    suffix = "." + filename.rsplit(".", 1)[-1] if "." in filename else ".audio"
    path = media_processor.save_temp(data, suffix)
    send, send_mime, info, converted = data, mime or "audio/mpeg", {}, False
    try:
        info = media_processor.probe(path)
        _duration_note(info, warns)
        try:
            send, send_mime, converted = media_processor.to_wav(path), "audio/wav", True
        except RuntimeError as e:   # no FFmpeg or unreadable: try the original bytes with Gemini
            warns.append(f"{e} The original file was used as-is.")
    finally:
        import os
        os.remove(path)
    if len(send) > 18 * 1024 * 1024 and not transcript.strip():
        raise LiveError("Audio is too large to send for transcription. Upload a shorter clip or paste a transcript.")
    text, method = _transcribe(send, send_mime, transcript, warns)
    if len(text) < 15:
        raise LiveError("No speech could be transcribed. Please paste a transcript of what is said.")
    ts["extracted"] = now()
    claims, info_c = claim_extractor.extract(text, max_claims=MAX_CLAIMS)
    meta = {"File name": filename, "Size": f"{len(data) // 1024} KB",
            **({"Duration": media_processor.fmt_time(info["duration"])} if info.get("duration") else {}),
            "Converted for analysis": "FFmpeg, mono 16 kHz WAV" if converted else "No"}
    inp = {"type": "audio", "title": f"Audio: {filename}", "text": "", "transcript": text[:4000],
           "extraction_method": method, "metadata": meta}
    return _finish("audio", inp, claims, info_c, refs, warns, [], False,
                   "Audio manipulation detection (e.g. voice cloning) is not implemented. This signal is skipped "
                   "and its weight is redistributed.", ts)


def analyze_video(data: bytes, filename: str, transcript: str, refs: List[Dict], warns: List[str]) -> Dict:
    ensure_services()
    ts = {"start": now()}
    suffix = "." + filename.rsplit(".", 1)[-1] if "." in filename else ".mp4"
    path = media_processor.save_temp(data, suffix)
    try:
        info = media_processor.probe(path)
        _duration_note(info, warns)
        try:
            frames = media_processor.sample_frames(path)
        except Exception as e:  # noqa: BLE001
            raise LiveError(f"Video processing failed ({e}). Upload a single frame as an image instead.")
        audio_spoken, audio_method = "", "No audio transcript"
        if info.get("has_audio") is False:
            warns.append("This video has no audio track. The supplied transcript, if any, and its visuals were analysed.")
        else:
            try:
                wav = media_processor.to_wav(path)
                audio_warnings: List[str] = []
                audio_spoken, audio_method = _transcribe(wav, "audio/wav", "", audio_warnings)
                if audio_spoken:
                    audio_method = "FFmpeg audio extraction + " + audio_method
                    warns.extend(audio_warnings)
                elif transcript.strip():
                    warns.append("The video's audio could not be transcribed; the supplied transcript was also used.")
                else:
                    warns.extend(audio_warnings)
            except RuntimeError as e:
                warns.append(f"{e}" + (" The supplied transcript was used." if transcript.strip()
                                      else " Paste a transcript if the video has speech."))
    finally:
        import os
        os.remove(path)

    spoken_parts = [part for part in (audio_spoken.strip(), transcript.strip()) if part]
    spoken = "\n".join(spoken_parts)
    method_parts = [part for part in (audio_method if audio_spoken else "",
                                     "Manual transcript typed by the user" if transcript.strip() else "") if part]
    method = " + ".join(method_parts) if method_parts else "No audio transcript"

    jpegs = [f["jpeg"] for f in frames]
    indicators: List[Dict] = []
    seen_ind = set()
    for k, fb in enumerate(jpegs):                       # local OpenCV signals; ELA is skipped (frames are re-encoded by us)
        try:
            for i in media_processor.image_indicators(fb, ela=False):
                if i["severity"] > 0 and i["name"] not in seen_ind and "metadata" not in i["method"].lower():
                    seen_ind.add(i["name"])
                    indicators.append({**i, "name": f"{i['name']} (frame {k + 1})"})
        except Exception:  # noqa: BLE001
            pass
    ocr_all = [ocr_service.extract_text(fb, fast=True)[0].strip() for fb in jpegs]

    described: List[Dict] = [{}] * len(jpegs)
    if gem.is_configured():
        try:
            described = gem.describe_frames(jpegs)                 # one request for all frames
            described += [{}] * (len(jpegs) - len(described))
            for d in described:
                indicators += media_processor.ai_anomaly_indicators(d.get("visual_anomalies", []))
        except gem.GeminiError as e:
            warns.append(f"Gemini frame inspection unavailable ({e}). Only local OpenCV signals and OCR were used.")
    descs = [d.get("description", "") for d in described if d.get("description")]
    visual_parts = []
    for k, frame in enumerate(frames):
        timestamp = media_processor.fmt_time(frame["t"])
        ocr_text = ocr_all[k] if k < len(ocr_all) else ""
        ai_text = str(described[k].get("visible_text", "")).strip() if k < len(described) else ""
        if ocr_text:
            visual_parts.append(f"[{timestamp}] OCR: {ocr_text}")
        if ai_text and (not ocr_text or ai_text.casefold() not in ocr_text.casefold()):
            visual_parts.append(f"[{timestamp}] Gemini visual text: {ai_text}")
    visual = "\n".join(visual_parts)
    if len(visual) > MAX_VIDEO_TEXT_CHARS:
        visual = visual[:MAX_VIDEO_TEXT_CHARS]
        warns.append(f"Extracted on-screen text exceeded {MAX_VIDEO_TEXT_CHARS:,} characters and was truncated before claim extraction.")

    preview_count = min(len(frames), MAX_VIDEO_FRAME_PREVIEWS)
    preview_indexes = ({round(i * (len(frames) - 1) / (preview_count - 1)) for i in range(preview_count)}
                       if preview_count > 1 else {0} if preview_count else set())
    frame_info = [
        {"timestamp": media_processor.fmt_time(frame["t"]),
         "description": described[k].get("description") or "Frame sampled (no AI description)",
         "thumb": _preview(frame["jpeg"], 240)}
        for k, frame in enumerate(frames) if k in preview_indexes
    ]

    combined = "\n".join(p for p in (f"Audio and supplied transcript: {spoken}" if spoken else "", f"Text visible in frames: {visual}" if visual else "",
                                     f"Scene: {' '.join(descs)}" if descs else "") if p)
    if len(combined) < 15:
        raise LiveError("No speech or readable text was found in the video. Paste a transcript, or upload a frame as an image.")
    ts["extracted"] = now()
    claims, info_c = claim_extractor.extract(combined, max_claims=MAX_CLAIMS,
                                             extra=f"The video audio was transcribed and {len(frames)} frames sampled "
                                                   f"at {media_processor.VIDEO_FRAME_INTERVAL_SECONDS}-second intervals were scanned for visible text "
                                                   "and visually inspected. These are time-spaced samples, not every encoded frame.")
    meta = {"File name": filename,
            "Frames inspected": f"{len(frames)} (one every {media_processor.VIDEO_FRAME_INTERVAL_SECONDS} second)",
            "Frame previews shown": f"{len(frame_info)} of {len(frames)}",
            "Size": f"{len(data) // 1024} KB",
            **({"Duration": media_processor.fmt_time(info["duration"])} if info.get("duration") else {}),
            **({"Resolution": f"{info['width']} x {info['height']}"} if info.get("width") else {}),
            "Recording date": info.get("creation_time") or "Not present in file"}
    inp = {"type": "video", "title": f"Video: {filename}", "text": "", "transcript": spoken[:MAX_VIDEO_TEXT_CHARS],
           "ocr_text": visual, "frames": frame_info,
           "extraction_method": method + f"; audio transcript and {len(frames)} frames scanned at "
                             f"{media_processor.VIDEO_FRAME_INTERVAL_SECONDS}-second intervals",
           "metadata": meta}
    return _finish("video", inp, claims, info_c, refs, warns, indicators, True,
                   "Visual indicators come from time-spaced frame samples, not every encoded frame. They are signals, not proof, and no deepfake detector is used.", ts)
