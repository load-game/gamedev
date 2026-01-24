console.log('[Inventory UI] Initializing inventory display')

const COLLECTABLES_KEY = 'player_collectables'

app.on('init', () => {
  const ui = app.create('ui', {
    x: 0.8,
    y: 0.05,
    width: 0.18,
    height: 0.25,
    color: 'rgba(0, 0, 0, 0.7)',
    pointerEvents: 'none'
  })
  app.add(ui)

  const title = app.create('ui/text', {
    x: 0.02,
    y: 0.02,
    width: 0.16,
    height: 0.04,
    text: 'INVENTORY',
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
    pointerEvents: 'none'
  })
  ui.add(title)

  const inventorySlots = []
  const slotSize = 0.04
  const slotsPerRow = 4
  const margin = 0.01

  function createSlots() {
    inventorySlots.forEach(slot => slot.destroy())
    inventorySlots.length = 0

    const collectables = world.get(COLLECTABLES_KEY) || []

    collectables.forEach((itemId, index) => {
      const row = Math.floor(index / slotsPerRow)
      const col = index % slotsPerRow

      const slot = app.create('ui', {
        x: margin + col * (slotSize + margin),
        y: 0.06 + row * (slotSize + margin),
        width: slotSize,
        height: slotSize,
        color: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)'
      })
      ui.add(slot)
      inventorySlots.push(slot)

      const icon = world.get(`collectable:${itemId}:icon`) || '📦'
      const label = app.create('ui/text', {
        x: 0,
        y: 0,
        width: slotSize,
        height: slotSize,
        text: icon,
        fontSize: 20,
        textAlign: 'center',
        verticalAlign: 'middle',
        pointerEvents: 'none'
      })
      slot.add(label)
    })
  }

  createSlots()

  world.on('collectable:collected', (data) => {
    console.log('[Inventory UI] Item collected:', data.itemName)
    world.set(`collectable:${data.itemId}:icon`, data.itemIcon)
    world.set(`collectable:${data.itemId}:name`, data.itemName)
    createSlots()
  })

  app.on('update', () => {
    ui.visible = !!world.getPlayer()
  })
})
