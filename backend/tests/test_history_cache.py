"""Comprehensive tests for Analysis History, SQLite memory, and deterministic caching."""
import io
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from database import database as db
from fastapi.testclient import TestClient
from main import app
from PIL import Image
from services import cache_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_db():
    """Ensure clean table before and after each test."""
    db.init_db()
    db.clear_history()
    yield
    db.clear_history()


def sample_case(case_id="test-1", decision="TRUSTED", trust_score=92.5, analysis_type="text",
                text="The earth orbits around the sun."):
    return {
        "case_id": case_id,
        "mode": "live",
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "input": {
            "type": analysis_type,
            "title": "Test statement",
            "text": text,
            "sha256": "abcdef123456",
            "metadata": {"File name": "doc.txt" if analysis_type != "text" else None},
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
                        "title": "NASA Solar System",
                        "url": "https://nasa.gov/solar-system",
                        "domain": "nasa.gov",
                        "classification": "SUPPORTS",
                        "reliability": 0.95,
                    }
                ],
            }
        ],
        "warnings": [],
        "manipulation": {"applicable": False, "risk": 0.0, "indicators": []},
        "overall": {
            "trust_score": trust_score,
            "raw_band": decision,
            "decision": decision,
            "forced_inconclusive": False,
            "force_reasons": [],
            "confidence": 0.88,
            "confidence_label": "High",
            "components": [],
        },
        "evidence_summary": {"total": 1, "counts": {"SUPPORTS": 1, "CONTRADICTS": 0, "NEUTRAL": 0}},
        "contradictions": [],
        "trail": [],
        "conclusion": {"headline": "Evidence strongly supports the claims.", "reasoning": ["Solid proof."], "caveats": []},
        "heuristics": {},
    }


