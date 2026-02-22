import React, { useEffect, useMemo, useRef, useState } from "react";
import BrandShell from "./components/BrandShell";
import { SLM_DOWNLOADS } from "./content/models";
import { 
  ingestSinglePdf, 
  initializeBackend, 
  downloadFinetunedModel, 
  startFinetuning 
} from "./api";

export default function Home({ onNavigate, onStartChat }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isIngesting, setIsIngesting] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  
  // États pour le Fine-Tuning restaurés
  const [isTraining, setIsTraining] = useState(false);
  const [finetuneJobId, setFinetuneJobId] = useState(null); 
  const [isDownloading, setIsDownloading] = useState(false);
  const [modalStatus, setModalStatus] = useState("");
  
  const fileInputRef = useRef(null);

  useEffect(() => { initializeBackend().catch(() => {}); }, []);

  const visibleModels = useMemo(() => SLM_DOWNLOADS.slice(0, 3), []);

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setIsIngesting(true);
      try {
        const res = await ingestSinglePdf(e.dataTransfer.files[0]);
        setUploadedFiles(prev => [...prev, res]);
      } catch (err) { alert(err.message); }
      setIsIngesting(false);
    }
  };

  // Correction de la logique de Fine-Tuning
  const handleStartFinetune = async () => {
    if (!selectedModel) return;

    setIsTraining(true);
    setModalStatus("🚀 Initializing Modal containers...");
    
    try {
      // On envoie 'datasetName' comme attendu par le backend
      const data = await startFinetuning({ datasetName: "cybersec" });
      
      if (data.job_id) {
        setFinetuneJobId(data.job_id);
        setModalStatus(`⚙️ Training in progress (ID: ${data.job_id})`);
      }
    } catch (err) {
      setModalStatus(`❌ Error: ${err.message}`);
      setIsTraining(false);
    }
  };

  const handleSyncFinetune = async () => {
    const name = prompt("Name of the model to download from Modal:", "my-finetuned-model");
    if (!name) return;
    
    setIsDownloading(true);
    setModalStatus("⬇️ Downloading GGUF from cloud...");
    try {
      await downloadFinetunedModel({ customName: name });
      setModalStatus(`✅ ${name} is now available in 'Your Models'.`);
    } catch (err) {
      setModalStatus(`❌ Download error: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <BrandShell activePage="home" onNavigate={onNavigate} primaryLabel="Your Library" onPrimaryAction={() => onNavigate("your-models")}>
      <main className="mx-auto max-w-5xl px-6 py-20 relative z-10">
        <section className="text-center mb-16 smooth-fade-in">
          <h1 className="text-6xl font-medium tracking-tighter mb-6">
            Local Intelligence. <span className="text-[var(--muted-ink)]">Studio.</span>
          </h1>
          <p className="text-[var(--muted-ink)] text-lg max-w-xl mx-auto font-light">
            Train, deploy, and chat with private models in a single workspace.
          </p>
        </section>

        {/* Grille des modèles */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {visibleModels.map((model) => (
            <article
              key={model.id}
              onClick={() => setSelectedModel(model)}
              className={`p-8 rounded-2xl border transition-all cursor-pointer ${
                selectedModel?.id === model.id ? "border-white bg-white/[0.05] shadow-2xl" : "border-[var(--brand-line)] hover:bg-white/[0.02]"
              }`}
            >
              <p className="text-[9px] uppercase tracking-[0.2em] text-[var(--muted-ink)] mb-4">{model.family}</p>
              <h3 className="text-xl font-medium mb-2">{model.name}</h3>
              <p className="text-sm text-[var(--muted-ink)] font-light line-clamp-2">{model.description}</p>
            </article>
          ))}
        </section>

        {/* Zone de Drop PDF */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-2xl p-16 text-center transition-all mb-12 ${
            dragActive ? "border-white bg-white/5" : "border-[var(--brand-line)] hover:border-[var(--muted-ink)]"
          }`}
        >
          <input type="file" ref={fileInputRef} onChange={(e) => handleDrop(e)} className="hidden" accept=".pdf" />
          <p className="text-sm font-medium">{isIngesting ? "⚡ Indexing..." : "Drop PDF to update context"}</p>
        </div>

        {/* --- ACTIONS LAB (CORRIGÉES) --- */}
        <div className="flex flex-col items-center gap-6 py-10 border-y border-[var(--brand-line)] mb-12">
          <div className="flex gap-4">
            {!finetuneJobId ? (
              <button 
                onClick={handleStartFinetune}
                disabled={!selectedModel || isTraining}
                className={`text-[10px] font-bold uppercase tracking-widest border px-8 py-3 rounded-full transition ${
                  isTraining ? "border-purple-500 text-purple-500 animate-pulse" : "border-white/10 hover:bg-white hover:text-black"
                }`}
              >
                {isTraining ? "Starting Job..." : "🚀 Start Fine-Tune"}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-8 py-3 border border-orange-500/30 bg-orange-500/5 rounded-full">
                <span className="text-[10px] font-bold uppercase text-orange-400">Training Active</span>
                <div className="h-1 w-12 bg-orange-500/20 rounded-full overflow-hidden">
                   <div className="h-full bg-orange-500 animate-[pulse_1.5s_infinite]"></div>
                </div>
              </div>
            )}
            
            {/* Le bouton de téléchargement apparaît quand un Job ID existe */}
            {finetuneJobId && (
              <button 
                onClick={handleSyncFinetune}
                disabled={isDownloading}
                className="text-[10px] font-bold uppercase tracking-widest border border-blue-500/30 bg-blue-500/5 px-8 py-3 rounded-full hover:bg-blue-500 hover:text-white transition"
              >
                {isDownloading ? "Downloading..." : "⬇️ Download Finetuned"}
              </button>
            )}
          </div>
          
          {modalStatus && (
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-white animate-ping" />
              <p className="text-[10px] text-[var(--muted-ink)] uppercase tracking-widest">{modalStatus}</p>
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <button 
            onClick={() => onStartChat(selectedModel, uploadedFiles)}
            disabled={!selectedModel}
            className="bg-white text-black px-12 py-4 rounded-full text-sm font-bold tracking-tight disabled:opacity-5 hover:scale-105 transition-all shadow-xl"
          >
            Open Workspace
          </button>
        </div>
      </main>
    </BrandShell>
  );
}