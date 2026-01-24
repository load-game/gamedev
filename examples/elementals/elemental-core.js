/**
 * Elemental Core
 *
 * - ItemRegistry
 * - ItemDB
 * - ActionBar
 * - Backpack
 *
 */

if (world.isServer) {
  const specs = {
    // [itemId]: { id, icon, name, desc, stack }
  }
  const invs = {
    // [playerId]: {
    //   active: 0,
  }
  //   items: [{ id, qty }],
  // }
  const ammoCounts = {
    // [playerId]: { [itemId]: { ammo, maxAmmo } }
  }
  function getInv(playerId) {
    let inv = invs[playerId]
    if (!inv) {
      const key = `elemental-core:items:${playerId}`
      // world.set(key, null)
      inv = world.get(key) || {
        active: 0,
        items: new Array(20).fill(null),
      }
      invs[playerId] = inv
    }
    return inv
  }
  function getAmmoCounts(playerId) {
    let ammo = ammoCounts[playerId]
    if (!ammo) {
      ammo = {}
      ammoCounts[playerId] = ammo
    }
    return ammo
  }
  function save(playerId) {
    const inv = getInv(playerId)
    const key = `elemental-core:items:${playerId}`
    world.set(key, inv)
  }
  // when players enter send them their inventory
  world.on('enter', e => {
    const inv = getInv(e.playerId)
    const ammo = getAmmoCounts(e.playerId)
    app.sendTo(e.playerId, 'init', {
      specs,
      ...inv,
      ammoCounts: ammo,
    })
    // let active item know to activate for player
    const item = inv.items[inv.active]
    if (item) {
      app.emit(`elemental-core:activate:${item.id}`, e.playerId)
    }
  })
  // listen for new or modified items
  world.on('elemental-item:spec', spec => {
    // update specs on client
    specs[spec.id] = spec
    app.send('spec', spec)
    // find players that currently have this item active
    // and let the item know to activate for that player
    for (const playerId in invs) {
      const inv = invs[playerId]
      const item = inv.items[inv.active]
      if (item && item.id === spec.id) {
        app.emit(`elemental-core:activate:${spec.id}`, playerId)
      }
    }
  })
  // listen to player changing active slot
  app.on('active', (idx, playerId) => {
    const inv = getInv(playerId)
    if (inv.active === idx) return
    const currItem = inv.items[inv.active]
    if (currItem) {
      app.emit(`elemental-core:deactivate:${currItem.id}`, playerId)
    }
    inv.active = idx
    const newItem = inv.items[inv.active]
    if (newItem) {
      app.emit(`elemental-core:activate:${newItem.id}`, playerId)
    }
    save(playerId)
  })
  // listen to play moving items
  app.on('move', ([a, b], playerId) => {
    const inv = getInv(playerId)
    if (typeof a !== 'number') return console.error('player attempt to move but A is NaN')
    if (typeof b !== 'number') return console.error('player attempt to move but B is NaN')
    if (!inv.items[a]) return console.error('player attempt to move but A is nothing')
    const activeItemId = inv.items[inv.active]?.id
    const itemA = inv.items[a]
    const itemB = inv.items[b]
    // if A and B are the same and B can stack more, this is a fill!
    let didFill
    if (itemA.id === itemB?.id) {
      const spec = specs[itemA.id]
      const fill = Math.min(itemA.qty, spec.stack - itemB.qty)
      if (fill > 0) {
        itemA.qty -= fill
        itemB.qty += fill
        if (itemA.qty === 0) {
          inv.items[a] = null
        }
        didFill = true
      }
    }
    // otherwise its a swap!
    if (!didFill) {
      inv.items[a] = itemB
      inv.items[b] = itemA
    }
    app.sendTo(playerId, 'setItem', [a, inv.items[a]])
    app.sendTo(playerId, 'setItem', [b, inv.items[b]])
    // check if active item changed
    const newActiveItemId = inv.items[inv.active]?.id
    if (activeItemId !== newActiveItemId) {
      app.emit(`elemental-core:deactivate:${activeItemId}`, playerId)
      app.emit(`elemental-core:activate:${newActiveItemId}`, playerId)
    }
    save(playerId)
  })
  // listen to player dropping items
  app.on('drop', (_, playerId) => {
    const inv = getInv(playerId)
    const item = inv.items[inv.active]
    if (!item) return
    app.emit(`elemental-core:drop:${item.id}`, playerId)
  })
  // listen to player dropping items from specific slot (mobile)
  app.on('drop-slot', (slotIdx, playerId) => {
    const inv = getInv(playerId)
    const item = inv.items[slotIdx]
    if (!item) return
    app.emit(`elemental-core:drop:${item.id}`, playerId)
    inv.items[slotIdx] = null
    app.sendTo(playerId, 'setItem', [slotIdx, null])
    save(playerId)
  })
  // listen to items wanting to give items to players
  world.on('elemental-item:give', ([playerId, id, qty]) => {
    const inv = getInv(playerId)
    const spec = specs[id]
    if (!spec) return console.error('core has no spec for item:', id)
    const activeIsEmpty = !inv.items[inv.active]
    // distribute quantity into existing or new stacks
    const changed = new Set()
    for (let n = 0; n < qty; n++) {
      let idx = inv.items.findIndex(item => {
        return item && item.id === id && item.qty < spec.stack
      })
      if (idx === -1) {
        // no stack found, find next empty slot
        idx = inv.items.findIndex(item => !item)
        if (idx === -1) {
          return console.error('player has no room to receive item:', id)
        }
        inv.items[idx] = { id, qty: 0 }
      }
      inv.items[idx].qty++
      changed.add(idx)
    }
    // notify changes
    for (const idx of changed) {
      app.sendTo(playerId, 'setItem', [idx, inv.items[idx]])
    }
    // if players active slot was empty but now has an item, activate it
    if (activeIsEmpty && inv.items[inv.active]) {
      app.emit(`elemental-core:activate:${inv.items[inv.active].id}`, playerId)
    }
    // save changes
    save(playerId)
  })
  // listen and respond to balance queries
  world.on('elemental:balance-request', ([playerId, itemId]) => {
    const inv = getInv(playerId)
    let balance = 0
    for (const item of inv.items) {
      if (item && item.id === itemId) balance += item.qty
    }
    app.emit('elemental:balance-response', [playerId, itemId, balance])
  })
  // listen for ammo count updates from weapons
  world.on('elemental-item:ammo-update', data => {
    const { playerId, itemId, ammo, maxAmmo } = data
    const ammoData = getAmmoCounts(playerId)
    ammoData[itemId] = { ammo, maxAmmo }

    app.sendTo(playerId, 'ammoUpdate', { itemId, ammo, maxAmmo })
  })
  world.on('elemental-item:take', ([playerId, itemId, qty]) => {
    const inv = getInv(playerId)
    // ensure we have enough
    let n = 0
    for (const item of inv.items) {
      if (item && item.id === itemId) n += item.qty
    }
    if (n < qty) return console.error(`core asked to take ${itemId}:${qty} but player only has ${n}`)
    // take from active first (if possible) then other slots
    const changed = new Set()
    let remaining = qty
    const activeItem = inv.items[inv.active]
    const activeItemId = activeItem?.id
    if (activeItem && activeItem.id === itemId) {
      const taken = Math.min(activeItem.qty, remaining)
      activeItem.qty -= taken
      remaining -= taken
      changed.add(inv.active)
      if (activeItem.qty === 0) {
        inv.items[inv.active] = null
      }
    }
    if (remaining > 0) {
      for (let i = 0; i < inv.items.length; i++) {
        const item = inv.items[i]
        if (!item) continue
        const taken = Math.min(item.qty, remaining)
        item.qty -= taken
        remaining -= taken
        changed.add(i)
        if (item.qty === 0) {
          inv.items[i] = null
        }
        if (remaining === 0) break
      }
    }
    // check if active item changed
    const newActiveItemId = inv.items[inv.active]?.id
    if (activeItemId !== newActiveItemId) {
      app.emit(`elemental-core:deactivate:${activeItemId}`, playerId)
      app.emit(`elemental-core:activate:${newActiveItemId}`, playerId)
    }
    // notify changes
    for (const idx of changed) {
      app.sendTo(playerId, 'setItem', [idx, inv.items[idx]])
    }
    save(playerId)
  })
  // when the app is destroyed or rebooted, let held items know to deactivate
  app.on('destroy', () => {
    for (const playerId in invs) {
      const inv = invs[playerId]
      const item = inv.items[inv.active]
      if (item) {
        app.emit(`elemental-core:deactivate:${item.id}`, playerId)
      }
    }
  })
  // request all item metadata
  app.emit('elemental-core:request-specs')
  // send existing players their inventory
  const players = world.getPlayers()
  for (const player of players) {
    const inv = getInv(player.id)
    const ammo = getAmmoCounts(player.id)
    app.sendTo(player.id, 'init', {
      specs,
      ...inv,
      ammoCounts: ammo,
    })
    // let active item know to activate for player
    const item = inv.items[inv.active]
    if (item) {
      app.emit(`elemental-core:activate:${item.id}`, player.id)
    }
  }

  app.on('clear-storage', playerId => {
    const key = `elemental-core:items:${playerId}`
    world.set(key, null)

    const emptyInv = {
      active: 0,
      items: new Array(20).fill(null),
    }
    invs[playerId] = emptyInv

    app.sendTo(playerId, 'init', {
      specs,
      ...emptyInv,
    })
  })
  app.on('give', playerId => {
    // Give button functionality - could be used for testing
  })
}

