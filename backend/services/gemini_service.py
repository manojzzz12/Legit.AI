"""Gemini API (free tier) wrapper - plain REST through httpx, no SDK needed.

Gemini is used ONLY to read content, extract claims, transcribe audio and label each
evidence snippet SUPPORTS / CONTRADICTS / NEUTRAL with a reason. It never produces the
trust score; scoring_engine.py does that with explicit rules.

The key comes from the GEMINI_API_KEY environment variable only.
Model names change often, so they are configurable. GEMINI_MODELS is a comma-separated
list; if one model is retired (404) or rate-limited (429) the next one is tried.
"""
import base64
import json
import os
import re
import time
from typing import Any, Dict, List, Optional

import httpx

API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"
DEFAULT_MODELS = "gemini-3.1-flash-lite,gemini-3-flash-preview,gemini-2.5-flash"


class GeminiError(RuntimeError):
    """kind: not_configured | auth | quota | not_found | bad_response | network"""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind


def is_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


def models() -> List[str]:
    return [m.strip() for m in os.getenv("GEMINI_MODELS", DEFAULT_MODELS).split(",") if m.strip()]


def _parse_json(text: str) -> Any:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"(\{.*\}|\[.*\])", text, flags=re.S)
        if m:
            return json.loads(m.group(1))
        raise


def generate(prompt: str, files: Optional[List[Dict]] = None, json_mode: bool = True,
             timeout: float = 60.0) -> Any:
    """files = [{"mime": "image/png", "data": bytes}]. Returns parsed JSON (or text)."""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise GeminiError("not_configured", "GEMINI_API_KEY is not set in backend/.env.")
    parts: List[Dict] = [{"text": prompt}]
    for f in files or []:
        parts.append({"inline_data": {"mime_type": f["mime"], "data": base64.b64encode(f["data"]).decode()}})
    body = {"contents": [{"parts": parts}],
            "generationConfig": {"temperature": 0.0,
                                 **({"responseMimeType": "application/json"} if json_mode else {})}}
    last: Optional[GeminiError] = None
    for model in models():
        for attempt in range(2):
            try:
                r = httpx.post(f"{API_ROOT}/{model}:generateContent", json=body,
                               headers={"x-goog-api-key": key, "Content-Type": "application/json"},
                               timeout=timeout)
            except httpx.HTTPError as e:
                raise GeminiError("network", f"Could not reach the Gemini API: {e}")
            if r.status_code == 200:
                try:
                    data = r.json()
                    text = "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
                    return _parse_json(text) if json_mode else text
                except (KeyError, IndexError, ValueError, json.JSONDecodeError):
                    last = GeminiError("bad_response", f"Gemini ({model}) returned an unreadable or blocked response.")
                    break
            if r.status_code in (401, 403):
                raise GeminiError("auth", "Gemini rejected the API key (check GEMINI_API_KEY).")
            if r.status_code == 404:
                last = GeminiError("not_found", f"Model '{model}' is not available; trying the next one.")
                break
            if r.status_code in (429, 503):
                last = GeminiError("quota", "Gemini free-tier rate limit or capacity reached.")
                if attempt == 0:
                    time.sleep(2)
                    continue
                break
            last = GeminiError("bad_response", f"Gemini ({model}) error {r.status_code}: {r.text[:160]}")
            break
    raise last or GeminiError("bad_response", "Gemini returned no usable answer.")


# ---------------------------------------------------------------- claim extraction
CLAIM_PROMPT = """You help a fact-checking tool. Read the CONTENT below and list the distinct claims it makes.
Return JSON only: {{"summary": "<one neutral sentence>", "claims": [{{"claim": "<self-contained sentence>",
"importance": "high|medium|low", "type": "factual|opinion|prediction", "search_query": "<concise web search query, 3-10 words, only for factual claims>"}}]}}
Rules: at most {max_claims} claims. Make each claim understandable on its own (name people, places, dates).
"factual" = can be checked against the real world. "opinion" = value judgement. "prediction" = about the future.
Do not judge whether claims are true. Do not invent claims that are not in the content.
{extra}
CONTENT:
\"\"\"{text}\"\"\""""


def extract_claims(text: str, files: Optional[List[Dict]] = None, max_claims: int = 6, extra: str = "") -> Dict:
    prompt = CLAIM_PROMPT.format(text=text[:8000] or "(no text; use the attached media)",
                                 max_claims=max_claims, extra=extra)
    return generate(prompt, files)


