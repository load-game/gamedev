// Tracking Billboard Map
// Displays a worldspace billboard with a map of the 2km x 2km world and player tracking

// App configuration
app.configure(() => {
    return [
      {
        key: 'mapBackgroundImage',
        type: 'file',
        kind: 'texture',
        label: 'Map Background Image',
        hint: 'Upload an image to use as the map background'
      }
    ]
  })
  
  if (!world.isClient) return
  
  // Constants
  const WORLD_SIZE = 2000 // 2km = 2000m
  const MAP_SIZE = 10 // 10m x 10m square map
  const PLAYER_LIST_WIDTH = 4 // 4m wide player list panel
  const GAP_BETWEEN_PANELS = 1.5 // 1.5m gap between map and list panels
  const MAP_PADDING = 0.2 // 0.2m padding inside map for border
  const LIST_PANEL_HEIGHT = 10 // 10m tall list panel (same as map)
  const PLAYER_SECTION_HEIGHT = 5 // 5m for player section (top half)
  const APP_SECTION_HEIGHT = 5 // 5m for app section (bottom half)
  const GAP_BETWEEN_SECTIONS = 0.3 // 0.3m gap between player and app sections
  
  // UI size conversion: size = 0.01 means 1 meter per 100 pixels
  const SIZE_CONVERSION = 0.01
  
  // Color palette for players (25 distinct, vibrant colors)
  const PLAYER_COLORS = [
    '#ff00ff', // Magenta
    '#00ffff', // Cyan
    '#ffff00', // Yellow
    '#00ff00', // Green
    '#ff0000', // Red
    '#0000ff', // Blue
    '#ff8800', // Orange
    '#8800ff', // Purple
    '#00ff88', // Mint
    '#ff0088', // Pink
    '#88ff00', // Lime
    '#0088ff', // Sky Blue
    '#ffaa00', // Amber
    '#aa00ff', // Violet
    '#00ffaa', // Aqua
    '#ff4444', // Light Red
    '#44ff44', // Light Green
    '#4444ff', // Light Blue
    '#ff44ff', // Light Magenta
    '#44ffff', // Light Cyan
    '#ffff44', // Light Yellow
    '#ff8844', // Coral
    '#8844ff', // Lavender
    '#44ff88', // Seafoam
    '#ff4488', // Rose
  ]
  
  // Player color mapping (playerId -> color)
  const playerColorMap = new Map()
  // Track which colors are currently in use to avoid duplicates
  const usedColorIndices = new Set()
  
  // App color mapping (appId -> color)
  const appColorMap = new Map()
  // Track which colors are currently in use for apps (separate from players)
  const usedAppColorIndices = new Set()
  
  // Get color for a player (assigns unique colors, reuses colors if all are taken)
  function getPlayerColor(playerId) {
    if (!playerColorMap.has(playerId)) {
      // First, try to find an unused color
      let colorIndex = -1
      for (let i = 0; i < PLAYER_COLORS.length; i++) {
        if (!usedColorIndices.has(i)) {
          colorIndex = i
          break
        }
      }
      
      // If all colors are used, use hash-based assignment
      if (colorIndex === -1) {
        let hash = 0
        for (let i = 0; i < playerId.length; i++) {
          const char = playerId.charCodeAt(i)
          hash = ((hash << 5) - hash) + char
          hash = hash + (hash << 15)
          hash = hash ^ (hash >>> 12)
          hash = hash + (hash << 2)
        }
        colorIndex = Math.abs(hash) % PLAYER_COLORS.length
      }
      
      const color = PLAYER_COLORS[colorIndex]
      playerColorMap.set(playerId, color)
      usedColorIndices.add(colorIndex)
    }
    return playerColorMap.get(playerId)
  }
  
  // Remove color assignment when player leaves
  function releasePlayerColor(playerId) {
    if (playerColorMap.has(playerId)) {
      const color = playerColorMap.get(playerId)
      const colorIndex = PLAYER_COLORS.indexOf(color)
      if (colorIndex !== -1) {
        usedColorIndices.delete(colorIndex)
      }
      playerColorMap.delete(playerId)
    }
  }
  
  // Get color for an app (assigns unique colors from same palette, reversed order to avoid matching players)
  function getAppColor(appId) {
    if (!appColorMap.has(appId)) {
      // First, try to find an unused color (starting from the end of the array, reversed)
      let colorIndex = -1
      for (let i = PLAYER_COLORS.length - 1; i >= 0; i--) {
        if (!usedAppColorIndices.has(i)) {
          colorIndex = i
          break
        }
      }
      
      // If all colors are used, use hash-based assignment (also reversed)
      if (colorIndex === -1) {
        let hash = 0
        for (let i = 0; i < appId.length; i++) {
          const char = appId.charCodeAt(i)
          hash = ((hash << 5) - hash) + char
          hash = hash + (hash << 15)
          hash = hash ^ (hash >>> 12)
          hash = hash + (hash << 2)
        }
        // Reverse the hash index: use (length - 1 - hash) to get reversed order
        colorIndex = PLAYER_COLORS.length - 1 - (Math.abs(hash) % PLAYER_COLORS.length)
      }
      
      const color = PLAYER_COLORS[colorIndex]
      appColorMap.set(appId, color)
      usedAppColorIndices.add(colorIndex)
    }
    return appColorMap.get(appId)
  }
  
  // Remove color assignment when app stops tracking
  function releaseAppColor(appId) {
    if (appColorMap.has(appId)) {
      const color = appColorMap.get(appId)
      const colorIndex = PLAYER_COLORS.indexOf(color)
      if (colorIndex !== -1) {
        usedAppColorIndices.delete(colorIndex)
      }
      appColorMap.delete(appId)
    }
  }
  
  // Function to create an app cube on the map (as a prim box)
  function createAppMapCube(appId, color) {
    const cube = app.create('prim', {
      type: 'box',
      size: [0.2, 0.2, 0.2], // 0.2m cube (2x size)
      color: color,
      position: [mapPanelWorldX + MAP_SIZE / 2, mapPanelWorldY, 0], // Center at billboard surface so half sticks out
      active: true
    })
    billboardGroup.add(cube)
    return cube
  }
  
  // Function to create an app list entry
  function createAppListEntry(appId, trackingName, color) {
    // Use uiview for flex layout children
    const entryContainer = app.create('uiview', {
      width: (PLAYER_LIST_WIDTH - 0.6) * 100, // Width minus padding in pixels
      height: 0.4 / SIZE_CONVERSION, // 0.4m tall entry in pixels
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0.1 / SIZE_CONVERSION,
      backgroundColor: 'transparent',
      active: true
    })
    
    // Colored cube (use uiview for flex child, square shape)
    const cube = app.create('uiview', {
      width: 0.2 / SIZE_CONVERSION, // 0.2m cube in pixels
      height: 0.2 / SIZE_CONVERSION,
      backgroundColor: color,
      borderRadius: 0.05 / SIZE_CONVERSION, // Slightly rounded corners
      active: true
    })
    entryContainer.add(cube)
    
    // App tracking name text
    const nameText = app.create('uitext', {
      value: trackingName || 'Unnamed App',
      fontSize: 0.25 / SIZE_CONVERSION, // 0.25m font size in pixels
      color: '#ffffff',
      fontWeight: 'normal',
      textAlign: 'left',
      active: true
    })
    entryContainer.add(nameText)
    
    appListPanel.add(entryContainer)
    
    return { container: entryContainer, cube, text: nameText }
  }
  
  // Create main container group
  const billboardGroup = app.create('group')
  app.add(billboardGroup)
  
  // Map Panel (Left - Square 10m x 10m)
  const mapPanel = app.create('ui', {
    space: 'world',
    width: MAP_SIZE * 100, // 1000 pixels for 10m (at size 0.01)
    height: MAP_SIZE * 100, // 1000 pixels for 10m
    size: SIZE_CONVERSION, // 0.01 = 1m per 100px
    position: [0, MAP_SIZE / 2, 0], // Center vertically, left side
    pivot: 'center-left',
    backgroundColor: '#000000',
    borderWidth: 0.2 / SIZE_CONVERSION, // 0.2m border in pixels
    borderColor: '#ff69b4', // Pink border
    borderRadius: 0.5 / SIZE_CONVERSION, // 0.5m radius in pixels
    padding: MAP_PADDING / SIZE_CONVERSION, // Padding in pixels
    billboard: 'none', // Fixed orientation
    pointerEvents: false,
    active: true
  })
  billboardGroup.add(mapPanel)
  
  // List Panel Container (Right - Rectangle 4m x 10m, divided into two sections)
  const listPanelX = MAP_SIZE + GAP_BETWEEN_PANELS + PLAYER_LIST_WIDTH / 2
  const listPanelY = MAP_SIZE / 2 // Center vertically, same as map
  
  // Calculate positions: Player section on top, App section on bottom, with gap between
  // Total height: PLAYER_SECTION_HEIGHT + GAP_BETWEEN_SECTIONS + APP_SECTION_HEIGHT = 5 + 0.3 + 5 = 10.3m
  // Player section center: listPanelY + (APP_SECTION_HEIGHT / 2 + GAP_BETWEEN_SECTIONS / 2) = 5 + 2.5 + 0.15 = 7.65m
  // App section center: listPanelY - (PLAYER_SECTION_HEIGHT / 2 + GAP_BETWEEN_SECTIONS / 2) = 5 - 2.5 - 0.15 = 2.35m
  
  // Player List Section (Top half)
  const playerListPanel = app.create('ui', {
    space: 'world',
    width: PLAYER_LIST_WIDTH * 100, // 400 pixels for 4m
    height: PLAYER_SECTION_HEIGHT * 100, // 500 pixels for 5m
    size: SIZE_CONVERSION,
    position: [listPanelX, listPanelY + (APP_SECTION_HEIGHT / 2 + GAP_BETWEEN_SECTIONS / 2), 0], // Top section
    pivot: 'center',
    backgroundColor: '#000000',
    borderWidth: 0.2 / SIZE_CONVERSION,
    borderColor: '#ff69b4', // Pink border
    borderRadius: 0.5 / SIZE_CONVERSION,
    padding: 0.3 / SIZE_CONVERSION, // Padding for player entries
    gap: 0.15 / SIZE_CONVERSION, // Gap between player entries
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    billboard: 'none', // Fixed orientation
    pointerEvents: false,
    active: true
  })
  billboardGroup.add(playerListPanel)
  
  // App List Section (Bottom half)
  const appListPanel = app.create('ui', {
    space: 'world',
    width: PLAYER_LIST_WIDTH * 100, // 400 pixels for 4m (same width as player list)
    height: APP_SECTION_HEIGHT * 100, // 500 pixels for 5m
    size: SIZE_CONVERSION,
    position: [listPanelX, listPanelY - (PLAYER_SECTION_HEIGHT / 2 + GAP_BETWEEN_SECTIONS / 2), 0], // Bottom section
    pivot: 'center',
    backgroundColor: '#000000',
    borderWidth: 0.2 / SIZE_CONVERSION,
    borderColor: '#ff69b4', // Pink border
    borderRadius: 0.5 / SIZE_CONVERSION,
    padding: 0.3 / SIZE_CONVERSION, // Padding for app entries
    gap: 0.15 / SIZE_CONVERSION, // Gap between app entries
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    billboard: 'none', // Fixed orientation
    pointerEvents: false,
    active: true
  })
  billboardGroup.add(appListPanel)
  
  // Store references
  const playerMapDots = new Map() // playerId -> dot UI element
  const playerListEntries = new Map() // playerId -> {dot, text} UI elements
  
  // App tracking references
  const appMapCubes = new Map() // appId -> cube prim element
  const appListEntries = new Map() // appId -> {container, cube, text} UI elements
  const appLastUpdateTime = new Map() // appId -> timestamp (for cleanup)
  const APP_TIMEOUT = 3.0 // Remove apps that haven't updated in 3 seconds
  
  // Map panel world position (center-left pivot means left edge is at X=0, center is at Y=MAP_SIZE/2)
  const mapPanelWorldX = 0 // Left edge of map panel
  const mapPanelWorldY = MAP_SIZE / 2 // Vertical center of map panel
  
  // Store reference to background image
  let mapBackgroundImage = null
  
  // Function to update background image
  function updateMapBackground() {
    // Remove existing background image if it exists
    if (mapBackgroundImage && mapBackgroundImage.parent) {
      mapBackgroundImage.parent.remove(mapBackgroundImage)
      mapBackgroundImage = null
    }
    
    // Add new background image if provided
    if (app.config.mapBackgroundImage?.url) {
      mapBackgroundImage = app.create('uiimage', {
        src: app.config.mapBackgroundImage.url,
        width: MAP_SIZE * 100, // Full map panel width in pixels (including padding area)
        height: MAP_SIZE * 100, // Full map panel height in pixels (including padding area)
        objectFit: 'cover',
        absolute: true, // Use absolute positioning
        top: 0, // Position from top edge (no padding)
        left: 0, // Position from left edge (no padding)
        right: 0, // Position from right edge (no padding)
        bottom: 0, // Position from bottom edge (no padding)
        active: true
      })
      mapPanel.add(mapBackgroundImage)
      // Background image fills entire map panel, extending to pink border
    }
  }
  
  // Initial background image setup
  updateMapBackground()
  
  // Listen for config changes to update background image
  app.on('config', () => {
    updateMapBackground()
  })
  
  // Function to convert world coordinates to map position (world coordinates relative to map panel)
  function worldToMapPosition(worldPos) {
    // World bounds: -1000 to +1000 on X and Z axes
    // Map panel is at world position [0, MAP_SIZE/2, 0] with 'center-left' pivot
    const normalizedX = (worldPos.x + WORLD_SIZE / 2) / WORLD_SIZE // 0 to 1
    const normalizedZ = (worldPos.z + WORLD_SIZE / 2) / WORLD_SIZE // 0 to 1
    
    // Clamp to map bounds
    const mapAreaWidth = MAP_SIZE - MAP_PADDING * 2
    const mapAreaHeight = MAP_SIZE - MAP_PADDING * 2
    const offsetX = MAP_PADDING + normalizedX * mapAreaWidth // X offset from left edge of map
    // Flip Z: world Z = -1000 (top) maps to top of map panel
    const offsetY = MAP_SIZE / 2 - MAP_PADDING - normalizedZ * mapAreaHeight // Y offset from center
    
    // Return world position
    return { 
      x: mapPanelWorldX + offsetX, 
      y: mapPanelWorldY + offsetY 
    }
  }
  
  // Function to create a player dot on the map (as a prim sphere)
  function createPlayerMapDot(playerId, color) {
    const dot = app.create('prim', {
      type: 'sphere',
      size: [0.1], // 0.1m radius sphere
      color: color,
      position: [mapPanelWorldX + MAP_SIZE / 2, mapPanelWorldY, 0], // Center at billboard surface so half sticks out
      active: true
    })
    billboardGroup.add(dot)
    return dot
  }
  
  // Function to create a player list entry
  function createPlayerListEntry(playerId, playerName, color) {
    // Use uiview for flex layout children
    const entryContainer = app.create('uiview', {
      width: (PLAYER_LIST_WIDTH - 0.6) * 100, // Width minus padding in pixels
      height: 0.4 / SIZE_CONVERSION, // 0.4m tall entry in pixels
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0.1 / SIZE_CONVERSION,
      backgroundColor: 'transparent',
      active: true
    })
    
    // Colored dot (use uiview for flex child)
    const dot = app.create('uiview', {
      width: 0.2 / SIZE_CONVERSION, // 0.2m dot in pixels
      height: 0.2 / SIZE_CONVERSION,
      backgroundColor: color,
      borderRadius: 0.1 / SIZE_CONVERSION, // Circular
      active: true
    })
    entryContainer.add(dot)
    
    // Player name text
    const nameText = app.create('uitext', {
      value: playerName || 'Anonymous',
      fontSize: 0.25 / SIZE_CONVERSION, // 0.25m font size in pixels
      color: '#ffffff',
      fontWeight: 'normal',
      textAlign: 'left',
      active: true
    })
    entryContainer.add(nameText)
    
    playerListPanel.add(entryContainer)
    
    return { container: entryContainer, dot, text: nameText }
  }
  
  // Function to update player list
  function updatePlayerList() {
    const players = world.getPlayers()
    
    // Remove entries for players who left
    for (const [playerId, entry] of playerListEntries.entries()) {
      if (!players.find(p => p.id === playerId)) {
        // Player left, remove their entry
        if (entry.container && entry.container.parent) {
          entry.container.parent.remove(entry.container)
        }
        playerListEntries.delete(playerId)
        releasePlayerColor(playerId) // Clean up color mapping
      }
    }
    
    // Remove map dots for players who left
    for (const [playerId, dot] of playerMapDots.entries()) {
      if (!players.find(p => p.id === playerId)) {
        if (dot && dot.parent) {
          dot.parent.remove(dot)
        }
        playerMapDots.delete(playerId)
      }
    }
    
    // Add/update entries for current players
    players.forEach(player => {
      const playerId = player.id
      const playerName = player.name || 'Anonymous'
      const color = getPlayerColor(playerId)
      
      // Create map dot if it doesn't exist
      if (!playerMapDots.has(playerId)) {
        const dot = createPlayerMapDot(playerId, color)
        playerMapDots.set(playerId, dot)
      }
      
      // Create list entry if it doesn't exist
      if (!playerListEntries.has(playerId)) {
        const entry = createPlayerListEntry(playerId, playerName, color)
        playerListEntries.set(playerId, entry)
      } else {
        // Update name if it changed
        const entry = playerListEntries.get(playerId)
        if (entry.text) {
          entry.text.value = playerName
        }
      }
    })
  }
  
  // Initial player list update
  updatePlayerList()
  
  // Listen to player enter/leave events
  world.on('enter', ({ playerId }) => {
    updatePlayerList()
  })
  
  world.on('leave', ({ playerId }) => {
    updatePlayerList()
  })
  
  // Listen for app tracking updates
  world.on('app-tracking-update', ({ appId, position, trackingName }) => {
    if (!appId || !position) return
    
    const color = getAppColor(appId)
    const currentTime = Date.now() / 1000 // Current time in seconds
    
    // Update last update time
    appLastUpdateTime.set(appId, currentTime)
    
    // Create map cube if it doesn't exist
    if (!appMapCubes.has(appId)) {
      const cube = createAppMapCube(appId, color)
      appMapCubes.set(appId, cube)
    }
    
    // Create list entry if it doesn't exist
    if (!appListEntries.has(appId)) {
      const entry = createAppListEntry(appId, trackingName, color)
      appListEntries.set(appId, entry)
    } else {
      // Update name if it changed
      const entry = appListEntries.get(appId)
      if (entry.text && entry.text.value !== trackingName) {
        entry.text.value = trackingName || 'Unnamed App'
      }
    }
    
    // Update cube position on map
    const cube = appMapCubes.get(appId)
    if (cube && position) {
      const worldPos = { x: position.x, y: position.y, z: position.z }
      const mapPos = worldToMapPosition(worldPos)
      cube.position.set(mapPos.x, mapPos.y, 0)
    }
  })
  
  // Update player positions on map every frame
  app.on('update', (delta) => {
    const players = world.getPlayers()
    const currentTime = Date.now() / 1000 // Current time in seconds
    
    // Update player positions
    players.forEach(player => {
      const playerId = player.id
      const dot = playerMapDots.get(playerId)
      
      if (dot && player.position) {
        // Convert world position to map position (world coordinates)
        const mapPos = worldToMapPosition(player.position)
        
        // Update dot position (world coordinates)
        // Keep Z at 0 (billboard surface) so half the sphere sticks out
        dot.position.set(mapPos.x, mapPos.y, 0)
      }
    })
    
    // Clean up apps that haven't updated in a while
    for (const [appId, lastUpdate] of appLastUpdateTime.entries()) {
      if (currentTime - lastUpdate > APP_TIMEOUT) {
        // App hasn't updated, remove it
        const cube = appMapCubes.get(appId)
        if (cube && cube.parent) {
          cube.parent.remove(cube)
        }
        appMapCubes.delete(appId)
        
        const entry = appListEntries.get(appId)
        if (entry && entry.container && entry.container.parent) {
          entry.container.parent.remove(entry.container)
        }
        appListEntries.delete(appId)
        
        appLastUpdateTime.delete(appId)
        releaseAppColor(appId)
      }
    }
  })
  
  