if (world.isClient) {
  const isMobile =
    typeof navigator !== 'undefined' && navigator.userAgent
      ? /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      : false
  const barWidth = isMobile ? 160 : 260
  const barHeight = isMobile ? 32 : 56
  const slotSize = isMobile ? 24 : 46

  const $bar = app.create('ui', {
    space: 'screen',
    pivot: 'bottom-center',
    position: [0.5, 1, 0],
    offset: [0, -40, 0],
    width: barWidth,
    height: barHeight,
    padding: 5,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.8)',
  })
  const slots = []
  for (let i = 0; i < 5; i++) {
    const $item = app.create('uiview', {
      width: slotSize,
      height: slotSize,
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: null,
      cursor: 'pointer',
    })
    $item.onPointerEnter = () => ($item.backgroundColor = 'rgba(255,255,255,0.1)')
    $item.onPointerLeave = () => ($item.backgroundColor = 'rgba(255,255,255,0.07)')
    $item.onPointerDown = () => handleSlotTap(i)
    $bar.add($item)
    const $img = app.create('uiimage', {
      // width: 70-5-5-1-1,
      // height: 70-5-5-1-1,
      // src: '/Frame 5.png',
      objectFit: 'cover',
      borderRadius: 5,
    })
    $item.add($img)
    const $qty = app.create('uitext', {
      absolute: true,
      right: 4,
      bottom: 4,
      width: 18,
      height: 18,
      color: 'white',
      fontSize: 10,
      fontWeight: 600,
      value: '',
    })
    $item.add($qty)
    slots.push({ $item, $img, $qty })
  }
  app.add($bar)
  const backpackWidth = isMobile ? 120 : 180
  const backpackHeight = isMobile ? 60 : 95
  const backpackSlotSize = isMobile ? 20 : 38

  const $backpack = app.create('ui', {
    space: 'screen',
    pivot: 'bottom-center',
    position: [0.5, 1, 0],
    offset: [0, -40 - barHeight - 4, 0],
    width: backpackWidth,
    height: backpackHeight,
    padding: 5,
    borderRadius: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    overflow: 'hidden',
    backgroundColor: 'black',
  })
  for (let i = 5; i < 13; i++) {
    const $item = app.create('uiview', {
      width: backpackSlotSize,
      height: backpackSlotSize,
      backgroundColor: 'rgba(255,255,255,0.07)',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: null,
      cursor: 'pointer',
    })
    $item.onPointerEnter = () => ($item.backgroundColor = 'rgba(255,255,255,0.1)')
    $item.onPointerLeave = () => ($item.backgroundColor = 'rgba(255,255,255,0.07)')
    $item.onPointerDown = () => handleSlotTap(i)
    $backpack.add($item)
    const $img = app.create('uiimage', {
      // width: 70-5-5-1-1,
      // height: 70-5-5-1-1,
      // src: '/Frame 5.png',
      objectFit: 'cover',
      borderRadius: 5,
    })
    $item.add($img)
    const $qty = app.create('uitext', {
      absolute: true,
      right: 4,
      bottom: 4,
      width: 18,
      height: 18,
      color: 'white',
      fontSize: 10,
      fontWeight: 600,
      value: '',
    })
    $item.add($qty)
    slots.push({ $item, $img, $qty })
  }

  let init
  let specs
  let items
  let active
  let open
  let control
  let selected = null
  let ammoCounts = {}
  let lastTap = null
  let tapFrameCount = 0

  const $toggleBtn = app.create('ui', {
    space: 'screen',
    width: 30,
    height: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 15,
    pivot: 'bottom-right',
    position: [1, 1],
    offset: [-175, -170, 0],
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
  })
  const toggleLabel = app.create('uitext', {
    value: 'BAG',
    color: 'white',
    fontSize: isMobile ? 7 : 9,
    fontWeight: 'bold',
  })
  $toggleBtn.add(toggleLabel)
  $toggleBtn.onPointerDown = () => {
    if (lastTap !== null && tapFrameCount < 18) {
      toggleHotbar()
      lastTap = null
      tapFrameCount = 0
    } else {
      lastTap = 'bag'
      tapFrameCount = 0
      if (hotbarVisible) {
        toggleBackpack()
      } else {
        toggleHotbar()
      }
    }
  }
  function toggleHotbar() {
    hotbarVisible = !hotbarVisible
    if (hotbarVisible) {
      app.add($bar)
    } else {
      app.remove($bar)
    }
  }

  app.add($toggleBtn)

  const $actions = app.create('ui', {
    space: 'screen',
    pivot: 'bottom-center',
    position: [0.5, 1, 0],
    offset: [0, -40 - backpackHeight - (isMobile ? 40 : 56), 0],
    width: backpackWidth,
    height: isMobile ? 30 : 40,
    padding: isMobile ? 3 : 5,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
  })

  const clearBtn = app.create('uiview', {
    width: isMobile ? 60 : 80,
    height: isMobile ? 22 : 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: null,
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
  })
  clearBtn.onPointerEnter = () => (clearBtn.backgroundColor = 'rgba(255,255,255,0.2)')
  clearBtn.onPointerLeave = () => (clearBtn.backgroundColor = 'rgba(255,255,255,0.1)')
  clearBtn.onPointerDown = () => {
    if (selected !== null) {
      slots[selected].$item.borderColor = selected === active ? 'rgba(255,255,255,0.4)' : null
      selected = null
    }
  }
  const clearLabel = app.create('uitext', {
    value: 'CLEAR',
    color: 'white',
    fontSize: isMobile ? 8 : 10,
    fontWeight: 600,
  })
  clearBtn.add(clearLabel)

  const dropBtn = app.create('uiview', {
    width: isMobile ? 60 : 80,
    height: isMobile ? 22 : 30,
    backgroundColor: 'rgba(255,100,100,0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: null,
    cursor: 'pointer',
    alignItems: 'center',
    justifyContent: 'center',
  })
  dropBtn.onPointerEnter = () => (dropBtn.backgroundColor = 'rgba(255,100,100,0.4)')
  dropBtn.onPointerLeave = () => (dropBtn.backgroundColor = 'rgba(255,100,100,0.2)')
  dropBtn.onPointerDown = () => {
    if (selected !== null) {
      app.send('drop-slot', selected)
    }
  }
  const dropLabel = app.create('uitext', {
    value: 'DROP',
    color: 'white',
    fontSize: isMobile ? 8 : 10,
    fontWeight: 600,
  })
  dropBtn.add(dropLabel)

  $actions.add(clearBtn)
  $actions.add(dropBtn)

  const $help = app.create('ui', {
    space: 'screen',
    pivot: 'top-center',
    position: [0.5, 0, 0],
    offset: [0, 20, 0],
    width: isMobile ? 200 : 260,
    height: isMobile ? 32 : 42,
    padding: isMobile ? 5 : 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  })
  const helpText = app.create('uitext', {
    value: isMobile
      ? 'Double-tap BAG to hide/show hotbar | Tap: Select | Double-tap slot: Use'
      : 'Tap: Select | Double-tap: Use | CLEAR/DROP: Buttons',
    color: 'white',
    fontSize: isMobile ? 7 : 9,
    textAlign: 'center',
  })
  $help.add(helpText)

  let actionsVisible = false
  let helpVisible = false
  let hotbarVisible = true
  const toggleBtnVisible = true

  app.on('update', () => {
    if (open && !actionsVisible) {
      app.add($actions)
      actionsVisible = true
    } else if (!open && actionsVisible) {
      app.remove($actions)
      actionsVisible = false
    }

    if (open && !helpVisible) {
      app.add($help)
      helpVisible = true
    } else if (!open && helpVisible) {
      app.remove($help)
      helpVisible = false
    }

    if (lastTap !== null) {
      tapFrameCount++
      if (tapFrameCount >= 18) {
        lastTap = null
        tapFrameCount = 0
      }
    }
  })

  function handleSlotTap(idx) {
    if (lastTap !== null && lastTap === idx && tapFrameCount < 18) {
      if (idx < 5) {
        setActive(idx)
      }
      lastTap = null
      tapFrameCount = 0
    } else {
      lastTap = idx
      tapFrameCount = 0
      select(idx)
    }
  }
  function setActive(idx) {
    if (selected) {
      slots[selected].$item.borderColor = null
      selected = null
    }
    active = idx
    for (let i = 0; i < 5; i++) {
      const slot = slots[i]
      slot.$item.borderColor = i === idx ? 'rgba(255,255,255,0.4)' : null
      app.send('active', idx)
    }
  }
  function toggleBackpack() {
    select(null)
    open = !open
    if (open) {
      app.add($backpack)
      control.pointer.unlock()
    } else {
      app.remove($backpack)
      control.pointer.lock()
    }
  }
  function select(idx) {
    // if selecting nothing, clear it
    if (selected !== null && idx === null) {
      slots[selected].$item.borderColor = selected === active ? 'rgba(255,255,255,0.4)' : null
      selected = null
    }
    // if first selection, select!
    else if (selected === null && idx !== null && items[idx]) {
      selected = idx
      slots[idx].$item.borderColor = 'white'
    }
    // if tapping empty slot with no selection, just return
    else if (selected === null && idx !== null && !items[idx]) {
      return
    }
    // if second selection is same, deselect!
    else if (selected !== null && idx !== null && selected === idx) {
      slots[idx].$item.borderColor = idx === active ? 'rgba(255,255,255,0.4)' : null
      selected = null
    }
    // if second selection, move!
    else if (selected !== null && idx !== null) {
      app.send('move', [selected, idx])
      slots[selected].$item.borderColor = selected === active ? 'rgba(255,255,255,0.4)' : null
      selected = null
    }
  }
  app.on('init', data => {
    init = true
    specs = data.specs
    items = data.items
    active = data.active
    ammoCounts = data.ammoCounts || {}
    for (let i = 0; i < items.length; i++) {
      const slot = slots[i]
      if (!slot) continue
      const item = items[i]
      if (item) {
        const spec = specs[item.id]
        if (spec && spec.icon) {
          slot.$img.src = spec.icon
        } else {
          slot.$img.src = null
          console.warn('[core] No spec or icon found for item:', item.id)
        }
        // Show ammo count for weapons, regular quantity for other items
        const ammoData = ammoCounts[item.id]
        if (ammoData && spec && spec.showAmmoCount) {
          slot.$qty.value = `${ammoData.ammo}/${ammoData.maxAmmo}`
        } else {
          slot.$qty.value = item.qty > 1 ? item.qty : ''
        }
      } else {
        slot.$img.src = null
        slot.$qty.value = ''
      }
    }
    setActive(data.active)
    control?.release()
    control = app.control()
    control.digit1.onPress = () => setActive(0)
    control.digit2.onPress = () => setActive(1)
    control.digit3.onPress = () => setActive(2)
    control.digit4.onPress = () => setActive(3)
    control.digit5.onPress = () => setActive(4)
    control.keyB.onPress = () => toggleBackpack()
    control.keyQ.onPress = () => app.send('drop')
  })
  app.on('spec', spec => {
    if (!init) return
    specs[spec.id] = spec
    for (let i = 0; i < 20; i++) {
      const item = items[i]
      if (item && item.id === spec.id) {
        slots[i].$img.src = spec.icon
      }
    }
  })
  app.on('setItem', ([idx, item]) => {
    if (!init) return
    items[idx] = item
    if (item) {
      const spec = specs[item.id]
      if (spec && spec.icon) {
        slots[idx].$img.src = spec.icon
      } else {
        slots[idx].$img.src = null
      }
      const ammoData = ammoCounts[item.id]
      if (ammoData && spec && spec.showAmmoCount) {
        slots[idx].$qty.value = `${ammoData.ammo}/${ammoData.maxAmmo}`
      } else {
        slots[idx].$qty.value = item.qty > 1 ? item.qty : ''
      }
    } else {
      slots[idx].$img.src = null
      slots[idx].$qty.value = ''
    }
  })
  app.on('ammoUpdate', ({ itemId, ammo, maxAmmo }) => {
    if (!init) return
    ammoCounts[itemId] = { ammo, maxAmmo }

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item && item.id === itemId) {
        const spec = specs[item.id]
        if (spec && spec.showAmmoCount) {
          slots[i].$qty.value = `${ammo}/${maxAmmo}`
        }
      }
    }
  })
  app.on('update', delta => {
    if (!init) return
    if (control.pointer.locked && open) {
      toggleBackpack()
    }
  })
}

// App Configuration
app.configure([
  {
    key: 'clearStorage',
    type: 'button',
    label: 'Clear World Storage',
    onClick: () => {
      const player = world.getPlayer()
      app.send('clear-storage', player.id)
    },
  },
])
