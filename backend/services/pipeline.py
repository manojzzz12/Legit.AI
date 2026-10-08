"""Turns a raw case (input + claims + evidence + indicators) into a full analysis result.

Flow:  enrich evidence -> manipulation risk -> score each claim -> aggregate
       -> contradictions -> evidence trail -> reasoned conclusion

The same function powers the demo scenarios AND /api/calculate-trust, so the demo
exercises the real scoring code instead of hard-coded results.
"""
import copy
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List

from services import scoring_engine as se
from services.evidence_engine import (SOURCE_TYPES, contradiction_panel, count_by_class,
                                      enrich_evidence)

DISCLAIMER = ("TrustLens estimates risk from the evidence it can find. It does not prove that content "
              "is real or fake, and manipulation indicators are signals, not proof.")


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def _explain_claim(c: Dict) -> str:
    n = c["counts"]
    tally = f"{n['supports']} supporting, {n['contradicts']} contradicting, {n['neutral']} neutral"
    if c["status_reason"] == "insufficient":
        return (f"Available evidence is insufficient ({tally}). Fewer than "
                f"{se.MIN_DECISIVE_FOR_VERDICT} sources took a clear position, so no verdict is given.")
    if c["status_reason"] == "conflicting":
        return (f"Conflicting evidence prevents a reliable conclusion ({tally}). Both sides include "
                f"sources of meaningful reliability, so the claim is left INCONCLUSIVE.")
    strong = c["confidence"] >= 0.75
    if c["status"] == "SUPPORTED":
        lead = "Evidence strongly supports the claim" if strong else "Evidence supports the claim"
    else:
        lead = "Evidence strongly contradicts the claim" if strong else "Evidence contradicts the claim"
    return f"{lead} ({tally})."


def _headline(decision: str, claims: List[Dict]) -> str:
    verifiable = [c for c in claims if c["verifiable"]]
    if decision == "TRUSTED":
        return "Evidence strongly supports the claims in this content."
    if decision == "LIKELY TRUSTED":
        return "Evidence supports the main claims, with some limits."
    if decision == "INCONCLUSIVE":
        if any(c["conflict"] for c in verifiable):
            return "Conflicting evidence prevents a reliable conclusion."
        if any(c["insufficient"] for c in verifiable) or not verifiable:
            return "Available evidence is insufficient."
        return "The evidence does not point clearly in either direction."
    return "Evidence strongly contradicts the main claims."


