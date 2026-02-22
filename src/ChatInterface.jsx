import React, { useEffect, useMemo, useRef, useState } from "react";
import { sendChatMessage, ingestSinglePdf } from "./api";

const TOP_K_BY_MODEL_ID = {
  "llama-3.2-3b": 5,
  "phi-3.5-mini": 4,
  "qwen-2.5-3b": 5,
  "mistral-7b-instruct": 7,
  "gemma-2-2b": 4,
};

function normalizeModel(selectedModel) {
  if (selectedModel && typeof selectedModel === "object") {
    return {
      id: selectedModel.id || "",
      name: selectedModel.name || "Unknown SLM",
    };
  }

  if (typeof selectedModel === "string" && selectedModel.trim()) {
    return { id: "", name: selectedModel.trim() };
  }

  return { id: "", name: "Unknown SLM" };
}

export default function ChatInterface({ selectedModel, uploadedFiles = [] }) {
  const activeModel = useMemo(() => normalizeModel(selectedModel), [selectedModel]);
  
  // 1. On sépare les IDs qui viennent des props (de la page Home)
  const initialDocumentIds = useMemo(
    () =>
      Array.from(
        new Set(
          (Array.isArray(uploadedFiles) ? uploadedFiles : [])
            .map((file) => Number(file?.documentId))
            .filter((id) => Number.isInteger(id) && id > 0)
        )
      ),
    [uploadedFiles]
  );

  // 2. On garde une trace des IDs ajoutés directement via Drag & Drop dans le chat
  const [localDocumentIds, setLocalDocumentIds] = useState([]);
  
  // 3. On fusionne le tout pour envoyer au RAG
  const allDocumentIds = useMemo(
    () => Array.from(new Set([...initialDocumentIds, ...localDocumentIds])),
    [initialDocumentIds, localDocumentIds]
  );

  const [messages, setMessages] = useState([
    {
      role: "slm",
      content: `Hi! I'm ${activeModel.name}. Ask a question about your documents and I'll answer with sources. You can also drop new PDFs here at any time to add them to my context!`,
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- LOGIQUE DRAG & DROP ---
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(
        (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      );

      if (files.length === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "slm", content: "⚠️ Please upload PDF files only.", sources: [] },
        ]);
        return;
      }

      setIsIngesting(true);
      const newIds = [];

      for (const file of files) {
        try {
          const result = await ingestSinglePdf(file);
          if (result && result.documentId) {
            newIds.push(result.documentId);
            setMessages((prev) => [
              ...prev,
              { role: "slm", content: `📄 Successfully ingested: ${file.name} (Added to context)`, sources: [] },
            ]);
          }
        } catch (error) {
          setMessages((prev) => [
            ...prev,
            { role: "slm", content: `❌ Failed to ingest ${file.name}: ${error.message}`, sources: [] },
          ]);
        }
      }

      if (newIds.length > 0) {
        setLocalDocumentIds((prev) => [...prev, ...newIds]);
      }
      setIsIngesting(false);
    }
  };

  // --- LOGIQUE D'ENVOI DE MESSAGE ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isLoading || isIngesting) return;

    const userMessage = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        message: question,
        selectedModel: activeModel.name,
        selectedModelId: activeModel.id,
        documentIds: allDocumentIds, // On utilise la liste fusionnée
        topK: TOP_K_BY_MODEL_ID[activeModel.id] || 5,
      });

      const slmResponse = {
        role: "slm",
        content: response?.answer || "No answer generated.",
        sources: Array.isArray(response?.sources) ? response.sources : [],
      };
      setMessages((prev) => [...prev, slmResponse]);
    } catch (error) {
      const failureMessage = {
        role: "slm",
        content: `Backend error: ${error.message}`,
        sources: [],
      };
      setMessages((prev) => [...prev, failureMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="relative flex h-screen flex-col bg-gray-900 font-sans text-gray-100"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {/* Overlay Drag & Drop */}
      {dragActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border-4 border-dashed border-purple-500 bg-gray-900/90 backdrop-blur-sm">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-purple-500/20 text-5xl">
            📄
          </div>
          <p className="mt-6 text-3xl font-bold text-purple-300">Drop PDFs here</p>
          <p className="mt-2 text-lg text-purple-200/70">They will be instantly added to the AI's context.</p>
        </div>
      )}

      <header className="flex items-center justify-between border-b border-purple-900/50 bg-gray-800 p-4 shadow-md">
        <h1 className="bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-xl font-bold text-transparent">
          EveryOne
        </h1>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gray-700 px-3 py-1 text-xs font-medium text-gray-200 transition-all">
            Indexed docs: {allDocumentIds.length}
          </div>
          <div className="rounded-full bg-purple-700 px-3 py-1 text-sm font-medium text-purple-100">
            Active model: {activeModel.name}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto space-y-6 p-4">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[82%] rounded-2xl p-4 shadow-sm ${
                  msg.role === "user"
                    ? "rounded-br-none bg-orange-600 text-white"
                    : "rounded-bl-none border border-purple-500/30 bg-gray-800 text-gray-200"
                }`}
              >
                <div
                  className={`mb-1 text-xs font-semibold ${msg.role === "user" ? "text-orange-200" : "text-purple-400"}`}
                >
                  {msg.role === "user" ? "You" : activeModel.name}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                {msg.role !== "user" && Array.isArray(msg.sources) && msg.sources.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-purple-300">
                      Sources
                    </p>
                    {msg.sources.map((source) => (
                      <div
                        key={`${source.chunkId}-${source.documentId}`}
                        className="rounded-lg border border-purple-400/20 bg-black/20 p-3"
                      >
                        <p className="text-xs font-semibold text-purple-200">
                          {source.title}
                          {Number(source.page) > 0 ? ` • page ${source.page}` : ""}
                          {` • score ${source.score}`}
                        </p>
                        <p className="mt-1 text-sm text-gray-300">{source.excerpt}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {(isLoading || isIngesting) && (
            <div className="flex justify-start">
              <div className="flex flex-col space-y-3 rounded-2xl rounded-bl-none border border-purple-500/30 bg-gray-800 p-4 shadow-sm">
                {isIngesting && (
                  <div className="text-xs font-semibold text-purple-300">Processing PDF...</div>
                )}
                <div className="flex space-x-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500"></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-purple-500"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="h-2 w-2 animate-bounce rounded-full bg-purple-500"
                    style={{ animationDelay: "0.4s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-gray-900 p-4 z-10 relative">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className={`flex items-center overflow-hidden rounded-xl border transition-all ${
              isIngesting ? "border-purple-500/50 bg-gray-800/50" : "border-gray-700 bg-gray-800 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500"
            }`}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isIngesting ? "Ingesting PDF..." : `Ask ${activeModel.name}...`}
              className="flex-1 border-none bg-transparent p-4 text-gray-100 placeholder-gray-500 focus:outline-none"
              disabled={isLoading || isIngesting}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || isIngesting}
              className="bg-purple-600 px-6 py-4 font-semibold text-white transition-colors hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500"
            >
              Send
            </button>
          </form>
          <div className="mt-2 text-center text-xs text-gray-500 flex justify-center gap-4">
            <span>Answers are generated from the local RAG database.</span>
            <span className="text-purple-400/70">Drag & Drop a PDF anywhere to add it.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}