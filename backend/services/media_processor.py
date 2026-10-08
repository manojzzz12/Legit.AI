"""OpenCV / Pillow / FFmpeg helpers. Everything here produces INDICATORS, never proof.

Each indicator: {name, severity 0..1, detail, method}. Severities are prototype heuristics
and false positives are common (screenshots, re-saved JPEGs, heavy compression).
"""
import io
import math
import os
import re
import shutil
import subprocess
import tempfile
from typing import Dict, List, Optional

import numpy as np

EDIT_SOFTWARE = ("photoshop", "gimp", "lightroom", "affinity", "canva", "pixelmator", "snapseed", "facetune", "stable diffusion", "midjourney", "dall")
HIGH = {"low": 0.2, "medium": 0.4, "high": 0.6}   # cap AI visual observations: they are not proof


def image_indicators(image_bytes: bytes, ela: bool = True) -> List[Dict]:
    from PIL import Image
    import cv2
    out: List[Dict] = []
    img = Image.open(io.BytesIO(image_bytes))
    fmt = img.format

    # 1. metadata
    try:
        exif = img.getexif()
    except Exception:  # noqa: BLE001
        exif = {}
    software = str(exif.get(305, "")) if exif else ""
    if software and any(s in software.lower() for s in EDIT_SOFTWARE):
        out.append({"name": "Editing/generation software in metadata", "severity": 0.5,
                    "detail": f"EXIF 'Software' field reads '{software}'. Editing is common and often harmless.",
                    "method": "EXIF metadata (Pillow)"})
    elif not exif:
        out.append({"name": "No camera metadata", "severity": 0.15,
                    "detail": "No EXIF data. Screenshots and social-media downloads usually have none, so this is weak.",
                    "method": "EXIF metadata (Pillow)"})
    else:
        out.append({"name": "Camera metadata present", "severity": 0.0,
                    "detail": "EXIF data is present. It can be edited, so this is not proof of authenticity.",
                    "method": "EXIF metadata (Pillow)"})

    rgb = img.convert("RGB")
    arr = np.array(rgb)
    h, w = arr.shape[:2]
    if min(h, w) < 64:
        return out

    # 2. error level analysis (only meaningful for JPEG-like images)
    if ela and fmt in ("JPEG", "MPO"):
        buf = io.BytesIO()
        rgb.save(buf, "JPEG", quality=90)
        re_img = np.array(Image.open(buf).convert("RGB")).astype(np.int16)
        diff = np.abs(arr.astype(np.int16) - re_img).mean(axis=2)
        bs = max(16, min(h, w) // 8)
        blocks = [diff[y:y + bs, x:x + bs].mean() for y in range(0, h - bs + 1, bs) for x in range(0, w - bs + 1, bs)]
        med, hi = float(np.median(blocks)), float(np.percentile(blocks, 98))
        ratio = hi / (med + 1e-3)
        sev = 0.0 if ratio < 3 else min(0.5, 0.15 + (ratio - 3) * 0.05)
        out.append({"name": "Error-level inconsistency", "severity": round(sev, 2),
                    "detail": f"Some regions recompress very differently from the rest (max/median ratio {ratio:.1f}). "
                              "Can indicate pasted or edited regions, but also sharp text and edges." if sev else
                              f"Compression error looks fairly uniform (ratio {ratio:.1f}).",
                    "method": "Error Level Analysis (Pillow)"})
    elif ela:
        out.append({"name": "Error-level analysis skipped", "severity": 0.0,
                    "detail": f"Image format is {fmt}; ELA only applies to JPEG files.", "method": "Error Level Analysis (Pillow)"})

    # 3. noise-level consistency across the image
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    bs = max(32, min(h, w) // 6)
    noise = [lap[y:y + bs, x:x + bs].var() for y in range(0, h - bs + 1, bs) for x in range(0, w - bs + 1, bs)]
    if len(noise) >= 6:
        cv = float(np.std(noise) / (np.mean(noise) + 1e-6))
        sev = 0.0 if cv < 1.5 else min(0.4, 0.1 + (cv - 1.5) * 0.15)
        out.append({"name": "Uneven noise/sharpness", "severity": round(sev, 2),
                    "detail": f"Block-to-block sharpness varies (coefficient {cv:.2f}). Natural photos with a blurred "
                              "background also score high, so treat as a weak signal.",
                    "method": "Laplacian variance blocks (OpenCV)"})
    return out


def ai_anomaly_indicators(anomalies: List[Dict]) -> List[Dict]:
    return [{"name": "Visual anomaly noted by AI", "severity": HIGH.get(a.get("level", "low"), 0.2),
             "detail": str(a.get("observation", ""))[:300], "method": "Gemini visual inspection (observation, not proof)"}
            for a in anomalies[:4]]


# ------------------------------------------------------------------------ FFmpeg
MAX_SECONDS = 120  # "short video": only the first 2 minutes are analysed, to keep things fast
VIDEO_FRAME_INTERVAL_SECONDS = 1


def ffmpeg_executable() -> Optional[str]:
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    try:
        import imageio_ffmpeg
    except ImportError:
        return None
    try:
        return imageio_ffmpeg.get_ffmpeg_exe()
    except (OSError, RuntimeError):
        return None


def ffmpeg_available() -> bool:
    return ffmpeg_executable() is not None


def _run(cmd: List[str], timeout: int = 90):
    return subprocess.run(cmd, capture_output=True, timeout=timeout, check=True)


def probe(path: str) -> Dict:
    """Duration, size, fps and embedded creation time. Uses ffprobe if present, OpenCV otherwise."""
    info: Dict = {"duration": None, "width": None, "height": None, "fps": None, "creation_time": None, "has_audio": None}
    if shutil.which("ffprobe"):
        try:
            import json
            r = _run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path], 20)
            d = json.loads(r.stdout)
            fmt = d.get("format", {})
            info["duration"] = float(fmt["duration"]) if fmt.get("duration") else None
            info["creation_time"] = (fmt.get("tags") or {}).get("creation_time")
            streams = d.get("streams", [])
            info["has_audio"] = any(x.get("codec_type") == "audio" for x in streams)
            v = next((x for x in streams if x.get("codec_type") == "video"), None)
            if v:
                info["width"], info["height"] = v.get("width"), v.get("height")
                num, _, den = (v.get("avg_frame_rate") or "0/1").partition("/")
                info["fps"] = round(float(num) / float(den or 1), 1) if float(den or 1) else None
            return info
        except Exception:  # noqa: BLE001
            pass
    try:
        import cv2
        cap = cv2.VideoCapture(path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 0
        n = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        info.update(width=width if width > 0 else None, height=height if height > 0 else None,
                    fps=round(fps, 1) if fps > 0 else None, duration=(n / fps) if fps > 0 and n > 0 else None)
        cap.release()
    except Exception:  # noqa: BLE001
        pass
    executable = ffmpeg_executable()
    no_video_stream = info["width"] is None or info["height"] is None
    if executable and (info["duration"] is None or info["has_audio"] is None or no_video_stream):
        try:
            result = subprocess.run([executable, "-hide_banner", "-i", path],
                                    capture_output=True, text=True, timeout=20)
            details = result.stderr
            duration = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", details)
            if (info["duration"] is None or no_video_stream) and duration:
                hours, minutes, seconds = duration.groups()
                info["duration"] = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
            if info["has_audio"] is None and "Input #" in details:
                info["has_audio"] = bool(re.search(r"Stream #\d+:\d+.*\bAudio:", details))
        except (OSError, subprocess.SubprocessError):
            pass
    return info


def to_wav(path: str, max_seconds: int = MAX_SECONDS) -> bytes:
    """Any audio/video file -> mono 16 kHz WAV (first max_seconds). Small, and a format every
    speech-to-text engine accepts. Raises RuntimeError if there is no audio or FFmpeg is missing."""
    executable = ffmpeg_executable()
    if not executable:
        raise RuntimeError("FFmpeg is not installed.")
    out = path + ".wav"
    try:
        _run([executable, "-y", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-t", str(max_seconds), out])
        with open(out, "rb") as f:
            data = f.read()
        if len(data) < 2000:
            raise RuntimeError("No audio track found.")
        return data
    except (subprocess.SubprocessError, OSError) as e:
        raise RuntimeError(f"Could not read the audio ({type(e).__name__}); the file may have no audio track.")
    finally:
        if os.path.exists(out):
            os.remove(out)


extract_audio = to_wav  # video -> audio uses the same conversion


def fmt_time(seconds: float) -> str:
    return f"{int(seconds) // 60:02d}:{int(seconds) % 60:02d}"


def sample_frames(video_path: str, n: Optional[int] = None, max_seconds: int = MAX_SECONDS) -> List[Dict]:
    """Sample a frame each second by default, or n evenly spaced frames when n is supplied."""
    import cv2
    cap = cv2.VideoCapture(video_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frames: List[Dict] = []
    try:
        if total <= 0:
            raise RuntimeError("Could not read this video file.")
        usable = min(total, int(fps * max_seconds))
        if n is None:
            duration = min(usable / fps, max_seconds)
            sample_times = [float(second) for second in range(max(1, math.ceil(duration)))]
            indexes = sorted({min(int(t * fps), usable - 1) for t in sample_times})
        else:
            indexes = [int(usable * (k + 1) / (n + 1)) for k in range(n)]
        for idx in indexes:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, frame = cap.read()
            if ok:
                h, w = frame.shape[:2]
                if max(h, w) > 720:                                  # keep one-second samples affordable to inspect together
                    f = 720 / max(h, w)
                    frame = cv2.resize(frame, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
                ok2, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 82])
                if ok2:
                    frames.append({"jpeg": buf.tobytes(), "t": idx / fps})
    finally:
        cap.release()
    if not frames:
        raise RuntimeError("No frames could be extracted.")
    return frames


def save_temp(data: bytes, suffix: str) -> str:
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    return path
