# EveryOne - Local SLM Marketplace

Marketplace local de modèles SLM pour:
- uploader des PDFs,
- choisir un modèle,
- discuter avec les documents,
- télécharger des modèles GGUF en local.

Le projet contient:
- un frontend React + Vite (UI marketplace),
- un backend FastAPI (ingestion, recherche locale, chat, download GGUF).

## Stack

### Frontend
- React 19
- Vite 7
- Tailwind CSS 4

### Backend
- FastAPI
- Uvicorn
- SQLite
- sentence-transformers
- huggingface_hub

## Structure

```text
app-slm/
├─ src/                  # Frontend React
├─ backend/              # API FastAPI
├─ models/               # Modèles GGUF téléchargés localement (créé automatiquement)
├─ package.json
└─ vite.config.js
```

## Démarrage rapide (Frontend)

1. **Installe Node.js d'abord** (version 18+ recommandée):
	- https://nodejs.org/
2. Ouvre un terminal dans le dossier `app-slm`.
3. Lance les commandes npm dans cet ordre:

```bash
npm install
npm run dev
```

4. Ouvre le site sur:

```text
http://localhost:5173
```

## Prérequis complets

- Node.js 18+
- npm 9+
- Python 3.10+
- pip

## Installation backend (optionnel mais recommandé)

Depuis `app-slm/backend`:

```bash
pip install -r requirements-api.txt
# Si tu veux toutes les dépendances ML (plus lourd):
# pip install -r requirements.txt
```

## Lancer le projet en local

Ouvre 2 terminaux.

### Terminal 1 - Backend (port 8000)

Depuis `app-slm/backend`:

```bash
uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 2 - Frontend (port 5173)

Depuis `app-slm`:

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`

## Variables d'environnement

### Frontend (optionnel)

Tu peux créer un `.env` dans `app-slm`:

```env
VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8000
VITE_API_BASE_URL=
```

Notes:
- en dev, le proxy Vite redirige `/api` vers le backend,
- `VITE_API_BASE_URL` peut rester vide si tu utilises le proxy.

### Backend (optionnel, recommandé pour modèles privés/rate limits)

```env
HF_TOKEN=ton_token_huggingface
```

ou

```env
HUGGINGFACE_HUB_TOKEN=ton_token_huggingface
```

## Télécharger un modèle GGUF en local

Quand tu cliques sur `Download` dans l'UI:
- le frontend appelle `POST /api/models/download`,
- le backend télécharge le modèle depuis Hugging Face,
- le fichier `.gguf` est stocké dans:

```text
app-slm/models/<model-id>/
```

Exemples:
- `app-slm/models/llama-3.2-3b/`
- `app-slm/models/qwen-2.5-3b/`

## Scripts frontend

Depuis `app-slm`:

```bash
npm run dev      # Lance le serveur de dev
npm run build    # Build production
npm run preview  # Prévisualise le build
npm run lint     # Lint du code
```

## Endpoints API principaux

- `GET /api/health`
- `POST /api/init`
- `POST /api/ingest`
- `POST /api/chat`
- `POST /api/models/download`

## Dépannage rapide

- Erreur `ECONNREFUSED 127.0.0.1:8000`:
	- le backend n'est pas démarré.
- Erreur au download Hugging Face:
	- vérifie ta connexion,
	- configure `HF_TOKEN` si besoin,
	- vérifie les droits d'écriture dans `app-slm/models`.
- Build frontend:

```bash
npx vite build
```

## Licence

Projet hackathon / usage interne. Ajoute ta licence ici si nécessaire.
