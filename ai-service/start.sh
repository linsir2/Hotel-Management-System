#!/bin/bash
# Hotel AI Service — Startup Script
# Usage: bash start.sh          (foreground)
#        bash start.sh --reload  (dev mode with auto-reload)

cd "$(dirname "$0")"

# Activate venv
source .venv/bin/activate

# Ensure .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env not found, copying from .env.example"
    cp .env.example .env
fi

# Start server
echo "🚀 Starting Hotel AI Service on http://0.0.0.0:8000"
if [ "$1" == "--reload" ]; then
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
else
    uvicorn main:app --host 0.0.0.0 --port 8000
fi
