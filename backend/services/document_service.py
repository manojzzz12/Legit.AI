"""Read text out of documents the user uploads (txt, md, pdf, docx).

Used in two ways: as the CONTENT to verify, or as user-provided REFERENCE evidence.
"""
import io
from typing import Tuple


def extract_text(filename: str, data: bytes) -> Tuple[str, str]:
    """Returns (text, method). Raises ValueError with a friendly message."""
    name = (filename or "").lower()
    if name.endswith((".txt", ".md", ".csv", ".json")):
        return data.decode("utf-8", errors="replace"), "Plain text file read"
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            text = "\n".join((p.extract_text() or "") for p in reader.pages[:30])
        except Exception as e:  # noqa: BLE001
            raise ValueError(f"Could not read this PDF ({e}).")
        if not text.strip():
            raise ValueError("This PDF has no text layer (it may be a scan). Upload it as an image instead.")
        return text, "PDF text extraction (pypdf)"
    if name.endswith(".docx"):
        try:
            import docx
            d = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in d.paragraphs), "Word document text extraction (python-docx)"
        except Exception as e:  # noqa: BLE001
            raise ValueError(f"Could not read this Word file ({e}).")
    raise ValueError("Unsupported document type. Use .txt, .md, .pdf or .docx.")
