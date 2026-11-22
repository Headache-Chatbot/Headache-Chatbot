import sqlite3
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

# Database lives next to this file (backend/), regardless of where the repo is stored
DB_PATH = Path(__file__).parent.resolve() / "clinical_cds.db"

_initialized = False

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def validate_password_strength(password: str) -> Dict[str, Any]:
    errors = []
    if len(password) < 4:
        errors.append("Password must be at least 4 characters long.")
    
    return {
        "valid": len(errors) == 0,
        "errors": errors
    }

def init_db():
    global _initialized
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cursor = conn.cursor()
        
        # Users table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            plain_password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            is_banned INTEGER NOT NULL DEFAULT 0,
            share_for_training INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
        """)
        
        # Query History table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS query_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            query TEXT NOT NULL,
            answer TEXT NOT NULL,
            red_flags TEXT NOT NULL,
            sources TEXT NOT NULL,
            validation TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """)
        
        # Pre-seed accounts if they do not exist
        default_accounts = [
            ("admin", "#1234$", "admin", 1),
            ("user1", "#1234$", "user", 1),
            ("user2", "#1234$", "user", 0),
            ("user3", "#1234$", "user", 1)
        ]
        
        for uname, pwd, role, consent in default_accounts:
            cursor.execute("SELECT id FROM users WHERE username = ?", (uname,))
            row = cursor.fetchone()
            if not row:
                now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                cursor.execute("""
                INSERT INTO users (username, password_hash, plain_password, role, is_banned, share_for_training, created_at)
                VALUES (?, ?, ?, ?, 0, ?, ?)
                """, (uname, hash_password(pwd), pwd, role, consent, now))
        
        conn.commit()
        _initialized = True
    finally:
        conn.close()

def get_db():
    if not _initialized or not DB_PATH.exists():
        init_db()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

# User helper methods
def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        return dict(row) if row else None

def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def create_user(username: str, password: str, share_for_training: bool = True) -> Dict[str, Any]:
    strength = validate_password_strength(password)
    if not strength["valid"]:
        raise ValueError(" ".join(strength["errors"]))
    
    if get_user_by_username(username):
        raise ValueError(f"Username '{username}' already exists.")
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO users (username, password_hash, plain_password, role, is_banned, share_for_training, created_at)
        VALUES (?, ?, ?, 'user', 0, ?, ?)
        """, (username, hash_password(password), password, 1 if share_for_training else 0, now))
        conn.commit()
        user_id = cursor.lastrowid
        
    try:
        from export_db_to_desktop import export_database
        export_database()
    except Exception:
        pass

    return get_user_by_id(user_id)

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    user = get_user_by_username(username)
    if not user:
        return None
    if user["password_hash"] != hash_password(password):
        return None
    return user

def update_user_consent(user_id: int, consent: bool):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET share_for_training = ? WHERE id = ?", (1 if consent else 0, user_id))
        conn.commit()

def toggle_user_ban(user_id: int, ban_status: bool):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET is_banned = ? WHERE id = ?", (1 if ban_status else 0, user_id))
        conn.commit()

def save_query_history(user_id: int, username: str, query: str, answer: str, red_flags: List[str], sources: List[Any], validation: Dict[str, Any]):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO query_history (user_id, username, query, answer, red_flags, sources, validation, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            username,
            query,
            answer,
            json.dumps(red_flags),
            json.dumps(sources),
            json.dumps(validation),
            now
        ))
        conn.commit()

    try:
        from export_db_to_desktop import export_database
        export_database()
    except Exception:
        pass

def get_user_history(user_id: int) -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM query_history WHERE user_id = ? ORDER BY id DESC", (user_id,))
        rows = cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["red_flags"] = json.loads(d["red_flags"])
            d["sources"] = json.loads(d["sources"])
            d["validation"] = json.loads(d["validation"])
            result.append(d)
        return result

def delete_user_account(user_id: int, password: str) -> bool:
    """Deletes a user account and all their query history after verifying password."""
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found.")
    if user["password_hash"] != hash_password(password):
        raise ValueError("Incorrect password. Account deletion aborted.")
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM query_history WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    return True

def clear_user_history(user_id: int) -> bool:
    """Clears all history for a specific user."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM query_history WHERE user_id = ?", (user_id,))
        conn.commit()
    return True

def delete_single_chat(user_id: int, query_id: int) -> bool:
    """Deletes a specific chat item from query history."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM query_history WHERE id = ? AND user_id = ?", (query_id, user_id))
        conn.commit()
    return True

def get_all_users_for_admin() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT u.id, u.username, u.plain_password, u.role, u.is_banned, u.share_for_training, u.created_at,
               COUNT(q.id) as total_queries
        FROM users u
        LEFT JOIN query_history q ON u.id = q.user_id
        GROUP BY u.id
        ORDER BY u.id ASC
        """)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def get_user_history_for_admin(target_user_id: int) -> Dict[str, Any]:
    user = get_user_by_id(target_user_id)
    if not user:
        return {"error": "User not found"}
    
    if not user["share_for_training"]:
        return {
            "user_id": user["id"],
            "username": user["username"],
            "hidden": True,
            "message": "Data hidden: User did not consent to AI training & history sharing.",
            "history": []
        }
    
    history = get_user_history(target_user_id)
    return {
        "user_id": user["id"],
        "username": user["username"],
        "hidden": False,
        "history": history
    }

def export_consented_training_data() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        SELECT q.id, q.username, q.query, q.answer, q.red_flags, q.sources, q.validation, q.timestamp
        FROM query_history q
        JOIN users u ON q.user_id = u.id
        WHERE u.share_for_training = 1
        ORDER BY q.id ASC
        """)
        rows = cursor.fetchall()
        dataset = []
        for r in rows:
            d = dict(r)
            sources = json.loads(d["sources"])
            citations = [s.get("citation", "") for s in sources]
            dataset.append({
                "id": d["id"],
                "timestamp": d["timestamp"],
                "instruction": "You are an evidence-grounded clinical decision support assistant.",
                "clinical_query": d["query"],
                "guideline_grounded_response": d["answer"],
                "retrieved_citations": citations,
                "red_flags_detected": json.loads(d["red_flags"])
            })
        return dataset

# Initialize on module import
init_db()