def make_test_image(text="Test Image", color=(200, 200, 200)):
    img = Image.new("RGB", (120, 80), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


# ------------------------------------------------------------------- History tests

def test_save_and_get_history_by_id():
    case = sample_case(case_id="case-100", decision="TRUSTED")
    db.save_case(case, processing_time_ms=120)

    res = client.get("/api/history/case-100")
    assert res.status_code == 200
    data = res.json()
    assert data["case_id"] == "case-100"
    assert data["overall"]["decision"] == "TRUSTED"
    assert data["overall"]["trust_score"] == 92.5
    assert len(data["claims"]) == 1
    assert data["conclusion"]["headline"] == "Evidence strongly supports the claims."


def test_list_history_and_empty_history():
    # Empty history
    res = client.get("/api/history")
    assert res.status_code == 200
    assert res.json() == []

    # Insert items
    c1 = sample_case(case_id="c1", analysis_type="text")
    c2 = sample_case(case_id="c2", analysis_type="image")
    db.save_case(c1)
    db.save_case(c2)

    res = client.get("/api/history")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 2
    # Verify lightweight structure (no large raw claims list in summary)
    for it in items:
        assert "case_id" in it
        assert "verdict" in it
        assert "trust_score" in it
        assert "analysis_type" in it
        assert "claims" not in it  # lightweight


def test_history_filter_by_type():
    db.save_case(sample_case(case_id="t1", analysis_type="text"))
    db.save_case(sample_case(case_id="t2", analysis_type="text"))
    db.save_case(sample_case(case_id="img1", analysis_type="image"))

    res_all = client.get("/api/history?type=all")
    assert len(res_all.json()) == 3

    res_img = client.get("/api/history?type=image")
    assert len(res_img.json()) == 1
    assert res_img.json()[0]["id"] == "img1"

    res_text = client.get("/api/history?type=text")
    assert len(res_text.json()) == 2


def test_delete_history_item_and_invalid_id():
    db.save_case(sample_case(case_id="del-1"))
    db.save_case(sample_case(case_id="del-2"))

    # Delete existing
    res = client.delete("/api/history/del-1")
    assert res.status_code == 200
    assert res.json() == {"deleted": True, "id": "del-1"}

    # Verify deleted
    assert client.get("/api/history/del-1").status_code == 404

    # Delete non-existent
    res_non = client.delete("/api/history/non-existent-id")
    assert res_non.status_code == 404
    assert res_non.json()["error"] == "history_not_found"


def test_clear_all_history():
    db.save_case(sample_case(case_id="clr-1"))
    db.save_case(sample_case(case_id="clr-2"))
    db.save_case(sample_case(case_id="clr-3"))

    res = client.delete("/api/history")
    assert res.status_code == 200
    assert res.json()["deleted"] is True
    assert res.json()["count"] == 3

    # Check empty
    assert client.get("/api/history").json() == []


def test_get_history_not_found():
    res = client.get("/api/history/missing-123")
    assert res.status_code == 404
    assert res.json()["error"] == "history_not_found"


def test_structured_json_serialization_preserves_nested_data():
    case = sample_case(case_id="json-test")
    case["manipulation"] = {
        "applicable": True,
        "risk": 0.45,
        "indicators": [{"name": "ELA diff", "severity": 0.45, "method": "Pillow"}]
    }
    case["overall"]["components"] = [
        {"key": "evidence_support", "value": 0.9, "weight": 0.4}
    ]
    db.save_case(case)

    loaded = db.get_history("json-test")
    assert loaded["manipulation"]["applicable"] is True
    assert loaded["manipulation"]["risk"] == 0.45
    assert len(loaded["manipulation"]["indicators"]) == 1
    assert loaded["overall"]["components"][0]["key"] == "evidence_support"


# ------------------------------------------------------------------- Cache tests

def test_cache_hit_and_miss_for_text():
    text_input = "The Great Wall of China is visible from space with the naked eye."
    ck = cache_service.text_cache_key(text_input)

    # 1. Cache miss initially
    assert db.get_by_cache_key(ck) is None

    # 2. Store case with this cache key
    c = sample_case(case_id="c-txt", text=text_input)
    db.save_case(c, cache_key=ck)

    # 3. Cache hit for exact text
    hit = db.get_by_cache_key(ck)
    assert hit is not None
    assert hit["case_id"] == "c-txt"
    assert hit["from_cache"] is True

    # 4. Cache hit for slightly different whitespace / casing
    ck_fuzzy = cache_service.text_cache_key("  THE Great Wall  of China is visible from space with the naked eye. ")
    assert ck == ck_fuzzy

    # 5. Cache miss for changed text
    ck_diff = cache_service.text_cache_key("The Great Wall of China is located in China.")
    assert db.get_by_cache_key(ck_diff) is None


def test_cache_hit_and_miss_for_image_and_claim():
    img1 = make_test_image(color=(255, 0, 0))
    img2 = make_test_image(color=(0, 255, 0))

    # Same image + same claim
    k1 = cache_service.media_cache_key("image", caption="ATM closed notice", content_bytes=img1)
    k1_same = cache_service.media_cache_key("image", caption="  atm closed notice  ", content_bytes=img1)
    assert k1 == k1_same

    # Same image + different claim
    k2 = cache_service.media_cache_key("image", caption="Bank open notice", content_bytes=img1)
    assert k1 != k2

    # Different image + same claim
    k3 = cache_service.media_cache_key("image", caption="ATM closed notice", content_bytes=img2)
    assert k1 != k3


def test_expired_cache_triggers_miss():
    text = "Photosynthesis requires sunlight, carbon dioxide, and water."
    ck = cache_service.text_cache_key(text)

    # Create an old case from 48 hours ago
    old_time = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat(timespec="seconds")
    case = sample_case(case_id="old-case", text=text)
    case["created_at"] = old_time
    db.save_case(case, cache_key=ck)

    # With TTL of 24 hours, this should be expired (miss)
    hit = db.get_by_cache_key(ck, ttl_hours=24.0)
    assert hit is None

    # With TTL of 72 hours, it is still valid
    hit_valid = db.get_by_cache_key(ck, ttl_hours=72.0)
    assert hit_valid is not None
    assert hit_valid["case_id"] == "old-case"


def test_endpoint_text_analysis_uses_cache_and_avoids_ai():
    text = "The Pacific Ocean is the largest ocean on Earth."
    mock_case = sample_case(case_id="mock-1", text=text, trust_score=98.0)

    with patch("services.live_pipeline.analyze_text", return_value=mock_case) as mock_analyze:
        # First call: executes live analysis and caches it
        r1 = client.post("/api/analyze/text", data={"text": text})
        assert r1.status_code == 200
        assert mock_analyze.call_count == 1
        d1 = r1.json()
        assert d1["case_id"] == "mock-1"

        # Second call with same text: must hit cache and NOT call analyze_text again
        r2 = client.post("/api/analyze/text", data={"text": f"  {text}  "})
        assert r2.status_code == 200
        assert mock_analyze.call_count == 1  # Still 1, NOT called again!
        d2 = r2.json()
        assert d2["case_id"] == "mock-1"
        assert d2.get("from_cache") is True


def test_endpoint_image_analysis_uses_cache_and_avoids_ai():
    img_bytes = make_test_image(color=(100, 150, 200))
    caption = "A photograph of the Eiffel Tower."
    mock_case = sample_case(case_id="mock-img-1", analysis_type="image", text=caption)

    with patch("services.live_pipeline.analyze_image", return_value=mock_case) as mock_analyze:
        files = {"file": ("eiffel.jpg", img_bytes, "image/jpeg")}
        r1 = client.post("/api/analyze/image", files=files, data={"caption": caption})
        assert r1.status_code == 200
        assert mock_analyze.call_count == 1

        # Second call with same image and same caption: hits cache without calling analyze_image
        files2 = {"file": ("eiffel.jpg", img_bytes, "image/jpeg")}
        r2 = client.post("/api/analyze/image", files=files2, data={"caption": caption})
        assert r2.status_code == 200
        assert mock_analyze.call_count == 1  # Not called again
        assert r2.json()["case_id"] == "mock-img-1"
        assert r2.json().get("from_cache") is True


def test_history_item_retrieval_never_triggers_external_calls():
    case = sample_case(case_id="no-ai-call")
    db.save_case(case)

    # Calling GET /api/history/{id} only accesses SQLite
    with patch("services.gemini_service.generate") as mock_gemini, \
         patch("services.tavily_service.search") as mock_tavily:
        res = client.get("/api/history/no-ai-call")
        assert res.status_code == 200
        assert res.json()["case_id"] == "no-ai-call"
        assert mock_gemini.call_count == 0
        assert mock_tavily.call_count == 0
