# Complete Setup Guide for PC-EZ Client

## Overview

Your client needs 3 backend APIs running:

1. **Components API** (port 8000) - PC parts database & image upload
2. **RAG API** (port 8001) - CPU knowledge base with Azure OpenAI
3. **Video API** (port 8002) - Video clips for assembly guides

---

## Environment Variables Checklist

Your `.env.local` needs these variables (copy from `.env.example`):

### ✅ Already Configured:

- ✅ `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
- ✅ `OPENAI_API_KEY`
- ✅ `DEEPGRAM_API_KEY`
- ✅ `CARTESIA_API_KEY`

### 🔍 Check These Backend URLs:

```bash
# Components API (PC parts database)
API_BASE_URL=http://localhost:8000
COMPONENTS_API_URL=http://localhost:8000

# RAG API (CPU knowledge base)
RAG_API_URL=http://localhost:8001

# Note: Video API runs on 8002 but isn't in env vars (hardcoded in code)
```

### ⚠️ Missing from Client - Needed for Backend APIs:

The backend APIs also need Azure OpenAI credentials. These should be in:

- `/scraper/pcpartpicker/api/.env`
- `/scraper/pcpartpicker/rag-api/.env`

---

## Step-by-Step Setup Commands

### 1️⃣ Setup Components API (Port 8000)

```bash
# Navigate to components API
cd /Users/isaacphoon/Documents/GitHub/pc-ez/scraper/pcpartpicker/api

# Create .env file
cat > .env << 'EOF'
AZURE_OPENAI_BASE_URL=your_azure_openai_base_url
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_MODEL=gpt-4o
EOF

# Check if requirements.txt or pyproject.toml exists
ls

# Install dependencies (if using pip)
# pip install -r requirements.txt

# Or if using uv (check if pyproject.toml exists)
# uv sync

# Run the API
uvicorn main:app --reload --port 8000
```

**What this API does:**

- Serves PC parts from SQLite database (`pcpartpicker.db`)
- `/components/search` - Search for components
- `/components-image-upload` - Upload image to detect components
- `/compatibility-check` - Check if components are compatible

---

### 2️⃣ Setup RAG API (Port 8001)

```bash
# Navigate to RAG API
cd /Users/isaacphoon/Documents/GitHub/pc-ez/scraper/pcpartpicker/rag-api

# Create .env file (if not exists)
cat > .env << 'EOF'
AZURE_OPENAI_BASE_URL=your_azure_openai_base_url
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_MODEL=gpt-4o
AZURE_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
EOF

# Install dependencies
# Check for requirements.txt or pyproject.toml

# Process data (build vector database)
python process_data.py

# Run the RAG API
uvicorn main:app --reload --port 8001
```

**What this API does:**

- Vector database for PC parts (LanceDB)
- `/query` - Natural language queries about PC parts
- Uses Azure OpenAI for embeddings and completions
- Supports CPUs, GPUs, motherboards, memory, storage, cases, coolers, PSUs

---

### 3️⃣ Setup Video API (Port 8002)

```bash
# Navigate to video scraper
cd /Users/isaacphoon/Documents/GitHub/pc-ez/scraper/pcvideoscrapper/scraper

# Check if .env needed (probably not for this one)
ls -la

# Run the video API
python api.py
# Or if using uvicorn:
# uvicorn api:app --reload --port 8002
```

**What this API does:**

- Serves video clips for RAM, CPU, GPU installation
- `/video/ram`, `/video/cpu`, `/video/gpu` - Get assembly video clips
- Uses yt-dlp and ffmpeg to download and clip videos

---

### 4️⃣ Setup & Run Client (Frontend + Voice Agent)

```bash
# Navigate to client
cd /Users/isaacphoon/Documents/GitHub/pc-ez/client

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your API keys (already done)

# Run Next.js dev server
pnpm dev

# In a separate terminal, run the voice agent
pnpm dev:agent
```

**What runs:**

- **Next.js**: Frontend on http://localhost:3000
- **Voice Agent**: LiveKit agent for voice interaction

---

## Quick Start Script (All at Once)

Create a script to start all servers:

```bash
#!/bin/bash
# save as: start-all-servers.sh

