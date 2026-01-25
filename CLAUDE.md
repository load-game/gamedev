# CLAUDE.md

Technical notes and caveats for the gamedev codebase.

## Debug Log Management

### Always Comment Out Debug Logs After Use
During debugging sessions, console.log statements are added with prefixes like `[PLAYER]`, `[VRM]`, `[DOF]`, etc. These MUST be commented out once the issue is resolved.

**Why?**
- Console spam degrades performance
- Makes real errors harder to spot
- Clutters browser console during development

**Where debug logs are added:**
- PlayerLocal.js: Player state and locomotion debugging
- createVRMFactory.js: VRM animation and emote debugging
- ClientCameraControls.js: Camera and DOF debugging

**Pattern to use:**
```javascript
// During debugging:
console.log('[PLAYER] Debug info:', value)

// After resolution:
// console.log('[PLAYER] Debug info:', value)
```

**Never leave debug logs active in production code.**

## Modes Enum Synchronization

### Critical: Keep Modes in Sync Across Files
When adding new animation modes, they **MUST** be added to **both** files:
- `src/core/entities/PlayerLocal.js` (lines 48-66)
- `src/core/extras/createVRMFactory.js` (near top)

**Issue**: PlayerLocal determines the mode, VRMFactory consumes it
- PlayerLocal sets: `mode = Modes.FLIP` (gets value like 7)
- If enum missing in PlayerLocal: `mode = undefined`
- Then code does: `if (!mode) mode = Modes.IDLE` → resets to 0
- VRM receives mode 0 → no animation plays

**Symptom**: Animation detection logs show mode 0 (IDLE) instead of expected mode (7, 8, 9, 10)

**Fix**: Always define modes in both enums with matching values:
```javascript
// Both files must have:
const Modes = {
  IDLE: 0, WALK: 1, RUN: 2, JUMP: 3, FALL: 4, FLY: 5, TALK: 6,
  FLIP: 7, BACKFLIP: 8, SIDEFLIP_LEFT: 9, SIDEFLIP_RIGHT: 10,
  // Platformer modes: 13-17
}
```

**Verification**: Check mode values match between files before testing animations

## Blockchain Integration

### Cartridge Controller (StarkNet)
- **File**: `src/core/systems/ClientWeb3.js`
- **Status**: Migrated from hyperfy/dojo
- **Dependencies**: @cartridge/controller@0.10.7, starknet@8.9.2
- **Usage**: Access via `world.web3` in client apps
- **Important**: Requires browser environment with LocalStorage
- **Note**: Cartridge may show rehydrate errors in console but functionality works

### EVM Integration (Ethereum)
- **Files**: `src/core/systems/EVMClient.js`
- **Status**: Migrated from hyperfy/dojo
- **Dependencies**: viem@2.43.2, wagmi@2.19.5, @tanstack/react-query@5.65.1
- **Features**:
  - Wallet connection (MetaMask, etc.)
  - ENS resolution with 5-minute caching
  - Real transaction execution

## Camera & DOF System

### ClientCameraControls
- **File**: `src/core/systems/ClientCameraControls.js`
- **Status**: Migrated from hyperfy/dojo
- **Features**:
  - Realistic depth of field with Bokeh effects
  - Raycast-based autofocus for head bones and reticle
  - ADS (Aim Down Sights) zoom simulation
  - Multiple camera presets (portrait, landscape, macro, standard)
  - Programmatic focal length control (24-200mm)

### DOFController
- **File**: `src/core/systems/DOFController.js`
- **Status**: Migrated from hyperfy/dojo
- **Integration**: Used by ClientCameraControls for focus calculations
- **Effects**: Dynamic DOF adjustment based on zoom and scene objects

### EffectRegistry
- **File**: `src/core/systems/EffectRegistry.js`
- **Status**: Migrated from hyperfy/dojo
- **Purpose**: Manages post-processing effects and shader uniforms
- **Integration**: Added to ClientGraphics and ClientPrefs systems

## SkinnedMesh Enhancements

### Bone Handle System
- **File**: `src/core/nodes/SkinnedMesh.js`
- **Status**: Enhanced from hyperfy/dojo version
- **Features**:
  - `entity.getBone('name')` returns reactive bone handle
  - Accessors: position, quaternion, rotation, scale, matrixWorld
  - matrixWorld setter for direct bone manipulation
- **Use Cases**: VRM avatar customization, bone-based animations

## Web3Environment Utility

