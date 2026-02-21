import React, { useState, useRef, useEffect } from "react";

export default function ChatInterface({ selectedModel = "SLM Inconnu" }) {
  const [messages, setMessages] = useState([
    {
      role: "slm",
      content: `Salut ! Je suis le modèle ${selectedModel}. Comment puis-je t'aider pour ce hackathon ?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      const slmResponse = {
        role: "slm",
        content: `C'est noté ! (Ceci est une réponse simulée par l'interface. Remplace ce timeout par le vrai fetch vers l'API de ${selectedModel}.)`,
      };
      setMessages((prev) => [...prev, slmResponse]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="flex h-screen flex-col bg-gray-900 font-sans text-gray-100">
      <header className="flex items-center justify-between border-b border-purple-900/50 bg-gray-800 p-4 shadow-md">
        <h1 className="bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-xl font-bold text-transparent">
          EveryOne SLM
        </h1>
        <div className="rounded-full bg-purple-700 px-3 py-1 text-sm font-medium text-purple-100">
          Modèle actif : {selectedModel}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto space-y-6 p-4">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                  msg.role === "user"
                    ? "rounded-br-none bg-orange-600 text-white"
                    : "rounded-bl-none border border-purple-500/30 bg-gray-800 text-gray-200"
                }`}
              >
                <div
                  className={`mb-1 text-xs font-semibold ${msg.role === "user" ? "text-orange-200" : "text-purple-400"}`}
                >
                  {msg.role === "user" ? "Toi" : selectedModel}
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex space-x-2 rounded-2xl rounded-bl-none border border-purple-500/30 bg-gray-800 p-4 shadow-sm">
                <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500"></div>
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-purple-500"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="h-2 w-2 animate-bounce rounded-full bg-purple-500"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-gray-900 p-4">
        <div className="mx-auto max-w-3xl">
          <form
            onSubmit={handleSubmit}
            className="flex items-center overflow-hidden rounded-xl border border-gray-700 bg-gray-800 transition-all focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Envoyer un message à ${selectedModel}...`}
              className="flex-1 border-none bg-transparent p-4 text-gray-100 placeholder-gray-500 focus:outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-purple-600 px-6 py-4 font-semibold text-white transition-colors hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500"
            >
              Envoyer
            </button>
          </form>
          <div className="mt-2 text-center text-xs text-gray-500">
            SLM généré en hackathon. Le modèle peut faire des erreurs.
          </div>
        </div>
      </footer>
    </div>
  );
}
