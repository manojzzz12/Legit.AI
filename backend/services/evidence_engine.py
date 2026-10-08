"""Evidence helpers: source reliability, provenance, summaries, contradictions.

IMPORTANT: every number in SOURCE_TYPES is a PROTOTYPE HEURISTIC WEIGHT chosen by
the team. They are not scientifically validated. The UI says so too.
"""
from typing import Dict, List, Optional

# ---------------------------------------------------------------- reliability
SOURCE_TYPES: Dict[str, Dict] = {
    "official": {"label": "Official government / international body", "weight": 0.95},
    "academic": {"label": "Academic / research source", "weight": 0.90},
    "news": {"label": "Recognised news organisation", "weight": 0.80},
    "organization": {"label": "Established organisation", "weight": 0.80},
    "unclassified_org": {"label": "Unclassified .org website", "weight": 0.55},
    "unknown": {"label": "Unknown website", "weight": 0.40},
    "encyclopedia": {"label": "Crowd-edited encyclopedia (Wikipedia)", "weight": 0.65},
    "social": {"label": "Social media", "weight": 0.20},
    "user_provided": {"label": "User-provided reference document (not independent)", "weight": 0.50},
}

OFFICIAL_LABELS = {"gov", "nic", "mil"}
OFFICIAL_DOMAINS = {"un.org", "who.int", "europa.eu", "worldbank.org", "imf.org"}
ACADEMIC_DOMAINS = {"nature.com", "science.org", "arxiv.org", "thelancet.com", "jstor.org"}
NEWS_DOMAINS = {
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "thehindu.com",
    "indianexpress.com", "ndtv.com", "nytimes.com", "theguardian.com",
    "washingtonpost.com", "aljazeera.com", "hindustantimes.com", "timesofindia.indiatimes.com",
}
ORG_DOMAINS = {"planetary.org", "redcross.org", "amnesty.org", "icrc.org", "unicef.org"}
SOCIAL_DOMAINS = {
    "facebook.com", "x.com", "twitter.com", "instagram.com", "tiktok.com",
    "reddit.com", "t.me", "youtube.com", "whatsapp.com",
}

# Fictional ".example" domains used ONLY by the demo scenarios (".example" is a
# reserved TLD, so these can never point at a real website).
DEMO_DOMAIN_TYPES = {
    "factcheck-desk.example": "news",
    "greenfield-herald.example": "news",
    "city-news-network.example": "news",
    "transit-council.example": "organization",
}


def _matches(domain: str, names: set) -> bool:
    return any(domain == n or domain.endswith("." + n) for n in names)


def normalize_domain(domain: str) -> str:
    d = (domain or "").lower().strip()
    return d[4:] if d.startswith("www.") else d


def classify_source(domain: str) -> Dict:
    """Rule-based source type + heuristic reliability weight (transparent on purpose)."""
    d = normalize_domain(domain)
    labels = set(d.split("."))
    if d.startswith("user-provided"):
        key = "user_provided"
    elif d.endswith("wikipedia.org"):
        key = "encyclopedia"
    elif d in DEMO_DOMAIN_TYPES:
        key = DEMO_DOMAIN_TYPES[d]
    elif labels & OFFICIAL_LABELS or d.endswith(".int") or _matches(d, OFFICIAL_DOMAINS):
        key = "official"
    elif "edu" in labels or "ac" in labels or _matches(d, ACADEMIC_DOMAINS):
        key = "academic"
    elif _matches(d, NEWS_DOMAINS):
        key = "news"
    elif _matches(d, ORG_DOMAINS):
        key = "organization"
    elif _matches(d, SOCIAL_DOMAINS):
        key = "social"
    elif d.endswith(".org"):
        key = "unclassified_org"
    else:
        key = "unknown"
    return {"source_type": key, "source_type_label": SOURCE_TYPES[key]["label"],
            "reliability": SOURCE_TYPES[key]["weight"]}


# ----------------------------------------------------------------- provenance
PROVENANCE_FIELDS = ["url", "title", "retrieved_at", "content_type",
                     "processing_method", "classification", "reliability"]


def provenance_completeness(item: Dict) -> float:
    present = sum(1 for f in PROVENANCE_FIELDS if item.get(f) not in (None, ""))
    return round(present / len(PROVENANCE_FIELDS), 3)


def enrich_evidence(item: Dict, retrieved_at: str, simulated: bool) -> Dict:
    """Add reliability + provenance to a raw evidence item."""
    out = dict(item)
    out.update(classify_source(item["domain"]))
    out["retrieved_at"] = item.get("retrieved_at") or retrieved_at
    out["simulated"] = simulated
    out["provenance_completeness"] = provenance_completeness(out)
    return out


# ------------------------------------------------------------------ summaries
def count_by_class(evidence: List[Dict]) -> Dict[str, int]:
    counts = {"SUPPORTS": 0, "CONTRADICTS": 0, "NEUTRAL": 0}
    for e in evidence:
        counts[e["classification"]] += 1
    return counts


def contradiction_panel(claim: Dict) -> Optional[Dict]:
    """Build the 'Conflicting Evidence Detected' panel for one scored claim."""
    ev = claim["evidence"]
    sides = {k: [e for e in ev if e["classification"] == k]
             for k in ("SUPPORTS", "CONTRADICTS", "NEUTRAL")}
    has_both = sides["SUPPORTS"] and sides["CONTRADICTS"]
    if not (claim["conflict"] or has_both):
        return None
    return {
        "claim_id": claim["id"],
        "claim": claim["claim"],
        "strongly_conflicting": claim["conflict"],
        "sides": sides,
        "conclusion": claim["status"],
    }
