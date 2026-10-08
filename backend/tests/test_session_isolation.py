"""Tests for cross-user browser session isolation, ownership enforcement, and cache boundaries."""
import io
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from database import database as db
from fastapi.testclient import TestClient
from main import app
from PIL import Image

client = TestClient(app)

SESSION_A = "user-session-aaaa-1111"
SESSION_B = "user-session-bbbb-2222"
SESSION_C = "user-session-cccc-3333"


@pytest.fixture(autouse=True)
def clean_db():
    db.init_db()
    db.clear_history()
    yield
    db.clear_history()


def sample_case(case_id="case-1", session_id=SESSION_A, text="Sample factual claim.", decision="TRUSTED"):
    return {
        "case_id": case_id,
        "session_id": session_id,
        "mode": "live",
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "input": {
            "type": "text",
            "title": "Claim title",
            "text": text,
            "sha256": "123456abcdef",
        },
        "claims": [
            {
                "id": "c1",
                "claim": text,
                "importance": "high",
                "type": "factual",
                "verifiable": True,
                "evidence": [
                    {
                        "id": "e1",
                        "title": "Reference source",
                        "url": "https://example.org",
                        "domain": "example.org",
                        "classification": "SUPPORTS",
                        "reliability": 0.9,
                    }
                ],
            }
        ],
        "warnings": [],
        "manipulation": {"applicable": False, "risk": 0.0, "indicators": []},
        "overall": {
            "trust_score": 90.0,
            "raw_band": decision,
            "decision": decision,
            "forced_inconclusive": False,
            "force_reasons": [],
            "confidence": 0.85,
            "confidence_label": "High",
            "components": [],
        },
        "evidence_summary": {"total": 1, "counts": {"SUPPORTS": 1, "CONTRADICTS": 0, "NEUTRAL": 0}},
        "contradictions": [],
        "trail": [],
        "conclusion": {"headline": "Claim is supported.", "reasoning": ["Solid proof."], "caveats": []},
        "heuristics": {},
    }


def test_session_isolation_in_history_listing():
    # Session A has two items
    db.save_case(sample_case("case-a1", session_id=SESSION_A))
    db.save_case(sample_case("case-a2", session_id=SESSION_A))

    # Session B has one item
    db.save_case(sample_case("case-b1", session_id=SESSION_B))

    # Fetch history as Session A
    res_a = client.get("/api/history", headers={"X-Session-ID": SESSION_A})
    assert res_a.status_code == 200
    items_a = res_a.json()
    assert len(items_a) == 2
    assert {it["id"] for it in items_a} == {"case-a1", "case-a2"}

    # Fetch history as Session B
    res_b = client.get("/api/history", headers={"X-Session-ID": SESSION_B})
    assert res_b.status_code == 200
    items_b = res_b.json()
    assert len(items_b) == 1
    assert items_b[0]["id"] == "case-b1"

    # Fetch history as Session C (new browser visitor)
    res_c = client.get("/api/history", headers={"X-Session-ID": SESSION_C})
    assert res_c.status_code == 200
    assert res_c.json() == []


def test_session_ownership_enforcement_on_detail_read():
    # Session A owns case-private-1
    db.save_case(sample_case("case-private-1", session_id=SESSION_A))

    # Session A can access it
    res_owner = client.get("/api/history/case-private-1", headers={"X-Session-ID": SESSION_A})
    assert res_owner.status_code == 200
    assert res_owner.json()["case_id"] == "case-private-1"

    # Session B guessing or requesting Session A's ID gets 404 (does NOT reveal record exists)
    res_other = client.get("/api/history/case-private-1", headers={"X-Session-ID": SESSION_B})
    assert res_other.status_code == 404
    assert res_other.json()["error"] == "history_not_found"


def test_session_ownership_enforcement_on_delete_item():
    # Session A owns case-del-test
    db.save_case(sample_case("case-del-test", session_id=SESSION_A))

    # Session B attempts to delete Session A's record -> gets 404
    res_b_del = client.delete("/api/history/case-del-test", headers={"X-Session-ID": SESSION_B})
    assert res_b_del.status_code == 404
    assert res_b_del.json()["error"] == "history_not_found"

    # Session A still has the record intact
    res_a_check = client.get("/api/history/case-del-test", headers={"X-Session-ID": SESSION_A})
    assert res_a_check.status_code == 200

    # Session A deletes their own record -> succeeds
    res_a_del = client.delete("/api/history/case-del-test", headers={"X-Session-ID": SESSION_A})
    assert res_a_del.status_code == 200
    assert res_a_del.json()["deleted"] is True

    # Record is now deleted for Session A
    assert client.get("/api/history/case-del-test", headers={"X-Session-ID": SESSION_A}).status_code == 404


