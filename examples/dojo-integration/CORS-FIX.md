# 🚨 CORS FIX for Local Dojo

## ❌ Problem
```
Access to fetch at 'http://localhost:5050/' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

## ✅ Solution

**Start both services with CORS enabled:**

### **Katana (StarkNet):**
```bash
katana --dev --block-time 1000 --dev.accounts 5 --http.cors_origins "http://localhost:3000"
```

### **Torii (Indexing):**
```bash
torii --world <WORLD_ADDRESS> --rpc http://localhost:5050 --http.cors_origins "http://localhost:3000"
```

## 🎯 What This Does

- ✅ Enables browser access to both StarkNet AND Torii from Hyperfy (`localhost:3000`)
- ✅ Allows fetch requests to `localhost:5050` (Katana) and `localhost:8080` (Torii)
- ✅ Solves ALL "No Access-Control-Allow-Origin" errors
- ✅ Makes DojoSystem connect to real local blockchain + indexing instead of mock

## 🧪 Test It

After starting BOTH services with CORS:

 Browser should show:
```
[DojoSystem] ✅ Connected to local Katana, block: 42
[DojoSystem] 🟢 Using real local Katana blockchain!
[DojoSystem] 🟢 Connected to real local Torii!
🚀 Test init triggered
✅ PASS: Network: LOCAL_KATANA
✅ PASS: Torii: Connected
```

Instead of:
```
❌ CORS errors
🟡 Using mock implementation
Test never initializes
```

## 🚀 One-Click Fix

```bash
# Use the fixed startup script
./examples/dojo-integration/start-local-dojo.sh
```

This script automatically includes the CORS flag!