"""Tesseract OCR with OpenCV preprocessing.

Screenshots, forwarded images and photos of notices OCR badly as-is. We try a few cheap
OpenCV variants (upscale+denoise, Otsu threshold, adaptive threshold, inverted for light-on-dark
text), run Tesseract on each, and keep the variant with the most confident words.

OCR can fail (Tesseract not installed, corrupt image). In that case we return empty text and the
pipeline continues with visual analysis. Nothing here raises.
"""
from typing import Dict, List, Tuple

import numpy as np

MAX_SIDE = 2000          # cap image size so OCR stays fast
MIN_WORD_CONF = 40       # words below this are dropped as noise
LOW_CONFIDENCE = 60      # mean confidence under this triggers a user-facing warning


def _decode(image_bytes: bytes):
    import cv2
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:  # formats OpenCV cannot decode (e.g. some WEBP/GIF): go through Pillow
        import io
        from PIL import Image
        img = cv2.cvtColor(np.array(Image.open(io.BytesIO(image_bytes)).convert("RGB")), cv2.COLOR_RGB2BGR)
    return img


def _variants(img, fast: bool = False) -> List[Tuple[str, np.ndarray]]:
    import cv2
    h, w = img.shape[:2]
    scale = 1.0
    if max(h, w) > MAX_SIDE:
        scale = MAX_SIDE / max(h, w)
    elif max(h, w) < 1000:
        scale = min(3.0, 1000 / max(h, w))      # small text needs enlarging
    if scale != 1.0:
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    if fast:   # video frames: one cheap pass (no slow denoising)
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return [("Otsu threshold", otsu)] + ([("inverted threshold", cv2.bitwise_not(otsu))] if np.mean(otsu) < 127 else [])
    den = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    _, otsu = cv2.threshold(den, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    adapt = cv2.adaptiveThreshold(den, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)
    # light text on a dark background is common in memes and notices
    inverted = cv2.bitwise_not(otsu) if np.mean(otsu) < 127 else None
    out = [("grayscale + denoise", den), ("Otsu threshold", otsu), ("adaptive threshold", adapt)]
    if inverted is not None:
        out.append(("inverted threshold", inverted))
    return out


def _read(img) -> Dict:
    import pytesseract
    from pytesseract import Output
    d = pytesseract.image_to_data(img, config="--psm 6", output_type=Output.DICT)
    lines: Dict[tuple, List[str]] = {}
    confs: List[float] = []
    for i, word in enumerate(d["text"]):
        word = (word or "").strip()
        try:
            conf = float(d["conf"][i])
        except (ValueError, TypeError):
            continue
        if word and conf >= MIN_WORD_CONF:
            lines.setdefault((d["block_num"][i], d["par_num"][i], d["line_num"][i]), []).append(word)
            confs.append(conf)
    text = "\n".join(" ".join(ws) for _, ws in sorted(lines.items()))
    return {"text": text, "confidence": round(float(np.mean(confs)), 1) if confs else None,
            "words": len(confs), "score": float(sum(confs))}


def extract(image_bytes: bytes, fast: bool = False) -> Dict:
    """Returns {text, confidence (0-100 or None), method, ok, error}. Never raises."""
    try:
        import pytesseract
        pytesseract.get_tesseract_version()
    except Exception:  # noqa: BLE001
        return {"text": "", "confidence": None, "ok": False, "method": "Tesseract OCR",
                "error": "Tesseract is not installed on the server"}
    try:
        best, best_name = None, ""
        for name, variant in _variants(_decode(image_bytes), fast):
            r = _read(variant)
            if best is None or r["score"] > best["score"]:
                best, best_name = r, name
        if not best or not best["text"]:
            return {"text": "", "confidence": None, "ok": True, "method": "Tesseract OCR + OpenCV preprocessing",
                    "error": None}
        return {"text": best["text"], "confidence": best["confidence"], "ok": True, "words": best["words"],
                "method": f"Tesseract OCR + OpenCV preprocessing ({best_name})", "error": None}
    except Exception as e:  # noqa: BLE001 - corrupt image, memory, anything
        return {"text": "", "confidence": None, "ok": False, "method": "Tesseract OCR",
                "error": f"OCR failed ({type(e).__name__})"}


def extract_text(image_bytes: bytes, fast: bool = False):
    """Returns (text, note). Used for video frames (fast=True)."""
    r = extract(image_bytes, fast)
    if r["error"]:
        return "", f"OCR unavailable ({r['error']}); continuing with visual analysis"
    note = r["method"] if r["text"] else "Tesseract OCR found no readable text"
    return r["text"], note
