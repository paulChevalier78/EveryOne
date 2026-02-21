import React from "react";
import BrandShell from "./components/BrandShell";
import { PRELOADED_MODELS } from "./content/models";
import { MODEL_LOGOS } from "./content/modelLogos";

export default function YourModels({ onNavigate }) {
  return (
    <BrandShell
      activePage="your-models"
      onNavigate={onNavigate}
      primaryLabel="Discover models"
      onPrimaryAction={() => onNavigate("discover")}
    >
      <main className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-10 md:px-7">
        <section className="smooth-fade-in">
          <h1 className="text-4xl font-black tracking-[-0.02em] md:text-5xl">Your Models</h1>
          <p className="mt-3 max-w-[720px] text-base font-medium text-[var(--muted-ink)] md:text-lg">
            These models are already loaded in your marketplace workspace.
          </p>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {PRELOADED_MODELS.map((model) => (
            <article
              key={model.id}
              className="rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-panel)] p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted-ink)]">
                  {model.family} • {model.size}
                </p>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-300">
                  Loaded
                </span>
              </div>
              <h2 className="mt-2 text-lg font-bold text-[var(--ink)]">{model.name}</h2>
              <div className="mt-2 flex h-11 items-center justify-center rounded-lg border border-[var(--brand-line)] bg-gradient-to-r from-[var(--brand-purple)]/20 to-[var(--brand-orange)]/20">
                <img
                  src={MODEL_LOGOS[model.id]}
                  alt={`${model.name} logo`}
                  className="h-7 w-7 rounded object-contain"
                />
              </div>
              <p className="mt-2 text-sm text-[var(--muted-ink)]">{model.description}</p>
              
              {/* Why use explanation */}
              <div className="mt-3 rounded-lg bg-[var(--brand-purple)]/10 p-3">
                <p className="text-xs font-semibold text-[var(--brand-purple-soft)]">
                  💡 {model.whyUse}
                </p>
              </div>
              
              <p className="mt-4 text-sm font-semibold text-[var(--brand-orange)]">
                {model.priceLabel}
              </p>
            </article>
          ))}
        </section>
      </main>
    </BrandShell>
  );
}
