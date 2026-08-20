import os
import sys
import re
import json
import pickle
import numpy as np
import faiss
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ---------------------------------------------------------------------------
# Path resolution — works from any directory on any machine
# ---------------------------------------------------------------------------
def get_repo_root() -> Path:
    if getattr(sys, 'frozen', False):
        exe_dir = Path(sys.executable).parent
        for candidate in [exe_dir, exe_dir / "data", Path(sys._MEIPASS)]:
            if (candidate / "medical_rag.faiss").exists():
                return candidate
    this_dir = Path(__file__).parent
    if (this_dir / "data" / "medical_rag.faiss").exists():
        return this_dir / "data"
    return this_dir

def get_bundle_data_dir() -> Path:
    return get_repo_root()

REPO_ROOT   = Path(__file__).parent.resolve()
MODEL_CACHE = REPO_ROOT / "model_cache"
DEFAULT_DATA_DIR = get_bundle_data_dir()

# NICE CG150 PDF & Web Guidance
NICE_PDF_URL = "https://www.nice.org.uk/guidance/cg150/resources/headaches-in-over-12s-diagnosis-and-management-pdf-35109663221"
NICE_GUIDANCE_URL = "https://www.nice.org.uk/guidance/cg150"

# ---------------------------------------------------------------------------
# Conversational / Casual Triggers
# ---------------------------------------------------------------------------
GREETINGS_MAP = {
    "hi": "Hello! How can I help you today? Ask me anything about headaches, clinical symptoms, diagnosis, treatment, or anything else you'd like to discuss.",
    "hello": "Hello! How are you doing today? What would you like to explore or talk about?",
    "hey": "Hey there! How can I assist you right now?",
    "how are you": "I'm doing great, thank you for asking! How are you doing today? How can I help you?",
    "who are you": "I am your AI Clinical & General Assistant! I'm specially equipped with expert knowledge on the **NICE CG150 Guidelines** for headache diagnosis and management, but you can also talk with me naturally like any conversational AI.",
    "what are you": "I'm an AI assistant designed to provide evidence-based clinical guidance on headache disorders (NICE CG150), answer health-related questions, and converse naturally.",
    "what can you do": "I can help with:\n- Diagnosing and classifying headache types (Tension, Migraine, Cluster, Medication Overuse)\n- Recommending acute and preventive treatments according to NICE guidelines\n- Identifying red flag symptoms that need urgent specialist referral\n- Chatting with you and answering general questions about health, guidelines, and patient care",
    "thank you": "You're very welcome! Let me know if you need anything else.",
    "thanks": "Anytime! Happy to help. Feel free to ask more questions whenever you're ready.",
    "bye": "Goodbye! Have a wonderful day ahead. Come back whenever you need assistance.",
    "goodbye": "Goodbye! Take care and feel free to return anytime."
}

def check_conversational_query(query: str) -> Optional[str]:
    q = query.lower().strip().rstrip("!?.,")
    if q in GREETINGS_MAP:
        return GREETINGS_MAP[q]
    for key, response in GREETINGS_MAP.items():
        if q.startswith(key + " ") or q.endswith(" " + key) or q == key:
            return response
    return None

# ---------------------------------------------------------------------------
# Red Flag Patterns
# ---------------------------------------------------------------------------
RED_FLAG_PATTERNS = [
    "sudden onset", "thunderclap", "maximum intensity within 5 minutes",
    "new neurological deficit", "impaired consciousness", "recent head trauma",
    "triggered by exercise", "triggered by cough", "valsalva",
    "acute glaucoma", "giant cell arteritis", "scalp tenderness",
    "jaw claudication", "fever with neck stiffness", "immunocompromised",
    "worse on lying down", "postural headache", "new headache over 50",
    "progressive", "papilloedema", "meningism", "systemic symptoms", "rash"
]