### Environment Detection
- **File**: `src/core/utils/web3Environment.js`
- **Purpose**: Consolidates environment checks across web3 systems
- **Features**:
  - Browser detection (isBrowser, isMobile, isQuest, isSafari)
  - Feature detection (LocalStorage, WebSocket, secure context)
  - Validation for required features

## BaseWeb3System

### Foundation Class
- **File**: `src/core/systems/BaseWeb3System.js`
- **Purpose**: Common foundation for all Web3 systems
- **Features**:
  - Standardized event emission
  - Connection state management
  - Mock API generation for graceful degradation
  - Debug information utilities

## System Registration

### Client World
All new systems are registered in `src/core/createClientWorld.js`:
- `world.register('web3', ClientWeb3)`
- `world.register('evm', EVM)`
- `world.register('cameraControls', ClientCameraControls)`

## VRM Expressions and Auto-Blink

**Added**: VRM facial expression system with auto-blink and talking animations

**Implementation**: `src/core/extras/createVRMFactory.js`

**Features**:
- **Auto-blink**: Random intervals (2.5-5s) with realistic timing (0.06s close, 0.12s open)
- **Viseme system**: Mouth animations for talking (aa, ee, ih, oh, ou expressions)
- **Dual path support**: VRM 1.0 ExpressionManager + VRM 0.x expression nodes fallback
- **Manual control**: `setExpression(name, weight)`, `setSpeaking(value)`, `setBlinkEnabled(active)`

**Expression Manager Fallback**:
- Primary: `expressionManager.setValue()` for VRM 1.0
- Fallback: Direct `VRMExpression` node manipulation for VRM 0.x
- Auto-detection based on VRM version

**API Methods**:
```javascript
// Auto-blink control (enabled by default)
vrm.setBlinkEnable(true)  // Enable automatic blinking

// Talking animation (cycles through visemes)
vrm.setSpeaking(true)     // Start mouth movement
vrm.setSpeaking(false)    // Stop mouth movement

// Manual expression control
vrm.setExpression('blink', 1.0)      // Force blink
vrm.setExpression('aa', 0.5)         // Set mouth shape

// Expression names: 'blink', 'aa', 'ee', 'ih', 'oh', 'ou'
```

**Technical Notes**:
- Expressions updated every frame in `update()` loop for smooth animation
- Blink uses 3-phase state machine: idle → closing → opening → idle
- Mouth visemes randomly switch every 180-300ms while talking
- Expression weights are clamped to 0-1 range
- Zero-overhead when expressions disabled or VRM lacks expression data

## VRM Animation Caveats

### Smart Flip Detection System
- **Implementation**: `src/core/entities/PlayerLocal.js:1080-1106`
- **Method**: `detectSmartFlipMode()` analyzes movement direction during air jumps
- **Detection Logic**:
  - Uses `Math.atan2(axis.x, -axis.z)` to calculate movement angle
  - 45° threshold zones for pure directions (±22.5° from cardinal directions)
  - Axis threshold fallback: axis.x > 0.5 or < -0.5 triggers side flips
  - Default: "front" flip for all other cases including diagonals
- **Emote Mapping**: Based on detected direction
  - "left" → `Modes.SIDEFLIP_LEFT` → `emote-flip-left.glb`
  - "right" → `Modes.SIDEFLIP_RIGHT` → `emote-flip-right.glb`
  - "back" → `Modes.BACKFLIP` → `emote-backflip.glb`
  - "front" → `Modes.FLIP` → `emote-flip.glb`
- **Console Debug**: Look for `[VRM]` prefix logs when flips trigger

### URL Validation for Emotes
- **Issue**: Console errors when VRM references undefined emote names
- **Fix**: Added URL validation in `getQueryParams()` to prevent crashes
- **Pattern**: Invalid URLs are caught and return empty query params object

### Platformer Animation Library
- **Location**: `/src/world/assets/mp-platformer/`
- **Status**: Additional platformer mechanics animations added
- **Animations Available**:
  - `mp-grinding.glb` - Grinding on rails/edges
  - `mp-climb-idle.glb` - Idle while climbing
  - `mp-climb-up.glb` - Climbing upward
  - `mp-climb-down.glb` - Climbing downward
  - `mp-ledge-hanging-idle.glb` - Hanging from ledge (idle)
  - `mp-ledge-hanging-moving.glb` - Moving while hanging from ledge
  - `mp-air-dive.glb` - Diving through air
  - `mp-wallslide.glb` - Sliding down wall
  - Plus additional: dash, spin, brake, crawl, die, fall, gliding, big-flip, ledge-climb
