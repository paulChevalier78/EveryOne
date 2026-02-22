import os
import sqlite3
import sys
import hashlib

import numpy as np #type: ignore
from pypdf import PdfReader # type: ignore
from sentence_transformers import SentenceTransformer  #type: ignore
from tqdm import tqdm #type: ignore

from init_db import DB_PATH, init_db


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL = os.getenv("RAG_EMBED_MODEL", "all-MiniLM-L6-v2")
FALLBACK_MODEL = os.getenv("RAG_EMBED_FALLBACK_MODEL", "BAAI/bge-large-en-v1.5")
model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global model
    if model is not None:
        return model

    try:
        model = SentenceTransformer(DEFAULT_MODEL)
    except Exception:
        # Offline fallback when the default model is not locally cached.
        model = SentenceTransformer(FALLBACK_MODEL, local_files_only=True)
    return model


def extract_pages_from_pdf(pdf_path: str) -> list[tuple[int, str]]:
    reader = PdfReader(pdf_path)
    pages: list[tuple[int, str]] = []
    for page_number, page in enumerate(reader.pages, start=1):
        page_text = page.extract_text()
        clean_text = (page_text or "").strip()
        if clean_text:
            pages.append((page_number, clean_text))
    return pages


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> list[str]:
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += max(1, chunk_size - overlap)
    return chunks


def embed_text(text: str) -> np.ndarray:
    return np.array(get_model().encode(text), dtype=np.float32)


def compute_file_sha256(file_path: str) -> str:
    hasher = hashlib.sha256()
    with open(file_path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def ingest_pdf(
    pdf_path: str,
    title: str | None = None,
    show_progress: bool = False,
    file_hash: str | None = None,
) -> dict:
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"File not found: {pdf_path}")

    init_db()

    page_entries = extract_pages_from_pdf(pdf_path)
    if not page_entries:
        raise ValueError("No extractable text found in the PDF.")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    document_title = title or os.path.basename(pdf_path)
    normalized_hash = (file_hash or compute_file_sha256(pdf_path)).strip().lower()

    if normalized_hash:
        cursor.execute(
            "SELECT id, title FROM documents WHERE file_hash = ? LIMIT 1",
            (normalized_hash,),
        )
        existing = cursor.fetchone()
        if existing:
            conn.close()
            return {
                "document_id": int(existing[0]),
                "title": existing[1],
                "chunks_inserted": 0,
                "db_path": DB_PATH,
                "already_exists": True,
                "file_hash": normalized_hash,
            }

    try:
        cursor.execute(
            "INSERT INTO documents (title, file_hash) VALUES (?, ?)",
            (document_title, normalized_hash or None),
        )
        document_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        if normalized_hash:
            cursor.execute(
                "SELECT id, title FROM documents WHERE file_hash = ? LIMIT 1",
                (normalized_hash,),
            )
            existing = cursor.fetchone()
            if existing:
                conn.close()
                return {
                    "document_id": int(existing[0]),
                    "title": existing[1],
                    "chunks_inserted": 0,
                    "db_path": DB_PATH,
                    "already_exists": True,
                    "file_hash": normalized_hash,
                }
        conn.close()
        raise

    chunks_with_page: list[tuple[int, str]] = []
    for page_number, page_text in page_entries:
        for chunk in chunk_text(page_text):
            chunks_with_page.append((page_number, chunk))

    iterator = chunks_with_page
    if show_progress:
        iterator = tqdm(chunks_with_page, desc="Progress", unit="chunk")

    chunks_inserted = 0
    for page_number, chunk in iterator:
        cursor.execute(
            "INSERT INTO chunks (document_id, content, page) VALUES (?, ?, ?)",
            (document_id, chunk, page_number),
        )
        chunk_id = cursor.lastrowid

        vector = embed_text(chunk)

        cursor.execute(
            "INSERT INTO embeddings (chunk_id, vector) VALUES (?, ?)",
            (chunk_id, vector.tobytes()),
        )
        chunks_inserted += 1

    conn.commit()
    conn.close()

    return {
        "document_id": int(document_id),
        "title": document_title,
        "chunks_inserted": chunks_inserted,
        "db_path": DB_PATH,
        "already_exists": False,
        "file_hash": normalized_hash,
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python ingest_pdf.py path/to/file.pdf")
    else:
        result = ingest_pdf(sys.argv[1], show_progress=True)
        print(f"PDF ingested: {result['title']}")
        print(f"Document ID: {result['document_id']}")
        print(f"Chunks inserted: {result['chunks_inserted']}")
        print(f"Database: {result['db_path']}")
