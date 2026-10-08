"""TrustLens AI - FastAPI backend (demo mode + live analysis).

Run:  uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import os
import shutil
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile
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
from services import fallback_search, gemini_service, live_pipeline as live, media_processor, tavily_service  # noqa: E402
from services.pipeline import build_case  # noqa: E402

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
def run_demo(demo_id: str):
    raw = DEMO_CASES.get(demo_id)
    if not raw:
        return JSONResponse(status_code=404, content={"error": "unknown_demo", "demo_ids": DEMO_IDS})
    case = build_case(raw, mode="demo")
    db.save_case(case)
    return case


# --------------------------------------------------------------------- cases
@app.get("/api/case/{case_id}")
def get_case(case_id: str):
    case = db.get_case(case_id)
    if not case:
        return JSONResponse(status_code=404, content={"error": "case_not_found"})
    return case


@app.get("/api/cases")
def recent_cases():
    return db.list_cases()


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


def finish(case):
    db.save_case(case)
    return case


@app.post("/api/analyze/text")
async def analyze_text(text: str = Form(""), reference_text: str = Form(""),
                       references: Optional[List[UploadFile]] = File(None)):
    """Text claim to verify. Optional reference documents/pasted text are used as extra evidence."""
    try:
        refs, warns = await read_refs(references, reference_text)
        return finish(live.analyze_text(text, refs, warns))
    except Exception as e:  # noqa: BLE001
        return live_error(e)


@app.post("/api/analyze/document")
async def analyze_document(file: UploadFile = File(...), reference_text: str = Form(""),
                           references: Optional[List[UploadFile]] = File(None)):
    """A .txt/.md/.pdf/.docx whose claims are verified."""
    try:
        refs, warns = await read_refs(references, reference_text)
        return finish(live.analyze_document(file.filename or "document", await read_upload(file), refs, warns))
    except Exception as e:  # noqa: BLE001
        return live_error(e)


@app.post("/api/analyze/image")
async def analyze_image(file: UploadFile = File(...), caption: str = Form(""), reference_text: str = Form(""),
                        references: Optional[List[UploadFile]] = File(None)):
    try:
        refs, warns = await read_refs(references, reference_text)
        return finish(live.analyze_image(await read_upload(file), file.filename or "image", file.content_type or "image/jpeg",
                                         caption, refs, warns))
    except Exception as e:  # noqa: BLE001
        return live_error(e)


@app.post("/api/analyze/audio")
async def analyze_audio(file: UploadFile = File(...), transcript: str = Form(""), reference_text: str = Form(""),
                        references: Optional[List[UploadFile]] = File(None)):
    try:
        refs, warns = await read_refs(references, reference_text)
        return finish(live.analyze_audio(await read_upload(file), file.filename or "audio", file.content_type or "audio/mpeg",
                                         transcript, refs, warns))
    except Exception as e:  # noqa: BLE001
        return live_error(e)


@app.post("/api/analyze/video")
async def analyze_video(file: UploadFile = File(...), transcript: str = Form(""), reference_text: str = Form(""),
                        references: Optional[List[UploadFile]] = File(None)):
    try:
        refs, warns = await read_refs(references, reference_text)
        return finish(live.analyze_video(await read_upload(file), file.filename or "video.mp4", transcript, refs, warns))
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
def calculate_trust(req: CalculateTrustRequest):
    """Run the REAL scoring engine on evidence you supply yourself."""
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
    db.save_case(case)
    return case
