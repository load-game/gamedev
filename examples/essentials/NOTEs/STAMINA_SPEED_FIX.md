# Stamina Particles Speed Parameter Fix

## Error
```
Error#2: [particles] speed invalid
```

## Root Cause
The Hyperfy particle system requires the `speed` parameter to be a **string**, not a number.

### Incorrect (Causes Error)
```javascript
speed: 0  // Number - INVALID!
```

### Correct (Fixed)
```javascript
speed: '0'  // String - VALID!
```

## Files Fixed

### 1. `/examples/essentials/stamina-system.js`
**Line 517:** Changed from `speed: 0` to `speed: '0'`

```javascript
// Fixed staminaParticles configuration
staminaParticles = app.create('particles', {
  shape: ['circle', 2, 1],
  direction: 0,
  speed: '0',  // ✅ FIXED: Now a string
  size: '0.15',
  rate: 40,
  life: '2',
  emissive: '300',
  color: '#00ff00',
  alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
  space: 'local',
  looping: true
})
```

### 2. `/examples/essentials/test-particles.js`
**Line 13:** Changed from `speed: 0` to `speed: '0'`

```javascript
// Fixed testParticles configuration
testParticles = app.create('particles', {
  shape: ['circle', 2, 1],
  direction: 0,
  speed: '0',  // ✅ FIXED: Now a string
  size: '0.2',
  rate: 30,
  life: '3',
  emissive: '200',
  color: '#ff0000',
  alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
  space: 'local',
  looping: true
})
```

## Hyperfy Particle System Requirements

Based on analysis of `examples/vfx/heal.js`, the particle system uses string values for:
- `speed` (e.g., `'1'`, `'0'`)
- `size` (e.g., `'0.02'`)
- `life` (e.g., `'2'`, `'3'`)
- `rate` (e.g., `30`, `40`) - numbers are OK for rate

### Numeric vs String Parameters

| Parameter | Type | Example | Required |
|-----------|------|---------|----------|
| `speed` | String | `'0'` | ✅ |
| `size` | String | `'0.15'` | ✅ |
| `life` | String | `'2'` | ✅ |
| `rate` | Number | `40` | ✅ |
| `direction` | Number | `0` | ✅ |
| `emissive` | String | `'300'` | ✅ |

## Why This Happens

The Hyperfy particle system appears to use string parsing for certain parameters (likely for expression evaluation). When a number is passed instead of a string, the parser fails with "speed invalid" error.

### Example from heal.js
```javascript
// heal.js shows correct usage
const dots = app.create('particles', {
  speed: '1',    // ✅ String
  size: '0.03',  // ✅ String
  life: '4',     // ✅ String
  rate: 30,      // ✅ Number is OK for rate
  ...
})
```

## Testing the Fix

### Test 1: Add Stamina System with Debug Enabled

```javascript
const staminaSystem = world.create('app', {
  src: '/examples/essentials/stamina-system.js',
  config: {
    debugMode: true,
    showUnlimitedParticles: true
  }
})
world.add(staminaSystem)
```

Expected: No error, particles should appear when stamina becomes unlimited

### Test 2: Use Test Particles Script

```javascript
const testParticles = world.create('app', {
  src: '/examples/essentials/test-particles.js'
})
world.add(testParticles)
```

Expected: After 1 second, red particles appear at player position

## Expected Result

When collecting a stamina potion, you should now see:
1. ✅ No "speed invalid" error in console
2. ✅ Green particles appear near stamina bar
3. ✅ Particles orbit continuously during unlimited mode
4. ✅ Particles disappear when unlimited mode ends

## Console Logs to Verify

```
[Stamina System] Creating unlimited stamina particles for 10 seconds
[Stamina System] ✓ UNLIMITED STAMINA PARTICLES CREATED AND ACTIVE!
[Stamina System]   Position: 12.34 5.67 -8.90
[Stamina System]   Rate: 40 Size: 0.15 Emissive: 300
```

## Summary

The error was caused by passing numeric values where string values are expected in the Hyperfy particle system. All speed, size, and life parameters must be strings, not numbers.

Fixed files:
- `/examples/essentials/stamina-system.js` (line 517)
- `/examples/essentials/test-particles.js` (line 13)

The particles should now work correctly and appear when unlimited stamina mode is active!
