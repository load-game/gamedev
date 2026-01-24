/**
 * Elemental Combat
 *
 * - Player damage number visuals
 * - Mob damage number visuals
 * - Healing over time
 * - Death animation
 * - Death respawn
 * - Mob combat integration
 *
 */

app.configure([
  {
    key: 'enabled',
    type: 'switch',
    label: 'Enabled',
    options: [
      { label: 'No', value: false },
      { label: 'Yes', value: true },
    ],
    initial: true,
  },
  {
    key: 'setspawn',
    type: 'buttons',
    label: 'Spawn',
    buttons: [
      { label: 'Set', onClick: () => app.send('set-spawn') },
      { label: 'Clear', onClick: () => app.send('clear-spawn') },
    ],
  },
  {
    key: 'death',
    type: 'section',
    label: 'Death',
  },
  {
    key: 'deathEmote',
    type: 'file',
    kind: 'emote',
    label: 'Emote',
  },
  {
    key: 'deathDuration',
    type: 'number',
    label: 'Duration',
    initial: 5,
  },
  {
    key: 'heal',
    type: 'section',
    label: 'Healing',
  },
  {
    key: 'healInterval',
    type: 'number',
    label: 'Interval',
    initial: 2,
  },
  {
    key: 'healAmount',
    type: 'number',
    label: 'Amount',
    initial: 10,
  },
  {
    key: 'mobCombat',
    type: 'section',
    label: 'Mob Combat',
  },
  {
    key: 'showMobDamage',
    type: 'switch',
    label: 'Show Mob Damage Numbers',
    options: [
      { label: 'No', value: false },
      { label: 'Yes', value: true },
    ],
    initial: true,
  },
])

const enabled = props.enabled
const deathEmote = props.deathEmote ? props.deathEmote.url + '?l=0' : null
const deathDuration = props.deathDuration
const healInterval = props.healInterval
const healAmount = props.healAmount
const showMobDamage = props.showMobDamage !== false

if (!enabled) return

/**
 * Server Logic
 */

if (world.isServer) {
  // check for saved spawn, with fallback in front of tombstone
  const defaultSpawn = app.position.clone()
  const direction = new Vector3(0, 0, 1).applyQuaternion(app.quaternion)
  const projection = new Vector3().copy(direction).multiplyScalar(1)
  defaultSpawn.add(projection)
  let customSpawn
  const customSpawnArr = world.get('elemental-combat:spawn')
  if (customSpawnArr) {
    customSpawn = new Vector3().fromArray(customSpawnArr)
  }
  // watch player health changes
  // when they have no health, play death animation and then respawn with full health
  world.on('health', ({ playerId, health }) => {
    console.log('[elemental-combat] Health event:', playerId, health)
    if (health === 0) {
      console.log('[elemental-combat] Player died, applying death effect')
      const player = world.getPlayer(playerId)
      if (!player) {
        console.error('[elemental-combat] Player not found:', playerId)
        return
      }
      player.applyEffect({
        emote: deathEmote,
        duration: deathDuration,
        freeze: true,
        onEnd: () => {
          console.log('[elemental-combat] Respawning player', playerId)
          player.teleport(customSpawn || defaultSpawn)
          player.heal()
        },
      })
    }
  })
  // heal players not at full health at a set interval and amount
  let elapsed = 0
  app.on('update', delta => {
    elapsed += delta
    if (elapsed < healInterval) return
    elapsed = 0
    const players = world.getPlayers()
    for (const player of players) {
      if (player.health > 0 && player.health < 100) {
        player.heal(healAmount)
      }
    }
  })
  // listen for client changing spawn
  app.on('set-spawn', (_, playerId) => {
    const player = world.getPlayer(playerId)
    if (!player) return
    if (!player.isAdmin) return
    customSpawn = player.position.clone()
    world.set('elemental-combat:spawn', customSpawn.toArray())
  })
  app.on('clear-spawn', (_, playerId) => {
    const player = world.getPlayer(playerId)
    if (!player) return
    if (!player.isAdmin) return
    customSpawn = null
    world.set('elemental-combat:spawn', null)
  })

  // Handle dead queries for mobs and players
  world.on('elemental:dead_request', ([type, id, responseId]) => {
    let isDead = false

    if (type === 'player') {
      const player = world.getPlayer(id)
      isDead = player ? player.health === 0 : false
    }
    // Mobs are assumed alive (mob app tracks its own state)

    app.emit(`elemental:dead_response:${responseId}`, isDead)
  })

  // Handle mob damage forwarding
  world.on('elemental-mob:hit', ([mobId, fromPlayerId, amount, crit]) => {
    console.log(`[elemental-combat] Forwarding mob damage - mobId: ${mobId}, from: ${fromPlayerId}, amount: ${amount}`)
    app.emit(`elemental-mob:hit:${mobId}`, [fromPlayerId, amount, crit])
    console.log(`[elemental-combat] Emitted elemental-mob:hit:${mobId} (via app.emit)`)
  })
}