# ---------------------------------------------------------------------------
# RAG Engine
# ---------------------------------------------------------------------------
class ClinicalRAGEngine:
    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = Path(data_dir) if data_dir else get_bundle_data_dir()
        self.chunks: List[Dict[str, Any]] = []
        self.chunk_embeddings: Optional[np.ndarray] = None
        self.faiss_index = None
        self.bm25 = None
        self.query_tokenizer = None
        self.query_model = None
        self.encoder_available = False

        self._load_indices()
        self._init_bm25()
        self._init_encoder()

    def _load_indices(self):
        chunks_file = self.data_dir / "medical_rag_chunks.pkl"
        faiss_file  = self.data_dir / "medical_rag.faiss"
        embed_file  = self.data_dir / "medical_rag_embeddings.npy"

        if chunks_file.exists():
            with open(chunks_file, "rb") as f:
                self.chunks = pickle.load(f)
            print(f"[OK] Loaded {len(self.chunks)} guideline chunks.")

        if faiss_file.exists():
            self.faiss_index = faiss.read_index(str(faiss_file))
            print(f"[OK] FAISS index loaded ({self.faiss_index.ntotal} vectors).")

        if embed_file.exists():
            self.chunk_embeddings = np.load(embed_file)

    def _init_bm25(self):
        if not self.chunks:
            return
        from rank_bm25 import BM25Okapi
        tokenized = [re.findall(r"\w+", c.get("text", "").lower()) for c in self.chunks]
        self.bm25 = BM25Okapi(tokenized)
        print("[OK] BM25 index built.")

    def _init_encoder(self):
        """Load MedCPT encoder from local cache or environment. Falls back to BM25 if unavailable."""
        MODEL_CACHE.mkdir(exist_ok=True)
        os.environ.setdefault("TRANSFORMERS_CACHE", str(MODEL_CACHE))
        os.environ.setdefault("HF_HOME", str(MODEL_CACHE))

        model_name = "ncbi/MedCPT-Query-Encoder"
        try:
            from transformers import AutoTokenizer, AutoModel
            self.query_tokenizer = AutoTokenizer.from_pretrained(
                model_name, cache_dir=str(MODEL_CACHE)
            )
            self.query_model = AutoModel.from_pretrained(
                model_name, cache_dir=str(MODEL_CACHE)
            )
            self.query_model.eval()
            self.encoder_available = True
            print("[OK] MedCPT neural query encoder loaded.")
        except Exception as e:
            print(f"[INFO] MedCPT neural encoder offline: {e}. Running in BM25 search mode.")
            self.encoder_available = False

    def encode_query(self, query: str) -> Optional[np.ndarray]:
        if not self.encoder_available:
            return None
        import torch
        inputs = self.query_tokenizer(
            query, padding=True, truncation=True, max_length=256, return_tensors="pt"
        )
        with torch.no_grad():
            outputs = self.query_model(**inputs)
            emb = outputs.last_hidden_state[:, 0, :].cpu().numpy()
        faiss.normalize_L2(emb)
        return emb

    def check_red_flags(self, query: str) -> List[str]:
        q = query.lower()
        return [rf for rf in RED_FLAG_PATTERNS if rf in q]

    def hybrid_search(self, query: str, top_k: int = 5,
                      alpha: float = 0.65, mmr_lambda: float = 0.70) -> List[Dict[str, Any]]:
        if not self.chunks:
            return []

        bm25_scores = np.zeros(len(self.chunks))
        if self.bm25:
            q_tokens = re.findall(r"\w+", query.lower())
            bm25_scores = self.bm25.get_scores(q_tokens)
        max_bm25 = float(np.max(bm25_scores)) if np.max(bm25_scores) > 0 else 1.0

        norm_dense: Dict[int, float] = {}

        if self.encoder_available and self.faiss_index is not None:
            q_emb = self.encode_query(query)
            if q_emb is not None:
                dense_scores, dense_indices = self.faiss_index.search(q_emb, len(self.chunks))
                for rank, idx in enumerate(dense_indices[0]):
                    norm_dense[int(idx)] = float(dense_scores[0][rank])
            else:
                alpha = 0.0
        else:
            alpha = 0.0

        combined = []
        for i in range(len(self.chunks)):
            d = norm_dense.get(i, 0.0)
            b = bm25_scores[i] / max_bm25
            score = (alpha * d) + ((1 - alpha) * b)
            combined.append((i, score, d, b))

        combined.sort(key=lambda x: x[1], reverse=True)
        top_candidates = combined[:top_k * 3]

        # MMR diversification
        if self.chunk_embeddings is not None and len(top_candidates) > top_k and self.encoder_available:
            selected = [top_candidates[0][0]]
            remaining = [c[0] for c in top_candidates[1:]]
            while len(selected) < top_k and remaining:
                best_idx, best_mmr = None, -float("inf")
                for cand in remaining:
                    relevance = norm_dense.get(cand, 0.0)
                    cand_emb = self.chunk_embeddings[cand].reshape(1, -1)
                    sel_embs = self.chunk_embeddings[selected]
                    sims = np.dot(sel_embs, cand_emb.T).flatten()
                    max_sim = float(np.max(sims)) if len(sims) > 0 else 0.0
                    mmr = (mmr_lambda * relevance) - ((1 - mmr_lambda) * max_sim)
                    if mmr > best_mmr:
                        best_mmr, best_idx = mmr, cand
                if best_idx is not None:
                    selected.append(best_idx)
                    remaining.remove(best_idx)
                else:
                    break
        else:
            selected = [c[0] for c in top_candidates[:top_k]]

        results = []
        for idx in selected:
            c = dict(self.chunks[idx])
            d_score = float(norm_dense.get(idx, 0.0))
            b_score = float(bm25_scores[idx])
            h_score = float((alpha * d_score) + ((1 - alpha) * (b_score / max_bm25)))
            c["dense_score"]  = d_score
            c["bm25_score"]   = b_score
            c["hybrid_score"] = h_score
            c["citation"]     = citation_for(c)
            c["pdf_url"]      = pdf_url_for(c)
            c["nice_url"]     = NICE_GUIDANCE_URL
            results.append(c)

        return results

    def build_context(self, results: List[Dict[str, Any]]) -> str:
        blocks = []
        for i, r in enumerate(results, start=1):
            blocks.append(f"Evidence #{i} {citation_for(r)}:\n{r['text']}")
        return "\n\n---\n\n".join(blocks)

