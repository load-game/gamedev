#!/bin/bash

# Deploy Fragment Collector Contracts
# Usage: ./deploy-contracts.sh [contract_dir]

CONTRACT_DIR=${1:-"$(pwd)/examples/fragment-collector"}
HARDCODED_WORLD="0x05c7b2e5e5b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e"

echo "📦 Deploying contracts from: $CONTRACT_DIR"

if [ ! -d "$CONTRACT_DIR" ]; then
    echo "❌ Contract directory not found: $CONTRACT_DIR"
    exit 1
fi

cd "$CONTRACT_DIR"

# Check if katana is running
echo "🔍 Checking if Katana is running..."
if ! curl -s http://localhost:5050 > /dev/null; then
    echo "❌ Katana is not running. Start it first with:"
    echo "   ./start-katana.sh"
    exit 1
fi

# Build contractsecho "🔨 Building contracts..."
if sozo build; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Deploy
echo "🚀 Deploying to Katana..."
if sozo migrate; then
    echo "✅ Deployment successful"

    # Get world address
    WORLD_ADDRESS=$(grep -o 'World deployed at: 0x[0-9a-f]*' deploy.log | cut -d' ' -f4 || echo "")
    if [ -z "$WORLD_ADDRESS" ]; then
        WORLD_ADDRESS=$(jq -r '.world.address' manifests/dev/manifest.json 2>/dev/null || echo "")
    fi

    echo ""
    echo "🌍 World Address: ${WORLD_ADDRESS:-$HARDCODED_WORLD}"
    echo ""
    echo "Save this address and use it when starting Torii:"
    echo "torii --world ${WORLD_ADDRESS:-$HARDCODED_WORLD} --rpc http://localhost:5050"
else
    echo "❌ Deployment failed"
    exit 1
fi
