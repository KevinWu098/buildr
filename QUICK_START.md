# Quick Start Commands - PC-EZ

## Prerequisites

- Node.js & pnpm installed
- Python 3.13+ with uv or pip
- All `.env` files configured

---

## 🚀 Start Everything (4 terminals needed)

### Terminal 1: Components API (Port 8000)

```bash
cd scraper/pcpartpicker/api
uvicorn main:app --reload --port 8000
```

### Terminal 2: RAG API (Port 8001)

```bash
cd scraper/pcpartpicker/rag-api
uvicorn main:app --reload --port 8001
```

### Terminal 3: Client Frontend (Port 3000)

```bash
cd client
pnpm dev
```

### Terminal 4: Voice Agent

```bash
cd client
pnpm dev:agent
```

---

## 🔍 Test Endpoints

```bash
# Components API
curl http://localhost:8000/components/search?q=ryzen

# RAG API
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -d '{"query":"Does Ryzen 5 5600G have integrated graphics?"}'

# Frontend
open http://localhost:3000
```

---

## 🛑 Stop Everything

```bash
# Kill all servers
lsof -ti:3000,8000,8001,8002 | xargs kill -9
```

---

## 📦 Port Summary

| Service        | Port | URL                              |
| -------------- | ---- | -------------------------------- |
| Frontend       | 3000 | http://localhost:3000            |
| Components API | 8000 | http://localhost:8000            |
| RAG API        | 8001 | http://localhost:8001            |
| Video API      | 8002 | http://localhost:8002 (optional) |

---

## 🔧 First-Time Setup

### 1. Install Client Dependencies

```bash
cd client
pnpm install
```

### 2. Setup Components API

```bash
cd scraper/pcpartpicker/api

# Create .env
echo 'AZURE_OPENAI_BASE_URL=your_azure_openai_base_url' > .env
echo 'AZURE_OPENAI_API_KEY=your_azure_openai_api_key' >> .env
echo 'AZURE_OPENAI_MODEL=gpt-4o' >> .env

# Install dependencies (if using uv)
uv sync
# Or if using pip:
# pip install -r requirements.txt
```

### 3. Setup RAG API

```bash
cd scraper/pcpartpicker/rag-api

# Create .env
echo 'AZURE_OPENAI_BASE_URL=your_azure_openai_base_url' > .env
echo 'AZURE_OPENAI_API_KEY=your_azure_openai_api_key' >> .env
echo 'AZURE_OPENAI_MODEL=gpt-4o' >> .env
echo 'AZURE_OPENAI_EMBEDDING_MODEL=text-embedding-3-small' >> .env

# Build vector database
python process_data.py

# Install dependencies (if using uv)
uv sync
```

### 4. Client Environment

```bash
cd client
cp .env.example .env.local
# Your .env.local already has all the API keys configured ✅
```

---

## ✅ You're Ready!

Your `.env.example` has everything needed:

- ✅ LiveKit credentials
- ✅ OpenAI API key
- ✅ Deepgram API key
- ✅ Cartesia API key
- ✅ Correct backend URLs (8000 for components, 8001 for RAG)

Just run the 4 terminal commands and you're good to go! 🎉