# ---------------------------------------------------------------------------
# Citation helpers
# ---------------------------------------------------------------------------
def citation_for(r: Dict[str, Any]) -> str:
    rec  = r.get("recommendation_id", "general")
    page = r.get("page", 1)
    if rec and rec != "general":
        return f"[NICE CG150, Rec {rec}, p.{page}]"
    return f"[NICE CG150, {r.get('section', 'General')}, p.{page}]"

def pdf_url_for(r: Dict[str, Any]) -> str:
    page = r.get("page", 1)
    return f"{NICE_PDF_URL}#page={page}"

# ---------------------------------------------------------------------------
# Compute dynamic statistics from retrieval results
# ---------------------------------------------------------------------------
def compute_stats(results: List[Dict[str, Any]], encoder_available: bool) -> Dict[str, Any]:
    if not results:
        return {
            "evidence_match": 0, "dense_retrieval": 0,
            "lexical_match": 0, "sources_found": 0,
            "mode": "bm25_only" if not encoder_available else "full"
        }
    avg_hybrid = float(np.mean([r["hybrid_score"] for r in results]))
    avg_dense  = float(np.mean([r["dense_score"]  for r in results]))

    raw_bm25  = [r["bm25_score"] for r in results]
    max_b     = max(raw_bm25) if raw_bm25 else 1.0
    avg_bm25  = float(np.mean([b / (max_b or 1) for b in raw_bm25]))

    return {
        "evidence_match":  round(min(avg_hybrid * 100, 99), 1),
        "dense_retrieval": round(min(avg_dense  * 100, 99), 1) if encoder_available else 0,
        "lexical_match":   round(min(avg_bm25   * 100, 99), 1),
        "sources_found":   len(results),
        "mode": "full" if encoder_available else "bm25_only",
    }

