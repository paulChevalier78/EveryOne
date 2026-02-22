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
    if (!NAV_PAGES.has(pageId)) {
      return;
    }
    setCurrentScreen(pageId);
  };

  const handleStartChat = (model, files) => {
    if (model && typeof model === "object") {
      setSelectedModel({ id: model.id || null, name: model.name || "Unknown SLM" });
    } else {
      setSelectedModel({ id: null, name: model || "Unknown SLM" });
    }
    setUploadedFiles(Array.isArray(files) ? files : []);
    setCurrentScreen("chat");
  };

  if (currentScreen === "chat") {
    return (
      <div className="w-full min-h-screen">
        <ChatInterface 
          selectedModel={selectedModel} 
          uploadedFiles={uploadedFiles} 
          onNavigate={handleNavigate} 
        />
      </div>
    );
  }

  if (currentScreen === "home") {
    return (
      <div className="w-full min-h-screen">
        <Home onNavigate={handleNavigate} onStartChat={handleStartChat} />
      </div>
    );
  }

  if (currentScreen === "your-models") {
    return (
      <div className="w-full min-h-screen">
        {/* C'est ICI qu'il manquait la liaison onStartChat={handleStartChat} ! */}
        <YourModels onNavigate={handleNavigate} onStartChat={handleStartChat} />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen">
      <DiscoverModels onNavigate={handleNavigate} />
    </div>
  );
}

export default App;