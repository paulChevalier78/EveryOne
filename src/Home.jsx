import React, { useEffect, useMemo, useRef, useState } from "react";
import BrandShell from "./components/BrandShell";
import { SLM_DOWNLOADS } from "./content/models";
import { MODEL_LOGOS } from "./content/modelLogos";
import { ingestSinglePdf, initializeBackend, downloadFinetunedModel } from "./api";

export default function Home({ onNavigate, onStartChat }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestErrors, setIngestErrors] = useState([]);
  const [carouselStart, setCarouselStart] = useState(0);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  
  // États pour gérer le finetuning
  const [isFinetuning, setIsFinetuning] = useState(false);
  const [finetuneJobId, setFinetuneJobId] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const fileInputRef = useRef(null);

  // Auto-scroll carousel every 3.2 seconds
  useEffect(() => {
    if (!isAutoScroll || selectedModel) return;

    const timer = setInterval(() => {
      setCarouselStart((prev) => (prev + 1) % SLM_DOWNLOADS.length);
    }, 3200);

    return () => clearInterval(timer);
  }, [isAutoScroll, selectedModel]);

  useEffect(() => {
    initializeBackend().catch(() => {
      // The UI still allows file drop; per-file ingestion will report precise errors.
    });
  }, []);

  // Get 3 visible models starting from carouselStart
  const visibleModels = useMemo(() => {
    return Array.from({ length: 3 }, (_, offset) => {
      const index = (carouselStart + offset) % SLM_DOWNLOADS.length;
      return SLM_DOWNLOADS[index];
    });
  }, [carouselStart]);

  const goPrev = () => {
    setCarouselStart((prev) => (prev - 1 + SLM_DOWNLOADS.length) % SLM_DOWNLOADS.length);
    setIsAutoScroll(false);
  };

  const handleFineTune = async () => {
    if (!selectedModel) return;

    try {
      setIsFinetuning(true);

      const payload = { 
        datasetName: "cybersec" // ou "hackmentor", "alpaca", etc.
      };

      const response = await fetch("http://localhost:8000/api/finetune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.job_id) {
        setFinetuneJobId(data.job_id);
      }
    } catch (err) {
      console.error(err);
      alert("Error communicating with local backend.");
    } finally {
      setIsFinetuning(false);
    }
  };

  const handleDownloadFinetuned = async () => {
    // 1. On demande le nom à l'utilisateur
    const customName = prompt(
      "Comment voulez-vous nommer ce modèle ? (ex: cybersec-v1)", 
      "mon-modele-finetune"
    );
    
    // Si l'utilisateur clique sur "Annuler", on arrête tout
    if (!customName) return;

    try {
      setIsDownloading(true);
      alert("Downloading fine-tuned model from Modal... This might take a minute depending on your connection.");
      
      // 2. On passe le nom à l'API
      await downloadFinetunedModel({ customName });
      
      alert(`Success! The model "${customName}" is now available in your local folder. Go to 'Discover Models' to use it.`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const goNext = () => {
    setCarouselStart((prev) => (prev + 1) % SLM_DOWNLOADS.length);
    setIsAutoScroll(false);
  };

  const handleModelSelect = (model) => {
    setSelectedModel(model);
    setIsAutoScroll(false);
  };

  const processFiles = async (filesList) => {
    const newFiles = Array.from(filesList).filter(
      (file) =>
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (newFiles.length === 0) {
      alert("Please upload PDF files only.");
      return;
    }

    setIsIngesting(true);
    setIngestErrors([]);

    const successfulIngestions = [];
    const ingestionFailures = [];

    for (const file of newFiles) {
      try {
        const result = await ingestSinglePdf(file);
        successfulIngestions.push({
          name: file.name,
          size: file.size,
          type: file.type || "application/pdf",
          documentId: result.documentId,
          chunksInserted: result.chunksInserted,
        });
      } catch (error) {
        ingestionFailures.push(`${file.name}: ${error.message}`);
      }
    }

    if (successfulIngestions.length > 0) {
      setUploadedFiles((prev) => {
        const merged = [...prev];
        for (const fileObj of successfulIngestions) {
          if (!merged.some((existing) => existing.documentId === fileObj.documentId)) {
            merged.push(fileObj);
          }
        }
        return merged;
      });
    }
    if (ingestionFailures.length > 0) {
      setIngestErrors(ingestionFailures);
    }

    setIsIngesting(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await processFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleStartChat = () => {
    if (selectedModel && onStartChat) {
      onStartChat(selectedModel, uploadedFiles);
    }
  };

  return (
    <BrandShell
      activePage="home"
      onNavigate={onNavigate}
      primaryLabel="Discover models"
      onPrimaryAction={() => onNavigate("discover")}
    >
      <main className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-10 md:px-7">
        <section className="smooth-fade-in">
          <h1 className="text-4xl font-black tracking-[-0.02em] md:text-5xl">
            Simple AI model marketplace
          </h1>
          <p className="mt-3 max-w-[720px] text-base font-medium text-[var(--muted-ink)] md:text-lg">
            Upload your PDFs and pick the right model for your use case.
          </p>
        </section>

        <section className="mt-8 space-y-6">
          {/* Drag & Drop Zone for PDFs */}
          <div className="smooth-fade-in">
            <div
              className={`rounded-2xl border bg-[var(--brand-panel)] p-5 transition ${
                dragActive
                  ? "border-[var(--brand-purple)] ring-2 ring-[var(--brand-purple)]/25"
                  : "border-[var(--brand-line)]"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                className="hidden"
                multiple
                accept="application/pdf"
              />

              <div className="rounded-2xl border border-dashed border-white/20 bg-[var(--brand-panel-soft)] p-7 text-center">
                <p className="text-lg font-bold text-[var(--ink)]">Drag & drop your PDFs</p>
                <p className="mt-2 text-sm text-[var(--muted-ink)]">
                  Click to browse files from your computer. Ingestion starts on drop.
                </p>
                <button
                  type="button"
                  className="mt-5 rounded-xl bg-[var(--brand-purple)] px-5 py-2 text-sm font-semibold text-white pointer-events-none"
                >
                  Browse files
                </button>
              </div>

              {isIngesting && (
                <p className="mt-4 text-sm font-semibold text-[var(--brand-purple-soft)]">
                  Ingestion in progress...
                </p>
              )}

              {uploadedFiles.length > 0 && (
                <div className="mt-4 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-panel-soft)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                    Uploaded files ({uploadedFiles.length})
                  </p>
                  <div className="mt-2 space-y-1">
                    {uploadedFiles.slice(0, 6).map((fileObj, index) => (
                      <p key={`${fileObj.name}-${index}`} className="truncate text-sm text-[var(--ink)]">
                        📄 {fileObj.name} (doc #{fileObj.documentId})
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {ingestErrors.length > 0 && (
                <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-200">
                    Ingestion errors ({ingestErrors.length})
                  </p>
                  <div className="mt-2 space-y-1">
                    {ingestErrors.slice(0, 4).map((error, index) => (
                      <p key={`${error}-${index}`} className="truncate text-sm text-red-100">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Carousel with 3 models */}
          <div className="smooth-fade-in rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-[-0.02em] text-[var(--ink)]">
                Featured models
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goPrev}
                  className="rounded-lg border border-[var(--brand-line)] px-3 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-white/5"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-lg border border-[var(--brand-line)] px-3 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-white/5"
                >
                  Next →
                </button>
              </div>
            </div>

            <p className="mt-2 text-sm text-[var(--muted-ink)]">3 visible • {SLM_DOWNLOADS.length} total models</p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {visibleModels.map((model) => (
                <article
                  key={model.id}
                  onClick={() => handleModelSelect(model)}
                  className={`cursor-pointer rounded-xl border bg-[var(--brand-panel-soft)] p-4 transition ${
                    selectedModel?.id === model.id
                      ? "border-[var(--brand-purple)] ring-1 ring-[var(--brand-purple)]/30"
                      : "border-[var(--brand-line)] hover:border-white/25"
                  }`}
                >
                  <div className="mb-3 flex h-12 items-center justify-center rounded-lg border border-[var(--brand-line)] bg-gradient-to-r from-[var(--brand-purple)]/20 to-[var(--brand-orange)]/20">
                    <img
                      src={MODEL_LOGOS[model.id]}
                      alt={`${model.name} logo`}
                      className="h-8 w-8 rounded object-contain"
                    />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                    {model.family} • {model.size}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-[var(--ink)]">{model.name}</h3>
                  <p className="mt-2 text-xs text-[var(--muted-ink)] line-clamp-2">
                    {model.description}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[var(--brand-purple-soft)] line-clamp-2">
                    💡 {model.whyUse}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--brand-orange)]">{model.priceLabel}</p>
                  {selectedModel?.id === model.id && (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-green-400">
                      ✓ Selected
                    </p>
                  )}
                </article>
              ))}
            </div>

            {selectedModel && (
              <div className="mt-4 rounded-xl border border-[var(--brand-purple)]/35 bg-[var(--brand-panel-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-purple-soft)]">
                  Model recommendation
                </p>
                <h3 className="mt-2 text-lg font-bold text-[var(--ink)]">{selectedModel.name}</h3>

                <div className="mt-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-panel)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                    Best use case
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink)]">{selectedModel.bestFor}</p>
                </div>

                <div className="mt-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-panel)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                    Key strengths
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedModel.strengths?.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-[var(--brand-purple)]/18 px-3 py-1 text-xs font-semibold text-[var(--brand-purple-soft)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="mt-4 text-xs text-[var(--muted-ink)]">
              Select one model. Click "Start Chat" to begin.
            </p>

            <div className="mt-4 flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleStartChat}
                disabled={!selectedModel}
                className="flex-1 rounded-xl bg-[var(--brand-purple)] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Chat →
              </button>

              {/* Soit le bouton de Fine-tuning, soit la barre de chargement animée */}
              {!finetuneJobId ? (
                <button
                  type="button"
                  onClick={handleFineTune}
                  disabled={!selectedModel || isFinetuning}
                  className="flex-1 rounded-xl bg-[var(--brand-orange)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFinetuning ? "Starting job..." : "Fine-Tune Model 🚀"}
                </button>
              ) : (
                <div className="flex-1 flex flex-col justify-center gap-2 rounded-xl border border-[var(--brand-orange)]/50 bg-[var(--brand-orange)]/10 px-4 py-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--brand-orange)]">
                    <span>Training on Modal...</span>
                    <span className="animate-pulse">⏳</span>
                  </div>
                  {/* Barre de progression indéterminée élégante avec Tailwind */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/20">
                    <div className="h-full w-full origin-left animate-[pulse_1.5s_ease-in-out_infinite] bg-[var(--brand-orange)]"></div>
                  </div>
                </div>
              )}
              
              {finetuneJobId && (
                <button
                  type="button"
                  onClick={handleDownloadFinetuned}
                  disabled={isDownloading}
                  className="flex-1 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading ? "Downloading..." : "⬇️ Download Finetuned"}
                </button>
              )}

              <button
                type="button"
                onClick={() => onNavigate("discover")}
                className="rounded-xl border border-[var(--brand-line)] px-5 py-2 text-sm font-semibold text-[var(--muted-ink)] hover:bg-white/5"
              >
                View all
              </button>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-4 text-center">
            <p className="text-sm font-semibold text-[var(--ink)]">Full privacy.</p>
          </article>
          <article className="rounded-xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-4 text-center">
            <p className="text-sm font-semibold text-[var(--ink)]">Lower cost.</p>
          </article>
          <article className="rounded-xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-4 text-center">
            <p className="text-sm font-semibold text-[var(--ink)]">Targeted performance.</p>
          </article>
        </section>
      </main>
    </BrandShell>
  );
}