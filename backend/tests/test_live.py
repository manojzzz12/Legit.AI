"""Live pipeline tests. Gemini and Tavily are replaced with fakes, so no keys or network are needed.

The point: evidence is derived from what the USER submits, and changing the input changes the verdict.
"""
import io

import pytest
from fastapi.testclient import TestClient

from main import app
from services import gemini_service as gem
from services import fallback_search as wiki
from services import tavily_service as tav

client = TestClient(app)
CLAIM = "The Riverside Bridge opened to traffic on 4 May 2021."


@pytest.fixture(autouse=True)
def fakes(monkeypatch):
    from database import database as db
    db.init_db()
    db.clear_history()
    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    monkeypatch.setenv("TAVILY_API_KEY", "fake")
    monkeypatch.setattr(gem, "extract_claims", lambda text, files=None, max_claims=6, extra="": {
        "summary": "A bridge claim", "claims": [
            {"claim": CLAIM, "importance": "high", "type": "factual", "search_query": "Riverside Bridge opening date"},
            {"claim": "It is a beautiful bridge.", "importance": "low", "type": "opinion"}]})

    def fake_classify(claim, items):  # naive: snippet mentioning "4 May 2021" supports, "closed"/"2019" contradicts
        out = {}
        for i in items:
            s = i["snippet"].lower()
            c = "SUPPORTS" if "4 may 2021" in s else "CONTRADICTS" if "2019" in s else "NEUTRAL"
            out[i["id"]] = {"classification": c, "reasoning": f"fake: {c}"}
        return out
    monkeypatch.setattr(gem, "classify_evidence", fake_classify)
    monkeypatch.setattr(tav, "search", lambda q, max_results=5, **kw: [])
    monkeypatch.setattr(wiki, "search", lambda q, max_results=2: [])   # never hit the real network in tests


def post(text, ref_text="", refs=None):
    files = [("references", (n, io.BytesIO(b), "text/plain")) for n, b in (refs or [])]
    return client.post("/api/analyze/text", data={"text": text, "reference_text": ref_text}, files=files or None)


def test_evidence_comes_from_user_reference_and_is_labelled_not_independent():
    r = post(CLAIM, "Council record: the Riverside Bridge opened to traffic on 4 May 2021 after repairs.")
    case = r.json()
    assert case["mode"] == "live"
    ev = case["claims"][0]["evidence"]
    assert ev and ev[0]["classification"] == "SUPPORTS" and ev[0]["source_type"] == "user_provided"
    assert ev[0]["simulated"] is False and ev[0]["reliability"] == 0.5
    assert case["claims"][1]["status"] == "NOT VERIFIED"           # opinion is skipped
    assert any("supplied" in c for c in case["conclusion"]["caveats"])


def test_changing_the_document_changes_the_evidence():
    sup = post(CLAIM, "The Riverside Bridge opened to traffic on 4 May 2021.").json()["claims"][0]["evidence"]
    con = post(CLAIM, "The Riverside Bridge opened to traffic in 2019, not later.").json()["claims"][0]["evidence"]
    assert sup[0]["classification"] == "SUPPORTS" and con[0]["classification"] == "CONTRADICTS"


def test_one_user_document_cannot_reach_trusted():
    o = post(CLAIM, "The Riverside Bridge opened to traffic on 4 May 2021.").json()["overall"]
    assert o["decision"] == "INCONCLUSIVE"        # a single decisive item is "insufficient"


def test_web_results_are_scored_and_conflict_is_inconclusive(monkeypatch):
    def results(q, max_results=5, **kw):
        base = {"retrieved_at": "2026-10-08T10:00:00+00:00"}
        return [{**base, "title": "A", "url": "https://www.reuters.com/a", "domain": "www.reuters.com", "snippet": "Opened 4 May 2021."},
                {**base, "title": "B", "url": "https://www.bbc.com/b", "domain": "www.bbc.com", "snippet": "It opened in 2019."},
                {**base, "title": "C", "url": "https://x.example/c", "domain": "x.example", "snippet": "Unrelated."}]
    monkeypatch.setattr(tav, "search", results)
    case = post(CLAIM).json()
    c = case["claims"][0]
    assert c["counts"] == {"supports": 1, "contradicts": 1, "neutral": 1}
    assert c["conflict"] and case["overall"]["decision"] == "INCONCLUSIVE" and case["contradictions"]
    assert all(e["processing_method"].startswith("Tavily") for e in c["evidence"])


