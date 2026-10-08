"""Tavily (free tier) search wrapper. Search ranking is NOT proof of truth.

Free-tier credits are limited, so the pipeline searches only a few claims per case
(MAX_SEARCHES_PER_CASE) and asks for a handful of results each. Key: TAVILY_API_KEY.
"""
import os
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional
from urllib.parse import urlparse

import httpx

TAVILY_URL = "https://api.tavily.com/search"


class TavilyError(RuntimeError):
    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind  # not_configured | auth | quota | network


def is_configured() -> bool:
    return bool(os.getenv("TAVILY_API_KEY"))


def max_searches() -> int:
    """Safety cap on searches per case (1 free-tier credit each). Claims are capped at 6 per case,
    so the default of 6 means every factual claim gets searched."""
    return int(os.getenv("MAX_SEARCHES_PER_CASE", "6"))


def _bare(domain: str) -> str:
    d = (domain or "").lower()
    return d[4:] if d.startswith("www.") else d


def search(query: str, max_results: int = 5, exclude_domains: Optional[Iterable[str]] = None) -> List[Dict]:
    """Independent evidence: at most ONE result per domain (so one site cannot count as several
    sources), and never a domain in exclude_domains (e.g. the page the claim itself came from)."""
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        raise TavilyError("not_configured", "TAVILY_API_KEY is not set in backend/.env.")
    excluded = {_bare(d) for d in (exclude_domains or []) if d}
    payload = {"query": query[:380], "search_depth": "basic", "max_results": min(max_results + 3, 10),
               "include_answer": False, "include_raw_content": False}
    if excluded:
        payload["exclude_domains"] = sorted(excluded)[:20]
    try:
        r = httpx.post(TAVILY_URL, headers={"Authorization": f"Bearer {key}"}, timeout=30.0, json=payload)
    except httpx.HTTPError as e:
        raise TavilyError("network", f"Could not reach Tavily: {e}")
    if r.status_code in (401, 403):
        raise TavilyError("auth", "Tavily rejected the API key (check TAVILY_API_KEY).")
    if r.status_code in (429, 432, 433):
        raise TavilyError("quota", "Tavily free-tier quota or rate limit reached.")
    if r.status_code != 200:
        raise TavilyError("network", f"Tavily error {r.status_code}.")
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    out, seen_domains = [], set()
    for res in r.json().get("results", []):
        url = res.get("url") or ""
        dom = _bare(urlparse(url).netloc)
        if not url or dom in seen_domains or dom in excluded or not (res.get("content") or "").strip():
            continue
        seen_domains.add(dom)
        out.append({"title": res.get("title") or url, "url": url,
                    "domain": urlparse(url).netloc.lower(),
                    "snippet": (res.get("content") or "").strip(),
                    "retrieved_at": now})
    return out[:max_results]


def self_test() -> Dict:
    """One real search (1 free-tier credit) to confirm the key works. Never returns the key."""
    if not is_configured():
        return {"ok": False, "error": "not_configured", "message": "TAVILY_API_KEY is not set in backend/.env."}
    try:
        res = search("capital of France", max_results=2)
        return {"ok": True, "results_returned": len(res), "credits_used": 1}
    except TavilyError as e:
        return {"ok": False, "error": e.kind, "message": str(e)}
