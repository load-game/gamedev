console.log('[Collectable] Initializing collectable item')

const COLLECTABLES_KEY = 'player_collectables'

app.on('init', () => {
  const itemId = app.get('itemId') || 'item_' + Math.random().toString(36).substr(2, 9)
  const itemName = app.get('itemName') || 'Item'
  const itemIcon = app.get('itemIcon') || '📦'
  const collectOn = app.get('collectOn') || 'click'
  const requiredItem = app.get('requires')
  const pickupRange = app.get('pickupRange') || 2

  console.log(`[Collectable] Configured: ${itemName} (${itemId})`)
  console.log(`[Collectable] Collect on: ${collectOn}`)

  if (requiredItem) {
    console.log(`[Collectable] Requires: ${requiredItem}`)
  }

  const mesh = app.root
  let originalScale = mesh.scale.x
  let canCollect = false

  function checkCollection() {
    if (canCollect || !mesh.visible) return

    const player = world.getPlayer()
    if (!player) return

    const distance = mesh.position.distanceTo(player.position)

    if (distance <= pickupRange) {
      if (requiredItem) {
        const currentCollectables = world.get(COLLECTABLES_KEY) || []
        const hasRequired = currentCollectables.includes(requiredItem)

        if (!hasRequired) {
          console.log(`[Collectable] Need ${requiredItem} to collect ${itemName}`)
          return
        }
      }

      collectItem()
    }
  }

  function collectItem() {
    canCollect = true
    console.log(`[Collectable] Collected: ${itemName}`)

    const currentCollectables = world.get(COLLECTABLES_KEY) || []
    if (!currentCollectables.includes(itemId)) {
      currentCollectables.push(itemId)
      world.set(COLLECTABLES_KEY, currentCollectables)

      world.emit('collectable:collected', {
        itemId,
        itemName,
        itemIcon,
        playerId: world.getPlayer()?.data?.id
      })
    }

    mesh.visible = false

    app.setTimeout(() => {
      canCollect = false
    }, 1000)
  }

  if (collectOn === 'click') {
    mesh.on('click', (event) => {
      if (event.playerId !== world.getPlayer()?.data?.id) return

      if (requiredItem) {
        const currentCollectables = world.get(COLLECTABLES_KEY) || []
        const hasRequired = currentCollectables.includes(requiredItem)

        if (!hasRequired) {
          world.chat(`You need ${requiredItem} first!`)
          return
        }
      }

      collectItem()
    })

    app.on('update', () => {
      mesh.rotation.y += 0.02
    })

  } else if (collectOn === 'proximity') {
    app.on('update', checkCollection)

    let bobTime = 0
    app.on('update', () => {
      bobTime += 0.05
      mesh.position.y += Math.sin(bobTime) * 0.01
    })
  }
})
