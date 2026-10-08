"""SQLite store for Legit.ai analysis cases, history, and memory cache."""
import json
import os
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


def _get_db_path() -> Path:
    if os.getenv("SQLITE_DB_PATH"):
        return Path(os.environ["SQLITE_DB_PATH"])
    if os.getenv("VERCEL"):
        return Path(tempfile.gettempdir()) / "trustlens.db"
    return Path(__file__).resolve().parent.parent / "data" / "trustlens.db"


def _conn() -> sqlite3.Connection:
    db_path = _get_db_path()
    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(db_path)
    except OSError:
        fallback_path = Path(tempfile.gettempdir()) / "trustlens.db"
        fallback_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(fallback_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS cases (
            case_id TEXT PRIMARY KEY,
            mode TEXT,
            input_type TEXT,
            analysis_type TEXT,
            status TEXT DEFAULT 'COMPLETED',
            created_at TEXT,
            completed_at TEXT,
            processing_time_ms INTEGER DEFAULT 0,
            input_text TEXT,
            original_filename TEXT,
            mime_type TEXT,
            content_hash TEXT,
            cache_key TEXT,
            decision TEXT,
            trust_score REAL,
            confidence REAL,
            risk_score REAL,
            from_cache INTEGER DEFAULT 0,
            payload TEXT NOT NULL
        )""")

        # Add any missing columns if migrating from an earlier schema
        existing_cols = {row[1] for row in c.execute("PRAGMA table_info(cases)").fetchall()}
        columns_to_add = [
            ("input_type", "TEXT"),
            ("analysis_type", "TEXT"),
            ("status", "TEXT DEFAULT 'COMPLETED'"),
            ("completed_at", "TEXT"),
            ("processing_time_ms", "INTEGER DEFAULT 0"),
            ("input_text", "TEXT"),
            ("original_filename", "TEXT"),
            ("mime_type", "TEXT"),
            ("content_hash", "TEXT"),
            ("cache_key", "TEXT"),
            ("trust_score", "REAL"),
            ("confidence", "REAL"),
            ("risk_score", "REAL"),
            ("from_cache", "INTEGER DEFAULT 0"),
        ]
        for col_name, col_type in columns_to_add:
            if col_name not in existing_cols:
                try:
                    c.execute(f"ALTER TABLE cases ADD COLUMN {col_name} {col_type}")
                except sqlite3.OperationalError:
                    pass

        c.execute("CREATE INDEX IF NOT EXISTS idx_cases_cache_key ON cases (cache_key)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases (created_at)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_cases_type ON cases (analysis_type)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_cases_status ON cases (status)")


def save_case(
    case: Dict,
    status: str = "COMPLETED",
    processing_time_ms: Optional[int] = None,
    cache_key: Optional[str] = None,
    original_filename: Optional[str] = None,
    mime_type: Optional[str] = None,
    content_hash: Optional[str] = None,
    from_cache: bool = False,
) -> None:
    case_id = case.get("case_id") or uuid.uuid4().hex[:10]
    case["case_id"] = case_id
    mode = case.get("mode", "live")
    inp = case.get("input", {})
    analysis_type = inp.get("type", "text")
    overall = case.get("overall", {})
    decision = overall.get("decision")
    trust_score = overall.get("trust_score")
    confidence = overall.get("confidence")
    risk_score = case.get("manipulation", {}).get("risk", 0.0)
    created_at = case.get("created_at") or datetime.now(timezone.utc).isoformat(timespec="seconds")
    completed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    input_text = inp.get("text") or inp.get("ocr_text") or inp.get("transcript") or inp.get("title") or ""
    orig_file = original_filename or inp.get("metadata", {}).get("File name")
    mime = mime_type or inp.get("metadata", {}).get("Format")
    chash = content_hash or inp.get("sha256")

    if from_cache:
        case["from_cache"] = True
    elif "from_cache" in case:
        from_cache = bool(case["from_cache"])

    payload_str = json.dumps(case)

    with _conn() as c:
        c.execute("""INSERT OR REPLACE INTO cases (
            case_id, mode, input_type, analysis_type, status, created_at, completed_at,
            processing_time_ms, input_text, original_filename, mime_type, content_hash,
            cache_key, decision, trust_score, confidence, risk_score, from_cache, payload
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
            case_id, mode, analysis_type, analysis_type, status, created_at, completed_at,
            processing_time_ms or 0, input_text, orig_file, mime, chash,
            cache_key, decision, trust_score, confidence, risk_score, 1 if from_cache else 0, payload_str
        ))


