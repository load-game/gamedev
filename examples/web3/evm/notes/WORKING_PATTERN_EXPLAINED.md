# Hyperfy UI Event Pattern - Why Our Apps Weren't Working

> **📚 Complete Reference**: See [UI_EVENT_HANDLERS.md](./UI_EVENT_HANDLERS.md) for comprehensive event handler documentation including all available handlers, best practices, and debugging tips.

## 🎯 The Critical Issue: Event Handler Pattern

### ❌ What We Were Doing (WRONG)
```javascript
// This looks right but doesn't work in Hyperfy:
button.on('click', async () => {
  // Handler code
})
```

**Result**: `button.on is not a function` error

### ✅ What Works (CORRECT)
```javascript
// Direct property assignment:
button.onPointerDown = async () => {
  // Handler code
}
```

## 📚 Why This Matters

Looking at the working `/examples/web3/` files (starknetkit, cartridge, etc.), they ALL use direct property assignment for event handlers.

### Working Pattern from web3 examples:

```javascript
// From cartridge-dashboard.js:
connectButton.onClick = () => {
  world.web3.connect()
}

// From starknetkit:
quickConnectBox.onPointerDown = () => {
  quickConnect()
}
```

## 🔍 The Pattern

In Hyperfy's SES environment:
- **Node types** (UIView, etc.) have event handlers as **direct properties**
- **NOT** EventEmitter-style `.on()` methods
- Simple assignment: `element.onEventName = function`

## ✅ Complete Working Pattern

```javascript
// 1. Create UI container
const ui = app.create('ui', { ... })

// 2. Create text (child of ui)
const status = app.create('uitext', { ... })

// 3. Create button container (UIView)
const buttonView = app.create('uiview', {
  width: 276,
  height: 36,
  backgroundColor: '#00a000',
  cursor: 'pointer'  // Shows it's clickable
})

// 4. Create button text (child of buttonView)
const buttonText = app.create('uitext', {
  value: 'Connect',
  color: '#ffffff'
})

// 5. Add text to view, view to ui, ui to app
buttonView.add(buttonText)
ui.add(status)
ui.add(buttonView)
app.add(ui)

// 6. Attach handlers (direct assignment!)
buttonView.onPointerDown = () => {
  // Click/tap handler
}

buttonView.onPointerOver = () => {
  // Mouse/touch enter
}

buttonView.onPointerOut = () => {
  // Mouse/touch leave
}
```

## 📋 Event Handler Names

Common event handlers in Hyperfy:
- `onPointerDown` - Click/tap (PREFERRED for buttons)
- `onPointerUp` - Mouse/touch release
- `onPointerOver` - Mouse/touch enter (hover)
- `onPointerOut` - Mouse/touch leave (hover end)
- `onPointerMove` - Mouse/touch move

## 🎯 Summary

**Always use direct property assignment for event handlers in Hyperfy:**
```javascript
// ✅ CORRECT
button.onPointerDown = () => { ... }
view.onPointerDown = () => { ... }

// ❌ WRONG
button.on('click', () => { ... })
button.addEventListener('click', () => { ... })
```

This is why our attempts kept failing - we were using standard JavaScript patterns that don't work in Hyperfy's restricted SES environment.

The `/examples/web3/` files work because they follow this exact pattern.