# ------------------------------------------------------------ evidence classification
CLASSIFY_PROMPT = """You are a careful fact-checking assistant. For ONE claim, label each evidence snippet.
CLAIM: {claim}

For each snippet answer:
- SUPPORTS: the snippet states or clearly implies the claim is correct, including the specific details (who/where/when/how many).
- CONTRADICTS: the snippet states something that conflicts with the claim (different date, place, number, outcome, or says it did not happen).
- NEUTRAL: the snippet is related but does not settle the claim, or is about something else.
Be strict: if details are missing or you are unsure, choose NEUTRAL. Judge only from the snippet text, not from your own memory.
Return JSON only: {{"results": [{{"id": "<snippet id>", "classification": "SUPPORTS|CONTRADICTS|NEUTRAL", "reasoning": "<one short sentence citing what the snippet says>"}}]}}

SNIPPETS:
{snippets}"""


def classify_evidence(claim: str, items: List[Dict]) -> Dict[str, Dict]:
    """items need id/title/snippet. Returns {id: {classification, reasoning}}."""
    block = "\n".join(f'[{i["id"]}] {i.get("title", "")} :: {i["snippet"][:900]}' for i in items)
    data = generate(CLASSIFY_PROMPT.format(claim=claim, snippets=block))
    out: Dict[str, Dict] = {}
    for r in (data.get("results") if isinstance(data, dict) else data) or []:
        cls = str(r.get("classification", "NEUTRAL")).upper()
        out[str(r.get("id"))] = {"classification": cls if cls in ("SUPPORTS", "CONTRADICTS", "NEUTRAL") else "NEUTRAL",
                                 "reasoning": str(r.get("reasoning", ""))[:400]}
    return out


# -------------------------------------------------------------------- media helpers
TRANSCRIBE_PROMPT = ("Transcribe the speech in this audio exactly as spoken. Return JSON only: "
                     '{"transcript": "<text>", "language": "<language>"}. If there is no speech, return an empty transcript.')

IMAGE_PROMPT = """Look at this image. Return JSON only:
{"description": "<2 sentences, neutral>", "visible_text": "<any readable text, or empty>",
 "visual_anomalies": [{"observation": "<specific visual inconsistency such as odd lighting, warped text, duplicated regions, impossible shadows>", "level": "low|medium|high"}]}
Only list anomalies you can actually point to in the image. An empty list is fine. These are observations, not proof of manipulation."""


FRAMES_PROMPT = """These {n} images are frames sampled in order from one short video. Return JSON only:
{{"frames": [{{"description": "<1 neutral sentence>", "visible_text": "<readable text or empty>",
"visual_anomalies": [{{"observation": "<specific inconsistency such as odd lighting, warped text, duplicated regions>", "level": "low|medium|high"}}]}}]}}
Give exactly {n} entries, in the same order as the images. Only list anomalies you can point to; an empty list is fine.
They are observations, not proof of manipulation."""


def describe_frames(jpegs: List[bytes]) -> List[Dict]:
    """ONE request for all frames (the free tier has a low requests-per-minute limit)."""
    data = generate(FRAMES_PROMPT.format(n=len(jpegs)), [{"mime": "image/jpeg", "data": j} for j in jpegs])
    out = (data.get("frames") if isinstance(data, dict) else data) or []
    return [x if isinstance(x, dict) else {} for x in out][:len(jpegs)]


def transcribe(audio: bytes, mime: str) -> Dict:
    return generate(TRANSCRIBE_PROMPT, [{"mime": mime, "data": audio}])


def describe_image(image: bytes, mime: str) -> Dict:
    return generate(IMAGE_PROMPT, [{"mime": mime, "data": image}])


# ------------------------------------------------------------------- key check
def self_test() -> Dict:
    """One tiny call per configured model, to confirm the key and show which model works.
    Never returns the key. Uses a few free-tier requests, so call it sparingly."""
    if not is_configured():
        return {"ok": False, "error": "not_configured", "message": "GEMINI_API_KEY is not set in backend/.env."}
    tried = []
    for m in models():
        saved = os.environ.get("GEMINI_MODELS")
        os.environ["GEMINI_MODELS"] = m
        try:
            data = generate('Reply with JSON only: {"ok": true}')
            tried.append({"model": m, "status": "works"})
            return {"ok": True, "model": m, "tried": tried, "reply": data}
        except GeminiError as e:
            tried.append({"model": m, "status": e.kind})
            if e.kind == "auth":
                return {"ok": False, "error": "auth", "message": str(e), "tried": tried}
        finally:
            if saved is None:
                os.environ.pop("GEMINI_MODELS", None)
            else:
                os.environ["GEMINI_MODELS"] = saved
    return {"ok": False, "error": "no_working_model", "tried": tried,
            "message": "No configured Gemini model answered. Check GEMINI_MODELS and your free-tier quota."}
