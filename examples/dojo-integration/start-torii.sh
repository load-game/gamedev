#!/bin/bash

# Torii Quick Start
# Usage: ./start-torii.sh <world_address> [port]

if [ -z "$1" ]; then
    echo "❌ World address required"
    echo "Usage: ./start-torii.sh <world_address> [port]"
    echo ""
    echo "Get the world address from deploy-contracts.sh output"
    echo "Or check: examples/fragment-collector/manifests/dev/manifest.json"
    exit 1
fi

WORLD_ADDRESS=$1
RPC_PORT=${2:-5050}
TORII_PORT=${3:-8080}

echo "🔍 Starting Torii indexer..."
echo "   World: $WORLD_ADDRESS"
echo "   RPC: http://localhost:$RPC_PORT"
echo "   Torii: http://localhost:$TORII_PORT"

exec torii --world "$WORLD_ADDRESS" --rpc "http://localhost:$RPC_PORT" --http-port $TORII_PORT
