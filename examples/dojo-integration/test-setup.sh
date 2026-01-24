#!/bin/bash

# Test Blockchain Setup
# Quick verification that everything is working

echo "🧪 Testing Blockchain Dev Environment"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILED=0

# Test 1: Katana
echo "1️⃣  Testing Katana..."
if curl -s -X POST http://localhost:5050 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"starknet_blockNumber","params":[],"id":1}' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Katana is running${NC}"
else
    echo -e "${RED}❌ Katana not responding${NC}"
    echo "   Start with: ./start-katana.sh"
    FAILED=1
fi

# Test 2: Torii
echo "2️⃣  Testing Torii..."
if curl -s http://localhost:8080/graphql > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Torii is running${NC}"
else
    echo -e "${YELLOW}⚠️  Torii not responding${NC}"
    echo "   Start with: ./start-torii.sh <world_address>"
fi

# Test 3: Contracts
echo "3️⃣  Testing contracts..."
if [ -f "examples/fragment-collector/manifests/dev/manifest.json" ]; then
    WORLD_ADDRESS=$(jq -r '.world.address' examples/fragment-collector/manifests/dev/manifest.json)
    if [ "$WORLD_ADDRESS" != "null" ] && [ ! -z "$WORLD_ADDRESS" ]; then
        echo -e "${GREEN}✅ Contracts deployed${NC}"
        echo "   World: $WORLD_ADDRESS"
    else
        echo -e "${YELLOW}⚠️  Contracts not deployed${NC}"
        echo "   Deploy with: ./deploy-contracts.sh"
    fi
else
    echo -e "${YELLOW}⚠️  Contracts not deployed${NC}"
    echo "   Deploy with: ./deploy-contracts.sh"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 Environment is ready!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Load a dojo example in Hyperfy:"
    echo "   examples/dojo-integration/test-dojo-api.js"
    echo ""
    echo "2. Or load the elementals hybrid:"
    echo "   examples/dojo-integration/elementals-dojo-hybrid.js"
else
    echo -e "${RED}❌ Some services are not running${NC}"
    echo ""
    echo "Quick fix:"
    echo "./start-blockchain-dev.sh"
fi
echo "═══════════════════════════════════════════════════════════════"
