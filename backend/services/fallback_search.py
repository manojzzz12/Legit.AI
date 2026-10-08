"""Backup evidence search: the free MediaWiki (Wikipedia) API. No key, no credit card.

Used automatically when Tavily is not configured, returns an error (quota, bad key, network),
or finds nothing. Good for notable people, places, events and dates; weak for breaking news
and local rumours. Wikipedia is crowd-edited, so it gets a lower prototype reliability weight
than news or official sources. Set FALLBACK_SEARCH=off to disable.
"""
import os
from datetime import datetime, timezone
from typing import Dict, List

import httpx

UA = "TrustLensAI-hackathon/0.2 (evidence verification prototype)"  # Wikipedia requires a User-Agent


def enabled() -> bool:
    return os.getenv("FALLBACK_SEARCH", "wikipedia").lower() == "wikipedia"


def search(query: str, max_results: int = 2) -> List[Dict]:
    """Returns evidence items shaped like Tavily results. Raises httpx.HTTPError on network failure."""
    lang = os.getenv("WIKI_LANG", "en")
    r = httpx.get(f"https://{lang}.wikipedia.org/w/api.php", headers={"User-Agent": UA}, timeout=20.0, params={
        "action": "query", "format": "json", "generator": "search", "gsrsearch": query[:300],
        "gsrlimit": max_results, "prop": "extracts|info", "exintro": 1, "explaintext": 1,
        "exchars": 900, "inprop": "url"})
    r.raise_for_status()
    pages = sorted((r.json().get("query", {}).get("pages", {})).values(), key=lambda p: p.get("index", 99))
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return [{"title": p.get("title", ""), "url": p.get("fullurl") or "", "domain": f"{lang}.wikipedia.org",
             "snippet": (p.get("extract") or "").strip(), "retrieved_at": now}
            for p in pages if (p.get("extract") or "").strip() and p.get("fullurl")][:max_results]
