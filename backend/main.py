"""TrustLens AI - FastAPI backend (demo mode + live analysis).

Run:  uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import hashlib
import os
import re
import shutil
import time
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import (FastAPI, File, Form, Header, HTTPException, Query,
                     UploadFile)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

for _key_name in ("GEMINI_API_KEY", "TAVILY_API_KEY"):
    if not os.getenv(_key_name, "").strip():
        os.environ.pop(_key_name, None)
load_dotenv(dotenv_path=Path(__file__).resolve().with_name(".env"))

from database import database as db  # noqa: E402
from demo.demo_cases import DEMO_CASES  # noqa: E402
from models.schemas import (CalculateTrustRequest, ClassifyEvidenceRequest,  # noqa: E402
                            SearchEvidenceRequest)
from services import (cache_service, fallback_search, gemini_service,  # noqa: E402
                      live_pipeline as live, media_processor, tavily_service)
from services.pipeline import build_case  # noqa: E402

SESSION_ID_REGEX = re.compile(r"^[a-zA-Z0-9_\-]{8,128}$")


def validate_session_id(x_session_id: Optional[str], required: bool = True) -> Optional[str]:
    if not x_session_id or not x_session_id.strip():
        if required:
            raise HTTPException(
                status_code=400,
                detail="Missing X-Session-ID header. A valid session ID is required to isolate analysis history."
            )
        return None
    cleaned = x_session_id.strip()
    if not SESSION_ID_REGEX.match(cleaned):
        raise HTTPException(
            status_code=400,
            detail="Invalid X-Session-ID header format. Must be 8-128 alphanumeric characters, hyphens, or underscores."
        )
    return cleaned

app = FastAPI(title="TrustLens AI", version="0.2.0")
origins = [
    os.getenv("FRONTEND_ORIGIN", "http://localhost:5173"),
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"], allow_headers=["*"],
)
db.init_db()

DEMO_IDS = list(DEMO_CASES.keys())


def not_enabled(feature: str, phase: str) -> JSONResponse:
    """Honest 501: live analysis is not built yet, but the app must not crash."""
    return JSONResponse(status_code=501, content={
        "error": "live_analysis_not_enabled",
        "message": f"{feature} is not enabled in this build ({phase}). Use a demo case instead.",
        "demo_available": True, "demo_ids": DEMO_IDS})


# ------------------------------------------------------------------- health
@app.get("/api/health")
def health():
    g, t = gemini_service.is_configured(), tavily_service.is_configured()
    return {
        "status": "ok", "mode": "live-ready" if (g or t) else "demo-only", "version": app.version,
        "features": {
            "demo_mode": "ready",
            "scoring_engine": "ready",
            "gemini": "configured" if g else "not configured (claims use simple rules; evidence cannot be classified)",
            "tavily": "configured" if t else "not configured",
            "backup_search": "Wikipedia API (free, no key)" if fallback_search.enabled() else "off",
            "ocr": "ready" if shutil.which("tesseract") else "tesseract not installed",
            "ffmpeg": "ready" if media_processor.ffmpeg_available() else "ffmpeg not installed (video audio unavailable)",
        },
    }


@app.get("/api/gemini/test")
def gemini_test():
    """Confirms GEMINI_API_KEY works and shows which model answered. Never exposes the key."""
    return gemini_service.self_test()


@app.get("/api/tavily/test")
def tavily_test():
    """Confirms TAVILY_API_KEY works (uses 1 free-tier credit). Never exposes the key."""
    return tavily_service.self_test()


# --------------------------------------------------------------------- demo
@app.get("/api/demo")
def list_demos():
    return [{"id": d["id"], "label": d["label"], "tagline": d["tagline"],
             "input_type": d["input"]["type"], "title": d["input"]["title"]} for d in DEMO_CASES.values()]


@app.get("/api/demo/{demo_id}")
def run_demo(demo_id: str, x_session_id: Optional[str] = Header(None, alias="X-Session-ID")):
    s_id = validate_session_id(x_session_id, required=False)
    raw = DEMO_CASES.get(demo_id)
    if not raw:
        return JSONResponse(status_code=404, content={"error": "unknown_demo", "demo_ids": DEMO_IDS})
    case = build_case(raw, mode="demo")
    db.save_case(case, session_id=s_id)
    return case


# --------------------------------------------------------------------- cases & history
@app.get("/api/case/{case_id}")
def get_case(case_id: str, x_session_id: Optional[str] = Header(None, alias="X-Session-ID")):
    s_id = validate_session_id(x_session_id, required=False)
    case = db.get_case(case_id, session_id=s_id)
    if not case:
        return JSONResponse(status_code=404, content={"error": "case_not_found"})
    return case


@app.get("/api/cases")
def recent_cases():
    return db.list_cases()


@app.get("/api/history")
def get_history_list(
    type: Optional[str] = Query(None),
    limit: int = Query(50),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    s_id = validate_session_id(x_session_id, required=True)
    return db.list_history(session_id=s_id, analysis_type=type, limit=limit)


@app.get("/api/history/{history_id}")
def get_history_detail(
    history_id: str,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    s_id = validate_session_id(x_session_id, required=True)
    case = db.get_history(history_id, session_id=s_id)
    if not case:
        return JSONResponse(status_code=404, content={"error": "history_not_found",
                                                      "message": f"History item '{history_id}' not found."})
    return case


@app.delete("/api/history/{history_id}")
def delete_history_item(
    history_id: str,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    s_id = validate_session_id(x_session_id, required=True)
    deleted = db.delete_history(history_id, session_id=s_id)
    if not deleted:
        return JSONResponse(status_code=404, content={"error": "history_not_found",
                                                      "message": f"History item '{history_id}' not found."})
    return {"deleted": True, "id": history_id}


@app.delete("/api/history")
def clear_all_history(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    s_id = validate_session_id(x_session_id, required=True)
    count = db.clear_history(session_id=s_id)
    return {"deleted": True, "count": count}


# ------------------------------------------------------------ live analysis
MAX_UPLOAD = 25 * 1024 * 1024


def live_error(e: Exception) -> JSONResponse:
    if isinstance(e, live.LiveError):
        return JSONResponse(status_code=e.status, content={"error": e.code, "message": str(e), "demo_available": True,
                                                           "demo_ids": DEMO_IDS})
    return JSONResponse(status_code=500, content={"error": "analysis_failed", "demo_available": True, "demo_ids": DEMO_IDS,
                                                  "message": f"Analysis failed unexpectedly ({type(e).__name__}). Try again or use a demo."})


async def read_upload(f: UploadFile) -> bytes:
    data = await f.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise live.LiveError("File is larger than 25 MB. Upload a shorter or smaller file.")
    return data


async def read_refs(references: Optional[List[UploadFile]], reference_text: str):
    raw = []
    for f in references or []:
        if f.filename:
            raw.append((f.filename, await read_upload(f)))
    return live.read_refs(raw, reference_text)


def finish(case, **kwargs):
    db.save_case(case, **kwargs)
    return case


@app.post("/api/analyze/text")
async def analyze_text(
    text: str = Form(""),
    reference_text: str = Form(""),
    references: Optional[List[UploadFile]] = File(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    """Text claim to verify. Optional reference documents/pasted text are used as extra evidence."""
    try:
        s_id = validate_session_id(x_session_id, required=False)
        cache_key = None
        if not references and not (reference_text or "").strip():
            cache_key = cache_service.text_cache_key(text)
            cached = db.get_by_cache_key(cache_key, session_id=s_id)
            if cached:
                return cached

        refs, warns = await read_refs(references, reference_text)
        t0 = time.perf_counter()
        case = live.analyze_text(text, refs, warns)
        dur = int((time.perf_counter() - t0) * 1000)
        return finish(case, session_id=s_id, cache_key=cache_key, processing_time_ms=dur)
    except Exception as e:  # noqa: BLE001
        return live_error(e)


@app.post("/api/analyze/document")
async def analyze_document(
    file: UploadFile = File(...),
    reference_text: str = Form(""),
    references: Optional[List[UploadFile]] = File(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    """A .txt/.md/.pdf/.docx whose claims are verified."""
    try:
        s_id = validate_session_id(x_session_id, required=False)
        data = await read_upload(file)
        cache_key = None
        if not references and not (reference_text or "").strip():
            cache_key = cache_service.media_cache_key("document", caption="", content_bytes=data)
            cached = db.get_by_cache_key(cache_key, session_id=s_id)
            if cached:
                return cached

        refs, warns = await read_refs(references, reference_text)
        t0 = time.perf_counter()
        case = live.analyze_document(file.filename or "document", data, refs, warns)
        dur = int((time.perf_counter() - t0) * 1000)
        return finish(case, session_id=s_id, cache_key=cache_key, processing_time_ms=dur,
                      original_filename=file.filename,
                      content_hash=hashlib.sha256(data).hexdigest())
    except Exception as e:  # noqa: BLE001
        return live_error(e)


@app.post("/api/analyze/image")
async def analyze_image(
    file: UploadFile = File(...),
    caption: str = Form(""),
    reference_text: str = Form(""),
    references: Optional[List[UploadFile]] = File(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    try:
        s_id = validate_session_id(x_session_id, required=False)
        data = await read_upload(file)
        cache_key = None
        if not references and not (reference_text or "").strip():
            cache_key = cache_service.media_cache_key("image", caption=caption, content_bytes=data)
            cached = db.get_by_cache_key(cache_key, session_id=s_id)
            if cached:
                return cached

        refs, warns = await read_refs(references, reference_text)
        t0 = time.perf_counter()
        case = live.analyze_image(data, file.filename or "image", file.content_type or "image/jpeg",
                                 caption, refs, warns)
        dur = int((time.perf_counter() - t0) * 1000)
        return finish(case, session_id=s_id, cache_key=cache_key, processing_time_ms=dur,
                      original_filename=file.filename, mime_type=file.content_type,
                      content_hash=hashlib.sha256(data).hexdigest())
    except Exception as e:  # noqa: BLE001
        return live_error(e)


@app.post("/api/analyze/audio")
async def analyze_audio(
    file: UploadFile = File(...),
    transcript: str = Form(""),
    reference_text: str = Form(""),
    references: Optional[List[UploadFile]] = File(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    try:
        s_id = validate_session_id(x_session_id, required=False)
        data = await read_upload(file)
        cache_key = None
        if not references and not (reference_text or "").strip():
            cache_key = cache_service.media_cache_key("audio", caption=transcript, content_bytes=data)
            cached = db.get_by_cache_key(cache_key, session_id=s_id)
            if cached:
                return cached

        refs, warns = await read_refs(references, reference_text)
        t0 = time.perf_counter()
        case = live.analyze_audio(data, file.filename or "audio", file.content_type or "audio/mpeg",
                                 transcript, refs, warns)
        dur = int((time.perf_counter() - t0) * 1000)
        return finish(case, session_id=s_id, cache_key=cache_key, processing_time_ms=dur,
                      original_filename=file.filename, mime_type=file.content_type,
                      content_hash=hashlib.sha256(data).hexdigest())
    except Exception as e:  # noqa: BLE001
        return live_error(e)


@app.post("/api/analyze/video")
async def analyze_video(
    file: UploadFile = File(...),
    transcript: str = Form(""),
    reference_text: str = Form(""),
    references: Optional[List[UploadFile]] = File(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    try:
        s_id = validate_session_id(x_session_id, required=False)
        data = await read_upload(file)
        cache_key = None
        if not references and not (reference_text or "").strip():
            cache_key = cache_service.media_cache_key("video", caption=transcript, content_bytes=data)
            cached = db.get_by_cache_key(cache_key, session_id=s_id)
            if cached:
                return cached

        refs, warns = await read_refs(references, reference_text)
        t0 = time.perf_counter()
        case = live.analyze_video(data, file.filename or "video.mp4", transcript, refs, warns)
        dur = int((time.perf_counter() - t0) * 1000)
        return finish(case, session_id=s_id, cache_key=cache_key, processing_time_ms=dur,
                      original_filename=file.filename,
                      content_hash=hashlib.sha256(data).hexdigest())
    except Exception as e:  # noqa: BLE001
        return live_error(e)


@app.post("/api/search-evidence")
def search_evidence(req: SearchEvidenceRequest):
    """Raw Tavily search for one claim (uses free-tier credits)."""
    try:
        return {"claim": req.claim, "results": tavily_service.search(req.claim, req.max_results)}
    except tavily_service.TavilyError as e:
        return JSONResponse(status_code=503, content={"error": f"tavily_{e.kind}", "message": str(e), "demo_available": True,
                                                      "hint": "Use /api/calculate-trust to supply evidence manually."})


@app.post("/api/classify-evidence")
def classify_evidence(req: ClassifyEvidenceRequest):
    """Ask Gemini whether one snippet supports, contradicts or is neutral to a claim."""
    try:
        res = gemini_service.classify_evidence(req.claim, [{"id": "x", "title": req.title, "snippet": req.snippet}])
        return {"claim": req.claim, **res.get("x", {"classification": "NEUTRAL", "reasoning": "No label returned."})}
    except gemini_service.GeminiError as e:
        return JSONResponse(status_code=503, content={"error": f"gemini_{e.kind}", "message": str(e), "demo_available": True})


# ---------------------------------------------- scoring (works right now)
@app.post("/api/calculate-trust")
def calculate_trust(
    req: CalculateTrustRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
):
    """Run the REAL scoring engine on evidence you supply yourself."""
    s_id = validate_session_id(x_session_id, required=False)
    raw = {
        "input": {"type": req.input_type, "title": "Manual scoring request", "text": req.input_text,
                  "extraction_method": "Supplied through /api/calculate-trust"},
        "manipulation": {"applicable": req.manipulation_applicable,
                         "indicators": [i.model_dump() for i in req.manipulation_indicators]},
        "claims": [],
    }
    for i, c in enumerate(req.claims, start=1):
        d = c.model_dump()
        d["id"] = d["id"] or f"c{i}"
        for j, e in enumerate(d["evidence"], start=1):
            e["id"] = e["id"] or f"{d['id']}e{j}"
        raw["claims"].append(d)
    case = build_case(raw, mode="manual")
    db.save_case(case, session_id=s_id)
    return case
