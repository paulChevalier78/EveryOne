import os
import sys
import sqlite3
import hashlib
import httpx
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import snapshot_download
from pydantic import BaseModel, Field

from gguf_runtime import (
    MODEL_ROOT,
    discover_local_gguf_models,
    generate_rag_answer_with_gguf,
    is_model_currently_loaded,
)
from ingest_pdf import embed_text, ingest_pdf
from init_db import DB_PATH, init_db

# --- CONFIGURATION API ---
app = FastAPI(title="SLM Backend API", version="1.1.0")

# Autorise le Frontend (Local + Mobile via IP)
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://192.168.128.181:5173", # Ton IP locale pour le test mobile
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODÈLES DE DONNÉES (PYDANTIC) ---

class ChatRequest(BaseModel):
    message: str
    selectedModel: str = "Unknown SLM"
    selectedModelId: str = ""
    documentIds: list[int] = Field(default_factory=list)
    topK: int = 0

class SourceItem(BaseModel):
    chunkId: int
    documentId: int
    page: int
    title: str
    score: float
    excerpt: str

class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceItem] = Field(default_factory=list)

class ModelDownloadRequest(BaseModel):
    modelId: str

class FinetuneRequest(BaseModel):
    datasetName: str

# NOUVEAU MODÈLE : Pour recevoir le nom personnalisé
class FinetuneDownloadRequest(BaseModel):
    customName: str = "mon-modele"

class LocalModelInfo(BaseModel):
    key: str
    fileName: str
    path: str
    sizeBytes: int
    isLoaded: bool

# --- REGISTRES & CONFIG ---

MODEL_DOWNLOAD_REGISTRY = {
    "llama-3.2-3b": {"repo_id": "bartowski/Llama-3.2-3B-Instruct-GGUF", "pattern": "*Q4_K_M.gguf"},
    "phi-3.5-mini": {"repo_id": "bartowski/Phi-3.5-mini-instruct-GGUF", "pattern": "*Q4_K_M.gguf"},
    "qwen-2.5-3b": {"repo_id": "bartowski/Qwen2.5-3B-Instruct-GGUF", "pattern": "*Q4_K_M.gguf"},
    "mistral-7b-instruct": {"repo_id": "bartowski/Mistral-7B-Instruct-v0.3-GGUF", "pattern": "*Q4_K_M.gguf"},
    "gemma-2-2b": {"repo_id": "bartowski/gemma-2-2b-it-GGUF", "pattern": "*Q4_K_M.gguf"},
}

MODEL_RAG_PROFILES = {
    "llama-3.2-3b": {"label": "Balanced", "default_top_k": 5},
    "phi-3.5-mini": {"label": "Concise", "default_top_k": 4},
    "qwen-2.5-3b": {"label": "Multilingual", "default_top_k": 5},
    "mistral-7b-instruct": {"label": "Deep context", "default_top_k": 7},
    "gemma-2-2b": {"label": "Fast", "default_top_k": 4},
}

DEFAULT_RAG_PROFILE = {"label": "Balanced", "default_top_k": 5}

PROJECT_ROOT = Path(__file__).resolve().parents[1]
UPLOADS_DIR = PROJECT_ROOT / "Storage" / "uploads"
DOWNLOAD_MODEL_ROOT = MODEL_ROOT

# --- FONCTIONS UTILITAIRES ---

def _find_document_by_hash(file_hash: str) -> tuple[int, str] | None:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title FROM documents WHERE file_hash = ? LIMIT 1", (file_hash.strip().lower(),))
    row = cursor.fetchone()
    conn.close()
    return (int(row[0]), str(row[1])) if row else None

