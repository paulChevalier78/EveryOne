import React, { useState } from "react";
import BrandShell from "./components/BrandShell";
import { SLM_DOWNLOADS } from "./content/models";
import { downloadModelGguf } from "./api";

export default function DiscoverModels({ onNavigate }) {
  const [downloadingId, setDownloadingId] = useState("");
  const [downloadMessage, setDownloadMessage] = useState("");

  const handleDownload = async (entry) => {
    setDownloadMessage("");
    setDownloadingId(entry.id);
    try {
      const result = await downloadModelGguf({ modelId: entry.id });
      setDownloadMessage(`✅ ${entry.name} saved to ${result.targetDir}`);
    } catch (error) {
      setDownloadMessage(`❌ ${error.message || "Download failed."}`);
    } finally {
      setDownloadingId("");
    }
  };

  return (
    <BrandShell activePage="discover" onNavigate={onNavigate} primaryLabel="Your Library" onPrimaryAction={() => onNavigate("your-models")}>
      <main className="mx-auto max-w-6xl px-6 py-20">
        <section className="smooth-fade-in mb-16">
          <h1 className="text-5xl font-medium tracking-tighter">Discover Models</h1>
          <p className="mt-4 text-[var(--muted-ink)] text-lg font-light">
            Expand your local intelligence with our curated SLM catalog.
          </p>
          {downloadMessage && (
            <p className="mt-6 text-xs uppercase tracking-widest text-white border-l border-white pl-4 py-1">
              {downloadMessage}
            </p>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SLM_DOWNLOADS.map((entry) => (
            <article key={entry.id} className="group flex flex-col rounded-2xl border border-[var(--brand-line)] bg-white/[0.01] p-8 transition-all hover:bg-white/[0.03] hover:border-[var(--muted-ink)]">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--muted-ink)]">
                  {entry.family} • {entry.size}
                </span>
                {entry.mandatory && (
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white">Core</span>
                )}
              </div>

              <h2 className="text-xl font-medium text-white mb-2">{entry.name}</h2>
              <p className="text-sm text-[var(--muted-ink)] font-light leading-relaxed mb-6 line-clamp-2">
                {entry.description}
              </p>

              <div className="mt-auto space-y-4">
                <div className="flex items-center justify-between border-t border-[var(--brand-line)] pt-4">
                  <span className="text-xs font-medium text-white">{entry.priceLabel}</span>
                  <span className="text-[10px] text-[var(--muted-ink)] uppercase tracking-widest">{entry.quant}</span>
                </div>
                
                <button
                  onClick={() => handleDownload(entry)}
                  disabled={downloadingId === entry.id}
                  className="w-full rounded-full bg-white py-3 text-xs font-bold uppercase tracking-widest text-black transition-transform active:scale-95 disabled:opacity-20"
                >
                  {downloadingId === entry.id ? "Syncing..." : "Download"}
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </BrandShell>
  );
}