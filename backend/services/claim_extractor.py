"""Claim extraction. Gemini when available, plain rules otherwise.

Output (one dict per claim):
    {"claim": "...", "importance": "high|medium|low", "type": "factual|opinion|prediction", "search_query": "..."}
Only 'factual' claims go to the evidence pipeline.
"""
import re
from typing import Dict, List, Tuple

from services import gemini_service as gem

OPINION_WORDS = re.compile(r"\b(i think|i believe|should|best|worst|beautiful|proud|amazing|terrible|great|awful|love|hate)\b", re.I)
FUTURE_WORDS = re.compile(r"\b(will|going to|expected to|predict|forecast|next year|by 20\d\d)\b", re.I)
FACT_HINT = re.compile(r"(\d|\b(was|were|is|are|has|have|had|announced|confirmed|signed|killed|won|lost|happened|held|launched)\b)", re.I)


def _clean(c: Dict, i: int) -> Dict:
    imp = c.get("importance") if c.get("importance") in ("high", "medium", "low") else "medium"
    typ = c.get("type") if c.get("type") in ("factual", "opinion", "prediction") else "factual"
    claim = str(c.get("claim", "")).strip()
    return {"id": f"c{i}", "claim": claim, "importance": imp, "type": typ,
            "search_query": (str(c.get("search_query") or claim)[:200]) if typ == "factual" else None}


def rule_based(text: str, max_claims: int = 6) -> List[Dict]:
    """Fallback when Gemini is unavailable: split sentences and guess a type. Deliberately simple."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if len(s.strip()) > 25]
    out = []
    for s in sentences[:max_claims]:
        typ = "prediction" if FUTURE_WORDS.search(s) else "opinion" if OPINION_WORDS.search(s) and not re.search(r"\d", s) \
            else "factual" if FACT_HINT.search(s) else "opinion"
        out.append({"claim": s, "importance": "high" if re.search(r"\d", s) else "medium", "type": typ,
                    "search_query": " ".join(s.split()[:12])})
    return out


def extract(text: str, files=None, max_claims: int = 6, extra: str = "") -> Tuple[List[Dict], Dict]:
    """Returns (claims, info). info = {method, summary, warning}."""
    if gem.is_configured():
        try:
            data = gem.extract_claims(text, files, max_claims, extra)
            claims = [_clean(c, i) for i, c in enumerate(data.get("claims", [])[:max_claims], 1) if str(c.get("claim", "")).strip()]
            if claims:
                return claims, {"method": "Gemini claim extraction", "summary": data.get("summary", ""), "warning": None}
        except gem.GeminiError as e:
            warn = f"Gemini unavailable ({e}). Claims were found with simple sentence rules instead."
        else:
            warn = "Gemini returned no claims. Claims were found with simple sentence rules instead."
    else:
        warn = "GEMINI_API_KEY is not set. Claims were found with simple sentence rules instead."
    claims = [_clean(c, i) for i, c in enumerate(rule_based(text, max_claims), 1)]
    return claims, {"method": "Rule-based sentence splitting (fallback)", "summary": "", "warning": warn}
