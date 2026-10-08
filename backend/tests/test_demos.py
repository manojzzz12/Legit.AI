"""Run with:  pytest -q   (from the backend folder)"""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def get(demo_id):
    r = client.get(f"/api/demo/{demo_id}")
    assert r.status_code == 200
    return r.json()


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_demo1_genuine_is_trusted():
    o = get("demo1")["overall"]
    assert o["decision"] == "TRUSTED"
    assert o["trust_score"] >= 90 and o["confidence"] >= 0.75


def test_demo2_manipulated_is_high_risk():
    case = get("demo2")
    assert case["overall"]["decision"] in ("HIGH RISK", "VERY HIGH RISK")
    assert case["manipulation"]["risk"] >= 0.6


def test_demo3_conflict_is_inconclusive_even_if_score_is_high():
    o = get("demo3")["overall"]
    assert o["decision"] == "INCONCLUSIVE"
    assert o["forced_inconclusive"] is True        # raw band was higher than INCONCLUSIVE
    assert o["confidence"] <= 0.60


def test_demo3_has_contradiction_panel_and_insufficient_claim():
    case = get("demo3")
    assert case["contradictions"], "expected a conflicting evidence panel"
    c2 = next(c for c in case["claims"] if c["id"] == "c2")
    assert c2["insufficient"] and c2["status"] == "INCONCLUSIVE"


def test_opinions_are_not_verified():
    c3 = next(c for c in get("demo1")["claims"] if c["id"] == "c3")
    assert c3["status"] == "NOT VERIFIED" and c3["evidence"] == []


def test_case_is_stored_and_retrievable():
    cid = get("demo1")["case_id"]
    assert client.get(f"/api/case/{cid}").json()["case_id"] == cid


def test_no_evidence_is_inconclusive():
    body = {"claims": [{"claim": "Something unverifiable happened.", "importance": "high", "type": "factual"}]}
    o = client.post("/api/calculate-trust", json=body).json()["overall"]
    assert o["decision"] == "INCONCLUSIVE" and o["confidence"] < 0.25


def test_live_without_keys_fails_gracefully(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    r = client.post("/api/analyze/text", data={"text": "The bridge opened to traffic on 4 May 2021."})
    assert r.status_code == 503 and r.json()["demo_available"] is True
