import os
import sys
import json
import re
import socket
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response

# ---------------------------------------------------------------------------
# Path resolution — works from any directory on any machine
# ---------------------------------------------------------------------------
backend_dir = Path(__file__).parent.resolve()
repo_root   = backend_dir.parent
data_dir    = repo_root / "data" if (repo_root / "data" / "medical_rag.faiss").exists() else repo_root

for p in [backend_dir, repo_root, data_dir]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from medical_clinical_rag import ClinicalRAGEngine, ask_clinical_assistant
import auth_db

# ---------------------------------------------------------------------------
# Gemini API key — loaded from env or config.json in repo root
# ---------------------------------------------------------------------------
CONFIG_FILE = repo_root / "config.json"

def load_gemini_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key
    if CONFIG_FILE.exists():
        try:
            cfg = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            return cfg.get("gemini_api_key", "").strip()
        except Exception:
            pass
    return ""

def save_gemini_key(key: str):
    cfg = {}
    if CONFIG_FILE.exists():
        try:
            cfg = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    cfg["gemini_api_key"] = key
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")

# ---------------------------------------------------------------------------
# Live Public Tunnel Manager (Zero-Config SSH / Cloudflared)
# ---------------------------------------------------------------------------
active_tunnel = {
    "process": None,
    "public_url": None,
    "status": "idle",
    "error": None,
    "mode": None
}