- **Modes Added**: GRINDING(13), CLIMBING(14), LEDGE_HANGING(15), AIR_DIVING(16), WALL_SLIDING(17)
- **Configuration**: All added to `src/core/extras/playerEmotes.js` and `src/core/entities/PlayerLocal.js` Modes
- **Dev Server Note**: Must restart dev server after adding new animations to see them load in console

### Animation Library Examples
- **Location**: `/src/examples/animLib/`
- **Copied From**: `/hyperfy/examples/animLib/`
- **Contents**: Example scripts for testing and working with VRM animations
- **Usage**: Navigate to directory and run node scripts for animation testing

## Build and Debug Notes

### Bundle Size Considerations
- Client bundle: ~5.3 MB
- node_modules: ~784 MB (blockchain packages are large)
- Build completes successfully with all systems included

### Debug Logging System
- Use `[PLAYER]` prefix for player state changes
- Use `[VRM]` prefix for VRM animation events
- Use `[DOF]` prefix for camera depth of field events
- Helps trace issues in player movement, animations, and camera systems

### VRM Animation Debugging
- **Debug Prefixes**: Use `[PLAYER]` for player state, `[VRM]` for VRM events
- **Key Locations**:
  - `src/core/entities/PlayerLocal.js:1025-1042` - Flip mode detection and mode setting
  - `src/core/extras/createVRMFactory.js:1615-1634` - VRM animation triggering
- **Debug Pattern**: When animations don't play:
  1. Add console.log in PlayerLocal before setting mode
  2. Add console.log in createVRMFactory when receiving mode
  3. Add console.log before setEmote() calls
  4. Check browser console for mode flow: player detection → mode set → VRM receive → setEmote
- **Common Issues**:
  - Mode detection logic not triggering (check `airJumping` condition)
  - Mode constants mismatch between files
  - VRM pose loading but not playing (check action.play() calls)
- **Platformer Modes**: GRINDING, CLIMBING, LEDGE_HANGING, AIR_DIVING, WALL_SLIDING modes use poses.target values instead of setEmote()

## Common Build Issues

### Port 5000 Already In Use
- **Error**: `listen EADDRINUSE: address already in use 0.0.0.0:5000`
- **Cause**: Previous server process didn't exit cleanly
- **Fix**: `lsof -ti:5000 | xargs kill -9`
- **Prevention**: Always stop server properly before restart

### Syntax Errors from Debug Logging
- **Error**: Unexpected "{" or "else" in build output
- **Cause**: Missing/extra braces when adding console.log statements
- **Fix**: Carefully check brace matching around debug logs
- **Example**: `setFocusSpeed(speed) { console.log(...) { ... } }` → missing brace

### ESBuild Cannot Read Outputs
- **Error**: `Cannot read properties of undefined (reading 'outputs')`
- **Cause**: Previous syntax error causing build failure
- **Fix**: Fix all syntax errors, then rebuild

### File Not Found During Build
- **Error**: Various file not found errors
- **Cause**: Worlds directory structure incomplete
- **Fix**: Ensure worlds/basic/ exists with world.json and index.js

### Duplicate Class Members
- **Error**: "Duplicate member detectSmartFlipMode/teleport in class body"
- **Cause**: Method copied inside another method or at wrong indentation
- **Fix**: Ensure methods are top-level class members, not nested inside other methods
- **Verification**: Check method placement with `grep -n "^\s*detectSmartFlipMode" file.js`

### PhysX Vector toArray Method
- **Error**: `TypeError: this.capsule.getLinearVelocity(...).toArray is not a function`
- **Cause**: `capsule.getLinearVelocity()` returns a PhysX vector, not a THREE.Vector3
- **Fix**: Copy to THREE.Vector3 first, then call `.toArray()`:
  ```javascript
  // ❌ Wrong: Direct toArray() on PhysX vector
  this.capsule.getLinearVelocity().toArray()

  // ✅ Correct: Copy to THREE.Vector3 first
  v1.copy(this.capsule.getLinearVelocity()).toArray()
  ```
- **Files Affected**: `src/core/entities/PlayerLocal.js:1074,1191`

