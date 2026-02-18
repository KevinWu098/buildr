#!/bin/bash
# One-time setup script for PC-EZ

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

echo "🔧 Setting up PC-EZ dependencies..."

# Setup Client
echo ""
echo "📦 Installing client dependencies..."
cd "$SCRIPT_DIR/client"
pnpm install
echo "✅ Client dependencies installed"

# Setup Components API
echo ""
echo "📦 Installing Components API dependencies..."
cd "$SCRIPT_DIR/scraper/pcpartpicker/api"
if command -v uv &> /dev/null; then
    echo "Using uv..."
    uv sync
else
    echo "Using pip..."
    pip install fastapi uvicorn sqlmodel aiosqlite openai python-dotenv google-genai greenlet python-multipart
fi
echo "✅ Components API dependencies installed"

# Setup RAG API
echo ""
echo "📦 Installing RAG API dependencies..."
cd "$SCRIPT_DIR/scraper/pcpartpicker/rag-api"
if command -v uv &> /dev/null; then
    echo "Using uv..."
    uv sync
else
    echo "Using pip..."
    pip install fastapi uvicorn lancedb openai python-dotenv pydantic
fi
echo "✅ RAG API dependencies installed"

# Setup Clips API
echo ""
echo "📦 Installing Clips API dependencies..."
cd "$SCRIPT_DIR/scraper/pcvideoscrapper/clips-api"
if command -v uv &> /dev/null; then
    echo "Using uv..."
    uv sync
else
    echo "Using pip..."
    pip install boto3 fastapi uvicorn python-dotenv
fi
echo "✅ Clips API dependencies installed"

echo ""
echo "✅ All dependencies installed!"
echo ""
echo "Next steps:"
echo "1. Make sure .env files are configured with your API keys"
echo "2. Run: ./start-all.sh"
