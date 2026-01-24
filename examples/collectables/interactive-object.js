console.log('[Interactive Object] Initializing interactive object')

const COLLECTABLES_KEY = 'player_collectables'

app.on('init', () => {
  const objectType = app.get('objectType') || 'door'
  const requiredItem = app.get('requires')
  const useItemOnComplete = app.get('useItem')
  const interactionVerb = app.get('interactionVerb') || 'Use'
  const successMessage = app.get('successMessage') || 'Success!'
  const failureMessage = app.get('failureMessage') || 'You need an item'

  console.log(`[Interactive Object] Configured: ${objectType}`)

  if (requiredItem) {
    console.log(`[Interactive Object] Requires: ${requiredItem}`)
  }

  if (useItemOnComplete) {
    console.log(`[Interactive Object] Consumes: ${useItemOnComplete}`)
  }

  const mesh = app.root
  let isUsed = false
  let isOpen = false

  mesh.on('click', (event) => {
    if (event.playerId !== world.getPlayer()?.data?.id) return
    if (isUsed && objectType !== 'toggle') return

    if (!requiredItem) {
      completeInteraction()
      return
    }

    const currentCollectables = world.get(COLLECTABLES_KEY) || []
    const hasRequired = currentCollectables.includes(requiredItem)

    if (!hasRequired) {
      const requiredItemName = world.get(`collectable:${requiredItem}:name`) || requiredItem
      world.chat(failureMessage.replace('{item}', requiredItemName))
      return
    }

    if (useItemOnComplete) {
      const itemIndex = currentCollectables.indexOf(useItemOnComplete)
      if (itemIndex > -1) {
        currentCollectables.splice(itemIndex, 1)
        world.set(COLLECTABLES_KEY, currentCollectables)

        const usedItemName = world.get(`collectable:${useItemOnComplete}:name`) || useItemOnComplete
        console.log(`[Interactive Object] Consumed: ${usedItemName}`)

        world.emit('collectable:removed', {
          itemId: useItemOnComplete,
          playerId: world.getPlayer()?.data?.id
        })
      }
    }

    completeInteraction()
  })

  function completeInteraction() {
    isUsed = true
    console.log(`[Interactive Object] ${objectType} activated`)

    world.chat(successMessage)

    if (objectType === 'door') {
      animateDoorOpen()
    } else if (objectType === 'fire') {
      lightFire()
    } else if (objectType === 'tree') {
      chopTree()
    } else if (objectType === 'chest') {
      openChest()
    } else if (objectType === 'switch') {
      toggleSwitch()
    }

    world.emit('interactive:used', {
      objectType,
      requiredItem,
      playerId: world.getPlayer()?.data?.id,
      position: mesh.position.toArray()
    })
  }

  function animateDoorOpen() {
    const duration = 1000
    const start = Date.now()
    const startY = mesh.position.y
    const startRotation = mesh.rotation.y

    app.on('update', function animate() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)

      mesh.position.y = startY + ease * 3
      mesh.rotation.y = startRotation + ease * Math.PI / 2

      if (progress >= 1) {
        app.off('update', animate)
      }
    })

    setTimeout(() => {
      mesh.visible = false
    }, duration)
  }

  function lightFire() {
    const fire = app.create('particles', {
      count: 50,
      rate: 0.1,
      life: 1000,
      speed: 0.02,
      spread: 0.5,
      gravity: -0.01,
      color: '#ff6600',
    })
    mesh.add(fire)

    const glow = app.create('pointlight', {
      color: '#ff6600',
      intensity: 2,
      range: 5,
    })
    mesh.add(glow)
  }

  function chopTree() {
    const duration = 500
    const start = Date.now()
    const startScale = mesh.scale.x

    app.on('update', function animate() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)

      const shake = Math.sin(progress * Math.PI * 10) * (1 - progress) * 0.1
      mesh.rotation.z = shake
      mesh.scale.x = startScale * (1 - progress * 0.1)
      mesh.scale.y = startScale * (1 - progress * 0.1)

      if (progress >= 1) {
        app.off('update', animate)
        mesh.visible = false
      }
    })
  }

  function openChest() {
    const lid = mesh.children.find(child => child.name === 'lid')
    if (lid) {
      const duration = 800
      const start = Date.now()
      const startRotation = lid.rotation.x

      app.on('update', function animate() {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)

        lid.rotation.x = startRotation - progress * Math.PI / 3

        if (progress >= 1) {
          app.off('update', animate)
        }
      })
    }
  }

  function toggleSwitch() {
    isOpen = !isOpen

    const targetRotation = isOpen ? Math.PI / 4 : 0
    const duration = 300
    const start = Date.now()
    const startRotation = mesh.rotation.z
    const deltaRotation = targetRotation - startRotation

    app.on('update', function animate() {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)

      mesh.rotation.z = startRotation + deltaRotation * ease

      if (progress >= 1) {
        app.off('update', animate)
      }
    })
  }
})
