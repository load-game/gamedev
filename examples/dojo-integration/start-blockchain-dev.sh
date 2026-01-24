#!/bin/bash

# 🚀 Hyperfy Blockchain Dev Environment - One-Click Start
# This script starts all required services for Dojo blockchain development

set -e  # Exit on error

echo "═══════════════════════════════════════════════════════════════"
echo "  🎮 Hyperfy Blockchain Dev Environment Starting..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required tools are installed
echo "🔍 Checking prerequisites..."

# Check for Katana
if ! command -v katana &> /dev/null; then
    echo -e "${RED}❌ Katana not found. Install with:${NC}"
    echo "   curl -L https://install.dojoengine.org | bash"
    exit 1
fi

# Check for Sozo
if ! command -v sozo &> /dev/null; then
    echo -e "${RED}❌ Sozo not found. Install with:${NC}"
    echo "   curl -L https://install.dojoengine.org | bash"
    exit 1
fi

# Check for Torii
if ! command -v torii &> /dev/null; then
    echo -e "${RED}❌ Torii not found. Install with:${NC}"
    echo "   curl -L https://install.dojoengine.org | bash"
    exit 1
fi

echo -e "${GREEN}✅ All Dojo tools installed${NC}"
echo ""

# Configuration
KATANA_PORT=5050
TORII_PORT=8080
FRAGMENT_CONTRACT_DIR="$(pwd)/examples/fragment-collector"
HARDCODED_WORLD_ADDRESS="0x05c7b2e5e5b5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e"

echo "📋 Configuration:"
echo "   Katana port: $KATANA_PORT"
echo "   Torii port: $TORII_PORT"
echo "   Contract dir: $FRAGMENT_CONTRACT_DIR"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  🛑 Shutting down services..."
    echo "═══════════════════════════════════════════════════════════════"

    # Kill Katana
    if [ ! -z "$KATANA_PID" ]; then
        kill $KATANA_PID 2>/dev/null
        echo -e "${YELLOW}⏹️  Stopped Katana${NC}"
    fi

    # Kill Torii
    if [ ! -z "$TORII_PID" ]; then
        kill $TORII_PID 2>/dev/null
        echo -e "${YELLOW}⏹️  Stopped Torii${NC}"
    fi

    # Kill Hyperfy if we started it
    if [ "$STARTED_HYPERFY" = true ]; then
        echo -e "${YELLOW}⏹️  Hyperfy dev server${NC}"
    fi

    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup INT

# Step 1: Start Katana
echo "═══════════════════════════════════════════════════════════════"
echo "  ⛓️  Step 1: Starting Katana (StarkNet Sequencer)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

katana --dev --block-time 1000 --dev.accounts 5 --http.cors_origins "http://localhost:3000" &
KATANA_PID=$!

# Wait for Katana to start
echo -n "⏳ Waiting for Katana to start..."
sleep 5
echo -e "${GREEN}✅ Ready${NC}"
echo ""

# Step 2: Deploy Contracts
echo "═══════════════════════════════════════════════════════════════"
echo "  📜 Step 2: Compiling and Deploying Contracts"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ -d "$FRAGMENT_CONTRACT_DIR" ]; then
    cd "$FRAGMENT_CONTRACT_DIR"

    echo "📁 Building Cairo contracts..."
    if sozo build 2>&1 | tee build.log; then
        echo -e "${GREEN}✅ Build successful${NC}"
    else
        echo -e "${RED}❌ Build failed. Check build.log${NC}"
        tail -20 build.log
        exit 1
    fi

    echo ""
    echo "🚀 Deploying to Katana..."

    # Check if contracts are already deployed
    if [ -f "$FRAGMENT_CONTRACT_DIR/manifests/dev/manifest.json" ]; then
        # Extract world address from manifest
        WORLD_ADDRESS=$(jq -r '.world.address' "$FRAGMENT_CONTRACT_DIR/manifests/dev/manifest.json")
        if [ "$WORLD_ADDRESS" != "null" ] && [ ! -z "$WORLD_ADDRESS" ]; then
            echo -e "${YELLOW}⚠️  Contracts already deployed at: $WORLD_ADDRESS${NC}"
            echo -e "${YELLOW}   Skipping redeployment${NC}"
        fi
    fi

    if [ -z "$WORLD_ADDRESS" ]; then
        if sozo migrate 2>&1 | tee deploy.log; then
            echo -e "${GREEN}✅ Deployment successful${NC}"
            # Extract world address from output
            WORLD_ADDRESS=$(grep -o 'World deployed at: 0x[0-9a-f]*' deploy.log | cut -d' ' -f4 || echo "")
        else
            echo -e "${RED}❌ Deployment failed. Using hardcoded address${NC}"
            WORLD_ADDRESS="$HARDCODED_WORLD_ADDRESS"
        fi
    fi

    cd - > /dev/null

    # Export world address for Hyperfy
    export WORLD_ADDRESS="${WORLD_ADDRESS:-$HARDCODED_WORLD_ADDRESS}"
    echo ""
    echo -e "${BLUE}🌍 World Address:${NC} $WORLD_ADDRESS"
else
    echo -e "${YELLOW}⚠️  Fragment collector contracts not found${NC}"
    echo -e "${YELLOW}   Using hardcoded world address${NC}"
    WORLD_ADDRESS="$HARDCODED_WORLD_ADDRESS"
fi

echo ""

# Step 3: Start Torii
echo "═══════════════════════════════════════════════════════════════"
echo "  🔍 Step 3: Starting Torii (Indexer)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

torii --world "$WORLD_ADDRESS" --rpc "http://localhost:$KATANA_PORT" &
TORII_PID=$!

# Wait for Torii to start
echo -n "⏳ Waiting for Torii to start..."
sleep 5
echo -e "${GREEN}✅ Ready${NC}"
echo ""

# Step 4: Start Hyperfy
echo "═══════════════════════════════════════════════════════════════"
echo "  🎮 Step 4: Starting Hyperfy Dev Server"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo -e "${GREEN}✅ Blockchain services ready!${NC}"
echo ""
echo "📊 Service Status:"
echo "   Katana:  http://localhost:$KATANA_PORT"
echo "   Torii:   http://localhost:$TORII_PORT/graphql"
echo "   World:   $WORLD_ADDRESS"
echo ""
echo -e "${YELLOW}📝 To use blockchain features in Hyperfy:${NC}"
echo "   Load: examples/dojo-integration/test-dojo-api.js"
echo "   Or: examples/dojo-integration/elementals-dojo-hybrid.js"
echo ""
echo -e "${BLUE}🚀 Starting Hyperfy...${NC}"
echo ""

# Start Hyperfy dev server
STARTED_HYPERFY=true
cd "$(pwd)"
npm run dev

# Wait for user to press Ctrl+C
echo ""
echo "Press Ctrl+C to stop all services..."
wait
