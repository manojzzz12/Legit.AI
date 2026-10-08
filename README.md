# TrustLens AI - Multimodal Digital Trust & Evidence Verification

**Phase 2-4 added: live analysis. Evidence now comes from what the user submits, not from fixtures.**

How a live case works:
1. You submit text, a document (.txt/.md/.pdf/.docx), an image, audio or a short video (+ optional reference evidence).
2. Text is extracted (document reader, Tesseract OCR, Gemini speech-to-text, bundled FFmpeg audio extraction + OpenCV frames).
3. Gemini extracts claims; only factual claims continue.
4. Evidence per claim = Tavily web search results (max `MAX_SEARCHES_PER_CASE` claims) + matching passages from reference documents you attach.
5. Gemini labels each snippet SUPPORTS / CONTRADICTS / NEUTRAL with a reason. The backend scoring engine computes everything else.
6. Without keys the app still runs: demo scenarios always work, and live mode explains what is missing (it never invents evidence).

Video checks transcribe the audio track and inspect on-screen text plus visual content from one sampled frame per second, for up to the first two minutes. Sampling is time-spaced rather than a scan of every encoded frame; the result displays selected frame previews while OCR and visual analysis run over all sampled frames. FFmpeg is bundled through the backend dependency, and the existing six-claim search budget still applies.

Demo scenarios remain pre-recorded fixtures and are labelled simulated.

## Project structure

```
trustlens/
├── backend/
│   ├── main.py                      FastAPI app + all endpoints
│   ├── requirements.txt
│   ├── .env.example                 GEMINI_API_KEY, TAVILY_API_KEY (empty for demo mode)
│   ├── models/schemas.py            request models
│   ├── database/database.py         SQLite store (stdlib sqlite3)
│   ├── demo/demo_cases.py           the 3 demo scenarios (raw inputs only)
│   ├── services/
│   │   ├── pipeline.py              raw case -> full analysis result (used by demos AND /api/calculate-trust)
│   │   ├── scoring_engine.py        trust score, confidence, decision rules (REAL, no AI)
│   │   ├── evidence_engine.py       source reliability heuristics, provenance, contradictions (REAL)
│   │   ├── gemini_service.py        stub - Phase 2
│   │   ├── claim_extractor.py       stub - Phase 2
│   │   ├── tavily_service.py        stub - Phase 3
│   │   ├── ocr_service.py           stub - Phase 4
│   │   └── media_processor.py       stub - Phase 4
│   └── tests/test_demos.py          9 tests covering all 3 scenarios
└── frontend/
    ├── vite.config.js               proxies /api -> http://127.0.0.1:8000
    └── src/
        ├── App.jsx, main.jsx, index.css
        ├── pages/Dashboard.jsx
        ├── services/api.js
        └── components/              VerdictCard, ClaimsPanel, EvidenceList, ContradictionPanel, ...
```

## Install

Backend (Python 3.10+):
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # leave keys empty for demo mode
```

Frontend (Node 18+):
```bash
cd frontend
npm install
```

## Run

Terminal 1 - backend:
```bash
cd backend
uvicorn main:app --reload --port 8000
```
API docs: http://127.0.0.1:8000/docs

Terminal 2 - frontend:
```bash
cd frontend
npm run dev
```
Open http://localhost:5173

## Test the three demos

Click a demo card at the top of the page.

| Demo | Input | Expected result |
|------|-------|-----------------|
| 1 Genuine | text | Score ~95, **TRUSTED**, confidence ~92% (High), all sources support |
| 2 Suspicious | image | Score ~30, **HIGH RISK**, manipulation level ~80%, official sources contradict |
| 3 Conflicting | video | Score ~78 but decision **INCONCLUSIVE**, confidence ~43% (Low), contradiction panel shown |

Demo 3 is the key one: the raw score would read LIKELY TRUSTED, and the forced-INCONCLUSIVE rule overrides it.

Command-line check: `curl http://127.0.0.1:8000/api/demo/demo3`
Automated check: `cd backend && pytest -q`

## How scoring works (all in `services/scoring_engine.py`)

* Trust = evidence support 35% + supporting-source reliability 25% + agreement 20% + manipulation (inverted) 10% + provenance completeness 10%.
  For text input the manipulation signal does not apply, so its weight is shared by the others instead of being faked.
* Confidence is calculated separately (evidence count, consensus, reliability, source independence, provenance), capped at 95%, and capped lower when evidence conflicts (45%) or is insufficient (35%).
* The decision is forced to **INCONCLUSIVE** when a high/medium-importance claim has conflicting reliable sources or fewer than 2 decisive sources, when confidence is below 25%, or when strong manipulation indicators coexist with otherwise-supportive evidence.
* Bands: 90-100 TRUSTED, 70-89 LIKELY TRUSTED, 40-69 INCONCLUSIVE, 20-39 HIGH RISK, 0-19 VERY HIGH RISK.
* All weights and thresholds are prototype heuristics, not scientifically validated.

## API

| Endpoint | Status in Phase 1 |
|----------|-------------------|
| GET /api/health | works |
| GET /api/demo, GET /api/demo/{demo_id} | works |
| GET /api/case/{case_id}, GET /api/cases | works (SQLite) |
| POST /api/calculate-trust | works - runs the real scoring engine on evidence you send |
| POST /api/analyze/text, image, audio, video | returns 501 with a clear message and the demo ids |
| POST /api/search-evidence, /api/classify-evidence | returns 501 (Tavily / Gemini phases) |

## Implemented vs simulated (Phase 1)

**Real, running code:** scoring engine, confidence logic, decision rules and overrides, source reliability rules, provenance completeness, contradiction detection, evidence trail, rule-based conclusion text, SQLite storage, all API endpoints listed as "works", full dashboard.

**Simulated (pre-recorded fixtures, clearly labelled in the UI):** the sources/snippets/URLs, the evidence classification (what Gemini will do), OCR text, transcript, sampled frames, and manipulation indicator measurements (what OpenCV/FFmpeg will do). Demo 1 uses real public facts with simulated retrievals; Demos 2 and 3 use fictional events and reserved `.example` domains so nothing is attributed to a real outlet.

**Not built yet:** Gemini calls, Tavily search, Tesseract OCR, OpenCV analysis, FFmpeg audio/frame extraction, deployment config.

## Next phases

2. Gemini: claim extraction + evidence classification (key from `GEMINI_API_KEY`, backend only).
3. Tavily: search 1 query per important claim, max 4 results (key from `TAVILY_API_KEY`).
4. Image/audio/video: Tesseract, OpenCV indicators, FFmpeg audio + one frame per second, manual transcript fallback.
5. Deployment (free tiers), 2-minute demo script, final polish.
