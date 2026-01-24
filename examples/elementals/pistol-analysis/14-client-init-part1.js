// ===== CLIENT INITIALIZATION =====
  return {
    client: {
      init() {
        console.log('[pistol] VERSION 2.0 - Animation-only system initialized for player:', player.id)

        // Parse zoom levels from config
        zoomLevels = (props.zoomLevels || '1.5, 1.0, 0.5, 0.3')
          .split(',')
          .map(s => parseFloat(s.trim()))
          .filter(n => !isNaN(n))

        // Initialize zoom to first level (normal view)
        currentZoom = zoomLevels[0]
        targetZoom = zoomLevels[0]
        currentZoomLevelIndex = 0

        console.log('[pistol] Initialized zoom system with levels:', zoomLevels)

        // ===== TASK 1: Get SkinnedMesh and bones from GLB =====
        // The app's model IS the pistol GLB, so we clone the entire app hierarchy
        console.log('[pistol] Initializing pistol for player:', player.name)

        // Try multiple possible node names from your GLB structure
        const possibleNames = [
          'CombatPistolSkin',
          'CombatPistol',
          'Pistol',
          'PistolSkin',
          // If none found, we'll just clone the whole app
        ]

        // Search for the skinned mesh node
        let foundNode = null
        for (const name of possibleNames) {
          foundNode = app.get(name)
          if (foundNode) {
            console.log(`[pistol] Found mesh node: ${name}`)
            break
          }
        }

        // If no specific node found, clone the entire app's model
        if (!foundNode) {
          console.warn('[pistol] No specific mesh found, cloning entire app model')
          // Clone the whole app hierarchy as fallback
          pistolSkin = app.clone(true)
        } else {
          pistolSkin = foundNode.clone(true)
        }

        // Safety check
        if (!pistolSkin) {
          console.error('[pistol] CRITICAL: Could not create pistol instance!')
          console.error(
            '[pistol] App children:',
            app.children.map(c => c.id)
          )
          return
        }

        world.add(pistolSkin)
        console.log('[pistol] Pistol instance created and added to world')

        // ===== HIDE PICKUP ACTION when pistol is equipped =====
        if (pickupAction) {
          pickupAction.active = false
          debugLog('Hiding pickup action (pistol equipped)')
        } else {
          debugLog('Pickup action not found when trying to hide')
        }

        // ===== DEBUG: Check for animations on pistol model =====
        console.log('[pistol] Checking for animations on pistol model...')
        let hasAnimations = false
        app.traverse(node => {
          if (node.anims && node.anims.length > 0) {
            console.log(`[pistol] Found node with animations: ${node.id}`, node.anims)
            hasAnimations = true
          }
        })
        if (!hasAnimations) {
          console.warn('[pistol] No animations found on pistol model - check your GLB has animations')
        }

        // ===== Get bone references for positioning =====
        // Note: getBone returns { position, quaternion, rotation, scale, matrixWorld }
        // These might be null if not a SkinnedMesh, which is okay
        if (pistolSkin.getBone) {
          muzzleBone = pistolSkin.getBone('Gun_Muzzle')
          ejectBone = pistolSkin.getBone('Gun_VFX_Eject')
          gripBone = pistolSkin.getBone('Gun_GripR')
          magazineMesh = pistolSkin.getBone('WAPClip')

          if (!muzzleBone) console.warn('[pistol] Gun_Muzzle bone not found - will use fallback positioning')
          if (!ejectBone) console.warn('[pistol] Gun_VFX_Eject bone not found - no shell casing ejection')
          if (!gripBone) console.warn('[pistol] Gun_GripR bone not found - will use fallback positioning')
          if (!magazineMesh) console.warn("[pistol] WAPClip bone not found - magazine won't be visible")

          // ===== Calculate grip offset ONCE during init =====
          // This offset is in the pistol's local space and won't change
          if (gripBone && gripBone.position) {
            gripOffset.copy(gripBone.position)
            console.log('[pistol] Grip offset calculated:', gripOffset.toArray())
          }
        } else {
          console.warn("[pistol] Not a SkinnedMesh - bone animations won't work")
        }

        // Initialize ammo
        ammo = props.maxAmmo || 100
        console.log(`[pistol] Pistol initialized with ${ammo} rounds`)

        // Get control handle for local player
        control = player.local ? app.control() : null
        console.log('[pistol] Control object created:', !!control, 'player.local:', player.local)

        // Capture ADS button to prevent default behavior
        if (control) {
          const adsButton = props.adsButton || 'mouseRight'
          if (control[adsButton]) {
            control[adsButton].capture = true
            console.log('[pistol] Captured ADS button:', adsButton)
          }

          // Also capture fire button
          const fireButton = props.fireButton || 'mouseLeft'
          if (control[fireButton]) {
            control[fireButton].capture = true
            console.log('[pistol] Captured fire button:', fireButton)
          }
        }