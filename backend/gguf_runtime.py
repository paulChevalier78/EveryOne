import os
import re
from dataclasses import dataclass
from pathlib import Path
from threading import Lock


MODEL_ROOT = Path(
    os.getenv("GGUF_MODEL_DIR", str(Path(__file__).resolve().parent / "Model"))
).resolve()

MODEL_SELECTION_ALIASES: dict[str, list[str]] = {
    "llama-3-2-3b": ["tinyllama", "llama"],
    "phi-3-5-mini": ["phi-2", "phi2", "phi"],
    "qwen-2-5-3b": ["qwen2", "qwen"],
    "mistral-7b-instruct": ["mistral"],
    "gemma-2-2b": ["gemma"],
}

_runtime_lock = Lock()
_loaded_model_path: Path | None = None
_loaded_model_mtime_ns: int | None = None
_loaded_llm = None


@dataclass(frozen=True)
class LocalGgufModel:
    key: str
    path: Path
    size_bytes: int


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def discover_local_gguf_models() -> list[LocalGgufModel]:
    if not MODEL_ROOT.exists():
        return []

    discovered: list[LocalGgufModel] = []
    for path in sorted(MODEL_ROOT.rglob("*.gguf")):
        try:
            size_bytes = int(path.stat().st_size)
        except OSError:
            size_bytes = 0
        discovered.append(
            LocalGgufModel(
                key=_normalize(path.stem),
                path=path.resolve(),
                size_bytes=size_bytes,
            )
        )
    return discovered


def _build_model_lookup(
    models: list[LocalGgufModel],
) -> tuple[dict[str, LocalGgufModel], list[LocalGgufModel]]:
    by_key: dict[str, LocalGgufModel] = {}
    for model in models:
        by_key[model.key] = model
    return by_key, models


def resolve_local_gguf_model(
    selected_model_id: str,
    selected_model_name: str,
) -> LocalGgufModel:
    models = discover_local_gguf_models()
    if not models:
        raise RuntimeError(
            f"No GGUF model found in '{MODEL_ROOT}'. Add at least one .gguf file."
        )

    by_key, all_models = _build_model_lookup(models)
    normalized_id = _normalize(selected_model_id)
    normalized_name = _normalize(selected_model_name)

    preferred_tokens: list[str] = []
    if normalized_id:
        preferred_tokens.append(normalized_id)
        preferred_tokens.extend(MODEL_SELECTION_ALIASES.get(normalized_id, []))
    if normalized_name:
        preferred_tokens.append(normalized_name)
        preferred_tokens.extend(part for part in normalized_name.split("-") if part)

    for token in preferred_tokens:
        if token in by_key:
            return by_key[token]
        for model in all_models:
            if token and token in model.key:
                return model

    if normalized_id or normalized_name:
        available = ", ".join(model.path.name for model in all_models)
        raise RuntimeError(
            "No compatible GGUF model found for "
            f"selectedModelId='{selected_model_id}' / selectedModel='{selected_model_name}'. "
            f"Available GGUF files in '{MODEL_ROOT}': {available}"
        )

    return all_models[0]


def _get_llama_runtime(model_path: Path):
    global _loaded_model_path, _loaded_model_mtime_ns, _loaded_llm

    try:
        current_mtime_ns = int(model_path.stat().st_mtime_ns)
    except OSError:
        current_mtime_ns = -1

    with _runtime_lock:
        if (
            _loaded_llm is not None
            and _loaded_model_path == model_path
            and _loaded_model_mtime_ns == current_mtime_ns
        ):
            return _loaded_llm, True

        try:
            from llama_cpp import Llama
        except ImportError as exc:
            raise RuntimeError(
                "llama-cpp-python is not installed. "
                "Run: ./venv/bin/pip install llama-cpp-python"
            ) from exc

        n_ctx = int(os.getenv("GGUF_N_CTX", "4096"))
        n_batch = int(os.getenv("GGUF_N_BATCH", "512"))
        n_threads = int(
            os.getenv("GGUF_N_THREADS", str(max(1, (os.cpu_count() or 4) - 1)))
        )
        n_gpu_layers = int(os.getenv("GGUF_N_GPU_LAYERS", "-1"))

        _loaded_llm = Llama(
            model_path=str(model_path),
            n_ctx=n_ctx,
            n_batch=n_batch,
            n_threads=n_threads,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )
        _loaded_model_path = model_path
        _loaded_model_mtime_ns = current_mtime_ns
        return _loaded_llm, False


def is_model_currently_loaded(model_path: Path) -> bool:
    try:
        current_mtime_ns = int(model_path.stat().st_mtime_ns)
    except OSError:
        return False

    with _runtime_lock:
        return bool(
            _loaded_llm is not None
            and _loaded_model_path == model_path
            and _loaded_model_mtime_ns == current_mtime_ns
        )


def _build_messages(question: str, ranked_chunks: list[dict]) -> list[dict]:
    # 1. MODE CHAT NORMAL (Sans PDF)
    if not ranked_chunks:
        return [
            {"role": "system", "content": "You are a helpful, smart, and friendly AI assistant."},
            {"role": "user", "content": question}
        ]

    # 2. MODE RAG (Avec PDF)
    limited_chunks = ranked_chunks[:6]
    context_lines: list[str] = []
    for index, chunk in enumerate(limited_chunks, start=1):
        excerpt = " ".join(str(chunk["content"]).split())
        if len(excerpt) > 700:
            excerpt = f"{excerpt[:700]}..."
        context_lines.append(f"[S{index}] {excerpt}")

    context_text = "\n\n".join(context_lines)
    
    system_prompt = (
        "You are a helpful local assistant.\n"
        "Answer ONLY from the provided context.\n"
        "If the context is insufficient, say it clearly.\n"
        "When you use information, cite source markers like [S1], [S2]."
    )
    
    user_prompt = f"Context:\n{context_text}\n\nQuestion:\n{question}"

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]


def generate_rag_answer_with_gguf(
    selected_model_id: str,
    selected_model_name: str,
    question: str,
    ranked_chunks: list[dict],
) -> tuple[str, LocalGgufModel, bool]:
    model = resolve_local_gguf_model(selected_model_id, selected_model_name)
    runtime, cache_hit = _get_llama_runtime(model.path)

    messages = _build_messages(question=question, ranked_chunks=ranked_chunks)
    temperature = float(os.getenv("GGUF_TEMPERATURE", "0.2"))
    top_p = float(os.getenv("GGUF_TOP_P", "0.95"))
    max_tokens = int(os.getenv("GGUF_MAX_TOKENS", "512"))

    try:
        # Utilisation de la Chat API qui gère automatiquement les formats Llama/Mistral/ChatML !
        result = runtime.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
        )
    except Exception as exc:
        raise RuntimeError(f"GGUF inference failed with '{model.path.name}': {exc}") from exc

    # Extraction de la réponse depuis la nouvelle structure de données
    answer_text = ""
    if isinstance(result, dict):
        choices = result.get("choices", [])
        if choices:
            answer_text = choices[0].get("message", {}).get("content", "").strip()

    if not answer_text:
        answer_text = "I could not generate an answer from the selected GGUF model."

    return answer_text, model, cache_hit
