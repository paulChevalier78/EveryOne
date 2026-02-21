import os
import sqlite3
import tempfile
from pathlib import Path

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import snapshot_download
from pydantic import BaseModel, Field

from ingest_pdf import embed_text, ingest_pdf
from init_db import DB_PATH, init_db


app = FastAPI(title="SLM Backend API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    selectedModel: str = "Unknown SLM"
    documentIds: list[int] = Field(default_factory=list)
    topK: int = 5


class SourceItem(BaseModel):
    chunkId: int
    documentId: int
    title: str
    score: float
    excerpt: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceItem] = Field(default_factory=list)


class ModelDownloadRequest(BaseModel):
    modelId: str


MODEL_DOWNLOAD_REGISTRY: dict[str, dict[str, str]] = {
    "llama-3.2-3b": {
        "repo_id": "bartowski/Llama-3.2-3B-Instruct-GGUF",
        "pattern": "*Q4_K_M.gguf",
    },
    "phi-3.5-mini": {
        "repo_id": "bartowski/Phi-3.5-mini-instruct-GGUF",
        "pattern": "*Q4_K_M.gguf",
    },
    "qwen-2.5-3b": {
        "repo_id": "bartowski/Qwen2.5-3B-Instruct-GGUF",
        "pattern": "*Q4_K_M.gguf",
    },
    "mistral-7b-instruct": {
        "repo_id": "bartowski/Mistral-7B-Instruct-v0.3-GGUF",
        "pattern": "*Q4_K_M.gguf",
    },
    "gemma-2-2b": {
        "repo_id": "bartowski/gemma-2-2b-it-GGUF",
        "pattern": "*Q4_K_M.gguf",
    },
}


@app.on_event("startup")
def startup_event() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/init")
def api_init() -> dict:
    db_path = init_db()
    return {"status": "ok", "dbPath": db_path}


@app.post("/api/models/download")
def api_models_download(payload: ModelDownloadRequest) -> dict:
    model_id = payload.modelId.strip()
    if not model_id:
        raise HTTPException(status_code=400, detail="modelId is required.")

    model_cfg = MODEL_DOWNLOAD_REGISTRY.get(model_id)
    if not model_cfg:
        raise HTTPException(status_code=400, detail=f"Unknown modelId: {model_id}")

    project_root = Path(__file__).resolve().parents[1]
    target_dir = project_root / "models" / model_id
    target_dir.mkdir(parents=True, exist_ok=True)

    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN")

    try:
        snapshot_download(
            repo_id=model_cfg["repo_id"],
            allow_patterns=[model_cfg["pattern"]],
            local_dir=str(target_dir),
            token=token,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Model download failed: {exc}") from exc

    gguf_files = [str(path.name) for path in target_dir.rglob("*.gguf")]
    if not gguf_files:
        raise HTTPException(
            status_code=500,
            detail="Download completed but no GGUF file was found in target directory.",
        )

    return {
        "status": "ok",
        "modelId": model_id,
        "downloadedFiles": gguf_files,
        "targetDir": str(target_dir),
    }


@app.post("/api/ingest")
async def api_ingest(files: list[UploadFile] = File(...)) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    results: list[dict] = []
    errors: list[dict] = []

    for file in files:
        filename = file.filename or "uploaded.pdf"
        if not filename.lower().endswith(".pdf"):
            errors.append({"file": filename, "error": "Only PDF files are supported."})
            continue

        temp_path = ""
        try:
            payload = await file.read()
            if not payload:
                raise ValueError("Uploaded file is empty.")

            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(payload)
                temp_path = tmp.name

            ingest_result = ingest_pdf(temp_path, title=filename)
            results.append(
                {
                    "file": filename,
                    "documentId": ingest_result["document_id"],
                    "chunksInserted": ingest_result["chunks_inserted"],
                }
            )
        except Exception as exc:
            errors.append({"file": filename, "error": str(exc)})
        finally:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)

    if not results:
        raise HTTPException(
            status_code=400,
            detail={"message": "No files ingested successfully.", "errors": errors},
        )

    return {"results": results, "errors": errors}


def search_chunks(
    query_text: str, document_ids: list[int] | None = None, top_k: int = 5
) -> list[dict]:
    clean_query = query_text.strip()
    if not clean_query:
        return []

    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    doc_ids = [int(doc_id) for doc_id in (document_ids or []) if str(doc_id).isdigit()]

    if doc_ids:
        placeholders = ",".join("?" for _ in doc_ids)
        query = f"""
            SELECT c.id, c.document_id, c.content, d.title, e.vector
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            JOIN embeddings e ON e.chunk_id = c.id
            WHERE c.document_id IN ({placeholders})
        """
        cursor.execute(query, tuple(doc_ids))
    else:
        cursor.execute(
            """
            SELECT c.id, c.document_id, c.content, d.title, e.vector
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            JOIN embeddings e ON e.chunk_id = c.id
            """
        )

    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return []

    query_vec = embed_text(clean_query)
    query_norm = float(np.linalg.norm(query_vec))
    if query_norm == 0.0:
        return []

    scored: list[dict] = []
    for chunk_id, document_id, content, title, vector_blob in rows:
        chunk_vec = np.frombuffer(vector_blob, dtype=np.float32)
        chunk_norm = float(np.linalg.norm(chunk_vec))
        if chunk_norm == 0.0:
            continue
        score = float(np.dot(query_vec, chunk_vec) / (query_norm * chunk_norm))
        scored.append(
            {
                "chunk_id": int(chunk_id),
                "document_id": int(document_id),
                "title": title,
                "content": content,
                "score": score,
            }
        )

    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[: max(1, int(top_k))]


def _build_answer(model_name: str, question: str, ranked_chunks: list[dict]) -> str:
    top_passages = ranked_chunks[:3]
    lines = [
        f"Model selected: {model_name}",
        f"Question: {question}",
        "",
        "Most relevant passages from your uploaded documents:",
    ]

    for index, chunk in enumerate(top_passages, start=1):
        excerpt = " ".join(chunk["content"].split())
        if len(excerpt) > 320:
            excerpt = f"{excerpt[:320]}..."
        lines.append(f"{index}. [{chunk['title']}] {excerpt}")

    lines.append("")
    lines.append(
        "This answer is fully local. No external AI API was called."
    )
    return "\n".join(lines)


@app.post("/api/chat", response_model=ChatResponse)
def api_chat(payload: ChatRequest) -> ChatResponse:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    ranked_chunks = search_chunks(
        query_text=message,
        document_ids=payload.documentIds,
        top_k=max(1, payload.topK),
    )

    if not ranked_chunks:
        return ChatResponse(
            answer="I could not find relevant content in the indexed documents. Upload PDFs first or ask a more specific question.",
            sources=[],
        )

    sources: list[SourceItem] = []
    for chunk in ranked_chunks:
        excerpt = " ".join(chunk["content"].split())
        if len(excerpt) > 160:
            excerpt = f"{excerpt[:160]}..."
        sources.append(
            SourceItem(
                chunkId=chunk["chunk_id"],
                documentId=chunk["document_id"],
                title=chunk["title"],
                score=round(chunk["score"], 4),
                excerpt=excerpt,
            )
        )

    answer = _build_answer(payload.selectedModel, message, ranked_chunks)
    return ChatResponse(answer=answer, sources=sources)
