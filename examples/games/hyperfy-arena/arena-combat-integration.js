// 🔥 Hyperfy Arena - Combat Integration
// Integrates with Elementals combat system for arena battles

app.configure({
  name: 'Hyperfy Arena Combat Integration',
  description: 'Connects arena matches with Elementals combat system'
})

const COMBAT_CONFIG = {
  // Weapon loadouts for arena spawns
  defaultLoadout: {
    health: 100,
    weapons: ['elemental-item-pistol.js', 'elemental-item-sword.js'],
    ammo: {
      pistol: 50,  // Ammo for pistol
    }
  },

  // Arena combat modifiers
  damageMultiplier: 1.0,    // Can be adjusted for balance
  selfDamage: false,        // Prevent self-damage
  friendlyFire: false,      // Prevent team damage (if teams added later)
  spawnProtection: true,    // Invulnerability after spawn
}

let elementalSystemLoaded = false
let arenaSystemReady = false

// Initialize combat integration
app.on('init', () => {
  console.log('⚔️ Initializing Arena Combat Integration...')

  // Wait for arena systems to be ready
  world.on('arena:map-ready', () => {
    arenaSystemReady = true
    tryInitializeCombat()
  })

  // Check if Elementals combat system is available
  checkElementalsSystem()
})

function checkElementalsSystem() {
  // Check if elemental-combat.js is loaded
  if (world.emit && typeof world.emit === 'function') {
    // Test if we can emit to elemental combat events
    setTimeout(() => {
      elementalSystemLoaded = true
      console.log('✅ Elementals combat system detected')
      tryInitializeCombat()
    }, 1000)
  } else {
    console.warn('⚠️ Elementals combat system not found - arena combat may be limited')
    setTimeout(checkElementalsSystem, 2000)
  }
}

function tryInitializeCombat() {
  if (!elementalSystemLoaded || !arenaSystemReady) return

  console.log('🔗 Initializing combat integration...')
  setupCombatEvents()
  setupWeaponSystem()
}

function setupCombatEvents() {
  console.log('📡 Setting up combat event handlers...')

  // Listen to player damage from elemental combat
  world.on('elemental-combat:player-damaged', (playerId, damage, dealerId, isCritical) => {
    if (!isValidArenaCombat(playerId, dealerId)) return

    console.log(`🩸 Arena combat: Player ${playerId} took ${damage} damage from ${dealerId}`)

    // Apply damage multiplier
    const finalDamage = Math.floor(damage * COMBAT_CONFIG.damageMultiplier)

    // Check spawn protection
    if (hasSpawnProtection(playerId)) {
      console.log(`🛡️ Player ${playerId} has spawn protection`)
      return
    }

    // Forward damage event to arena with modified damage
    world.emit('arena:player-damaged', [playerId, finalDamage, dealerId, isCritical])
  })

  // Listen to player death from elemental combat
  world.on('elemental-combat:player-died', (playerId, killerId) => {
    if (!isValidArenaCombat(playerId, killerId)) return

    console.log(`💀 Arena combat: Player ${playerId} eliminated by ${killerId}`)

    // Forward death event to arena system
    world.emit('arena:player-eliminated', [playerId, killerId])
  })

  // Listen to weapon hits
  world.on('elemental-item:hit', (targetId, dealerId, damage, weaponType) => {
    console.log(`🎯 Weapon hit: ${weaponType} - ${dealerId} -> ${targetId} (${damage} dmg)`)
  })
}

function setupWeaponSystem() {
  console.log('🔫 Setting up arena weapon system...')

  // When players spawn, give them arena loadout
  world.on('arena:player-spawned', (data) => {
    const { playerId } = data
    equipPlayerWithLoadout(playerId)
  })

  // When match starts, ensure all players have weapons
  world.on('arena:match-started', (data) => {
    const { players } = data
    players.forEach(playerId => {
      equipPlayerWithLoadout(playerId)
    })
  })
}

function equipPlayerWithLoadout(playerId) {
  const player = world.entities[playerId]
  if (!player?.playerProxy) return

  console.log(`🎒 Equipping player ${playerId} with arena loadout`)

  // Reset health to full
  player.playerProxy.heal(100)

  // Give arena loadout
  // Note: This would need to be adapted based on how elemental-core.js handles inventory
  try {
    // Try to give weapons using elemental inventory system
    if (world.emit) {
      world.emit('elemental-core:give-item', [playerId, 'pistol', 1])
      world.emit('elemental-core:give-item', [playerId, 'sword', 1])
      world.emit('elemental-core:give-ammo', [playerId, 'pistol', COMBAT_CONFIG.defaultLoadout.ammo.pistol])
    }
  } catch (e) {
    console.warn('Could not give arena weapons through elemental system:', e)

    // Fallback: try direct method if available
    if (player.giveItem) {
      try {
        player.giveItem('pistol_arena', { ammo: COMBAT_CONFIG.defaultLoadout.ammo.pistol })
        player.giveItem('sword_arena', {})
      } catch (e2) {
        console.warn('Fallback weapon generation failed:', e2)
      }
    }
  }
}