def test_clear_history_only_deletes_current_session_records():
    # Session A has 2 records
    db.save_case(sample_case("case-a-clr1", session_id=SESSION_A))
    db.save_case(sample_case("case-a-clr2", session_id=SESSION_A))

    # Session B has 2 records
    db.save_case(sample_case("case-b-clr1", session_id=SESSION_B))
    db.save_case(sample_case("case-b-clr2", session_id=SESSION_B))

    # Session A clears their history
    res_clr = client.delete("/api/history", headers={"X-Session-ID": SESSION_A})
    assert res_clr.status_code == 200
    assert res_clr.json()["deleted"] is True
    assert res_clr.json()["count"] == 2

    # Session A history is empty
    res_a = client.get("/api/history", headers={"X-Session-ID": SESSION_A})
    assert res_a.status_code == 200
    assert res_a.json() == []

    # Session B history is completely intact
    res_b = client.get("/api/history", headers={"X-Session-ID": SESSION_B})
    assert res_b.status_code == 200
    assert len(res_b.json()) == 2
    assert {it["id"] for it in res_b.json()} == {"case-b-clr1", "case-b-clr2"}


def test_cache_boundaries_between_different_sessions():
    text_input = "Light travels at approximately 300,000 kilometers per second in a vacuum."
    mock_case_a = sample_case("mock-a", session_id=SESSION_A, text=text_input)
    mock_case_b = sample_case("mock-b", session_id=SESSION_B, text=text_input)

    with patch("services.live_pipeline.analyze_text", side_effect=[mock_case_a, mock_case_b]) as mock_analyze:
        # Session A runs analysis -> pipeline called
        res_a1 = client.post("/api/analyze/text", data={"text": text_input}, headers={"X-Session-ID": SESSION_A})
        assert res_a1.status_code == 200
        assert mock_analyze.call_count == 1
        assert res_a1.json()["case_id"] == "mock-a"
        assert not res_a1.json().get("from_cache")

        # Session A runs identical analysis again -> CACHE HIT, pipeline NOT called
        res_a2 = client.post("/api/analyze/text", data={"text": text_input}, headers={"X-Session-ID": SESSION_A})
        assert res_a2.status_code == 200
        assert mock_analyze.call_count == 1
        assert res_a2.json()["case_id"] == "mock-a"
        assert res_a2.json().get("from_cache") is True

        # Session B runs identical analysis -> CACHE MISS (Session A's cache is NOT leaked to B)
        res_b1 = client.post("/api/analyze/text", data={"text": text_input}, headers={"X-Session-ID": SESSION_B})
        assert res_b1.status_code == 200
        assert mock_analyze.call_count == 2
        assert res_b1.json()["case_id"] == "mock-b"
        assert not res_b1.json().get("from_cache")


def test_history_endpoints_require_valid_session_header():
    # Missing header returns 400
    assert client.get("/api/history").status_code == 400
    assert client.get("/api/history/some-id").status_code == 400
    assert client.delete("/api/history/some-id").status_code == 400
    assert client.delete("/api/history").status_code == 400

    # Invalid header format (too short, spaces, special chars) returns 400
    for bad_id in ["short", "with spaces in id", "<script>alert(1)</script>", "x" * 200]:
        res = client.get("/api/history", headers={"X-Session-ID": bad_id})
        assert res.status_code == 400
        assert "Invalid X-Session-ID" in res.json()["detail"]


def test_legacy_records_without_session_id_are_excluded_from_user_history():
    # Insert legacy record with NULL / empty session_id
    legacy_case = sample_case("legacy-case-999", session_id=None)
    db.save_case(legacy_case)

    # Neither Session A nor Session B sees the legacy record
    res_a = client.get("/api/history", headers={"X-Session-ID": SESSION_A})
    assert all(it["id"] != "legacy-case-999" for it in res_a.json())

    res_a_detail = client.get("/api/history/legacy-case-999", headers={"X-Session-ID": SESSION_A})
    assert res_a_detail.status_code == 404
