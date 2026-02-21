import os
import sqlite3
import sys

import numpy as np
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

from init_db import DB_PATH, init_db


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model = SentenceTransformer("all-MiniLM-L6-v2")


def extract_text_from_pdf(pdf_path: str) -> str:
    reader = PdfReader(pdf_path)
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
    return text


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
    return np.array(model.encode(text), dtype=np.float32)


def ingest_pdf(
    pdf_path: str, title: str | None = None, show_progress: bool = False
) -> dict:
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"File not found: {pdf_path}")

    init_db()

    text = extract_text_from_pdf(pdf_path)
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("No extractable text found in the PDF.")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    document_title = title or os.path.basename(pdf_path)
    cursor.execute("INSERT INTO documents (title) VALUES (?)", (document_title,))
    document_id = cursor.lastrowid

    iterator = chunks
    if show_progress:
        iterator = tqdm(chunks, desc="Progress", unit="chunk")

    chunks_inserted = 0
    for chunk in iterator:
        cursor.execute(
            "INSERT INTO chunks (document_id, content) VALUES (?, ?)",
            (document_id, chunk),
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
