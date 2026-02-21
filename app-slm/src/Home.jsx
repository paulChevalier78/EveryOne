import React, { useEffect, useMemo, useRef, useState } from "react";
import BrandShell from "./components/BrandShell";
import { SLM_DOWNLOADS } from "./content/models";
import { MODEL_LOGOS } from "./content/modelLogos";

export default function Home({ onNavigate, onStartChat }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [carouselStart, setCarouselStart] = useState(0);
  const [selectedModel, setSelectedModel] = useState(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const fileInputRef = useRef(null);

  // Auto-scroll carousel every 3.2 seconds
  useEffect(() => {
    if (!isAutoScroll || selectedModel) return;

    const timer = setInterval(() => {
      setCarouselStart((prev) => (prev + 1) % SLM_DOWNLOADS.length);
    }, 3200);

    return () => clearInterval(timer);
  }, [isAutoScroll, selectedModel]);

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

  const goNext = () => {
    setCarouselStart((prev) => (prev + 1) % SLM_DOWNLOADS.length);
    setIsAutoScroll(false);
  };

  const handleModelSelect = (model) => {
    setSelectedModel(model);
    setIsAutoScroll(false);
  };

  const processFiles = (filesList) => {
    const newFiles = Array.from(filesList).filter(
      (file) =>
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    );

    if (newFiles.length === 0) {
      alert("Please upload PDF files only.");
      return;
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const handleStartChat = () => {
    if (selectedModel && onStartChat) {
      onStartChat(selectedModel.name, uploadedFiles);
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
                  Click to browse files from your computer.
                </p>
                <button
                  type="button"
                  className="mt-5 rounded-xl bg-[var(--brand-purple)] px-5 py-2 text-sm font-semibold text-white pointer-events-none"
                >
                  Browse files
                </button>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-4 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-panel-soft)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                    Uploaded files ({uploadedFiles.length})
                  </p>
                  <div className="mt-2 space-y-1">
                    {uploadedFiles.slice(0, 6).map((fileObj, index) => (
                      <p key={`${fileObj.name}-${index}`} className="truncate text-sm text-[var(--ink)]">
                        📄 {fileObj.name}
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
                  {/* Why use explanation */}
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
                  Recommandation du modèle
                </p>
                <h3 className="mt-2 text-lg font-bold text-[var(--ink)]">{selectedModel.name}</h3>

                <div className="mt-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-panel)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                    Dans quel cas le choisir
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink)]">{selectedModel.bestFor}</p>
                </div>

                <div className="mt-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-panel)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                    Pourquoi il est fort
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

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleStartChat}
                disabled={!selectedModel}
                className="flex-1 rounded-xl bg-[var(--brand-purple)] px-5 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Chat →
              </button>
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
            <p className="text-sm font-semibold text-[var(--ink)]">Confidentialité absolue.</p>
          </article>
          <article className="rounded-xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-4 text-center">
            <p className="text-sm font-semibold text-[var(--ink)]">Coût réduit.</p>
          </article>
          <article className="rounded-xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-4 text-center">
            <p className="text-sm font-semibold text-[var(--ink)]">Performance ciblée.</p>
          </article>
        </section>
      </main>
    </BrandShell>
  );
}
