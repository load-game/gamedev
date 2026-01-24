#!/bin/bash

# 🚀 Complete Local Dojo Environment (Katana + Torii + CORS)
# All services started with proper CORS for browser access

WORLD_ADDRESS="${1:-0x5e3350a4c61af85c423c1c9f4a4b2b3f4e3e2a1c8d7b6a5e0f2e3a0e5e3e0a5}"
KATANA_PID=""
TORII_PID=""

echo "🟢 Starting complete local Dojo environment..."
echo "   World Address: $WORLD_ADDRESS"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    if [[ ! -z "$KATANA_PID" ]]; then
        kill $KATANA_PID 2>/dev/null
        echo "✅ Katana stopped"
    fi
    if [[ ! -z "$TORII_PID" ]]; then
        kill $TORII_PID 2>/dev/null
        echo "✅ Torii stopped"
    fi
    exit 0
}

# Set up cleanup on script exit
trap cleanup SIGINT SIGTERM

echo "📍 Step 1: Starting Katana StarkNet sequencer..."
katana --dev --block-time 1000 --dev.accounts 5 --http.cors_origins "http://localhost:3000" &
KATANA_PID=$!

echo "⏳ Waiting for Katana to start..."
sleep 3

# Test if Katana is running
if curl -s http://localhost:5050 > /dev/null; then
    echo "✅ Katana running at http://localhost:5050"
else
    echo "❌ Katana failed to start"
    cleanup
    exit 1
fi

echo "📍 Step 2: Starting Torii indexing service..."
sleep 2
torii --world $WORLD_ADDRESS --rpc http://localhost:5050 --http.cors_origins "http://localhost:3000" &
TORII_PID=$!

echo "⏳ Waiting for Torii to start..."
sleep 3

# Test if Torii is running
if curl -s http://localhost:8080/graphql > /dev/null; then
    echo "✅ Torii running at http://localhost:8080"
else
    echo "❌ Torii failed to start"
    cleanup
    exit 1
fi

echo ""
echo "🎯 Both services are ready!"
echo "📡 Katana RPC: http://localhost:5050"
echo "🔍 Torii GraphQL: http://localhost:8080/graphql"
echo ""
echo "🎮 Next: Start Hyperfy"
echo "   cd /home/blank/Work/hyperfy && npm run dev"
echo ""
echo "🛑 Stop all services anytime with Ctrl+C"

# Keep script running
wait