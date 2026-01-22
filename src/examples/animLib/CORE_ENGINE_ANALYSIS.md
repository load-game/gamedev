# Hyperfy Core Engine Analysis
## Animation Selection Support Investigation

## Root Cause Found

**Location:** `/home/blank/hyperfy/src/core/extras/createEmoteFactory.js:10`

```javascript
const clip = glb.animations[0]
```

**Problem:** The function hardcodes `animations[0]`, selecting only the first animation from combined GLB files.

## How Player Animations Work in Hyperfy

### Data Flow:
1. **App calls:** `player.applyEffect({emote: url})`
2. **Proxy forwards:** `setEffect()` → `player.data.effect = {emote: url}`
3. **PlayerLocal update:** Reads `this.data.effect.emote`
4. **Avatar.setEmote:** Called with the URL
5. **VRM Factory loads:** `hooks.loader.load('emote', url)`
6. **ClientLoader:** Parses GLB → `createEmoteFactory(glb, url)`
7. **Emote factory:** Returns `{toClip(options) { return factory.toClip(options) }}`
8. **VRM Factory:** Calls `emo.toClip()` to get animation clip

### Current Limitation:
- URL parameters (`?name=AnimationName`) are parsed via `getQueryParams(url)`
- Only used for: `loop`, `speed`, `gaze` options
- **Not used for:** Animation selection from `glb.animations[]`

## Proposed Solution

### Option 1: Modify createEmoteFactory (Minimal Change)

**Changes needed:**
1. Pass URL query params to `createEmoteFactory(glb, url, queryParams)`
2. Parse animation name: `const animName = queryParams.name`
3. Find animation: `const clip = glb.animations.find(a => a.name === animName) || glb.animations[0]`

**Files to modify:**
- `/home/blank/hyperfy/src/core/extras/createEmoteFactory.js` - Add animation selection
- `/home/blank/hyperfy/src/core/systems/ClientLoader.js` - Pass query params to factory
- `/home/blank/hyperfy/src/core/extras/createVRMFactory.js` - Use selected animation

### Option 2: New "animation" Loader Type (Cleaner)

**Create explicit support for combined animation files:**
```javascript
// New loader type in ClientLoader.js
if (type === 'animation') {
  const buffer = await file.arrayBuffer()
  const glb = await this.gltfLoader.parseAsync(buffer)
  return {
    animations: glb.animations, // Return all animations
    toClip(name, options) {
      const clip = glb.animations.find(a => a.name === name)
      if (!clip) throw new Error(`Animation "${name}" not found`)
      return createRetargetedClip(clip, options)
    }
  }
}
```

## Implementation Approach

### Recommended: Option 1 (Quick Fix)

1. **In createEmoteFactory.js:**
```javascript
export function createEmoteFactory(glb, url, queryParams = {}) {
  // Select animation by name from URL
  const animName = queryParams.name || queryParams.animation
  let clip = glb.animations[0] // default

  if (animName && glb.animations.length > 1) {
    clip = glb.animations.find(a => a.name === animName) || clip
  }
  // ... rest of function unchanged
}
```

2. **In ClientLoader.js:**
```javascript
if (type === 'emote') {
  const buffer = await file.arrayBuffer()
  const glb = await this.gltfLoader.parseAsync(buffer)
  const queryParams = getQueryParams(url) // Parse URL params
  const factory = createEmoteFactory(glb, url, queryParams) // Pass them
  // ...
}
```

3. **In createVRMFactory.js:**
```javascript
// Parse query params and pass them to toClip()
const opts = getQueryParams(url)
const loop = opts.l !== '0'
const speed = parseFloat(opts.s || 1)
const gaze = opts.g == '1'
const animName = opts.name || opts.animation // Get animation name

// Pass animation name in options
currentEmote = emotes[url]
if (currentEmote.action) {
  currentEmote.loop = loop
  currentEmote.action.clampWhenFinished = !loop
  currentEmote.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
  currentEmote.action.timeScale = speed
}
```

## Testing

Once implemented, test with:
```javascript
// Should play pistol shoot animation from combined GLB
player.applyEffect({
  emote: 'asset://03c758d3eef806abea5b8a1fdf15d6e5c8f527e3888ab840ab74a9a3b789e42f.glb?name=VRM|PistolShoot@15'
})
```

## Benefits

1. **No GLB splitting needed** - Use combined animation files
2. **Backward compatible** - Still works with single-animation GLBs
3. **URL-based selection** - Easy to use with existing URL format
4. **No app changes needed** - Works with current `player.applyEffect()` API

## Estimated Effort

**Option 1:** ~30 minutes to implement
**Option 2:** ~1-2 hours (cleaner architecture)

Both options are technically feasible and would solve the core issue. The limitation is purely in the Hyperfy engine, not Three.js or the file format.
