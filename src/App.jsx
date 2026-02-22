import React, { useState } from "react";
import Home from "./Home";
import YourModels from "./YourModels";
import DiscoverModels from "./DiscoverModels";
import ChatInterface from "./ChatInterface";

const NAV_PAGES = new Set(["home", "your-models", "discover"]);

function App() {
  const [currentScreen, setCurrentScreen] = useState("home");
  const [selectedModel, setSelectedModel] = useState({ id: null, name: "Unknown SLM" });
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleNavigate = (pageId) => {
    if (!NAV_PAGES.has(pageId)) return;
    setCurrentScreen(pageId);
  };

  const handleStartChat = (model, files) => {
    setSelectedModel({ 
      id: model?.id || null, 
      name: model?.name || "Unknown SLM" 
    });
    setUploadedFiles(Array.isArray(files) ? files : []);
    setCurrentScreen("chat");
  };

  return (
    // On définit le fond noir de base ici
    <div className="relative min-h-screen w-full bg-[#050505] overflow-x-hidden">
      
      {/* --- FOND ANIMÉ (BLOBS ORANGE & VIOLET) --- */}
      {/* Ce bloc reste fixe en arrière-plan pendant toute la navigation */}
      <div className="animated-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      {/* --- LOGIQUE DE NAVIGATION (CALQUE SUPÉRIEUR) --- */}
      {/* On utilise z-10 pour passer devant les blobs flous */}
      <div className="relative z-10 w-full min-h-screen">
        {currentScreen === "chat" && (
          <ChatInterface 
            selectedModel={selectedModel} 
            uploadedFiles={uploadedFiles} 
            onNavigate={handleNavigate} 
          />
        )}

        {currentScreen === "home" && (
          <Home 
            onNavigate={handleNavigate} 
            onStartChat={handleStartChat} 
          />
        )}

        {currentScreen === "your-models" && (
          <YourModels 
            onNavigate={handleNavigate} 
            onStartChat={handleStartChat} 
          />
        )}

        {currentScreen === "discover" && (
          <DiscoverModels 
            onNavigate={handleNavigate} 
          />
        )}
      </div>
    </div>
  );
}

export default App;