function isValidArenaCombat(playerId, dealerId) {
  // Check if this is valid arena combat during active match
  const matchState = app.getMatchState?.()
  if (!matchState || matchState.state !== 'active') return false

  // Prevent self-damage
  if (COMBAT_CONFIG.selfDamage === false && playerId === dealerId) return false

  // Check if players are in valid arena positions
  const player = world.entities[playerId]
  const dealer = world.entities[dealerId]

  if (!player || !dealer) return false

  // This would use the arena map's boundary checking
  // For now, assume all players in match are valid
  return true
}

function hasSpawnProtection(playerId) {
  if (!COMBAT_CONFIG.spawnProtection) return false

  const matchState = app.getMatchState?.()
  if (!matchState) return false

  const playerStats = matchState.stats?.find(([id, stats]) => id === playerId)
  if (!playerStats) return false

  const [, stats] = playerStats
  return Date.now() < stats.spawnProtectionUntil
}

// Bridge between arena damage events and elemental combat
function applyDamageToPlayer(playerId, damage, dealerId, isCritical = false) {
  const player = world.entities[playerId]
  if (!player?.playerProxy) return

  console.log(`⚔️ Applying ${damage} damage to player ${playerId}`)

  try {
    // Use elemental combat system for damage
    if (world.emit) {
      world.emit('elemental-combat:apply-damage', [playerId, damage, dealerId, isCritical])
    } else {
      // Fallback: direct damage
      player.playerProxy.damage(damage)
    }
  } catch (e) {
    console.error('Failed to apply damage through elemental system:', e)
    // Last resort: direct damage
    player.playerProxy.damage(damage)
  }
}

// UI Helper: Show damage numbers above players
function showDamageNumber(playerId, damage, isCritical = false) {
  const player = world.entities[playerId]
  if (!player) return

  try {
    const damageText = app.create('text', {
      name: `Damage_${playerId}_${Date.now()}`,
      position: [player.position[0], player.position[1] + 2, player.position[2]],
      rotation: [0, 0, 0],
      scale: [0.5, 0.5, 0.5],
      collisionEnabled: false,
      visible: true,
      text: isCritical ? `${damage}!` : damage.toString(),
      fontSize: isCritical ? 3 : 2,
      color: isCritical ? [1, 0.2, 0.2] : [1, 0.8, 0.2],
      billboard: true
    })

    // Animate and remove damage number
    setTimeout(() => {
      if (damageText) {
        damageText.position[1] += 1
        damageText.material.opacity = 0.5
      }
    }, 500)

    setTimeout(() => {
      try {
        if (damageText) damageText.destroy()
      } catch (e) {
        // Already destroyed
      }
    }, 2000)
  } catch (e) {
    console.warn('Could not create damage number:', e)
  }
}

// Combat balance utilities
function getWeaponDamage(weaponType, isCritical = false) {
  const baseDamages = {
    pistol: { min: 15, max: 25 },
    sword: { min: 20, max: 35 }
  }

  const weapon = baseDamages[weaponType]
  if (!weapon) return 10

  let damage = Math.floor(Math.random() * (weapon.max - weapon.min + 1)) + weapon.min
  damage = Math.floor(damage * COMBAT_CONFIG.damageMultiplier)

  return isCritical ? damage * 2 : damage
}

function calculateCriticalHit(chance = 0.2) {
  return Math.random() < chance
}

// Public API for other arena systems
app.applyArenaDamage = (playerId, dealerId, weaponType) => {
  const isCritical = calculateCriticalHit()
  const damage = getWeaponDamage(weaponType, isCritical)

  showDamageNumber(playerId, damage, isCritical)
  applyDamageToPlayer(playerId, damage, dealerId, isCritical)

  return { damage, isCritical }
}

app.healPlayer = (playerId, amount) => {
  const player = world.entities[playerId]
  if (!player?.playerProxy) return

  player.playerProxy.heal(amount)
  console.log(`💚 Healed player ${playerId} for ${amount} HP`)

  // Show heal number
  showDamageNumber(playerId, `+${amount}`, false)
}

app.getCombatStats = (playerId) => {
  const player = world.entities[playerId]
  if (!player?.playerProxy) return null

  return {
    health: player.playerProxy.health,
    maxHealth: player.playerProxy.maxHealth || 100,
    isAlive: player.playerProxy.health > 0
  }
}

// Debug utilities
app.debugCombatState = () => {
  const matchState = app.getMatchState?.()
  const players = Object.keys(world.entities).filter(id => world.entities[id]?.isPlayer)

  console.log('🔧 Combat Debug Info:')
  console.log('- Match State:', matchState?.state || 'unknown')
  console.log('- Players in arena:', players.length)
  console.log('- Elementals loaded:', elementalSystemLoaded)
  console.log('- Arena ready:', arenaSystemReady)

  players.forEach(playerId => {
    const stats = app.getCombatStats(playerId)
    console.log(`- Player ${playerId}: HP ${stats?.health}/${stats?.maxHealth}`)
  })
}

console.log('⚔️ Hyperfy Arena Combat Integration script loaded')