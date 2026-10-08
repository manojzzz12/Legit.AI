"""Real Tesseract + OpenCV tests (skipped automatically if Tesseract is not installed)."""
import io
import shutil

import pytest
from PIL import Image, ImageDraw, ImageFont

from services import ocr_service

pytestmark = pytest.mark.skipif(shutil.which("tesseract") is None, reason="tesseract not installed")
TEXT = "ATMs will remain CLOSED for 10 days"


def make(fg, bg, size=(900, 160), font_size=44):
    img = Image.new("RGB", size, bg)
    ImageDraw.Draw(img).text((20, 40), TEXT, fill=fg, font=ImageFont.load_default(size=font_size))
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def words(s):
    return {w.lower().strip(".,") for w in s.split()}


def test_dark_text_on_light():
    r = ocr_service.extract(make("black", "white"))
    assert r["ok"] and {"atms", "closed", "days"} <= words(r["text"]) and r["confidence"] > 60


def test_light_text_on_dark_is_read_thanks_to_inversion():
    r = ocr_service.extract(make("white", (20, 20, 20)))
    assert {"closed", "days"} <= words(r["text"])


def test_small_screenshot_text_is_upscaled():
    r = ocr_service.extract(make("black", "white", size=(420, 60), font_size=18))
    assert "closed" in words(r["text"])


def test_blank_and_corrupt_inputs_never_raise():
    blank = io.BytesIO()
    Image.new("RGB", (300, 100), "white").save(blank, "PNG")
    assert ocr_service.extract(blank.getvalue())["text"] == ""
    bad = ocr_service.extract(b"not an image")
    assert bad["ok"] is False and bad["text"] == "" and ocr_service.extract_text(b"not an image")[0] == ""
