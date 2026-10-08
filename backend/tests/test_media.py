"""Audio/video tests using real FFmpeg + OpenCV on tiny generated clips. Gemini/Tavily are faked."""
import io
import subprocess

import pytest
from fastapi.testclient import TestClient

from main import app
from services import fallback_search as wiki
from services import gemini_service as gem
from services import media_processor as mp
from services import tavily_service as tav

pytestmark = pytest.mark.skipif(not mp.ffmpeg_available(), reason="ffmpeg not installed")
client = TestClient(app)
SPEECH = "The Greenfield Metro Phase 2 line opened to passengers on fifteenth March."


def ff(tmp_path, name, *args):
    out = tmp_path / name
    executable = mp.ffmpeg_executable()
    assert executable is not None
    subprocess.run([executable, "-y", "-loglevel", "error", *args, str(out)], check=True)
    return out.read_bytes()


@pytest.fixture(autouse=True)
def fakes(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    monkeypatch.setenv("TAVILY_API_KEY", "fake")
    calls = {"transcribe": [], "frames": 0}
    monkeypatch.setattr(gem, "transcribe", lambda audio, mime: calls["transcribe"].append((len(audio), mime)) or {"transcript": SPEECH})
    monkeypatch.setattr(gem, "describe_frames", lambda jpegs: calls.__setitem__("frames", calls["frames"] + 1) or [
        {"description": f"Scene {i}", "visible_text": "", "visual_anomalies": []} for i, _ in enumerate(jpegs)])
    monkeypatch.setattr(gem, "extract_claims", lambda *a, **k: {"summary": "", "claims": [
        {"claim": "Metro Phase 2 opened on 15 March.", "importance": "high", "type": "factual", "search_query": "metro phase 2 opening"}]})
    monkeypatch.setattr(gem, "classify_evidence", lambda c, items: {i["id"]: {"classification": "NEUTRAL", "reasoning": "fake"} for i in items})
    monkeypatch.setattr(tav, "search", lambda *a, **k: [])
    monkeypatch.setattr(wiki, "search", lambda *a, **k: [])
    return calls


def test_audio_in_odd_format_is_converted_to_small_wav(tmp_path, fakes):
    webm = ff(tmp_path, "rec.ogg", "-f", "lavfi", "-i", "sine=frequency=300:duration=3")   # not WAV/MP3
    r = client.post("/api/analyze/audio", files={"file": ("rec.ogg", io.BytesIO(webm), "audio/ogg")})
    case = r.json()
    assert r.status_code == 200 and case["input"]["transcript"] == SPEECH
    assert fakes["transcribe"][0][1] == "audio/wav"                        # normalised before sending
    assert case["input"]["metadata"]["Converted for analysis"].startswith("FFmpeg")
    assert case["manipulation"]["applicable"] is False                     # honest: no audio forensics


def test_long_audio_is_trimmed_to_two_minutes(tmp_path, fakes):
    long = ff(tmp_path, "long.wav", "-f", "lavfi", "-i", "sine=frequency=300:duration=150", "-ar", "8000", "-ac", "1")
    case = client.post("/api/analyze/audio", files={"file": ("long.wav", io.BytesIO(long), "audio/wav")}).json()
    assert any("first 2 minutes" in w for w in case["warnings"])
    assert fakes["transcribe"][0][0] < 16000 * 2 * 125                      # <= ~120 s of 16-bit 16 kHz mono


def test_video_scans_all_seconds_with_one_gemini_frame_call_and_extracts_audio(tmp_path, fakes):
    vid = ff(tmp_path, "v.mp4", "-f", "lavfi", "-i", "testsrc=duration=6:size=320x240:rate=10",
             "-f", "lavfi", "-i", "sine=frequency=440:duration=6", "-shortest")
    r = client.post("/api/analyze/video", files={"file": ("v.mp4", io.BytesIO(vid), "video/mp4")})
    case = r.json()
    assert r.status_code == 200 and fakes["frames"] == 1                     # one request for every one-second sample
    assert case["input"]["metadata"]["Frames inspected"].startswith("6")
    assert case["input"]["frames"][0]["timestamp"] == "00:00"
    assert case["input"]["transcript"] == SPEECH and "FFmpeg audio extraction" in case["input"]["extraction_method"]
    assert case["input"]["metadata"]["Resolution"] == "320 x 240"
    assert all("Error-level" not in i["name"] for i in case["manipulation"]["indicators"])


def test_silent_video_is_analysed_visually_and_says_so(tmp_path, fakes):
    vid = ff(tmp_path, "s.mp4", "-f", "lavfi", "-i", "testsrc=duration=4:size=320x240:rate=10")
    case = client.post("/api/analyze/video", files={"file": ("s.mp4", io.BytesIO(vid), "video/mp4")}).json()
    assert any("no audio track" in w for w in case["warnings"]) and fakes["transcribe"] == []


def test_manual_transcript_skips_transcription_and_bad_video_suggests_image(tmp_path, fakes):
    vid = ff(tmp_path, "m.mp4", "-f", "lavfi", "-i", "testsrc=duration=4:size=320x240:rate=10")
    ok = client.post("/api/analyze/video", files={"file": ("m.mp4", io.BytesIO(vid), "video/mp4")}, data={"transcript": SPEECH})
    assert ok.status_code == 200 and fakes["transcribe"] == []
    bad = client.post("/api/analyze/video", files={"file": ("x.mp4", io.BytesIO(b"garbage"), "video/mp4")})
    assert bad.status_code == 400 and "frame" in bad.json()["message"].lower()


def test_local_whisper_backup_used_when_gemini_transcription_fails(tmp_path, monkeypatch):
    from services import local_stt
    from services.gemini_service import GeminiError
    monkeypatch.setattr(gem, "transcribe", lambda *a: (_ for _ in ()).throw(GeminiError("quota", "rate limit")))
    monkeypatch.setattr(local_stt, "available", lambda: True)
    monkeypatch.setattr(local_stt, "transcribe", lambda audio: SPEECH)
    wav = ff(tmp_path, "a.wav", "-f", "lavfi", "-i", "sine=frequency=300:duration=3")
    case = client.post("/api/analyze/audio", files={"file": ("a.wav", io.BytesIO(wav), "audio/wav")}).json()
    assert "Local Whisper" in case["input"]["extraction_method"] and any("Whisper" in w for w in case["warnings"])
