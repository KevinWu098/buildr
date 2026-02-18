#!/bin/bash
# Start all PC-EZ servers

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

echo "🚀 Starting PC-EZ..."

# Use uv run if available, otherwise plain uvicorn
if command -v uv &> /dev/null; then
    UVICORN="uv run uvicorn"
else
    UVICORN="uvicorn"
fi

# Start Components API
echo "📦 Starting Components API (port 8000)..."
cd "$SCRIPT_DIR/scraper/pcpartpicker/api"
$UVICORN main:app --reload --port 8000 &
COMPONENTS_PID=$!

# Start RAG API
echo "🧠 Starting RAG API (port 8001)..."
cd "$SCRIPT_DIR/scraper/pcpartpicker/rag-api"
$UVICORN main:app --reload --port 8001 &
RAG_PID=$!

# Start Clips API
echo "🎬 Starting Clips API (port 8002)..."
cd "$SCRIPT_DIR/scraper/pcvideoscrapper/clips-api"
$UVICORN main:app --reload --port 8002 &
CLIPS_PID=$!

# Start Client Frontend
echo "🌐 Starting Frontend (port 3000)..."
cd "$SCRIPT_DIR/client"
pnpm dev &
CLIENT_PID=$!

# Start Voice Agent
echo "🎤 Starting Voice Agent..."
pnpm dev:agent &
AGENT_PID=$!

echo ""
echo "✅ All servers started!"
echo ""
echo "📍 URLs:"
echo "   Frontend:       http://localhost:3000"
echo "   Components API: http://localhost:8000"
echo "   RAG API:        http://localhost:8001"
echo "   Clips API:      http://localhost:8002"
echo ""
echo "🛑 To stop all servers, press Ctrl+C"

# Wait for user to stop
trap "kill $COMPONENTS_PID $RAG_PID $CLIPS_PID $CLIENT_PID $AGENT_PID 2>/dev/null; echo 'Stopped all servers'; exit" INT TERM

wait
