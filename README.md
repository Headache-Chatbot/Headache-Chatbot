<<<<<<< HEAD
# Headache-Chatbot
Transforming primary care diagnostics with RAG-powered, NICE CG150-grounded clinical intelligence. This production-ready decision support tool features a multi-layer safety architecture, interactive deep-linked citations, and offline fallbacks to eliminate AI hallucinations and streamline headache assessment workflows.
=======
# Clinical Decision Support — NICE CG150 RAG System

Evidence-grounded clinical assistant powered by **MedCPT + FAISS + BM25** retrieval, **FastAPI** backend, **React 18 + Tailwind** frontend, and a Windows desktop launcher.

---

## Quick Start (Any Machine)

### Requirements
- **Python 3.10 or newer** — [Download here](https://www.python.org/downloads/)  
  ⚠️ Make sure to tick **"Add Python to PATH"** during install.
- **Node.js + npm** *(optional — only needed if you want to rebuild the React UI)*

### Steps

1. Copy or clone this folder to **anywhere** on your PC (e.g. `C:\Projects\`, `D:\Work\`, it doesn't matter).
2. Double-click **`start.bat`**.  
   - First run automatically installs all Python packages.  
   - The browser opens at `http://127.0.0.1:8000`.
3. Sign in with a default account (see below) or register a new one.

### Default Accounts

| Username | Password | Role  |
|----------|----------|-------|
| `admin`  | `#1234$` | Admin |
| `user1`  | `#1234$` | User  |
| `user2`  | `#1234$` | User  |
| `user3`  | `#1234$` | User  |

---

## Project Structure

```
Clinical_Decision_Support_RAG/
│
├── start.bat                  ← Double-click to launch (Windows)
├── desktop_main.py            ← App entry point (port detection, browser launch)
├── medical_clinical_rag.py    ← MedCPT + FAISS + BM25 retrieval engine
├── requirements.txt           ← Python dependencies
├── app_icon.ico               ← Application icon
│
├── backend/
│   ├── app.py                 ← FastAPI server (auth, queries, admin API)
│   └── auth_db.py             ← SQLite user/history database layer
│
├── frontend/
│   ├── src/
│   │   └── App.jsx            ← React 18 full UI (auth, dark/light mode, charts)
│   ├── dist/                  ← Pre-built production bundle (ready to serve)
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── data/
    ├── medical_rag.faiss      ← FAISS vector index (NICE CG150 embeddings)
    ├── medical_rag_chunks.pkl ← Guideline text chunks with metadata
    └── medical_rag_embeddings.npy ← Raw embedding matrix
```

> **Note:** `backend/clinical_cds.db` is created automatically on first launch.  
> It is excluded from version control (`.gitignore`) so each developer gets their own local database.

---

## Editing the Frontend

```bash
cd frontend
npm install        # first time only
npm run dev        # live dev server at http://localhost:5173
npm run build      # rebuild production dist/
```

Changes to `frontend/src/App.jsx` are reflected immediately in dev mode.  
Run `npm run build` before committing so the `dist/` is always up to date.

---

## Editing the Backend

The backend is a plain FastAPI app. Edit [`backend/app.py`](backend/app.py) and restart `desktop_main.py`:

```bash
python desktop_main.py
```

Or run uvicorn directly for auto-reload during development:

```bash
cd backend
uvicorn app:app --reload --port 8000
```

---

## RAG Data Files

The `data/` folder contains the pre-built NICE CG150 index. These files are large and are excluded from git (see `.gitignore`). Share them via a shared drive, Google Drive, or OneDrive and place them in the `data/` folder before running.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `python not found` | Install Python 3.10+ and tick "Add to PATH" |
| App opens but RAG returns "insufficient evidence" | Make sure `data/*.faiss`, `*.pkl`, `*.npy` are present |
| Port 8000 already in use | The app auto-detects a free port and falls back to 8001, 8002, etc. |
| Frontend shows old version | Run `npm run build` inside `frontend/` |
| Database locked | Stop any other running instance of the app |
>>>>>>> 462404d (Initial commit)
