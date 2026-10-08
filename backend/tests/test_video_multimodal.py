"""The video pipeline combines audio transcription, OCR, and visual frame analysis."""
from types import SimpleNamespace

from fastapi.testclient import TestClient

from main import app
from services import fallback_search as wiki
from services import gemini_service as gem
from services import live_pipeline as live
from services import media_processor as media
from services import ocr_service
from services import tavily_service as tav

client = TestClient(app)


def test_default_video_sampling_covers_each_second(monkeypatch):
    class FakeCapture:
        def __init__(self):
            self.frame_index = 0
            self.positions = []

        def get(self, prop):
            return {1: 10, 2: 2}.get(prop, 0)

        def set(self, prop, value):
            self.frame_index = value
            self.positions.append(value)

        def read(self):
            return True, SimpleNamespace(shape=(240, 320, 3))

        def release(self):
            pass

    capture = FakeCapture()
    fake_cv2 = SimpleNamespace(
        CAP_PROP_FRAME_COUNT=1,
        CAP_PROP_FPS=2,
        CAP_PROP_POS_FRAMES=3,
        IMWRITE_JPEG_QUALITY=4,
        VideoCapture=lambda path: capture,
        imencode=lambda ext, frame, params: (True, SimpleNamespace(tobytes=lambda: b"jpeg")),
    )
    monkeypatch.setitem(__import__("sys").modules, "cv2", fake_cv2)

    frames = media.sample_frames("sample.mp4")

    assert len(frames) == 5
    assert [frame["t"] for frame in frames] == [0, 1, 2, 3, 4]
    assert capture.positions == [0, 2, 4, 6, 8]


def test_video_combines_audio_manual_transcript_ocr_and_visual_frame_text(tmp_path, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    monkeypatch.setenv("TAVILY_API_KEY", "fake")
    video_path = tmp_path / "sample.mp4"
    video_path.write_bytes(b"video")
    frames = [{"jpeg": f"frame-{i}".encode(), "t": float(i)} for i in range(3)]
    frame_calls = []
    transcription_calls = []
    extracted_claims = {}

    monkeypatch.setattr(media, "save_temp", lambda data, suffix: str(video_path))
    monkeypatch.setattr(media, "probe", lambda path: {
        "duration": 3.0, "width": 320, "height": 240, "has_audio": True, "creation_time": None,
    })
    monkeypatch.setattr(media, "sample_frames", lambda path: frames)
    monkeypatch.setattr(media, "to_wav", lambda path: b"wav bytes")
    monkeypatch.setattr(media, "image_indicators", lambda data, ela=False: [])
    monkeypatch.setattr(ocr_service, "extract_text", lambda data, fast=False: (f"Screen text {data.decode()}", "mock OCR"))
    monkeypatch.setattr(gem, "transcribe", lambda audio, mime: transcription_calls.append((audio, mime)) or {
        "transcript": "The city announced the bridge opened in 2024.",
    })
    monkeypatch.setattr(gem, "describe_frames", lambda images: frame_calls.append(images) or [
        {"description": f"Scene {i}", "visible_text": f"AI visible text {i}", "visual_anomalies": []}
        for i, _ in enumerate(images)
    ])
    monkeypatch.setattr(live.claim_extractor, "extract", lambda text, **kwargs: (
        extracted_claims.update({"text": text, "extra": kwargs.get("extra")}) or [
            {"id": "c1", "claim": "The city announced the bridge opened in 2024.",
             "importance": "high", "type": "factual", "search_query": "bridge opened 2024"},
        ],
        {"method": "test", "summary": "", "warning": None},
    ))
    monkeypatch.setattr(gem, "classify_evidence", lambda claim, items: {})
    monkeypatch.setattr(tav, "search", lambda *args, **kwargs: [])
    monkeypatch.setattr(wiki, "search", lambda *args, **kwargs: [])

    response = client.post(
        "/api/analyze/video",
        files={"file": ("sample.mp4", b"video", "video/mp4")},
        data={"transcript": "A reporter says the bridge is open."},
    )

    assert response.status_code == 200
    case = response.json()
    assert transcription_calls == [(b"wav bytes", "audio/wav")]
    assert len(frame_calls) == 1 and len(frame_calls[0]) == len(frames)
    assert case["input"]["transcript"] == (
        "The city announced the bridge opened in 2024.\nA reporter says the bridge is open."
    )
    for i in range(len(frames)):
        assert f"Screen text frame-{i}" in case["input"]["ocr_text"]
        assert f"AI visible text {i}" in case["input"]["ocr_text"]
    assert "The city announced the bridge opened in 2024." in extracted_claims["text"]
    assert "Screen text frame-2" in extracted_claims["text"]
    assert "1-second intervals" in extracted_claims["extra"]
    assert case["input"]["metadata"]["Frames inspected"].startswith("3")
    assert case["input"]["metadata"]["Frame previews shown"] == "3 of 3"