def search_chunks(query_text: str, document_ids: list[int] | None = None, top_k: int = 5) -> list[dict]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    doc_ids = [int(d) for d in (document_ids or [])]
    if doc_ids:
        placeholders = ",".join("?" for _ in doc_ids)
        query = f"""
            SELECT c.id, c.document_id, c.page, c.content, d.title, e.vector
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            JOIN embeddings e ON e.chunk_id = c.id
            WHERE c.document_id IN ({placeholders})
        """
        cursor.execute(query, tuple(doc_ids))
    else:
        cursor.execute("SELECT c.id, c.document_id, c.page, c.content, d.title, e.vector FROM chunks c JOIN documents d ON d.id = c.document_id JOIN embeddings e ON e.chunk_id = c.id")

    rows = cursor.fetchall()
    conn.close()
    if not rows: return []

    query_vec = embed_text(query_text.strip())
    scored = []
    for cid, did, pg, cont, tit, v_blob in rows:
        c_vec = np.frombuffer(v_blob, dtype=np.float32)
        score = float(np.dot(query_vec, c_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(c_vec)))
        scored.append({"chunk_id": cid, "document_id": did, "page": pg or 0, "title": tit, "content": cont, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:max(1, int(top_k))]

# --- ENDPOINTS ---

@app.on_event("startup")
def startup_event():
    init_db()

@app.post("/api/init")
def api_init():
    init_db()
    return {"status": "ok", "message": "Backend et base de données initialisés."}

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/models/local", response_model=list[LocalModelInfo])
def api_models_local():
    models = discover_local_gguf_models()
    return [LocalModelInfo(key=m.key, fileName=m.path.name, path=str(m.path), sizeBytes=m.size_bytes, isLoaded=is_model_currently_loaded(m.path)) for m in models]

@app.post("/api/ingest")
async def api_ingest(files: list[UploadFile] = File(...)):
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    results, errors = [], []
    for file in files:
        try:
            payload = await file.read()
            f_hash = hashlib.sha256(payload).hexdigest()
            existing = _find_document_by_hash(f_hash)
            if existing:
                results.append({"file": file.filename, "documentId": existing[0], "alreadyExists": True})
                continue
            
            path = UPLOADS_DIR / f"{datetime.now().strftime('%Y%m%dt%H%M%S')}_{file.filename}"
            path.write_bytes(payload)
            res = ingest_pdf(str(path), title=file.filename, file_hash=f_hash)
            results.append({"file": file.filename, "documentId": res["document_id"], "chunksInserted": res["chunks_inserted"]})
        except Exception as e:
            errors.append({"file": file.filename, "error": str(e)})
    return {"results": results, "errors": errors}

@app.post("/api/chat", response_model=ChatResponse)
def api_chat(payload: ChatRequest):
    msg = payload.message.strip()
    if not msg: raise HTTPException(status_code=400, detail="Empty message")

    ranked_chunks = search_chunks(msg, payload.documentIds) if payload.documentIds else []

    sources = [SourceItem(chunkId=c["chunk_id"], documentId=c["document_id"], page=c["page"], title=c["title"], score=round(c["score"], 4), excerpt=c["content"][:160]) for c in ranked_chunks]

    try:
        answer, _, _ = generate_rag_answer_with_gguf(payload.selectedModelId, payload.selectedModel, msg, ranked_chunks)
        return ChatResponse(answer=answer.strip(), sources=sources)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/finetune")
async def api_start_finetune(payload: FinetuneRequest):
    """Déclenche le job de fine-tuning sur Modal"""
    MODAL_URL = "https://gab404--llama32-gguf-finetune-finetune-endpoint.modal.run"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(MODAL_URL, json={"dataset_name": payload.datasetName}, timeout=30.0)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Modal Error: {str(e)}")

@app.post("/api/finetune/download")
def api_download_finetuned(payload: FinetuneDownloadRequest):
    """Télécharge le modèle fine-tuné depuis le volume Modal vers le dossier local avec un nom custom."""
    
    # On nettoie le nom pour éviter les erreurs de système de fichiers
    clean_name = "".join(c for c in payload.customName if c.isalnum() or c in ("-", "_")).strip()
    if not clean_name:
        clean_name = "modele-finetune"
        
    target_file = MODEL_ROOT / f"{clean_name}-q4_k_m.gguf"
    target_file.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        # On ajoute --force pour écraser si on réutilise le même nom
        cmd = [
            sys.executable, "-m", "modal", "volume", "get", "finetune-vol", 
            "model-q4_k_m.gguf", str(target_file), "--force"
        ]
        
        custom_env = os.environ.copy()
        custom_env["PYTHONIOENCODING"] = "utf-8"
        
        subprocess.run(cmd, check=True, capture_output=True, env=custom_env)
        
        return {"status": "ok", "message": f"Modèle téléchargé avec succès sous le nom {target_file.name} !"}
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode("utf-8", errors="ignore") if e.stderr else "Erreur inconnue"
        raise HTTPException(status_code=500, detail=f"Erreur Modal CLI: {error_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/models/download")
def api_models_download(payload: ModelDownloadRequest):
    cfg = MODEL_DOWNLOAD_REGISTRY.get(payload.modelId)
    if not cfg: raise HTTPException(status_code=400, detail="Unknown modelId")
    target = DOWNLOAD_MODEL_ROOT / payload.modelId
    target.mkdir(parents=True, exist_ok=True)
    try:
        snapshot_download(repo_id=cfg["repo_id"], allow_patterns=[cfg["pattern"]], local_dir=str(target))
        return {"status": "ok", "modelId": payload.modelId}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))