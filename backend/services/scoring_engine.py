"""Transparent, rule-based scoring engine.

Nothing here calls an AI model. The LLM may later CLASSIFY evidence, but the numbers
are always computed by these explicit rules so judges can audit every step.

All weights/thresholds are prototype heuristics, not scientifically validated.
"""
from typing import Dict, List

# --- Trust score weights (sum to 1.0) ---------------------------------------
WEIGHTS = {
    "evidence_support": 0.35,
    "source_reliability": 0.25,
    "agreement": 0.20,
    "manipulation": 0.10,
    "provenance": 0.10,
}
COMPONENT_LABELS = {
    "evidence_support": "Evidence support",
    "source_reliability": "Reliability of supporting sources",
    "agreement": "Cross-source agreement",
    "manipulation": "Manipulation indicators (inverted)",
    "provenance": "Provenance completeness",
}

# --- Tunable thresholds ------------------------------------------------------
IMPORTANCE_WEIGHT = {"high": 3, "medium": 2, "low": 1}
NEUTRAL_DILUTION = 0.25          # neutral evidence slightly dilutes the support signal
MIN_DECISIVE_ITEMS = 3           # decisive items needed for full "coverage"
MIN_DECISIVE_FOR_VERDICT = 2     # fewer than this => insufficient evidence
CONFLICT_SHARE = 0.25            # minority side holds >= 25% of weighted evidence...
CONFLICT_MIN_RELIABILITY = 0.60  # ...and its best source is reasonably reliable
NEAR_TIE_SHARE = 0.40            # or the sides are almost evenly split
MANIP_DAMPING = 0.6              # how strongly one indicator raises overall risk
STRONG_MANIPULATION = 0.70       # risk at/above this blocks a "trusted" verdict
MAX_CONFIDENCE = 0.95            # we never claim certainty
MIN_CONFIDENCE_FOR_VERDICT = 0.25

DECISION_BANDS = [  # (minimum score, label)
    (90, "TRUSTED"),
    (70, "LIKELY TRUSTED"),
    (40, "INCONCLUSIVE"),
    (20, "HIGH RISK"),
    (0, "VERY HIGH RISK"),
]


def band_for_score(score: float) -> str:
    for minimum, label in DECISION_BANDS:
        if score >= minimum:
            return label
    return "VERY HIGH RISK"


def confidence_label(c: float) -> str:
    if c >= 0.75:
        return "High"
    if c >= 0.50:
        return "Medium"
    if c >= 0.25:
        return "Low"
    return "Very low"


# --- Manipulation ------------------------------------------------------------
def manipulation_risk(indicators: List[Dict]) -> float:
    """Noisy-OR combination: several moderate indicators add up, none is 'proof'."""
    p_clean = 1.0
    for ind in indicators:
        p_clean *= 1.0 - MANIP_DAMPING * float(ind.get("severity", 0.0))
    return round(1.0 - p_clean, 3)


# --- Per-claim scoring -------------------------------------------------------
def _mass(evidence: List[Dict], label: str) -> float:
    return sum(e["reliability"] for e in evidence if e["classification"] == label)


