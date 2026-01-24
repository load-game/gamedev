# 🚀 QUICK FIX: Complete Dojo Setup

You're very close! Just need to restart Torii with CORS.

## ❌ Current Issue:
```
Access to fetch at 'http://localhost:8080/graphql' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

## ✅ Fix (2 minutes):

### **Stop old Torii:**
```bash
pkill torii
```

### **Start Torii with CORS:**
```bash
torii --world 0x5e3350a4c61af85c423c1c9f4a4b2b3f4e3e2a1c8d7b6a5e0f2e3a0e5e3e0a5 --rpc http://localhost:5050 --http.cors_origins "http://localhost:3000"
```

### **Refresh your Hyperfy browser page**

## 🎯 Expected Result:
```
[DojoSystem] ✅ Connected to local Katana, block: X
[DojoSystem] 🟢 Using real local Katana blockchain!
[DojoSystem] 🟢 Connected to real local Torii!    ← NEW!
🚀 Test init triggered                             ← Should appear!
✅ PASS: All services connected!
```

## 🔄 Or Use One-Click Script:
```bash
./examples/dojo-integration/start-complete-dojo.sh
```

This handles BOTH services with proper CORS automatically!

**Just add `--http.cors_origins "http://localhost:3000"` to Torii and you're done!** 🎮⚡