### Unknown Network Packet Types
- **Error**: `writePacket failed: entityState (name not found)`
- **Cause**: Sending network packet type that isn't registered in `packets.js`
- **Fix**: Use `entityModified` instead of `entityState` for network updates
- **Implementation**: Track changed properties with `hasChanges` flag, only send updates when values change
- **Code Pattern**:
  ```javascript
  // Check each property for changes
  let hasChanges = false
  if (!this.lastState.p.equals(this.base.position)) {
    data.p = this.base.position.toArray()
    this.lastState.p.copy(this.base.position)
    hasChanges = true
  }
  // ... check other properties ...
  if (hasChanges) {
    this.world.network.send('entityModified', data)
  }
  ```
- **Files Affected**: `src/core/entities/PlayerLocal.js:1114`

## Asset Loading System

### Asset URL Resolution Bug
- **Error**: `THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported` (when loading valid glTF 2.0 files)
- **Root Cause**: Malformed URLs with double slashes generated by `resolveURL`
- **Location**: `src/core/World.js:215-217`
- **Problem**: Using `'asset:/'` (single slash) instead of `'asset://'` in string replacement creates malformed URLs like `http://localhost:5000/assets//file.glb`
- **Fix**: Change `url.replace('asset:/', this.assetsUrl)` to `url.replace('asset://', this.assetsUrl)`
- **Impact**: Affects all asset:// URL loading throughout codebase

### Fetch Error Handling Required
- **Error**: Silent failures when assets fail to load, followed by cryptic parser errors
- **Location**: `src/core/systems/ClientLoader.js:106-109`
- **Problem**: No HTTP response validation, failed fetches (404s) pass HTML error pages to loaders
- **Fix**: Add response validation:
  ```javascript
  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`Failed to load ${url}: ${resp.status} ${resp.statusText}`)
  }
  ```
- **Benefit**: Clear error messages instead of cryptic parser failures

### Query Parameter Handling
- **Error**: Cache pollution with query parameters in file names
- **Location**: `src/core/systems/ClientLoader.js:111`
- **Problem**: URLs like `asset://file.glb?s=1.0` cached as `file.glb?s=1.0`
- **Fix**: Strip query parameters: `url.split('/').pop().split('?')[0]`
- **Application**: Required in both `loadFile()` and `insert()` methods

### Undefined assetsUrl Causing Black Screen
- **Error**: Black screen with all assets showing 404 errors
- **Root Cause**: `world.assetsUrl` is `undefined` when `options.assetsUrl` not passed to `world.init()`
- **Location**: `src/core/World.js:62-63`
- **Problem**: `url.replace('asset://', undefined)` results in malformed URLs like `undefinedmp-grinding.glb`
- **Fix**: Add default assetsUrl based on window.location in World.init():
  ```javascript
  if (!this.assetsUrl && typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const host = window.location.host
    this.assetsUrl = `${protocol}//${host}/assets/`
  }
  ```
- **Impact**: All asset:// URLs fail to resolve, causing complete asset loading failure

### Missing Trailing Slash in assetsUrl
- **Error**: 404 errors with malformed URLs like `http://localhost:5000/assetsmp-grinding.glb` (missing slash after assets)
- **Root Cause**: `assetsUrl` not ending with `/` combined with `url.replace('asset://', assetsUrl)`
- **Location**: `src/core/World.js:217-253`
- **Problem**: When `assetsUrl` is `http://localhost:5000/assets` (no trailing slash), asset URLs become malformed
- **Fix**: Normalize assetsUrl and assetsDir to ensure they end with slash in resolveURL:
  ```javascript
  // Ensure assetsUrl ends with slash
  const normalizedAssetsUrl = this.assetsUrl.endsWith('/') ? this.assetsUrl : this.assetsUrl + '/'
  const resolved = url.replace('asset://', normalizedAssetsUrl)
  ```
- **Impact**: All asset URLs malformed, causing 404 errors even when assetsUrl is defined

### Promise Error Handling
- **Error**: Unhandled promise rejections for failed asset loads
- **Location**: `src/core/systems/ClientLoader.js:244-248`
- **Problem**: Failed loads leave promises in cache, causing silent failures on retry
- **Fix**: Add catch block that deletes failed promises from cache and logs errors

