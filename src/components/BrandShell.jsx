import React from "react";
// Le chemin correct vers les assets depuis le dossier components est ../assets/
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
  onPrimaryAction, 
  primaryLabel 
}) {
  const handleNav = (pageId) => onNavigate && onNavigate(pageId);

  return (
    <div className="min-h-screen text-[var(--ink)]">
      {/* Header avec effet Glassmorphism */}
      <header className="sticky top-0 z-50 glass">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
          
          {/* Logo complet : Image + Texte Dégradé + Sous-titre */}
          <button
            type="button"
            onClick={() => handleNav("home")}
            className="group flex items-center gap-3 transition"
          >
            <img 
              src={brandLogo} 
              alt="EveryOne logo" 
              className="h-10 w-10 object-contain transition duration-300 group-hover:scale-110" 
            />
            
            <div className="flex flex-col items-start text-left">
              <h1 className="bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-[31px] font-black leading-none tracking-[-0.03em] text-transparent transition-opacity group-hover:opacity-80">
                EveryOne
              </h1>
              <div className="text-xs font-semibold text-[var(--muted-ink)]">
                Model Marketplace
              </div>
            </div>
          </button>
          
          <nav className="hidden gap-8 lg:flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`text-[17px] font-semibold transition ${
                  activePage === item.id 
                    ? "text-white" 
                    : "text-[var(--muted-ink)] hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          
          <button 
            onClick={onPrimaryAction}
            className="text-[10px] font-bold border border-white/10 px-5 py-2 rounded-full hover:bg-white hover:text-black transition uppercase tracking-widest"
          >
            {primaryLabel || "Menu"}
          </button>
        </div>
      </header>
      
      {/* Contenu principal surélevé pour passer devant les blobs */}
      <main className="relative z-10">
        {children}
      </main>
    </div>
  );
}