def start_tunnel_worker(port: int = 8000):
    global active_tunnel
    active_tunnel["status"] = "starting"
    active_tunnel["error"] = None
    
    # 1. Try cloudflared.exe if present
    cf_path = repo_root / "cloudflared.exe"
    if not cf_path.exists():
        cf_path = backend_dir / "cloudflared.exe"

    if cf_path.exists():
        try:
            print("[INFO] Launching cloudflared tunnel...")
            proc = subprocess.Popen(
                [str(cf_path), "tunnel", "--url", f"http://127.0.0.1:{port}"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            active_tunnel["process"] = proc
            active_tunnel["mode"] = "cloudflared"
            
            # Read until URL found
            for _ in range(40):
                line = proc.stdout.readline()
                if line:
                    m = re.search(r'(https://[a-zA-Z0-9-]+\.trycloudflare\.com)', line)
                    if m:
                        active_tunnel["public_url"] = m.group(1)
                        active_tunnel["status"] = "active"
                        print(f"[SUCCESS] Cloudflare Public Tunnel: {active_tunnel['public_url']}")
                        return
                time.sleep(0.3)
        except Exception as e:
            print(f"[WARN] Cloudflared launch failed: {e}")

    # 2. Fallback to Windows built-in OpenSSH with localhost.run / pinggy
    try:
        print("[INFO] Launching SSH tunnel (localhost.run)...")
        proc = subprocess.Popen(
            ['ssh', '-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=30', '-R', f'80:localhost:{port}', 'nokey@localhost.run'],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        active_tunnel["process"] = proc
        active_tunnel["mode"] = "ssh_tunnel"
        
        for _ in range(50):
            line = proc.stdout.readline()
            if line:
                m = re.search(r'([a-zA-Z0-9.-]+\.lhr\.life)', line)
                if m:
                    active_tunnel["public_url"] = f"https://{m.group(1)}"
                    active_tunnel["status"] = "active"
                    print(f"[SUCCESS] Public SSH Tunnel: {active_tunnel['public_url']}")
                    return
            time.sleep(0.2)
    except Exception as e:
        active_tunnel["status"] = "failed"
        active_tunnel["error"] = str(e)
        print(f"[ERROR] SSH tunnel failed: {e}")

# ---------------------------------------------------------------------------
# App initialization
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Clinical Decision Support System (NICE CG150)",
    version="3.5.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine: Optional[ClinicalRAGEngine] = None

@app.on_event("startup")
def startup_event():
    global engine
    auth_db.init_db()
    print("Loading Clinical RAG Engine...")
    engine = ClinicalRAGEngine(data_dir=data_dir)
    key = load_gemini_key()
    if key:
        print("[OK] Gemini API key active.")
    else:
        print("[INFO] No Gemini API key — structured templates will be used.")

# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class RegisterRequest(BaseModel):
    username: str
    password: str
    share_for_training: bool = True

class LoginRequest(BaseModel):
    username: str
    password: str

class ConsentRequest(BaseModel):
    user_id: int
    share_for_training: bool

class BanToggleRequest(BaseModel):
    user_id: int
    is_banned: bool

class QueryRequest(BaseModel):
    query: str
    user_id: Optional[int] = None
    username: Optional[str] = "Anonymous"
    conversation_history: Optional[List[Dict]] = None

class ApiKeyRequest(BaseModel):
    admin_username: str
    admin_password: str
    gemini_api_key: str

# ---------------------------------------------------------------------------
# System & Network Discovery Endpoints
# ---------------------------------------------------------------------------
def get_local_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except Exception:
        return '127.0.0.1'
    finally:
        s.close()

@app.get("/api/network-info")
def get_network_info():
    local_ip = get_local_ip()
    port = int(os.environ.get("PORT", 8000))
    return {
        "local_ip": local_ip,
        "local_url": f"http://{local_ip}:{port}",
        "localhost_url": f"http://127.0.0.1:{port}",
        "tunnel_url": active_tunnel.get("public_url"),
        "tunnel_status": active_tunnel.get("status"),
        "tunnel_mode": active_tunnel.get("mode"),
    }

@app.post("/api/tunnel/start")
def start_tunnel_endpoint():
    global active_tunnel
    if active_tunnel["status"] == "active" and active_tunnel["public_url"]:
        return {
            "success": True,
            "public_url": active_tunnel["public_url"],
            "status": "active"
        }
    
    port = int(os.environ.get("PORT", 8000))
    t = threading.Thread(target=start_tunnel_worker, args=(port,), daemon=True)
    t.start()
    
    # Wait up to 3 seconds for initial result
    time.sleep(2.5)
    return {
        "success": True,
        "public_url": active_tunnel.get("public_url"),
        "status": active_tunnel.get("status")
    }

@app.get("/api/tunnel/status")
def get_tunnel_status():
    return {
        "status": active_tunnel.get("status"),
        "public_url": active_tunnel.get("public_url"),
        "mode": active_tunnel.get("mode"),
        "error": active_tunnel.get("error")
    }

# ---------------------------------------------------------------------------
# Auth Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/health")
def health_endpoint():
    key = load_gemini_key()
    return {
        "status": "healthy",
        "guideline": "NICE CG150",
        "ready": True,
        "llm_mode": bool(key),
        "encoder_mode": engine.encoder_available if engine else False,
    }

@app.post("/api/auth/register")
def register_endpoint(req: RegisterRequest):
    try:
        user = auth_db.create_user(
            username=req.username.strip(),
            password=req.password,
            share_for_training=req.share_for_training
        )
        return {
            "success": True,
            "message": "Account created successfully.",
            "user": {
                "id": user["id"],
                "username": user["username"],
                "role": user["role"],
                "share_for_training": bool(user["share_for_training"])
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/login")
def login_endpoint(req: LoginRequest):
    user = auth_db.authenticate_user(req.username.strip(), req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password.")
    if user["is_banned"]:
        raise HTTPException(status_code=403, detail="Your account has been suspended by an administrator.")
    return {
        "success": True,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "is_banned": bool(user["is_banned"]),
            "share_for_training": bool(user["share_for_training"]),
            "created_at": user["created_at"]
        }
    }

@app.post("/api/user/consent")
def update_consent_endpoint(req: ConsentRequest):
    auth_db.update_user_consent(req.user_id, req.share_for_training)
    return {"success": True, "share_for_training": req.share_for_training}

@app.get("/api/user/history/{user_id}")
def get_history_endpoint(user_id: int):
    history = auth_db.get_user_history(user_id)
    return {"history": history}

# ---------------------------------------------------------------------------
# Admin Endpoints
# ---------------------------------------------------------------------------
@app.get("/api/admin/users")
def get_all_users_endpoint():
    return {"users": auth_db.get_all_users_for_admin()}

@app.post("/api/admin/toggle-ban")
def toggle_ban_endpoint(req: BanToggleRequest):
    auth_db.toggle_user_ban(req.user_id, req.is_banned)
    return {"success": True, "user_id": req.user_id, "is_banned": req.is_banned}

@app.get("/api/admin/user-history/{user_id}")
def get_user_history_admin(user_id: int):
    return auth_db.get_user_history_for_admin(user_id)

@app.get("/api/admin/export-training-data")
def export_training_data_endpoint(format: str = "json"):
    data = auth_db.export_consented_training_data()
    if format == "jsonl":
        lines = [json.dumps(item, ensure_ascii=False) for item in data]
        return Response(
            content="\n".join(lines),
            media_type="application/x-ndjson",
            headers={"Content-Disposition": "attachment; filename=training_dataset.jsonl"}
        )
    return JSONResponse(
        content={"total_samples": len(data), "dataset": data},
        headers={"Content-Disposition": "attachment; filename=training_dataset.json"}
    )

@app.post("/api/admin/set-api-key")
def set_api_key_endpoint(req: ApiKeyRequest):
    user = auth_db.authenticate_user(req.admin_username.strip(), req.admin_password)
    if not user or user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin credentials required.")
    save_gemini_key(req.gemini_api_key.strip())
    return {"success": True, "message": "Gemini API key saved. AI LLM mode is active."}

@app.get("/api/admin/llm-status")
def get_llm_status():
    key = load_gemini_key()
    return {
        "llm_enabled": bool(key),
        "key_set": bool(key),
        "encoder_mode": engine.encoder_available if engine else False,
        "mode_label": "Google Gemini 1.5 + MedCPT RAG" if (key and engine and engine.encoder_available)
                      else "Google Gemini 1.5 + BM25 RAG" if key
                      else "Structured Template + MedCPT RAG" if (engine and engine.encoder_available)
                      else "Structured Template + BM25 (Keyword Only)"
    }

# ---------------------------------------------------------------------------
# Main Query Endpoint
# ---------------------------------------------------------------------------
@app.post("/api/query")
def handle_clinical_query(req: QueryRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    if req.user_id:
        user = auth_db.get_user_by_id(req.user_id)
        if user and user["is_banned"]:
            raise HTTPException(status_code=403, detail="Account is suspended.")

    global engine
    if engine is None:
        engine = ClinicalRAGEngine(data_dir=data_dir)

    api_key = load_gemini_key()

    result = ask_clinical_assistant(
        query=req.query,
        engine=engine,
        api_key=api_key,
        conversation_history=req.conversation_history,
    )

    if req.user_id:
        auth_db.save_query_history(
            user_id=req.user_id,
            username=req.username or "Anonymous",
            query=req.query,
            answer=result["answer"],
            red_flags=result["red_flags"],
            sources=result.get("sources", []),
            validation=result["validation"]
        )

    return result

@app.get("/api/guideline-info")
def get_guideline_info():
    return {
        "document_id": "NICE_CG150",
        "title": "Headaches in over 12s: diagnosis and management",
        "authority": "National Institute for Health and Care Excellence (NICE)",
        "population": "People aged 12 years and older",
        "total_chunks": len(engine.chunks) if engine else 0,
        "vector_dim": engine.faiss_index.d if engine and engine.faiss_index else 768,
        "embedding_model": "ncbi/MedCPT-Query-Encoder (768d)",
        "retrieval_method": "FAISS Dense (65%) + BM25Okapi Lexical (35%) + MMR Diversification",
        "encoder_available": engine.encoder_available if engine else False,
    }

# ---------------------------------------------------------------------------
# Static Files & SPA Routing
# ---------------------------------------------------------------------------
frontend_dist = repo_root / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
