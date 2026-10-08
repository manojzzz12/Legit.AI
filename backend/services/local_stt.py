"""OPTIONAL free, offline speech-to-text backup (faster-whisper). Not installed by default.

Used only when Gemini transcription fails or is not configured. To enable:
    pip install faster-whisper
The first use downloads a small model (~75 MB for "tiny") from Hugging Face. CPU only, free.
Set LOCAL_STT=off to disable even if installed. WHISPER_MODEL=tiny|base (base is slower, better).
"""
import io
import os

_model = None


def available() -> bool:
    if os.getenv("LOCAL_STT", "on").lower() == "off":
        return False
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def transcribe(audio: bytes) -> str:
    global _model
    from faster_whisper import WhisperModel
    if _model is None:
        _model = WhisperModel(os.getenv("WHISPER_MODEL", "tiny"), device="cpu", compute_type="int8")
    segments, _ = _model.transcribe(io.BytesIO(audio), beam_size=1, vad_filter=True)
    return " ".join(seg.text.strip() for seg in segments).strip()
