import React, { useState } from "react";
import BrandShell from "./components/BrandShell";
import { SLM_DOWNLOADS } from "./content/models";
import { MODEL_LOGOS } from "./content/modelLogos";
import { downloadModelGguf } from "./api";

export default function DiscoverModels({ onNavigate }) {
  const [copiedId, setCopiedId] = useState("");
  const [downloadingId, setDownloadingId] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");

  const handleCopy = async (entry) => {
    try {
      await navigator.clipboard.writeText(entry.command);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(""), 1200);
    } catch {
      setCopiedId("");
    }
  };

  const handleDownload = async (entry) => {
    setDownloadMessage("");
    setDownloadingId(entry.id);

    try {
      const result = await downloadModelGguf({ modelId: entry.id });
      const count = Array.isArray(result.downloadedFiles)
        ? result.downloadedFiles.length
        : 0;
      setDownloadMessage(
        `✅ ${entry.name} téléchargé en local (${count} fichier${count > 1 ? "s" : ""}) dans ${result.targetDir}`
      );
    } catch (error) {
      setDownloadMessage(`❌ ${error.message || "Download failed."}`);
    } finally {
      setDownloadingId("");
    }
  };

  return (
    <BrandShell
      activePage="discover"
      onNavigate={onNavigate}
      primaryLabel="Your models"
      onPrimaryAction={() => onNavigate("your-models")}
    >
      <main className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-10 md:px-7">
        <section className="smooth-fade-in">
          <h1 className="text-4xl font-black tracking-[-0.02em] md:text-5xl">Discover Models</h1>
          <p className="mt-3 max-w-[720px] text-base font-medium text-[var(--muted-ink)] md:text-lg">
            Browse all 5 marketplace models and add the ones you need.
          </p>
          {downloadMessage && (
            <p className="mt-3 rounded-lg border border-[var(--brand-line)] bg-[var(--brand-panel)] p-3 text-sm text-[var(--ink)]">
              {downloadMessage}
            </p>
          )}
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SLM_DOWNLOADS.map((entry) => (
            <article
              key={entry.id}
              className="rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                  {entry.family} • {entry.size}
                </p>
                {entry.mandatory && (
                  <span className="rounded-full bg-[var(--brand-orange)]/18 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#FFD4AE]">
                    Core
                  </span>
                )}
              </div>

              <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">{entry.name}</h2>
              <div className="mt-2 flex h-11 items-center justify-center rounded-lg border border-[var(--brand-line)] bg-gradient-to-r from-[var(--brand-purple)]/20 to-[var(--brand-orange)]/20">
                <img
                  src={MODEL_LOGOS[entry.id]}
                  alt={`${entry.name} logo`}
                  className="h-7 w-7 rounded object-contain"
                />
              </div>
              <p className="mt-2 text-sm text-[var(--muted-ink)]">{entry.description}</p>

              {/* Why use explanation */}
              <div className="mt-3 rounded-lg bg-[var(--brand-purple)]/10 p-3">
                <p className="text-xs font-semibold text-[var(--brand-purple-soft)]">
                  💡 {entry.whyUse}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--brand-orange)]">
                  {entry.priceLabel}
                </span>
                <span className="text-xs font-medium text-[var(--muted-ink)]">{entry.quant}</span>
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(entry)}
                  disabled={downloadingId === entry.id}
                  className="rounded-xl bg-[var(--brand-purple)] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#6D28D9]"
                >
                  {downloadingId === entry.id ? "Downloading..." : "Download"}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(entry)}
                  className="rounded-xl border border-[var(--brand-line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-white/5"
                >
                  {copiedId === entry.id ? "Command copied" : "Copy CLI command"}
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </BrandShell>
  );
}