def test_no_gemini_means_unclassified_not_invented(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY")
    monkeypatch.setattr(tav, "search", lambda q, max_results=5, **kw: [
        {"title": "A", "url": "https://www.reuters.com/a", "domain": "www.reuters.com", "snippet": "Opened 4 May 2021.",
         "retrieved_at": "2026-10-08T10:00:00+00:00"}])
    case = post("The Riverside Bridge opened to traffic on 4 May 2021. It carries 40000 vehicles a day.").json()
    assert case["overall"]["decision"] == "INCONCLUSIVE"
    assert case["warnings"] and all(e["classification"] == "NEUTRAL" for c in case["claims"] for e in c["evidence"])


def test_document_upload_and_bad_type():
    ok = client.post("/api/analyze/document", files={"file": ("claim.txt", io.BytesIO(CLAIM.encode()), "text/plain")},
                     data={"reference_text": CLAIM})
    assert ok.status_code == 200 and ok.json()["input"]["type"] == "text"
    bad = client.post("/api/analyze/document", files={"file": ("x.exe", io.BytesIO(b"zz"), "application/octet-stream")})
    assert bad.status_code == 400


def test_image_pipeline_runs_locally(monkeypatch):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (320, 240), (200, 200, 200)).save(buf, "JPEG")
    monkeypatch.setattr(gem, "describe_image", lambda *a, **k: {"description": "A grey card", "visible_text": "",
                                                              "visual_anomalies": [{"observation": "odd shadow", "level": "medium"}]})
    r = client.post("/api/analyze/image", files={"file": ("a.jpg", io.BytesIO(buf.getvalue()), "image/jpeg")},
                    data={"caption": CLAIM, "reference_text": "Riverside Bridge opened to traffic on 4 May 2021."})
    case = r.json()
    assert r.status_code == 200 and case["manipulation"]["applicable"] and case["input"]["preview"].startswith("data:image")
    assert any("Gemini" in i["method"] for i in case["manipulation"]["indicators"])


