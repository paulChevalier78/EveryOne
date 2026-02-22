import React, { useCallback, useEffect, useState } from "react";
import BrandShell from "./components/BrandShell";
import { SLM_DOWNLOADS } from "./content/models";
import { MODEL_LOGOS } from "./content/modelLogos";
import { fetchLocalModels } from "./api";

function normalize(text = "") {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatSize(sizeBytes) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "Unknown size";
  const gib = sizeBytes / (1024 ** 3);
  if (gib >= 1) return `${gib.toFixed(2)} GB`;
  const mib = sizeBytes / (1024 ** 2);
  return `${mib.toFixed(1)} MB`;
}

function matchCatalogModel(localModel) {
  const normalizedKey = normalize(localModel.key || "");
  const normalizedPath = normalize(localModel.path || "");

  return (
    SLM_DOWNLOADS.find((entry) => {
      const normalizedId = normalize(entry.id);
      return (
        normalizedPath.includes(normalizedId) ||
        normalizedKey.includes(normalizedId)
      );
    }) || null
  );
}

// AJOUT : on ajoute onStartChat dans les props
export default function YourModels({ onNavigate, onStartChat }) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadModels = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const localModels = await fetchLocalModels();
      setModels(localModels);
    } catch (fetchError) {
      setError(fetchError.message || "Failed to load local models.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  return (
    <BrandShell
      activePage="your-models"
      onNavigate={onNavigate}
      primaryLabel="Discover models"
      onPrimaryAction={() => onNavigate("discover")}
    >
      <main className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-10 md:px-7">
        <section className="smooth-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-4xl font-black tracking-[-0.02em] md:text-5xl">Your Models</h1>
            <button
              type="button"
              onClick={loadModels}
              disabled={loading}
              className="rounded-xl border border-[var(--brand-line)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)] hover:bg-white/5 disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <p className="mt-3 max-w-[720px] text-base font-medium text-[var(--muted-ink)] md:text-lg">
            Models detected from local GGUF storage.
          </p>
          {error && (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </p>
          )}
        </section>

        {!loading && models.length === 0 ? (
          <section className="mt-8 rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-6">
            <p className="text-sm text-[var(--muted-ink)]">
              No local GGUF model found yet. Go to `Discover models` and click `Download`.
            </p>
          </section>
        ) : (
          <section className="mt-8 grid gap-4 md:grid-cols-3">
            {models.map((localModel) => {
              const catalogModel = matchCatalogModel(localModel);
              const cardId = localModel.path || localModel.key || localModel.fileName;
              
              // On construit l'objet model à envoyer au chat
              const modelToChat = {
                id: catalogModel?.id || localModel.key,
                name: catalogModel?.name || localModel.fileName
              };

              return (
                <article
                  key={cardId}
                  className="flex flex-col rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-5 transition hover:border-white/25"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                      {catalogModel ? `${catalogModel.family} • ${catalogModel.size}` : "Local GGUF"}
                    </p>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                        localModel.isLoaded
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-500/20 text-slate-200"
                      }`}
                    >
                      {localModel.isLoaded ? "Loaded" : "Available"}
                    </span>
                  </div>
                  
                  <div className="flex-1">
                    <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">
                      {modelToChat.name}
                    </h2>
                    {catalogModel?.id && MODEL_LOGOS[catalogModel.id] && (
                      <div className="mt-2 flex h-11 items-center justify-center rounded-lg border border-[var(--brand-line)] bg-gradient-to-r from-[var(--brand-purple)]/20 to-[var(--brand-orange)]/20">
                        <img
                          src={MODEL_LOGOS[catalogModel.id]}
                          alt={`${catalogModel.name} logo`}
                          className="h-7 w-7 rounded object-contain"
                        />
                      </div>
                    )}
                    <p className="mt-2 truncate text-sm text-[var(--muted-ink)]">{localModel.fileName}</p>
                    <p className="mt-1 text-xs text-[var(--muted-ink)]">{formatSize(localModel.sizeBytes)}</p>
                  </div>

                  {/* AJOUT : Le bouton pour lancer le chat avec ce modèle */}
                  <button
                    type="button"
                    onClick={() => onStartChat && onStartChat(modelToChat, [])}
                    className="mt-5 w-full rounded-xl bg-[var(--brand-purple)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6D28D9]"
                  >
                    Start Chat →
                  </button>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </BrandShell>
  );
}