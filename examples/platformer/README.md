# Hyperfy Platformer System 🎮

A complete 3D platformer framework for Hyperfy with procedural level generation and advanced movement mechanics.

## 🚀 Quick Start

### **For instant platformer action:**
1. Place `platformer-starter.js` in your world
2. Click "🚀 Launch Complete Platformer"
3. Start playing immediately!

### **For world builders:**
1. Use `platformer-level-generator.js` for custom levels
2. Use `platformer-controller.js` for full coordination
3. Mix and match components as needed

## 📁 File Structure

```
platformer/
├── platformer-starter.js       # 🎮 Easy start (RECOMMENDED)
├── platformer-controller.js    # 🧠 Main coordinator
├── platformer-level-generator.js # 🏗️ Level generator + editor
├── platformer-air-dive.js      # 🪂 Air diving mechanics
├── platformer-climbing.js      # 🧗 Wall climbing mechanics
├── platformer-grinding.js      # 🚂 Rail grinding mechanics
├── platformer-ledge.js         # 🪟 Ledge hanging mechanics
├── platform-switcher.js        # 🔘 Simple platform switcher (legacy)
└── README.md                   # This file
```

## 🎯 Core Features

### **Movement Mechanics**
- **Air Diving**: Momentum-based diving with physics (F key)
- **Wall Climbing**: Scalable walls with stamina drain (C key)
- **Rail Grinding**: Curve-based rail sliding (G key)
- **Ledge Hanging**: Suspension mechanics with movement (W+S keys)

### **Level Generation**
- **Procedural Generation**: Randomized, playable level creation
- **World Editor**: Click-to-place platform building
- **Save/Load System**: Persistent level storage
- **Difficulty Scaling**: Adjustable challenge levels

### **Integration**
- **Seamless Coordination**: All mechanics work together
- **UI Controls**: Intuitive configuration interfaces
- **Physics Integration**: PhysX-based movement and collisions

## 🎮 Controls

| Action | Key | Description |
|--------|-----|-------------|
| Move | WASD | Basic movement |
| Jump | Space | Standard jump |
| Air Dive | F (in air) | Momentum-based dive |
| Grind | G (near rail) | Start/stop rail grinding |
| Climb | C (near wall) | Wall climbing |
| Ledge Grab | W+S (near ledge) | Ledge hanging |
| Platform Trigger | Step on platform | Activates falling platforms |

**Special Platform Interactions:**
- **Falling Platforms**: Automatically activate when stepped on (no key needed)
- **Triggers**: Based on `areatrigger.js` pattern with configurable areas

## 🛠️ Usage Examples

### **1. Basic Platformer World Setup**
```javascript
// Just add this to your world:
app.create('app', {
  file: 'examples/platformer/platformer-starter.js',
  position: [0, 0, 0]
})
```

### **2. Custom Procedural Generation**
```javascript
// In your app:
const generator = app.create('app', {
  file: 'examples/platformer/platformer-controller.js',
  props: {
    autoGenerate: true,
    difficulty: 7,
    levelLength: 120,
    seed: 12345 // Reproducible level
  }
})
```

### **3. Level Editor for World Building**
```javascript
// Create level editor:
const editor = app.create('app', {
  file: 'examples/platformer/platformer-level-generator.js',
  props: {
    mode: 'edit', // Enable editing mode
    platformType: 'medium' // Default platform
  }
})
```

## 🏗️ Level Generation API

### **Platform Types**
- `small` - 2x2 basic platforms
- `medium` - 4x3 standard platforms
- `large` - 6x4 wide platforms
- `x-large` - 8x5 massive platforms
- `falling` - Interactive falling platforms with trigger area and physics

#### **Falling Platform System**
Based on your `areatrigger.js` system, falling platforms include:
- **Trigger Area**: Box collider larger than platform for detection
- **Kinematic → Dynamic**: Converts physics type on player contact
- **Configurable Delay**: Customizable fall delay (100-3000ms)
- **Variable Fall Speed**: Adjustable falling speed (1-20)
- **Optional Respawn**: Automatic platform regeneration (5-60 seconds)
- **Physics Wobble**: Random slight movement for realism
- **Cleanup System**: Automatic trigger removal after activation

### **Mechanics**
- `grind` - Rails with curve support
- `climb` - Scalable wall sections
- `ledge` - Horizontal hanging points
- `air-dive` - Large gap areas for diving

