console.log('[Adventure World] Setting up collectables demo')

world.set('player_collectables', [])

const items = [
  { id: 'key_blue', name: 'Blue Key', icon: '🔵', position: [3, 1, -5] },
  { id: 'key_red', name: 'Red Key', icon: '🔴', position: [-4, 1, -3] },
  { id: 'matches', name: 'Matches', icon: '🔥', position: [0, 1, -7] },
  { id: 'axe', name: 'Axe', icon: '🪓', position: [5, 1, -2] },
  { id: 'coin', name: 'Coin', icon: '🪙', position: [-3, 1, -8], collectOn: 'proximity' }
]

const interactive = [
  {
    type: 'door',
    position: [-8, 1.5, -5],
    color: '#4169E1',
    requires: 'key_blue',
    useItem: 'key_blue',
    successMessage: 'The blue door opens!'
  },
  {
    type: 'door',
    position: [8, 1.5, -5],
    color: '#DC143C',
    requires: 'key_red',
    useItem: 'key_red',
    successMessage: 'The red door opens!'
  },
  {
    type: 'fire',
    position: [0, 0.5, -12],
    color: '#8B4513',
    requires: 'matches',
    useItem: 'matches',
    successMessage: 'You light the fire!'
  },
  {
    type: 'tree',
    position: [-6, 2, -8],
    color: '#228B22',
    requires: 'axe',
    successMessage: 'You chop down the tree!'
  },
  {
    type: 'chest',
    position: [6, 0.5, -8],
    color: '#FFD700',
    requires: 'coin',
    successMessage: 'The treasure chest opens!'
  }
]

items.forEach((item, index) => {
  const collectable = app.create('app', {
    position: item.position,
    blueprint: {
      app: '/examples/collectables/collectable-item.js',
      props: {
        itemId: item.id,
        itemName: item.name,
        itemIcon: item.icon,
        collectOn: item.collectOn || 'click',
        pickupRange: 2
      }
    }
  })
  app.add(collectable)

  const visual = collectable.create('prim', {
    type: 'box',
    size: [0.3, 0.3, 0.3],
    color: item.id.includes('key') ? '#FFD700' : '#888888'
  })
  collectable.add(visual)

  const label = collectable.create('ui/text', {
    text: item.icon,
    fontSize: 24,
    color: '#ffffff',
    x: 0.5,
    y: 0.5
  })
  visual.add(label)
})

interactive.forEach(obj => {
  const interactiveObj = app.create('app', {
    position: obj.position,
    blueprint: {
      app: '/examples/collectables/interactive-object.js',
      props: {
        objectType: obj.type,
        requires: obj.requires,
        useItem: obj.useItem,
        successMessage: obj.successMessage,
        failureMessage: `You need a ${obj.requires}!`,
        interactionVerb: obj.type === 'door' ? 'Unlock' : 'Use'
      }
    }
  })
  app.add(interactiveObj)

  if (obj.type === 'door') {
    const door = interactiveObj.create('prim', {
      type: 'box',
      size: [0.2, 3, 1.5],
      color: obj.color
    })
    interactiveObj.add(door)
  } else if (obj.type === 'fire') {
    const firepit = interactiveObj.create('prim', {
      type: 'cylinder',
      size: [1, 0.2, 1],
      color: obj.color
    })
    interactiveObj.add(firepit)
  } else if (obj.type === 'tree') {
    const trunk = interactiveObj.create('prim', {
      type: 'cylinder',
      size: [0.5, 4, 0.5],
      color: obj.color
    })
    interactiveObj.add(trunk)

    const leaves = interactiveObj.create('prim', {
      type: 'sphere',
      size: [2, 2, 2],
      color: '#90EE90',
      position: [0, 3, 0]
    })
    interactiveObj.add(leaves)
  } else if (obj.type === 'chest') {
    const chestBase = interactiveObj.create('prim', {
      type: 'box',
      size: [1.5, 0.8, 1],
      color: obj.color
    })
    interactiveObj.add(chestBase)

    const chestLid = interactiveObj.create('prim', {
      type: 'box',
      size: [1.6, 0.3, 1.1],
      position: [0, 0.55, 0],
      name: 'lid',
      color: obj.color
    })
    chestBase.add(chestLid)
  }
})

const inventoryUI = app.create('app', {
  blueprint: {
    app: '/examples/collectables/inventory-ui.js'
  }
})
app.add(inventoryUI)

const spawnPoint = [0, 1.5, 0]
const player = world.getPlayer()
if (player) {
  player.position.set(...spawnPoint)
}

console.log('[Adventure World] Setup complete!')
console.log('[Adventure World] Find and collect items, then use them on matching objects')
