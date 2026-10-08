"""Cache key and normalization utilities for Legit.ai analysis caching."""
import hashlib
import os
import re
from typing import Optional


def normalize_text(text: Optional[str]) -> str:
    """Normalize input text/claims consistently: strip, collapse whitespace, lowercase."""
    if not text:
        return ""
    cleaned = re.sub(r"\s+", " ", text.strip()).lower()
    return cleaned


def text_cache_key(text: str, reference_text: str = "") -> str:
    """Deterministic cache key for text/document claims."""
    norm_text = normalize_text(text)
    norm_ref = normalize_text(reference_text)
    parts = ["type:text", f"text:{norm_text}"]
    if norm_ref:
        parts.append(f"ref:{norm_ref}")
    raw_key = "|".join(parts)
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def media_cache_key(analysis_type: str, caption: str = "", content_bytes: Optional[bytes] = None,
                    reference_text: str = "") -> str:
    """Deterministic cache key for media (image/document/audio/video).

    Includes:
    - normalized analysis type
    - normalized caption/claim
    - SHA-256 of media bytes
    - normalized reference text if any
    """
    norm_type = analysis_type.strip().lower()
    norm_cap = normalize_text(caption)
    norm_ref = normalize_text(reference_text)

    parts = [f"type:{norm_type}"]
    if norm_cap:
        parts.append(f"caption:{norm_cap}")
    if content_bytes is not None:
        file_hash = hashlib.sha256(content_bytes).hexdigest()
        parts.append(f"hash:{file_hash}")
    if norm_ref:
        parts.append(f"ref:{norm_ref}")

    raw_key = "|".join(parts)
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def get_cache_ttl_hours() -> float:
    """Retrieve configured cache TTL in hours, defaulting to 24."""
    try:
        return float(os.getenv("ANALYSIS_CACHE_TTL_HOURS", "24"))
    except (ValueError, TypeError):
        return 24.0
