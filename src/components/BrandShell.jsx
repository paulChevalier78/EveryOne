import React from "react";
import brandLogo from "../assets/Logo.png";

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "your-models", label: "Your Models" },
  { id: "discover", label: "Discover" },
];

export default function BrandShell({
  children,
  activePage = "home",
  onNavigate,
  primaryLabel = "Discover models",
  onPrimaryAction,
  primaryDisabled = false,
}) {
  const handleNav = (pageId) => {
    if (onNavigate) {
      onNavigate(pageId);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--brand-surface)] text-[var(--ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--brand-line)] bg-[var(--brand-panel)]/92 backdrop-blur-xl">
        {/* Ligne principale du Header */}
        <div className="mx-auto flex h-20 w-full max-w-[1240px] items-center justify-between gap-5 px-4 md:px-7">
          
          {/* Logo PNG sans bordure + Texte avec dégradé */}
          <button
            type="button"
            onClick={() => handleNav("home")}
            className="group flex items-center gap-3 transition"
          >
            {/* L'image seule, avec un petit effet de zoom au survol */}
            <img 
              src={brandLogo} 
              alt="EveryOne logo" 
              className="h-10 w-10 object-contain transition duration-300 group-hover:scale-110" 
            />
            
            {/* La colonne de texte */}
            <div className="flex flex-col items-start text-left">
              <h1 className="bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-[31px] font-black leading-none tracking-[-0.03em] text-transparent transition-opacity group-hover:opacity-80">
                EveryOne
              </h1>
              <div className="text-xs font-semibold text-[var(--muted-ink)]">
                Model Marketplace
              </div>
            </div>
          </button>

          <button
            type="button"
            className="brand-button-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55 lg:hidden"
            onClick={onPrimaryAction}
            disabled={primaryDisabled}
          >
            Create
          </button>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`text-[17px] font-semibold transition ${
                  activePage === item.id
                    ? "text-[var(--brand-purple-soft)]"
                    : "text-[var(--muted-ink)] hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="brand-button-primary rounded-2xl px-5 py-3 text-[16px] font-semibold disabled:cursor-not-allowed disabled:opacity-55"
              onClick={onPrimaryAction}
              disabled={primaryDisabled}
            >
              {primaryLabel}
            </button>
          </nav>
        </div>

        {/* Navigation Mobile (scrollable en dessous du logo) */}
        <div className="mx-auto block w-full max-w-[1240px] overflow-x-auto px-4 pb-3 lg:hidden md:px-7">
          <div className="flex min-w-max items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                  activePage === item.id
                    ? "bg-[var(--brand-purple)] text-white"
                    : "bg-white/8 text-[var(--muted-ink)] hover:bg-white/15"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}