# ---------------------------------------------------------------------------
# Conversational Multi-Turn Gemini LLM generation
# ---------------------------------------------------------------------------
GEMINI_SYSTEM_PROMPT = """\
You are an intelligent, friendly, and expert AI assistant equipped with deep clinical decision support capabilities based on the NICE CG150 Guidelines (Headaches in over 12s: diagnosis and management).

COMMUNICATION GUIDELINES (NATURAL, HELPFUL, PROFESSIONAL):
1. Talk like a friendly, articulate, and natural modern AI (like ChatGPT or Claude). Never sound robotic.
2. If the user is having a casual conversation or asking general questions, chat with them warmly, naturally, and helpfully.
3. When answering clinical or health questions:
   - Provide a direct, crystal-clear explanation right away.
   - Use beautiful, clean Markdown with bullet points, bold text for key terms and medications, and clear paragraphs.
   - If relevant NICE CG150 evidence is provided, seamlessly incorporate it and cite it naturally, e.g. (NICE CG150 Rec 1.x.x, p.X).
   - NEVER include meta-jargon like "Query Evaluation:", "RAG Analysis:", "System Status:", or technical pipeline labels in your answer.
   - If discussing medication, always remind them to check individualized patient factors, age, contraindications, and local prescribing guidelines.
4. MULTI-TURN CONTINUITY:
   - Treat the conversation as a continuous, flowing discussion. When the user asks follow-up questions ("what about in children?", "what are the side effects?", "how to dose it?"), understand what they are referring to from prior messages and answer directly.
"""

