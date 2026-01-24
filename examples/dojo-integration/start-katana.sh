#!/bin/bash

# Katana Quick Start
# Usage: ./start-katana.sh [port]

PORT=${1:-5050}
echo "🚀 Starting Katana on port $PORT..."

# Check if already running
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  Port $PORT already in use. Katana might already be running."
    read -p "Kill existing process? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        lsof -ti:$PORT | xargs kill -9
        sleep 2
    else
        exit 1
    fi
fi

echo "✅ Starting Katana with dev mode and CORS enabled..."
exec katana --dev --block-time 1000 --dev.accounts 5 --http.cors_origins "http://localhost:3000"
