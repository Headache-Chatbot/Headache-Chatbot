import os
import sys

# Ensure UTF-8 console output on Windows to prevent UnicodeEncodeError
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import time
import socket
import webbrowser
import threading
from pathlib import Path

# Resolve base directories dynamically — works from any location on any machine
if getattr(sys, 'frozen', False):
    base_dir = Path(sys.executable).parent
    bundle_dir = Path(sys._MEIPASS)
else:
    base_dir = Path(__file__).parent.resolve()
    bundle_dir = base_dir

backend_dir = base_dir / "backend"
repo_root = base_dir
# data files live in a /data subfolder if present, otherwise in repo root
data_dir = repo_root / "data" if (repo_root / "data" / "medical_rag.faiss").exists() else repo_root

for p in [base_dir, backend_dir, data_dir, repo_root]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

def find_available_port(start_port=8000, max_attempts=10):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
    return start_port

def open_browser(port):
    time.sleep(1.8)
    url = f"http://127.0.0.1:{port}"
    print(f"\n[+] Opening Clinical Decision Support UI at {url} in your browser...")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"Could not open browser automatically: {e}")

def main():
    try:
        port = find_available_port(8000)
        url = f"http://127.0.0.1:{port}"

        # Discover Local Wi-Fi IP
        local_ip = "127.0.0.1"
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            pass

        print("=" * 80)
        print(" [NICE CG150 Clinical Decision Support Desktop & Mobile Presentation App]")
        print("=" * 80)
        print(f" • Local PC Browser:   {url}")
        print(f" • Mobile / Wi-Fi URL: http://{local_ip}:{port}")
        print(" • QR Code & Public Link: Click 'Present / Scan QR' button in the top navbar")
        print(" • Default Admin:      Username: admin | Password: #1234$")
        print(" • Default Users:      Username: user1, user2, user3 | Password: #1234$")
        print(" • Press Ctrl+C in this console window to shut down.")
        print("=" * 80)

        # Launch browser opener in background thread
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()

        # Import and start server on 0.0.0.0 for multi-device / phone access
        import uvicorn
        from app import app
        uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
    except Exception as e:
        print(f"\n[ERROR]: Application encountered an issue: {e}")
        input("\nPress Enter to exit...")

if __name__ == "__main__":
    main()
