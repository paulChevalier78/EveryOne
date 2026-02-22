const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export async function initializeBackend() {
  const response = await fetch(buildUrl("/api/init"), {
    method: "POST",
  });

  if (!response.ok) {
    const payload = await parseJsonSafe(response);
    throw new Error(payload.detail || payload.message || "Backend initialization failed.");
  }

  return parseJsonSafe(response);
}

export async function ingestSinglePdf(file) {
  const formData = new FormData();
  formData.append("files", file);

  const response = await fetch(buildUrl("/api/ingest"), {
    method: "POST",
    body: formData,
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const detail = payload.detail || payload.message || "Failed to ingest PDF.";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  const first = Array.isArray(payload.results) ? payload.results[0] : null;
  if (!first || typeof first.documentId !== "number") {
    throw new Error("Invalid ingest response from backend.");
  }

  return first;
}

export async function sendChatMessage({ message, selectedModel, selectedModelId, documentIds, topK = 5 }) {
  const response = await fetch(buildUrl("/api/chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      selectedModel,
      selectedModelId,
      documentIds,
      topK,
    }),
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const detail = payload.detail || payload.message || "Chat request failed.";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return payload;
}

export async function downloadModelGguf({ modelId }) {
  const response = await fetch(buildUrl("/api/models/download"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ modelId }),
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const detail = payload.detail || payload.message || "Model download failed.";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return payload;
}

export async function fetchLocalModels() {
  const response = await fetch(buildUrl("/api/models/local"), {
    method: "GET",
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const detail = payload.detail || payload.message || "Failed to fetch local GGUF models.";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return Array.isArray(payload) ? payload : [];
}

export async function downloadFinetunedModel({ customName }) {
  const response = await fetch(buildUrl("/api/finetune/download"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ customName }),
  });

  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    const detail = payload.detail || payload.message || "Failed to download fine-tuned model.";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return payload;
}