### **Generation Parameters**
```javascript
{
  difficulty: 1-10,    // Complexity and challenge
  levelLength: 20-150, // Number of path segments
  includeGrinding: true,   // Add grind rails
  includeClimbing: true,   // Add climbable walls
  includeLedges: true,     // Add ledge points
  includeAirDive: true,    // Add diving areas
  fallDelay: 800,          // Falling platform delay (ms)
  fallSpeed: 8,            // Falling platform speed
  respawnFallingPlatforms: false, // Auto-respawn fallen platforms
  respawnTime: 15          // Respawn time (seconds)
}
```

## 🔧 Advanced Configuration

### **Custom Mechanics Integration**
```javascript
// Extend the system with your own mechanics:
app.on('custom-mechanic-trigger', (playerId, data) => {
  // Your custom logic here
})
```

### **Level Data Structure**
```javascript
// Saved level format:
{
  platforms: [
    {
      type: 'medium',
      position: [x, y, z]
    }
  ],
  mechanics: {
    grindRails: [
      {
        points: [[x,y,z], ...]
      }
    ]
  }
}
```

## 🎨 Asset Requirements

**GLB Assets** (place in your world assets):
- `platform-small.glb`, `platform-medium.glb`, etc.
- `mp-air-dive.glb`, `mp-climb-idle.glb`, etc.
- (See individual mechanic files for specific asset names)

## 🐛 Troubleshooting

### **Common Issues & Solutions**

**❌ "Controls not working"**
- Use `app.control()` API (required in Hyperfy)
- Don't use standard `keydown` events
- Check console for errors

**❌ "Level not generating"**
- Ensure all asset files are available
- Check browser console for missing dependencies
- Verify file paths are correct

**❌ "Mechanics not activating"**
- Make sure `enableMechanics: true` in controller
- Check that player is near trigger areas
- Verify mechanic apps loaded successfully

**❌ "Physics issues"**
- Ensure trigger colliders have `trigger: true`
- Check layer assignments (`environment`, `prop`)
- Verify `collision: true` on platforms

### **Debug Information**
```javascript
// Get system status:
const status = controllerApp.getMechanicStatus()
console.log('Mechanic Status:', status)
```

### **Console Monitoring**
```javascript
// Look for these log messages:
'[PlatformerController] Loaded airDive mechanic'
'[PlatformerStarter] ✅ Complete platformer system launched!'
'[LevelGenerator] Generated 45 platforms and 12 mechanics'
```

## 🚀 Performance Tips

1. **Limit Level Length**: Keep `levelLength` under 150 for smooth performance
2. **Moderate Difficulty**: High difficulty spawns more mechanics
3. **Clear Old Levels**: Use "Clear Everything" before regenerating
4. **Optimize Assets**: Use simple GLB models for platforms

## 🔄 Integration with Existing Worlds

### **Adding to Combat Systems**
```javascript
// Platformer + Combat integration:
world.on('health', ({ playerId, health }) => {
  if (health === 0) {
    // Respawn at platformer start
    player.teleport([0, 5, 10])
  }
})
```

### **Combining with Custom Apps**
```javascript
// Your app + platformer:
app.on('your-game-event', () => {
  // Trigger platformer mechanic
  app.emit('air-dive-available', [playerId, diveArea])
})
```

## 📈 Version History

- **v1.0** - Core system with 4 mechanics
- **v1.1** - Added level generation and editor
- **v1.2** - Unified controller and starter app
- **v1.3** - Improved procedural algorithms

## 🤝 Contributing

**Adding New Mechanics:**
1. Create new file: `platformer-your-mechanic.js`
2. Follow established pattern (`init()`, `update()`, `cleanup()`)
3. Load in `platformer-controller.js`
4. Add controls to `setupInputControls()`

**Testing Your Changes:**
1. Use `platformer-starter.js` for easy testing
2. Check console for loading messages
3. Test mechanics individually and together

## 📞 Support

**Need help?**
1. Check browser console for errors
2. Verify all required assets are loaded
3. Test with `platformer-starter.js` first
4. Check this README for common solutions

---

**🎮 Happy Platforming!**
Built with ❤️ for the Hyperfy community

*For the latest updates and community examples, check the Hyperfy Discord!*