def score_claim(evidence: List[Dict], manip_risk: float, manip_applicable: bool) -> Dict:
    sup = [e for e in evidence if e["classification"] == "SUPPORTS"]
    con = [e for e in evidence if e["classification"] == "CONTRADICTS"]
    neu = [e for e in evidence if e["classification"] == "NEUTRAL"]
    S, C, N = _mass(evidence, "SUPPORTS"), _mass(evidence, "CONTRADICTS"), _mass(evidence, "NEUTRAL")
    decisive_n = len(sup) + len(con)
    coverage = min(1.0, decisive_n / MIN_DECISIVE_ITEMS)

    if S + C > 0:
        net = (S - C) / (S + C + NEUTRAL_DILUTION * N)       # -1 .. +1
        support = ((net + 1) / 2) * coverage
        agreement = (S / (S + C)) * coverage
        minority_share = min(S, C) / (S + C)
    else:
        support = agreement = minority_share = 0.0

    supporting_reliability = (sum(e["reliability"] for e in sup) / len(sup)) if sup else 0.0
    provenance = (sum(e["provenance_completeness"] for e in evidence) / len(evidence)) if evidence else 0.0

    values = {
        "evidence_support": support,
        "source_reliability": supporting_reliability,
        "agreement": agreement,
        "manipulation": 1.0 - manip_risk,
        "provenance": provenance,
    }
    weights = dict(WEIGHTS)
    if not manip_applicable:           # text input: redistribute weight instead of faking a value
        weights.pop("manipulation")
    total_w = sum(weights.values())
    weights = {k: w / total_w for k, w in weights.items()}

    components = []
    trust = 0.0
    for key in WEIGHTS:
        if key not in weights:
            components.append({"key": key, "label": COMPONENT_LABELS[key], "value": None,
                               "weight": 0.0, "points": 0.0, "applicable": False})
            continue
        pts = values[key] * weights[key] * 100
        trust += pts
        components.append({"key": key, "label": COMPONENT_LABELS[key], "value": round(values[key], 3),
                           "weight": round(weights[key], 3), "points": round(pts, 1), "applicable": True})
    trust = round(trust, 1)

    # --- flags ---
    insufficient = decisive_n < MIN_DECISIVE_FOR_VERDICT
    conflict = False
    if S > 0 and C > 0:
        minority_items = sup if S < C else con
        minority_best = max(e["reliability"] for e in minority_items)
        conflict = (minority_share >= NEAR_TIE_SHARE or
                    (minority_share >= CONFLICT_SHARE and minority_best >= CONFLICT_MIN_RELIABILITY))

    # --- confidence (separate from trust) ---
    if not evidence:
        confidence = 0.05
    else:
        decisive = sup + con
        avg_rel = (sum(e["reliability"] for e in decisive) / len(decisive)) if decisive else 0.0
        domains = {e["domain"] for e in evidence}
        independence = len(domains) / len(evidence)
        confidence = (0.30 * min(1.0, decisive_n / 4)
                      + 0.30 * (1 - 2 * minority_share)
                      + 0.20 * avg_rel
                      + 0.10 * independence
                      + 0.10 * provenance)
        if insufficient:
            confidence = min(confidence, 0.35)
        if conflict:
            confidence = min(confidence, 0.45)
    confidence = round(min(confidence, MAX_CONFIDENCE), 3)

    # --- status & decision ---
    if insufficient:
        status, reason = "INCONCLUSIVE", "insufficient"
    elif conflict:
        status, reason = "INCONCLUSIVE", "conflicting"
    elif S > C:
        status, reason = "SUPPORTED", "majority_support"
    else:
        status, reason = "CONTRADICTED", "majority_contradiction"

    raw_band = band_for_score(trust)
    if insufficient or conflict or confidence < MIN_CONFIDENCE_FOR_VERDICT:
        decision = "INCONCLUSIVE"
    else:
        decision = raw_band

    return {
        "trust_score": trust, "raw_band": raw_band, "decision": decision,
        "confidence": confidence, "confidence_label": confidence_label(confidence),
        "status": status, "status_reason": reason,
        "conflict": conflict, "insufficient": insufficient,
        "components": components,
        "evidence_mass": {"supports": round(S, 2), "contradicts": round(C, 2), "neutral": round(N, 2)},
        "counts": {"supports": len(sup), "contradicts": len(con), "neutral": len(neu)},
        "minority_share": round(minority_share, 3),
    }


# --- Whole-case aggregation --------------------------------------------------
def aggregate(claims: List[Dict], manip_risk: float, manip_applicable: bool) -> Dict:
    verifiable = [c for c in claims if c["verifiable"]]
    reasons: List[str] = []

    if not verifiable:
        return {"trust_score": 0.0, "raw_band": "INCONCLUSIVE", "decision": "INCONCLUSIVE",
                "forced_inconclusive": True, "force_reasons": ["No verifiable factual claims were found."],
                "confidence": 0.05, "confidence_label": "Very low", "components": []}

    scored = [c for c in verifiable if not c["insufficient"]] or verifiable
    wsum = sum(IMPORTANCE_WEIGHT[c["importance"]] for c in scored)
    trust = sum(c["trust_score"] * IMPORTANCE_WEIGHT[c["importance"]] for c in scored) / wsum
    cw = sum(IMPORTANCE_WEIGHT[c["importance"]] for c in verifiable)
    confidence = sum(c["confidence"] * IMPORTANCE_WEIGHT[c["importance"]] for c in verifiable) / cw
    trust, confidence = round(trust, 1), round(min(confidence, MAX_CONFIDENCE), 3)

    # blended components so the UI can show one breakdown
    comp = []
    for key in WEIGHTS:
        rows = [next(x for x in c["components"] if x["key"] == key) for c in scored]
        if not rows[0]["applicable"]:
            comp.append(dict(rows[0])); continue
        w = [IMPORTANCE_WEIGHT[c["importance"]] for c in scored]
        comp.append({"key": key, "label": COMPONENT_LABELS[key], "applicable": True,
                     "value": round(sum(r["value"] * x for r, x in zip(rows, w)) / wsum, 3),
                     "weight": rows[0]["weight"],
                     "points": round(sum(r["points"] * x for r, x in zip(rows, w)) / wsum, 1)})

    for c in verifiable:
        if c["importance"] in ("high", "medium"):
            if c["conflict"]:
                reasons.append(f"Claim {c['id']} has conflicting evidence from reliable sources.")
            elif c["insufficient"]:
                reasons.append(f"Claim {c['id']} has insufficient independent evidence.")
    if confidence < MIN_CONFIDENCE_FOR_VERDICT:
        reasons.append("Overall confidence is too low to give a verdict.")

    raw_band = band_for_score(trust)
    if manip_applicable and manip_risk >= STRONG_MANIPULATION and raw_band in ("TRUSTED", "LIKELY TRUSTED"):
        reasons.append("Strong manipulation indicators were found; supporting evidence may refer to an "
                       "original version of this media rather than the file submitted.")

    forced = bool(reasons)
    return {"trust_score": trust, "raw_band": raw_band,
            "decision": "INCONCLUSIVE" if forced else raw_band,
            "forced_inconclusive": forced and raw_band != "INCONCLUSIVE",
            "force_reasons": reasons,
            "confidence": confidence, "confidence_label": confidence_label(confidence),
            "components": comp}