def build_case(raw: Dict, mode: str = "demo", case_id: str = None) -> Dict:
    raw = copy.deepcopy(raw)  # never mutate the shared demo fixtures
    now = datetime.now(timezone.utc)
    start = now - timedelta(seconds=20)
    simulated = mode == "demo"
    live = mode == "live"
    inp = raw["input"]
    warnings = list(raw.get("warnings", []))

    # ---- manipulation -------------------------------------------------------
    manip_in = raw.get("manipulation", {"applicable": False, "indicators": []})
    indicators = manip_in.get("indicators", [])
    for ind in indicators:
        ind.setdefault("detected", ind.get("severity", 0) > 0)
    applicable = bool(manip_in.get("applicable", False))
    risk = se.manipulation_risk(indicators) if applicable else 0.0
    manipulation = {
        "applicable": applicable, "risk": risk,
        "risk_label": "High" if risk >= 0.6 else "Moderate" if risk >= 0.3 else "Low",
        "indicators": indicators,
        "note": manip_in.get("note", ""),
        "disclaimer": "Manipulation indicators were detected, but they are not definitive proof."
        if risk >= 0.3 else
        "No strong indicators were found. This does not prove the media is authentic.",
    }

    # ---- claims -------------------------------------------------------------
    claims: List[Dict] = []
    for rc in raw["claims"]:
        verifiable = rc["type"] == "factual"
        base = {"id": rc["id"], "claim": rc["claim"], "importance": rc["importance"], "type": rc["type"],
                "verifiable": verifiable, "search_query": rc.get("search_query")}
        if verifiable:
            ev = [enrich_evidence(e, _iso(start + timedelta(seconds=e.get("retrieved_offset_s", 0))), simulated)
                  for e in rc.get("evidence", [])]
            base["evidence"] = ev
            base.update(se.score_claim(ev, risk, applicable))
            base["explanation"] = _explain_claim(base)
        else:
            base.update({"evidence": [], "status": "NOT VERIFIED", "trust_score": None, "confidence": None,
                         "confidence_label": None, "decision": None, "conflict": False, "insufficient": False,
                         "explanation": f"This is {'an' if rc['type'] == 'opinion' else 'a'} {rc['type']}, "
                                        "so it is not sent to evidence verification."})
        claims.append(base)

    overall = se.aggregate(claims, risk, applicable)
    all_ev = [e for c in claims for e in c["evidence"]]
    counts = count_by_class(all_ev)

    # ---- summary & contradictions ------------------------------------------
    by_type: Dict[str, int] = {}
    for e in all_ev:
        by_type[e["source_type_label"]] = by_type.get(e["source_type_label"], 0) + 1
    evidence_summary = {
        "total": len(all_ev), "counts": counts,
        "distinct_domains": len({e["domain"] for e in all_ev}),
        "by_source_type": by_type,
        "average_reliability": round(sum(e["reliability"] for e in all_ev) / len(all_ev), 2) if all_ev else None,
    }
    contradictions = [p for p in (contradiction_panel(c) for c in claims if c["verifiable"]) if p]

    # ---- evidence trail -----------------------------------------------------
    n_fact = sum(1 for c in claims if c["verifiable"])
    last_ret = max([e.get("retrieved_offset_s", 0) for rc in raw["claims"] for e in rc.get("evidence", [])] or [3])
    t = lambda s: _iso(start + timedelta(seconds=s))
    sim = " (simulated in demo mode)" if simulated else ""
    trail = [
        {"step": "INPUT RECEIVED", "status": "complete", "timestamp": t(0),
         "detail": f"{inp['type'].capitalize()} input received: {inp.get('title', 'untitled')}."},
        {"step": "CONTENT EXTRACTED", "status": "complete", "timestamp": t(1),
         "detail": f"{inp.get('extraction_method', 'Direct input')}{sim}."},
        {"step": "CLAIMS IDENTIFIED", "status": "complete", "timestamp": t(2),
         "detail": f"{len(claims)} claims found; {n_fact} factual claim(s) sent to verification."},
        {"step": "EVIDENCE SEARCHED", "status": "complete", "timestamp": t(3),
         "detail": raw.get("search_note") or f"{len(all_ev)} independent sources retrieved{sim}."},
        {"step": "SOURCES ANALYZED", "status": "complete", "timestamp": t(last_ret + 1),
         "detail": f"{counts['SUPPORTS']} support, {counts['CONTRADICTS']} contradict, {counts['NEUTRAL']} neutral. "
                   "Reliability assigned with prototype heuristic weights."},
        {"step": "CONTRADICTIONS CHECKED", "status": "warning" if any(c["conflict"] for c in claims) else "complete",
         "timestamp": t(last_ret + 2),
         "detail": f"{sum(1 for c in claims if c['conflict'])} claim(s) with strongly conflicting evidence."},
        {"step": "TRUST SCORE CALCULATED", "status": "complete", "timestamp": t(last_ret + 3),
         "detail": f"Rule-based score {overall['trust_score']}/100, confidence {round(overall['confidence'] * 100)}%."},
        {"step": "FINAL CONCLUSION", "status": "warning" if overall["decision"] == "INCONCLUSIVE" else "complete",
         "timestamp": t(last_ret + 4), "detail": f"Decision: {overall['decision']}."},
    ]

    if raw.get("trail_ts") and len(raw["trail_ts"]) == len(trail):   # live mode: real timestamps
        for step, ts in zip(trail, raw["trail_ts"]):
            step["timestamp"] = ts

    # ---- reasoned conclusion ------------------------------------------------
    reasoning = [f"Claim {c['id']}: {c['explanation']}" for c in claims if c["verifiable"]]
    skipped = [c for c in claims if not c["verifiable"]]
    if skipped:
        reasoning.append(f"{len(skipped)} opinion/prediction statement(s) were listed but not verified.")
    if overall["forced_inconclusive"]:
        reasoning.append(f"The score alone ({overall['trust_score']}) falls in the {overall['raw_band']} range, "
                         "but the decision is set to INCONCLUSIVE because: " + " ".join(overall["force_reasons"]))
    if applicable:
        reasoning.append(manipulation["disclaimer"] + f" Combined manipulation risk: {round(risk * 100)}%.")
    reasoning.append(f"Confidence is {round(overall['confidence'] * 100)}% ({overall['confidence_label']}). "
                     "It is calculated separately from the trust score and reflects how much, how reliable and "
                     "how consistent the evidence is.")

    caveats = [DISCLAIMER, "Source reliability weights are prototype heuristics, not scientifically validated."]
    if simulated:
        caveats.insert(0, "DEMO MODE: sources, extraction and classification are pre-recorded fixtures. "
                          "The scoring, confidence and decision logic are real and run live.")

    if live and any(e["source_type"] == "user_provided" for e in all_ev):
        caveats.insert(0, "Some evidence came from documents you supplied. It is used as given evidence, "
                          "not as independent corroboration, and carries a lower reliability weight.")
    text_for_hash = "|".join([inp.get("text", ""), inp.get("ocr_text", ""), inp.get("transcript", "")])
    return {
        "case_id": case_id or uuid.uuid4().hex[:10],
        "mode": mode,
        "created_at": _iso(now),
        "demo": {"id": raw.get("id"), "label": raw.get("label"), "tagline": raw.get("tagline"),
                 "expected": raw.get("expected")} if raw.get("id") else None,
        "input": {**inp, "sha256": hashlib.sha256(text_for_hash.encode()).hexdigest()[:16]},
        "claims": claims,
        "warnings": warnings,
        "manipulation": manipulation,
        "overall": overall,
        "evidence_summary": evidence_summary,
        "contradictions": contradictions,
        "trail": trail,
        "conclusion": {"headline": _headline(overall["decision"], claims),
                       "reasoning": reasoning, "caveats": caveats},
        "heuristics": {
            "trust_weights": se.WEIGHTS,
            "source_weights": {k: {"label": v["label"], "weight": v["weight"]} for k, v in SOURCE_TYPES.items()},
            "decision_bands": [{"min": m, "label": l} for m, l in se.DECISION_BANDS],
            "note": "Prototype heuristic weights chosen by the team. Not scientifically validated.",
        },
    }