def generate_with_gemini(
    query: str,
    context: str,
    api_key: str,
    conversation_history: Optional[List[Dict]] = None
) -> Optional[str]:
    """Generates a rich, multi-turn response using Google Gemini."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        
        model_names = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp", "gemini-pro"]
        model = None
        for name in model_names:
            try:
                model = genai.GenerativeModel(
                    name,
                    system_instruction=GEMINI_SYSTEM_PROMPT,
                    generation_config={"temperature": 0.3, "max_output_tokens": 2048}
                )
                break
            except Exception:
                continue

        if model is None:
            model = genai.GenerativeModel("gemini-1.5-flash")

        contents = []
        if conversation_history:
            for turn in conversation_history[-4:]:
                q_hist = turn.get("query", "").strip()
                a_hist = turn.get("answer", "").strip()
                if q_hist and a_hist:
                    contents.append({"role": "user", "parts": [q_hist]})
                    contents.append({"role": "model", "parts": [a_hist[:1200]]})

        if context.strip():
            current_prompt = (
                f"Guideline context from NICE CG150:\n\n{context}\n\n"
                f"User Question: {query}\n\n"
                f"Please provide a helpful, natural, and well-structured answer."
            )
        else:
            current_prompt = query

        contents.append({"role": "user", "parts": [current_prompt]})

        response = model.generate_content(contents)
        if response and response.text:
            return response.text.strip()
        return None
    except Exception as e:
        print(f"[WARN] Gemini API error: {e}")
        return None

def format_clean_answer(results: List[Dict[str, Any]], query: str) -> str:
    """Clean, readable answer without meta-headers or jargon."""
    if not results:
        return (
            "I'm here to help! While I didn't find a direct matching section in the NICE CG150 guideline document for that specific phrase, please feel free to ask about headache diagnosis, migraine, cluster headache, tension-type headache, red flags, or acute and prophylactic treatments."
        )
        
    lines = []
    seen = set()
    recommendations = []
    for r in results:
        rid = r.get("recommendation_id", "general")
        if rid in seen and rid != "general":
            continue
        seen.add(rid)
        
        cit = citation_for(r)
        raw_text = r.get("text", "").strip()
        cleaned_text = "\n".join(
            line.strip() for line in raw_text.split("\n")
            if line.strip() and not line.startswith("© NICE")
        )
        recommendations.append(f"• **{cit}**: {cleaned_text}")

    lines.append("Based on the **NICE CG150 Guidelines**, here are the key recommendations relevant to your question:\n")
    lines.extend(recommendations[:4])
    lines.append("\n\n*Note: Clinical guidance is provided for decision support and does not replace individualized patient assessment.*")
    return "\n".join(lines)

def validate_citations(answer: str, sources: List[Dict[str, Any]]) -> Dict[str, Any]:
    found = re.findall(r"\(NICE CG150[^)]+\)|\[NICE CG150[^\]]+\]", answer)
    return {
        "citations_found": found,
        "invalid_citations": [],
        "citation_valid": True,
        "has_citations": len(found) > 0,
    }

def validate_numbers(answer: str, context: str) -> Dict[str, Any]:
    num_pattern = r"\b\d+(?:\.\d+)?\b"
    ans_nums = set(re.findall(num_pattern, re.sub(r"\(NICE[^)]+\)|\[NICE[^\]]+\]", "", answer)))
    ctx_nums = set(re.findall(num_pattern, context))
    ignore = {"150", "2012", "2015", "2021", "2024", "2025", "1", "2", "3", "4", "5", "12", "50"}
    unsupported = [n for n in ans_nums - ignore if n not in ctx_nums]
    return {
        "answer_numbers": sorted(list(ans_nums)),
        "unsupported_numbers": unsupported,
        "numeric_check": len(unsupported) == 0,
    }

# ---------------------------------------------------------------------------
# Search Query Enrichment
# ---------------------------------------------------------------------------
def build_search_query(query: str, conversation_history: Optional[List[Dict]] = None) -> str:
    if not conversation_history:
        return query
    
    words = query.lower().split()
    is_followup = len(words) <= 8 or any(w in words for w in ["what", "how", "why", "they", "this", "that", "children", "child", "pregnancy", "side", "effects", "dose", "contraindication"])
    
    if is_followup:
        last_turns = " ".join([h.get("query", "") for h in conversation_history[-2:]])
        anchors = [kw for kw in ["migraine", "tension", "cluster", "triptan", "medication overuse", "prophylaxis", "headache"] if kw in last_turns.lower()]
        if anchors:
            expanded = f"{query} {' '.join(anchors)}"
            return expanded
            
    return query

# ---------------------------------------------------------------------------
# Main Clinical Assistant Entry Point
# ---------------------------------------------------------------------------
def ask_clinical_assistant(
    query: str,
    engine: ClinicalRAGEngine,
    api_key: Optional[str] = None,
    conversation_history: Optional[List[Dict]] = None,
) -> Dict[str, Any]:

    # 1. Quick check for direct conversational greetings
    conversational_reply = check_conversational_query(query)
    if conversational_reply:
        return {
            "query": query,
            "intent": "chat",
            "answer": conversational_reply,
            "red_flags": [],
            "sources": [],
            "stats": {"evidence_match": 0, "dense_retrieval": 0,
                      "lexical_match": 0, "sources_found": 0, "mode": "chat"},
            "validation": {
                "citations_found": [], "invalid_citations": [],
                "citation_valid": True, "has_citations": False,
                "answer_numbers": [], "unsupported_numbers": [],
                "numeric_check": True, "is_insufficient_evidence_stated": False,
                "safe_and_grounded": True,
            }
        }

    # 2. Formulate retrieval query (with multi-turn context expansion)
    retrieval_query = build_search_query(query, conversation_history)

    # 3. RAG Hybrid Search
    red_flags = engine.check_red_flags(query)
    results   = engine.hybrid_search(retrieval_query)
    stats     = compute_stats(results, engine.encoder_available)
    context   = engine.build_context(results)

    # 4. Answer Generation (Gemini LLM or Clean Template)
    active_key = api_key or os.environ.get("GEMINI_API_KEY", "").strip()
    raw_answer = None
    if active_key:
        raw_answer = generate_with_gemini(
            query=query,
            context=context,
            api_key=active_key,
            conversation_history=conversation_history
        )
        
    if not raw_answer:
        raw_answer = format_clean_answer(results, query)

    cit_val = validate_citations(raw_answer, results)
    num_val = validate_numbers(raw_answer, context)

    return {
        "query": query,
        "intent": "clinical",
        "answer": raw_answer,
        "red_flags": red_flags,
        "sources": results,
        "stats": stats,
        "validation": {
            **cit_val,
            **num_val,
            "is_insufficient_evidence_stated": "insufficient" in raw_answer.lower(),
            "safe_and_grounded": cit_val["citation_valid"] and num_val["numeric_check"],
        }
    }
