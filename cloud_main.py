"""
Cloud entry point — used when deployed to Railway/Render/etc.
Reads PORT from environment variable, no browser launch.
"""
import os
import sys
from pathlib import Path

# UTF-8 stdout (safe for cloud logs too)
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Add backend and repo root to path
BASE_DIR = Path(__file__).parent.resolve()
backend_dir = BASE_DIR / "backend"
data_dir = BASE_DIR / "data" if (BASE_DIR / "data" / "medical_rag.faiss").exists() else BASE_DIR

for p in [BASE_DIR, backend_dir, data_dir]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import uvicorn
from app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    print(f"[INFO] Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
