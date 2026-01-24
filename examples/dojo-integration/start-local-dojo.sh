#!/bin/bash

# 🚀 Quick Start Local Dojo Environment
# Verified commands for current Katana version

echo "🟢 Starting local Dojo environment..."

echo "📍 Step 1: Starting Katana StarkNet sequencer..."
# Start Katana with dev mode + CORS for browser access
katana --dev --block-time 1000 --dev.accounts 5 --http.cors_origins "http://localhost:3000" &
KATANA_PID=$!

echo "⏳ Waiting for Katana to start..."
sleep 3

# Test if Katana is running
if curl -s http://localhost:5050 > /dev/null; then
    echo "✅ Katana is running at http://localhost:5050"

    # Show created accounts
    echo "📋 Checking created accounts..."
    katana rpc --url http://localhost:5050 call \
        --function get_balance \
        --address 0x1 \
        --calldata 0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc735

    echo ""
    echo "🎯 Next steps:"
    echo "1. In a new terminal: cd /tmp/my-dojo-world && sozo init elementals-world"
    echo "2. Then: sozo migrate"
    echo "3. Then: torii --world <YOUR_WORLD_ADDRESS> --rpc http://localhost:5050 --http.cors_origins \"http://localhost:3000\""
    echo "4. Finally: cd /home/blank/Work/hyperfy && npm run dev"
    echo ""
    echo "🛑 Stop Katana anytime with: kill $KATANA_PID"
    echo "💬 Or press Ctrl+C"

    # Keep the script running to show Katana logs
    wait $KATANA_PID
else
    echo "❌ Katana failed to start"
    kill $KATANA_PID 2>/dev/null
    exit 1
fi