### Missing Platformer Animation Files - RESOLVED
- **Error**: 404 errors for platformer animations: `mp-grinding.glb`, `mp-climb-idle.glb`, `mp-climb-up.glb`, `mp-climb-down.glb`, `mp-ledge-hanging-idle.glb`, `mp-ledge-hanging-moving.glb`, `mp-air-dive.glb`, `mp-wallslide.glb`
- **Root Cause**: Platformer animation files in subdirectory `/home/blank/gamedev/src/world/assets/mp-platformer/` but dev server serves from `/home/blank/gamedev/src/world/assets/`
- **Location**: `src/core/extras/playerEmotes.js:28-35`
- **Problem**: Platformer animations configured at root level (`asset://mp-grinding.glb`) but files are in subdirectory
- **Fix**: Move platformer animation files from subdirectory to main assets directory:
  ```bash
  mv /home/blank/gamedev/src/world/assets/mp-platformer/*.glb /home/blank/gamedev/src/world/assets/
  ```
- **Status**: ✅ **RESOLVED** - All platformer animations now load successfully
- **Note**: Basic animations work because they're directly in `/home/blank/gamedev/src/world/assets/` which is the `assetsDir`

### Missing Strafe Jump Animation Files
- **Error**: 404 errors for `emote-jump-left.glb` and `emote-jump-right.glb`
- **Location**: `src/core/extras/playerEmotes.js:24-25`
- **Status**: ⚠️ **Files do not exist**
- **Impact**: STRAFE_JUMP_LEFT and STRAFE_JUMP_RIGHT modes cannot load animations (non-critical, fallback animations work)
- **Note**: These are optional strafe jump animations distinct from platformer mechanics

### Unreachable Code After Return Statement
- **Error**: `▲ [WARNING] The following expression is not returned because of an automatically-inserted semicolon [semicolon-after-return]`
- **Location**: `src/core/extras/createVRMFactory.js:768`
- **Problem**: Code after `return` statement is unreachable and causes build warnings
  ```javascript
  // ❌ WRONG - Unreachable code
  if (currentEmote?.url === url) {
    return
    console.log("[VRM DEBUG] setEmote returning early - same emote already playing") // This never executes!
  }

  // ✅ CORRECT - Code before return
  if (currentEmote?.url === url) {
    console.log("[VRM DEBUG] setEmote returning early - same emote already playing")
    return
  }
  ```
- **Fix**: Move console.log or any code before the return statement
- **Impact**: Build fails with warnings, server won't start
- **Note**: JavaScript automatically inserts semicolons after return statements, making any code on the same line or immediately after unreachable

## Dev Server Issues

### Port 5000 Already In Use

- **Error**: `listen EADDRINUSE: address already in use 0.0.0.0:5000`
- **Root Cause**: Previous server process didn't exit cleanly or another service is using port 5000
- **Fix**: Kill the process using the port before starting dev server:
  ```bash
  lsof -ti:5000 | xargs kill -9
  ```
- **Prevention**: Always stop the dev server with Ctrl+C before restarting

### App-Server Sync Authentication Error

- **Error**: `Error: invalid_code` and `Error: app server exited with code 1`
- **Location**: `app-server/direct.js:228` - WebSocket authentication fails during sync
- **Impact**: App-server sync stops, but **world server continues running and serving requests**
- **Verification**: Check `http://localhost:5000` is accessible even with this error
- **Symptom**: App-server exits but world server remains functional
- **Status**: Non-critical - core world functionality works without app-server sync

### Dev Server Verification Checklist

When `npm run dev` appears to hang or fail:

1. **Check port availability**:
   ```bash
   lsof -ti:5000  # Should return nothing
   ```

2. **Verify server is listening**:
   - Look for: `server listening on port 5000` in output
   - Check: `http://localhost:5000` in browser
   - Test: curl http://localhost:5000

3. **Expected startup sequence**:
   - `> gamedev@0.0.4-alpha.4 dev`
   - `> bash -c 'npm run dev:runtime & node bin/gamedev.mjs app-server & wait'`
   - `> node scripts/build.mjs --dev`
   - `World: Local world detected, waiting for server (http://localhost:5000)`
   - `[assets] initializing`
   - `[clean] running`
   - `server listening on port 5000`
   - `Sync: Starting app-server sync` (may show auth error after this)

4. **Success indicators**:
   - Port 5000 responds to HTTP requests
   - Client interface loads in browser at localhost:5000
   - World assets resolve successfully
   - No EADDRINUSE errors in output

5. **What to ignore**:
   - `Error: invalid_code` from app-server sync (doesn't affect core functionality)
   - Deprecation warnings from fs.Stats
   - THREE.GLTFLoader warnings about textures
   - PhysX warnings about triangle mesh sizes