/**
 * Client Logic
 */

if (world.isClient) {
  const v1 = new Vector3()
  const maxDistance = 20
  const localPlayer = world.getPlayer()

  // listen to players taking damage and display numbers above their head
  world.on('elemental-item:dmg', ([playerId, amount, crit]) => {
    showNumber(playerId, amount, crit)
  })

  // listen to mobs taking damage and display numbers above them
  world.on('elemental-mob:dmg', ([mobId, amount, crit]) => {
    if (showMobDamage) {
      showMobNumber(mobId, amount, crit)
    }
  })

  function showNumber(playerId, amount, crit) {
    const player = world.getPlayer(playerId)
    if (!player) return
    const distance = localPlayer.position.distanceTo(player.position)
    if (distance > maxDistance) return
    const $ui = app.create('ui', {
      width: crit ? 30 : 15,
      height: crit ? 30 : 15,
      billboard: 'full',
      alignItems: 'center',
      justifyContent: 'center',
    })
    const $text = app.create('uitext', {
      value: amount,
      fontWeight: 800,
      fontSize: crit ? 16 : 8,
      color: crit ? '#d82424' : 'white',
    })
    $ui.add($text)
    world.add($ui)
    $ui.position.copy(player.position)
    $ui.position.y += (player.height || 1.7) + 0.3
    const x = num(-0.5, 0.5, 1)
    const z = num(-0.5, 0.5, 1)
    const dir = new Vector3(x, 1, z)
    const time = 1
    const speed = 0.3
    let elapsed = 0
    function update(delta) {
      v1.copy(dir).multiplyScalar(speed * delta)
      $ui.position.add(v1)
      elapsed += delta
      if (elapsed > time) {
        world.remove($ui)
        app.off('update', update)
      }
    }
    app.on('update', update)
  }

  function showMobNumber(mobId, amount, crit) {
    // Find the mob by its instance ID
    const mob = world.apps.find(app => app.instanceId === mobId)
    if (!mob) return

    const mobPosition = mob.position
    const distance = localPlayer.position.distanceTo(mobPosition)
    if (distance > maxDistance) return

    const $ui = app.create('ui', {
      width: crit ? 30 : 15,
      height: crit ? 30 : 15,
      billboard: 'full',
      alignItems: 'center',
      justifyContent: 'center',
    })
    const $text = app.create('uitext', {
      value: amount,
      fontWeight: 800,
      fontSize: crit ? 16 : 8,
      color: crit ? '#d82424' : 'orange', // Orange for mob damage
    })
    $ui.add($text)
    world.add($ui)
    $ui.position.copy(mobPosition)
    $ui.position.y += 2 // Higher for mobs
    const x = num(-0.5, 0.5, 1)
    const z = num(-0.5, 0.5, 1)
    const dir = new Vector3(x, 1, z)
    const time = 1
    const speed = 0.3
    let elapsed = 0
    function update(delta) {
      v1.copy(dir).multiplyScalar(speed * delta)
      $ui.position.add(v1)
      elapsed += delta
      if (elapsed > time) {
        world.remove($ui)
        app.off('update', update)
      }
    }
    app.on('update', update)
  }
}