# Start Components API
cd /Users/isaacphoon/Documents/GitHub/pc-ez/scraper/pcpartpicker/api
uvicorn main:app --reload --port 8000 &
echo "✅ Components API started on port 8000"

# Start RAG API
cd /Users/isaacphoon/Documents/GitHub/pc-ez/scraper/pcpartpicker/rag-api
uvicorn main:app --reload --port 8001 &
echo "✅ RAG API started on port 8001"

# Start Video API
cd /Users/isaacphoon/Documents/GitHub/pc-ez/scraper/pcvideoscrapper/scraper
python api.py &
echo "✅ Video API started on port 8002"

# Start Client
cd /Users/isaacphoon/Documents/GitHub/pc-ez/client
pnpm dev &
echo "✅ Client started on port 3000"

# Start Voice Agent
pnpm dev:agent &
echo "✅ Voice Agent started"

echo ""
echo "🎉 All servers running!"
echo "Frontend: http://localhost:3000"
echo "Components API: http://localhost:8000"
echo "RAG API: http://localhost:8001"
echo "Video API: http://localhost:8002"
```

Make it executable:

```bash
chmod +x start-all-servers.sh
./start-all-servers.sh
```

---

## Verification Checklist

After starting everything, test:

1. **Components API**: `curl http://localhost:8000/components/search?q=ryzen`
2. **RAG API**: `curl -X POST http://localhost:8000/query -H "Content-Type: application/json" -d '{"query":"Does Ryzen 5 5600G have integrated graphics?"}'`
3. **Video API**: `curl http://localhost:8002/video/ram`
4. **Client**: Open http://localhost:3000

---

## Common Issues & Solutions

### Issue: Port already in use

```bash
# Kill process on specific port
lsof -ti:8000 | xargs kill -9
lsof -ti:8001 | xargs kill -9
lsof -ti:8002 | xargs kill -9
```

### Issue: Database not found (Components API)

```bash
cd /Users/isaacphoon/Documents/GitHub/pc-ez/scraper/pcpartpicker/api
# Check if pcpartpicker.db exists
ls -la pcpartpicker.db

# If missing, create it:
python json_to_sqlite.py
```

### Issue: Vector database not found (RAG API)

```bash
cd /Users/isaacphoon/Documents/GitHub/pc-ez/scraper/pcpartpicker/rag-api
# Build vector database
python process_data.py
```

### Issue: Video clips missing

```bash
cd /Users/isaacphoon/Documents/GitHub/pc-ez/scraper/pcvideoscrapper/scraper
# Create clips directory
mkdir -p clips
# Videos will be downloaded on first request
```

---

## Environment Variables Summary

### Client (`client/.env.local`):

```bash
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=
OPENAI_API_KEY=
DEEPGRAM_API_KEY=
CARTESIA_API_KEY=
API_BASE_URL=http://localhost:8000
RAG_API_URL=http://localhost:8001
COMPONENTS_API_URL=http://localhost:8000
```

### Components API (`scraper/pcpartpicker/api/.env`):

```bash
AZURE_OPENAI_BASE_URL=your_azure_openai_base_url
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_MODEL=gpt-4o
```

### RAG API (`scraper/pcpartpicker/rag-api/.env`):

```bash
AZURE_OPENAI_BASE_URL=your_azure_openai_base_url
AZURE_OPENAI_API_KEY=your_azure_openai_api_key
AZURE_OPENAI_MODEL=gpt-4o
AZURE_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### Video API (probably none needed):

No environment variables required - uses hardcoded video IDs.

---

## Ready to Run!

Follow these steps in order:

1. ✅ Create `.env` files for all APIs
2. ✅ Install dependencies (`pip install` or `uv sync`)
3. ✅ Build databases if needed
4. ✅ Start all servers
5. ✅ Test endpoints
6. ✅ Open http://localhost:3000

Your client should now have full access to:

- PC parts database
- RAG-powered CPU recommendations
- Assembly video clips
- Voice agent integration
