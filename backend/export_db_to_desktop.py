import sqlite3
import os
import json
from datetime import datetime
from pathlib import Path

def export_database():
    backend_dir = Path(__file__).parent.resolve()
    db_path = backend_dir / "clinical_cds.db"
    desktop_path = Path(os.environ.get("USERPROFILE", "C:/Users/I-FiX")) / "Desktop"
    
    if not db_path.exists():
        print(f"Database not found at: {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        users = conn.execute("SELECT * FROM users ORDER BY id ASC").fetchall()
        history = conn.execute("SELECT * FROM query_history ORDER BY id DESC").fetchall()
    finally:
        conn.close()

    now_str = datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")

    # 1. Plain Text Format
    txt_file = desktop_path / "Clinical_CDS_Database.txt"
    lines = []
    lines.append("=" * 95)
    lines.append("        CLINICAL DECISION SUPPORT (CDS) - DATABASE EXPORT (DEVELOPER VIEW)")
    lines.append(f" Generated on: {now_str}")
    lines.append(f" Local Database: {db_path}")
    lines.append("=" * 95)
    lines.append("")
    lines.append("--- [1] REGISTERED USER ACCOUNTS & LOGINS ---")
    lines.append(f"Total Users: {len(users)}")
    lines.append("-" * 95)
    lines.append(f"{'ID':<4} | {'Username':<18} | {'Password':<18} | {'Role':<8} | {'Status':<8} | {'Consent':<8} | {'Created At'}")
    lines.append("-" * 95)
    for u in users:
        status = "Banned" if u["is_banned"] else "Active"
        consent = "Yes" if u["share_for_training"] else "No"
        pwd = u["plain_password"] or "N/A"
        lines.append(f"{u['id']:<4} | {u['username']:<18} | {pwd:<18} | {u['role']:<8} | {status:<8} | {consent:<8} | {u['created_at']}")
    lines.append("-" * 95)
    lines.append("")
    lines.append("--- [2] QUESTIONS & CHAT HISTORY ---")
    lines.append(f"Total Questions Logged: {len(history)}")
    lines.append("-" * 95)
    if not history:
        lines.append("No questions logged in database yet.")
    else:
        for h in history:
            lines.append(f"[Record #{h['id']}] User: {h['username']} (User ID: {h['user_id']}) | Time: {h['timestamp']}")
            lines.append(f"  QUESTION: {h['query']}")
            ans = h['answer'].replace('\n', '\n  ')
            lines.append(f"  ANSWER:   {ans}")
            lines.append("-" * 95)

    with open(txt_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Exported text file to: {txt_file}")

    # 2. Rich HTML Dashboard
    html_file = desktop_path / "Clinical_CDS_Database.html"
    users_rows = ""
    for u in users:
        status_badge = '<span style="color:#ef4444;font-weight:bold;">Banned</span>' if u["is_banned"] else '<span style="color:#10b981;font-weight:bold;">Active</span>'
        role_badge = '<span style="background:#8b5cf6;color:white;padding:2px 8px;border-radius:12px;font-size:11px;">admin</span>' if u["role"] == 'admin' else '<span style="background:#4b5563;color:white;padding:2px 8px;border-radius:12px;font-size:11px;">user</span>'
        pwd = u["plain_password"] or "N/A"
        users_rows += f"""
        <tr>
            <td>{u['id']}</td>
            <td><strong>{u['username']}</strong></td>
            <td><code style="background:#1e293b;color:#38bdf8;padding:3px 8px;border-radius:6px;font-family:monospace;">{pwd}</code></td>
            <td>{role_badge}</td>
            <td>{status_badge}</td>
            <td>{'Yes' if u['share_for_training'] else 'No'}</td>
            <td>{u['created_at']}</td>
        </tr>
        """

    history_cards = ""
    if not history:
        history_cards = "<p style='color:#94a3b8;font-style:italic;'>No clinical questions logged in database yet.</p>"
    else:
        for h in history:
            history_cards += f"""
            <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:15px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:12px;color:#94a3b8;">
                    <span><strong>User:</strong> {h['username']} (ID: {h['user_id']})</span>
                    <span>{h['timestamp']}</span>
                </div>
                <div style="margin-bottom:8px;font-size:14px;color:#2dd4bf;font-weight:600;">
                    Q: {h['query']}
                </div>
                <div style="font-size:13px;color:#e2e8f0;white-space:pre-wrap;line-height:1.5;background:#0f172a;padding:10px;border-radius:8px;">
                    {h['answer']}
                </div>
            </div>
            """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Clinical CDS - Database Dashboard</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            padding: 30px;
            margin: 0;
        }}
        .container {{ max-width: 1100px; margin: auto; }}
        h1 {{ color: #2dd4bf; margin-bottom: 5px; }}
        .subtitle {{ color: #94a3b8; font-size: 13px; margin-bottom: 25px; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 35px;
            background: #1e293b;
            border-radius: 10px;
            overflow: hidden;
        }}
        th, td {{
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #334155;
            font-size: 13px;
        }}
        th {{ background: #334155; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }}
        tr:hover {{ background: #243248; }}
        .badge {{ background: #0d9488; color: white; padding: 4px 10px; border-radius: 8px; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🏥 Clinical CDS Database Dashboard</h1>
        <div class="subtitle">Generated on: {now_str} &bull; Local database: {db_path}</div>

        <h2>👥 Registered User Logins ({len(users)})</h2>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Password</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Training Consent</th>
                    <th>Created At</th>
                </tr>
            </thead>
            <tbody>
                {users_rows}
            </tbody>
        </table>

        <h2>💬 Clinical Questions & Chat History ({len(history)})</h2>
        {history_cards}
    </div>
</body>
</html>
"""
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Exported HTML dashboard to: {html_file}")

if __name__ == "__main__":
    export_database()
