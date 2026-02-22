import React, { useEffect, useRef, useState } from "react";
import { sendChatMessage } from "./api";
// Correction du chemin : ./assets au lieu de ../assets car ce fichier est dans src/
import brandLogo from "./assets/Logo.png"; 

export default function ChatInterface({ selectedModel, uploadedFiles = [], onNavigate }) {
  const [messages, setMessages] = useState([{
    role: "slm", content: `System ready. Connected to ${selectedModel.name}.`, sources: []
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { 
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await sendChatMessage({
        message: userMsg.content,
        selectedModel: selectedModel.name,
        selectedModelId: selectedModel.id,
        documentIds: uploadedFiles.map(f => f.documentId),
      });
      setMessages(prev => [...prev, { role: "slm", content: res.answer, sources: res.sources }]);
    } catch (err) { 
      alert(err.message); 
    }
    setIsLoading(false);
  };

  return (
    // On retire le fond solide pour voir les blobs d'App.jsx
    <div className="flex h-screen flex-col text-[var(--ink)]">
      
      {/* Header avec effet glassmorphism */}
      <header className="sticky top-0 z-50 glass">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
          
          {/* Logo complet rétabli */}
          <button
            type="button"
            onClick={() => onNavigate("home")}
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
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-ink)]">
                Active: <span className="text-white">{selectedModel.name}</span>
              </div>
            </div>
          </button>

          <div className="hidden md:block">
             <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted-ink)]">
               Secure Workspace
             </span>
          </div>
        </div>
      </header>

      {/* Zone de messages */}
      <main className="relative z-10 flex-1 overflow-y-auto py-12">
        <div className="mx-auto max-w-2xl space-y-12 px-6">
          {messages.map((msg, i) => (
            <div key={i} className="smooth-fade-in">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-ink)] mb-3">
                {msg.role === "user" ? "Researcher" : "Assistant"}
              </div>
              <div className="text-[15px] leading-relaxed font-light text-slate-200">
                {msg.content}
              </div>
              {msg.sources?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {msg.sources.map((s, si) => (
                    <span key={si} className="text-[9px] border border-[var(--brand-line)] px-2 py-0.5 rounded text-[var(--muted-ink)]">
                      Ref: {s.title} (p.{s.page})
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input flottant */}
      <footer className="relative z-10 p-8">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl relative">
          <input
            className="w-full bg-[var(--brand-panel-soft)] border border-[var(--brand-line)] rounded-2xl py-5 px-7 text-sm focus:outline-none focus:border-[var(--muted-ink)] transition-all placeholder:text-gray-600 backdrop-blur-md"
            placeholder="Type your inquiry..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          {isLoading && (
            <div className="absolute right-6 top-5 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            </div>
          )}
        </form>
      </footer>
    </div>
  );
}