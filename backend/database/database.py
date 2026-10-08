"""Tiny SQLite store (standard library only). One row per analysed case."""
import json
import os
import sqlite3
import tempfile
from pathlib import Path
from typing import Dict, List, Optional


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
            case_id TEXT PRIMARY KEY, mode TEXT, input_type TEXT,
            decision TEXT, created_at TEXT, payload TEXT NOT NULL)""")


def save_case(case: Dict) -> None:
    with _conn() as c:
        c.execute("INSERT OR REPLACE INTO cases VALUES (?,?,?,?,?,?)",
                  (case["case_id"], case["mode"], case["input"]["type"],
                   case["overall"]["decision"], case["created_at"], json.dumps(case)))


def get_case(case_id: str) -> Optional[Dict]:
    with _conn() as c:
        row = c.execute("SELECT payload FROM cases WHERE case_id=?", (case_id,)).fetchone()
    return json.loads(row["payload"]) if row else None


def list_cases(limit: int = 20) -> List[Dict]:
    with _conn() as c:
        rows = c.execute("SELECT case_id, mode, input_type, decision, created_at FROM cases "
                         "ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]