def get_case(case_id: str) -> Optional[Dict]:
    with _conn() as c:
        row = c.execute("SELECT payload FROM cases WHERE case_id=?", (case_id,)).fetchone()
    return json.loads(row["payload"]) if row else None


get_history = get_case


def list_cases(limit: int = 20) -> List[Dict]:
    """Legacy helper for backward compatibility."""
    with _conn() as c:
        rows = c.execute("SELECT case_id, mode, input_type, decision, created_at FROM cases "
                         "ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]


def list_history(analysis_type: Optional[str] = None, limit: int = 50) -> List[Dict]:
    """Returns lightweight metadata summaries of stored analyses."""
    with _conn() as c:
        query = ("SELECT case_id, mode, analysis_type, status, created_at, completed_at, "
                 "processing_time_ms, input_text, original_filename, mime_type, content_hash, "
                 "decision, trust_score, confidence, risk_score, from_cache, payload "
                 "FROM cases WHERE status = 'COMPLETED' ")
        params: List[Any] = []
        if analysis_type and analysis_type.strip().lower() != "all":
            norm_type = analysis_type.strip().lower()
            if norm_type == "text":
                query += "AND (LOWER(analysis_type) = 'text' OR LOWER(analysis_type) = 'document') "
            else:
                query += "AND LOWER(analysis_type) = ? "
                params.append(norm_type)
        query += "ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        rows = c.execute(query, params).fetchall()

    out = []
    for r in rows:
        d = dict(r)
        headline = ""
        claims_count = 0
        evidence_count = 0
        preview = None
        try:
            pl = json.loads(d.pop("payload", "{}"))
            headline = pl.get("conclusion", {}).get("headline", "")
            claims_count = len(pl.get("claims", []))
            evidence_count = pl.get("evidence_summary", {}).get("total", 0)
            preview = pl.get("input", {}).get("preview")
        except Exception:
            pass

        out.append({
            "id": d["case_id"],
            "case_id": d["case_id"],
            "mode": d["mode"],
            "analysis_type": d["analysis_type"] or "text",
            "status": d["status"] or "COMPLETED",
            "created_at": d["created_at"],
            "completed_at": d["completed_at"] or d["created_at"],
            "processing_time_ms": d.get("processing_time_ms") or 0,
            "input_text": d.get("input_text") or "",
            "original_filename": d.get("original_filename"),
            "mime_type": d.get("mime_type"),
            "content_hash": d.get("content_hash"),
            "verdict": d.get("decision") or "UNKNOWN",
            "decision": d.get("decision") or "UNKNOWN",
            "trust_score": d.get("trust_score"),
            "confidence": d.get("confidence"),
            "risk_score": d.get("risk_score"),
            "headline": headline,
            "claims_count": claims_count,
            "evidence_count": evidence_count,
            "preview": preview,
            "from_cache": bool(d.get("from_cache", 0)),
        })
    return out


def delete_history(case_id: str) -> bool:
    with _conn() as c:
        cur = c.execute("DELETE FROM cases WHERE case_id=?", (case_id,))
        return cur.rowcount > 0


def clear_history() -> int:
    with _conn() as c:
        cur = c.execute("DELETE FROM cases")
        return cur.rowcount


def get_by_cache_key(cache_key: str, ttl_hours: Optional[float] = None) -> Optional[Dict]:
    """Retrieve cached analysis if valid and not expired."""
    if not cache_key:
        return None
    if ttl_hours is None:
        try:
            ttl_hours = float(os.getenv("ANALYSIS_CACHE_TTL_HOURS", "24"))
        except (ValueError, TypeError):
            ttl_hours = 24.0

    with _conn() as c:
        row = c.execute(
            "SELECT payload, created_at FROM cases WHERE cache_key=? AND status='COMPLETED' ORDER BY created_at DESC LIMIT 1",
            (cache_key,)
        ).fetchone()
        if not row:
            return None

        created_at_str = row["created_at"]
        if ttl_hours > 0:
            try:
                created_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                age_hours = (datetime.now(timezone.utc) - created_dt).total_seconds() / 3600.0
                if age_hours > ttl_hours:
                    return None
            except Exception:
                pass

        data = json.loads(row["payload"])
        data["from_cache"] = True
        return data
