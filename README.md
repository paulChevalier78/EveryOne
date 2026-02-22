# app-slm (Frontend + Backend)

Ce projet contient:
- un frontend React/Vite dans `src/`
- un backend FastAPI dans `backend/`

Le frontend appelle le backend sur `/api/*`.

## 1) Lancer le backend

Depuis `backend/`:

```bash
./venv/bin/uvicorn api:app --host 127.0.0.1 --port 8000 --reload
```

Healthcheck:

```bash
curl http://127.0.0.1:8000/api/health
```

## 2) Lancer le frontend

Depuis la racine `app-slm/`:

```bash
npm run dev
```

Par defaut, Vite proxy `/api` vers `http://127.0.0.1:8000`.

## Variables d'environnement

Copier `.env.example` vers `.env` si tu veux personnaliser les URLs:

```bash
cp .env.example .env
```

- `VITE_BACKEND_PROXY_TARGET`: cible backend pour le proxy Vite (dev)
- `VITE_API_BASE_URL`: URL backend explicite (laisser vide pour utiliser le proxy Vite)
- `CORS_ORIGINS`: origines autorisees cote backend, separees par des virgules

## Inference GGUF locale

Le backend peut faire l'inference locale avec des modeles `.gguf` places dans:

`backend/Model`

Exemple detecte:
- `backend/Model/Tinyllama1.1/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf`
- `backend/Model/Phi2/phi-2.Q4_K_M.gguf`
- `backend/Model/Qwen2_1.5B/qwen2-1_5b-instruct-q4_k_m.gguf`

Installer le runtime une fois:

```bash
cd backend
./venv/bin/pip install -r requirements-api.txt
```

Verifier les modeles reconnus:

```bash
curl http://127.0.0.1:8000/api/models/local
```

Le champ `isLoaded` indique si le fichier GGUF est deja charge en memoire.

## Ingestion PDF

- Un PDF deja indexe n'est pas reintegre: detection par hash SHA-256 du fichier.
- Les chunks stockent le numero de page (`chunks.page`), et les sources du chat affichent la page.

## Exemple d'URL non locale

Si ton backend tourne sur une autre machine:

1. Frontend `.env`:
```env
VITE_BACKEND_PROXY_TARGET=http://10.0.0.12:8000
VITE_API_BASE_URL=
```
2. Backend (meme shell):
```bash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173 ./venv/bin/uvicorn api:app --host 0.0.0.0 --port 8000
```
