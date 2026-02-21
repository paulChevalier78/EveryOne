export const SLM_DOWNLOADS = [
  {
    id: "llama-3.2-3b",
    name: "Llama 3.2 3B Instruct",
    family: "Llama",
    size: "3B",
    quant: "Q4_K_M GGUF",
    priceLabel: "Included",
    loadedByDefault: true,
    description:
      "Balanced quality and speed for local retrieval-augmented chats. Mandatory baseline model in this workspace.",
    whyUse: "Perfect to get started: free, fast, and ideal for everyday conversations with your documents.",
    bestFor: "Choisis-le si tu veux un modèle stable pour la majorité des PDFs sans te prendre la tête.",
    strengths: ["Très polyvalent", "Rapide en local", "Excellent modèle de base"],
    downloadUrl:
      "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF",
    command:
      "huggingface-cli download bartowski/Llama-3.2-3B-Instruct-GGUF --include \"*Q4_K_M.gguf\" --local-dir ./models/llama-3.2-3b",
    mandatory: true,
  },
  {
    id: "phi-3.5-mini",
    name: "Phi 3.5 Mini Instruct",
    family: "Phi",
    size: "3.8B",
    quant: "Q4_K_M GGUF",
    priceLabel: "€9 / month",
    loadedByDefault: true,
    description:
      "Compact SLM tuned for concise and structured responses with strong latency.",
    whyUse: "Ideal for quick and structured responses: lightweight, efficient, perfect for simple and fast tasks.",
    bestFor: "Choisis-le pour des réponses courtes, claires et immédiates sur des documents simples.",
    strengths: ["Faible latence", "Structuré", "Consomme peu de ressources"],
    downloadUrl:
      "https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF",
    command:
      "huggingface-cli download bartowski/Phi-3.5-mini-instruct-GGUF --include \"*Q4_K_M.gguf\" --local-dir ./models/phi-3.5-mini",
    mandatory: false,
  },
  {
    id: "qwen-2.5-3b",
    name: "Qwen 2.5 3B Instruct",
    family: "Qwen",
    size: "3B",
    quant: "Q4_K_M GGUF",
    priceLabel: "€12 / month",
    loadedByDefault: true,
    description:
      "Efficient multilingual SLM with good reasoning-to-size ratio for production prototypes.",
    whyUse: "Best for multilingual: excellent in French and other languages, ideal for international prototypes.",
    bestFor: "Choisis-le si tes documents sont multilingues ou si ton équipe travaille en plusieurs langues.",
    strengths: ["Très bon en français", "Multilingue solide", "Bon compromis taille/raisonnement"],
    downloadUrl:
      "https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF",
    command:
      "huggingface-cli download bartowski/Qwen2.5-3B-Instruct-GGUF --include \"*Q4_K_M.gguf\" --local-dir ./models/qwen-2.5-3b",
    mandatory: false,
  },
  {
    id: "mistral-7b-instruct",
    name: "Mistral 7B Instruct v0.3",
    family: "Mistral",
    size: "7B",
    quant: "Q4_K_M GGUF",
    priceLabel: "€19 / month",
    loadedByDefault: false,
    description:
      "High-quality local model for deeper context windows when your machine can handle heavier inference.",
    whyUse: "For experts: more powerful, better context understanding, ideal for complex documents.",
    bestFor: "Choisis-le pour des PDFs techniques longs et des questions complexes avec plus de contexte.",
    strengths: ["Compréhension avancée", "Meilleur sur les cas complexes", "Contexte plus riche"],
    downloadUrl:
      "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF",
    command:
      "huggingface-cli download bartowski/Mistral-7B-Instruct-v0.3-GGUF --include \"*Q4_K_M.gguf\" --local-dir ./models/mistral-7b",
    mandatory: false,
  },
  {
    id: "gemma-2-2b",
    name: "Gemma 2 2B Instruct",
    family: "Gemma",
    size: "2B",
    quant: "Q4_K_M GGUF",
    priceLabel: "€7 / month",
    loadedByDefault: false,
    description:
      "Lightweight assistant model focused on fast responses for daily internal workflows.",
    whyUse: "Lightest and fastest: perfect for daily tasks, instant responses, low resource usage.",
    bestFor: "Choisis-le pour un usage quotidien ultra-rapide sur machine légère.",
    strengths: ["Très rapide", "Ultra léger", "Idéal pour tâches répétitives"],
    downloadUrl:
      "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF",
    command:
      "huggingface-cli download bartowski/gemma-2-2b-it-GGUF --include \"*Q4_K_M.gguf\" --local-dir ./models/gemma-2-2b",
    mandatory: false,
  },
];

export const PRELOADED_MODELS = SLM_DOWNLOADS.filter((model) => model.loadedByDefault);