def test_audio_without_transcript_or_gemini_asks_for_manual_transcript(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY")
    r = client.post("/api/analyze/audio", files={"file": ("a.mp3", io.BytesIO(b"123"), "audio/mpeg")})
    assert r.status_code == 400 and "transcript" in r.json()["message"].lower()


def test_gemini_selftest_never_leaks_key_and_reports_model(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "SECRET-KEY-123")
    monkeypatch.setattr(gem, "generate", lambda *a, **k: {"ok": True})
    body = client.get("/api/gemini/test").text
    assert '"ok":true' in body.replace(" ", "") and "SECRET-KEY-123" not in body


def test_gemini_selftest_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY")
    assert client.get("/api/gemini/test").json()["error"] == "not_configured"


def test_every_factual_claim_is_searched_and_classified_separately(monkeypatch):
    claims = [{"claim": f"Fact number {i} happened on 4 May 2021.", "importance": "medium", "type": "factual",
               "search_query": f"fact {i}"} for i in range(1, 4)] + [{"claim": "I love it.", "importance": "low", "type": "opinion"}]
    monkeypatch.setattr(gem, "extract_claims", lambda *a, **k: {"summary": "", "claims": claims})
    queries = []

    def search(q, max_results=5, **kw):
        queries.append(q)
        return [{"title": "T", "url": f"https://www.reuters.com/{q}", "domain": "www.reuters.com",
                 "snippet": "Happened 4 May 2021.", "retrieved_at": "2026-10-08T10:00:00+00:00"}]
    monkeypatch.setattr(tav, "search", search)
    case = post("Fact number 1 happened on 4 May 2021. Fact number 2 happened. Fact number 3 happened.").json()
    assert sorted(queries) == ["fact 1", "fact 2", "fact 3"]                  # opinion not searched
    facts = [c for c in case["claims"] if c["verifiable"]]
    assert len(facts) == 3 and all(c["evidence"][0]["classification"] == "SUPPORTS" for c in facts)


def test_own_source_domain_is_excluded_from_evidence(monkeypatch):
    seen = {}

    def search(q, max_results=5, exclude_domains=None, **kw):
        seen["ex"] = list(exclude_domains or [])
        return []
    monkeypatch.setattr(tav, "search", search)
    post("Per https://rumour-site.example/post/1 the Riverside Bridge opened on 4 May 2021.")
    assert "rumour-site.example" in seen["ex"]


def test_tavily_client_keeps_one_result_per_domain(monkeypatch):
    import httpx
    sent = {}

    class R:
        status_code = 200

        def json(self):
            return {"results": [
                {"url": "https://www.bbc.com/a", "title": "A", "content": "x"},
                {"url": "https://bbc.com/b", "title": "B", "content": "y"},
                {"url": "https://skip.example/c", "title": "C", "content": "z"},
                {"url": "https://www.reuters.com/d", "title": "D", "content": "w"}]}

    def post_(url, headers=None, json=None, timeout=None):
        sent.update(json=json, auth=headers["Authorization"])
        return R()
    monkeypatch.undo()
    monkeypatch.setenv("TAVILY_API_KEY", "k")
    monkeypatch.setattr(httpx, "post", post_)
    out = tav.search("q", max_results=5, exclude_domains=["skip.example"])
    assert [o["domain"] for o in out] == ["www.bbc.com", "www.reuters.com"]
    assert sent["json"]["exclude_domains"] == ["skip.example"] and sent["auth"] == "Bearer k"


def test_tavily_selftest_hides_key(monkeypatch):
    monkeypatch.setenv("TAVILY_API_KEY", "SECRET-T")
    monkeypatch.setattr(tav, "search", lambda *a, **k: [{"x": 1}])
    body = client.get("/api/tavily/test").text
    assert "SECRET-T" not in body and '"ok":true' in body.replace(" ", "")


WIKI_HIT = [{"title": "Riverside Bridge", "url": "https://en.wikipedia.org/wiki/Riverside_Bridge", "domain": "en.wikipedia.org",
             "snippet": "The bridge opened to traffic on 4 May 2021.", "retrieved_at": "2026-10-08T10:00:00+00:00"}]


def test_wikipedia_backup_used_when_tavily_fails(monkeypatch):
    def boom(*a, **k):
        raise tav.TavilyError("quota", "Tavily free-tier quota or rate limit reached.")
    monkeypatch.setattr(tav, "search", boom)
    monkeypatch.setattr(wiki, "search", lambda q, max_results=2: WIKI_HIT)
    case = post(CLAIM).json()
    ev = case["claims"][0]["evidence"][0]
    assert ev["source_type"] == "encyclopedia" and ev["reliability"] == 0.65 and ev["classification"] == "SUPPORTS"
    assert ev["processing_method"].startswith("Wikipedia") and any("Tavily failed" in w for w in case["warnings"])


def test_wikipedia_backup_used_when_no_tavily_key(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY")
    monkeypatch.setattr(wiki, "search", lambda q, max_results=2: WIKI_HIT)
    case = post(CLAIM).json()
    assert case["claims"][0]["evidence"] and any("Wikipedia backup" in w for w in case["warnings"])


def test_both_searches_down_still_returns_inconclusive_not_crash(monkeypatch):
    monkeypatch.setattr(tav, "search", lambda *a, **k: (_ for _ in ()).throw(tav.TavilyError("network", "down")))

    def nowiki(*a, **k):
        raise ConnectionError("offline")
    monkeypatch.setattr(wiki, "search", nowiki)
    r = post(CLAIM)
    assert r.status_code == 200 and r.json()["overall"]["decision"] == "INCONCLUSIVE"
    assert any("Wikipedia" in w for w in r.json()["warnings"])


def test_image_upload_reads_text_with_real_ocr_and_feeds_claims(monkeypatch):
    import shutil
    if shutil.which("tesseract") is None:
        pytest.skip("tesseract not installed")
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new("RGB", (900, 160), "white")
    ImageDraw.Draw(img).text((20, 40), "ATMs will remain CLOSED for 10 days", fill="black", font=ImageFont.load_default(size=44))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    seen = {}
    monkeypatch.setattr(gem, "describe_image", lambda *a, **k: {"description": "A notice", "visible_text": "", "visual_anomalies": []})
    monkeypatch.setattr(gem, "extract_claims", lambda text, *a, **k: seen.update(text=text) or {"claims": [
        {"claim": "ATMs will be closed for 10 days.", "importance": "high", "type": "factual", "search_query": "ATMs closed 10 days"}]})
    r = client.post("/api/analyze/image", files={"file": ("n.png", io.BytesIO(buf.getvalue()), "image/png")})
    case = r.json()
    assert r.status_code == 200 and "CLOSED" in case["input"]["ocr_text"]
    assert "CLOSED" in seen["text"]                                   # OCR text reached claim extraction
    assert "OCR confidence" in case["input"]["metadata"] and "OpenCV" in case["input"]["extraction_method"]
