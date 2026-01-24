// Projectile-based Pistol Item for @elementals/ - v1764864708
const MIN_DMG = 20
const MAX_DMG = 40
const CRIT_CHANCE = 0.2
const CRIT_MULTIPLIER = 1.8
const PROJECTILE_SPEED = 50 // Faster for "bullet" feel
const PROJECTILE_LIFETIME = 3 // Shorter  lifetime for bullets
const RANGE = 100 // Longer range for a pistol
const FIRE_RATE = 0.1 // Cooldown in seconds between shots (reduced for testing)

const v1 = new Vector3()
const v2 = new Vector3()
const v3 = new Vector3()
const q1 = new Quaternion()
const e1 = new Euler(0, 0, 0, 'YXZ')

// ===== GLOBAL VARIABLES =====
let pickupAction = null // Pickup action for the pistol

// ===== DEBUG HELPER =====
function debugLog(...args) {
  if (props.debugLogs) {
    console.log('[pistol]', ...args)
  }
}

createItem(({ player, hooks }) => {
  // ===== CLIENT & SERVER SHARED =====
  let pistolSkin // The main SkinnedMesh (CombatPistolSkin)
  let magazineMesh // Magazine mesh (WAPClip bone/mesh)
  let muzzleBone // Gun_Muzzle bone for muzzle flash position
  let ejectBone // Gun_VFX_Eject bone for shell casing ejection
  let gripBone // Gun_GripR bone for hand attachment
  const gripOffset = new Vector3() // Cached grip bone offset (local space)

  let control
  let lastFireTime = 0
  let ammo = props.maxAmmo || 100 // Start with full ammo
  const projectiles = new Map() // Track active bullets
  const projectileUpdateHandlers = new Map() // Track update handlers for cleanup
  let mobileShootBtn = null // Mobile shoot button UI element
  let mobileAdsBtn = null // Mobile ADS button UI element


  // Helper function to check if player has ammunition available
  function checkHasAmmunition() {
    if (ammo > 0) {
      return true
    }
    console.log('[pistol] Out of ammo!')
    return false
  }

  // Helper function to get current ammo count for inventory display
  function getAmmoCount() {
    return ammo
  }

  // Helper function to get max ammo count for inventory display
  function getMaxAmmoCount() {
    return props.maxAmmo || 100
  }

  // Reload function - restore ammo
  function reloadPistol() {
    const maxAmmo = props.maxAmmo || 100
    if (ammo >= maxAmmo) {
      debugLog('Already at max ammo')
      return
    }

    ammo = maxAmmo
    debugLog(`Reloaded! Ammo: ${ammo}/${maxAmmo}`)

    // Notify core inventory of ammo change
    if (props.showAmmoCount) {
      world.emit('elemental-item:ammo-update', {
        playerId: player.id,
        itemId: props.id,
        ammo: ammo,
        maxAmmo: maxAmmo
      })
    }

    // Play BOTH pistol model animation AND player animation
    playPistolAnimation('EmoteReload')
    playSound('reloadSound')

    // Play reload animation
    const reloadUrl = getAnimationUrl('reload')
    if (reloadUrl) {
      setPistolState('reloading')
      playAnimation(reloadUrl, {
        duration: props.reloadDuration || 0.917,
        loop: false,
        fadeDuration: 0.2,
        isPose: true, // Mark as pose animation to use additive blending
      })

      // Reload animation is now additive, so we just need to restore the appropriate pose
      const reloadDuration = props.reloadDuration || 0.917
      setTimeout(() => {
        console.log('[pistol] Reload animation completed, restoring pose')
        console.log('[pistol] Current pistol state:', pistolState)
        console.log('[pistol] Is aiming:', isAiming)
        console.log('[pistol] Additive system available:', !!player.applyAdditiveAnimation)
        console.log('[pistol] Player.avatar exists:', !!player.avatar)

        // CRITICAL: Reset currentAnimation so maintenance system knows to reapply poses
        currentAnimation = null
        console.log('[pistol] Reset currentAnimation to null for pose maintenance')


        // Since reload is now additive, we can immediately restore the pose
        console.log('[pistol] Calling returnToIdleState() immediately (reload is additive)')
        returnToIdleState()
      }, reloadDuration * 1000 + 500) // Add 500ms delay to ensure additive animation has time to load
    } else {
      // No reload animation, just restore pose immediately
      console.log('[pistol] No reload animation, restoring pose immediately')
      returnToIdleState()
    }

    // Notify server
    hooks.call('reload', { ammo })
  }

  // Helper function to get animation URL based on configuration
  function getAnimationUrl(animType) {
    const emoteKey = `${animType}Emote`
    console.log(`[pistol] Looking for ${animType} animation with key: ${emoteKey}`)
    console.log(`[pistol] ${emoteKey} value:`, props[emoteKey])

    if (props[emoteKey] && props[emoteKey].url) {
      const url = props[emoteKey].url
      console.log(`[pistol] ${animType} animation URL:`, url)

      // Validate URL to prevent crashes in VRM system
      try {
        // Check if URL is valid - support both asset:// and http:// URLs
        if (typeof url === 'string' && url.trim() && (url.startsWith('asset://') || url.startsWith('http'))) {
          console.log(`[pistol] Found valid ${animType} animation:`, url)
          return url
        } else {
          console.warn(`[pistol] Invalid ${animType} animation URL format:`, url)
        }
      } catch (error) {
        console.warn(`[pistol] Invalid ${animType} animation URL:`, url, error)
      }
    } else {
      console.log(`[pistol] No ${animType} animation configured`)
    }

    return null
  }


  // Helper function to play animation with additive support
  function playAnimation(animUrl, options = {}) {
    if (!animUrl) {
      console.log(`[pistol] V2.0 - No animation URL provided, skipping animation`)
      return
    }

    // Only check cooldown for non-looping animations to prevent spam
    const now = world.getTime()
    if (!options.loop && now - animationCooldown < 0.05) {
      console.log(`[pistol] Animation cooldown active, skipping: ${animUrl}`)
      return
    }

    console.log(`[pistol] Playing animation: ${animUrl} with options:`, options)

    // Check if this is a pose animation (should use additive) or action animation (should use standard emote)
    const isPoseAnimation = options.isPose || animUrl.includes('grip') || animUrl.includes('aim') || animUrl.includes('idle') || animUrl.includes('Idle') || animUrl.includes('PistolIdle') || animUrl.includes('AimIdle') || animUrl.includes('fire') || animUrl.includes('reload') || animUrl.includes('Fire') || animUrl.includes('Reload')
    const isActionAnimation = options.isAction || animUrl.includes('equip') || animUrl.includes('Equip')

    // CRITICAL: For non-looping animations, use a unique URL to force replay
    // The VRM system caches animations by URL, so we need to make each call unique
    // Define uniqueUrl here so it's available in all scopes
    const uniqueUrl = options.loop !== false ? animUrl : animUrl + (animUrl.includes('?') ? '&' : '?') + '_t=' + Date.now()

    console.log(`[pistol] Animation analysis:`, {
      animUrl,
      uniqueUrl,
      isPoseAnimation,
      isActionAnimation,
      applyAdditiveAnimation: !!player.applyAdditiveAnimation,
      propsUseAdditive: props.useAdditiveAnimations
    })

    if (isPoseAnimation) {
      // ONLY use additive system for poses - no fallback to standard emotes
      if (player.applyAdditiveAnimation) {
        console.log(`[pistol] Using ADDITIVE animation for pose: ${animUrl}`)

        console.log('[pistol] DEBUG FLAG CHECK:', {
          'props.debugArmRotations': props.debugArmRotations,
          'typeof props.debugArmRotations': typeof props.debugArmRotations,
          'props.debugArmRotations === true': props.debugArmRotations === true,
          'props.debugArmRotations == true': props.debugArmRotations == true,
          'Boolean(props.debugArmRotations)': Boolean(props.debugArmRotations)
        })

        console.log(`[pistol] Using ${options.loop !== false ? 'standard' : 'unique'} URL: ${uniqueUrl}`)

        player.applyAdditiveAnimation(uniqueUrl, {
          weight: (options.weight || 1.0) * (props.pistolAnimationWeight || 1.0),
          fadeDuration: options.fadeDuration || 0.15,
          loop: options.loop !== false, // Default to true unless explicitly set to false
          onComplete: options.onComplete,
          // Pass configuration values for VRM system
          configurableSmoothing: props.animationSmoothing || 0.3,
          adaptiveSmoothing: props.adaptiveSmoothing !== false,
          baseLocomotionWeight: props.baseLocomotionWeight || 0.0,
          conflictResolutionMode: props.conflictResolutionMode || 'additive_priority',
          maxBoneRotation: props.maxBoneRotation || 15,
          disableLeftArm: props.disableLeftArm === true,
          disableRightArm: props.disableRightArm === true,
          debugArmRotations: props.debugArmRotations === true,
          rotationScale: props.rotationScale || 0.3,
          disableEngineIdle: props.disableEngineIdle === true,
        })
      } else {
        console.log(`[pistol] Pose animation requires additive system, skipping: ${animUrl}`)
        console.log(`[pistol] Additive system unavailable - cannot play pose animation`)
        return null
      }
    } else if (isActionAnimation) {
      // ONLY use standard emotes for actions - these temporarily replace locomotion
      console.log(`[pistol] Using STANDARD emote for action: ${animUrl}`)

      // Clear additive animations before action to prevent conflicts
      if (player.clearAdditiveAnimations) {
        console.log(`[pistol] Clearing additive animations before action`)
        player.clearAdditiveAnimations({ fadeDuration: 0.1 })
      }

      // Try multiple methods to play standard emote
      try {
        let emoteSet = false

        // Try player.avatar.setEmote first (most reliable)
        if (player.avatar && player.avatar.setEmote && !emoteSet) {
          console.log(`[pistol] Setting emote via player.avatar.setEmote: ${animUrl}`)
          player.avatar.setEmote(animUrl)
          emoteSet = true
        }

        // Try world.getPlayer() as fallback
        if (!emoteSet) {
          const worldPlayer = world.getPlayer()
          if (worldPlayer && worldPlayer.avatar && worldPlayer.avatar.setEmote) {
            console.log(`[pistol] Setting emote via worldPlayer.avatar.setEmote: ${animUrl}`)
            worldPlayer.avatar.setEmote(animUrl)
            emoteSet = true
          }
        }

        // Try player.modify
        if (player.modify && !emoteSet) {
          console.log(`[pistol] Setting emote via player.modify: ${animUrl}`)
          player.modify({
            effect: {
              emote: animUrl,
              duration: options.duration || 0,
              cancellable: false,
              loop: options.loop || false,
              priority: options.priority || 1,
            }
          })
          emoteSet = true
        }

        // Try player.playEmote
        if (player.playEmote && !emoteSet) {
          console.log(`[pistol] Setting emote via player.playEmote: ${animUrl}`)
          player.playEmote(animUrl, options.duration || 0)
          emoteSet = true
        }

        // Try player.setEmote
        if (player.setEmote && !emoteSet) {
          console.log(`[pistol] Setting emote via player.setEmote: ${animUrl}`)
          player.setEmote(animUrl)
          emoteSet = true
        }

        // Try player.emote property
        if (player.emote !== undefined && !emoteSet) {
          console.log(`[pistol] Setting emote via player.emote: ${animUrl}`)
          player.emote = animUrl
          emoteSet = true
        }

        if (!emoteSet) {
          console.log(`[pistol] No emote method available for action!`)
          console.log(`[pistol] Available player methods:`, Object.getOwnPropertyNames(player))
          return null
        }
      } catch (error) {
        console.log(`[pistol] Emote error:`, error)
        return null
      }
    } else {
      console.log(`[pistol] Unknown animation type: ${animUrl}`)
      return null
    }

    // Track current animation and set cooldown only for non-looping animations
    // Use uniqueUrl for non-looping animations to match what was actually played
    currentAnimation = options.loop !== false ? animUrl : uniqueUrl
    if (!options.loop) {
      animationCooldown = now
    }

    console.log(`[pistol] Animation tracking - currentAnimation: ${currentAnimation}, cooldown: ${animationCooldown}, time: ${now}`)
  }

  // Helper function to clear all animations and reset to default
  function clearAllAnimations() {
    console.log('[pistol] Clearing additive animations and resetting to default')

    // Only clear additive animations - don't try to clear standard emotes
    if (player.clearAdditiveAnimations) {
      player.clearAdditiveAnimations({ fadeDuration: 0.2 })
      console.log('[pistol] Cleared additive animations')
    } else {
      console.log('[pistol] Additive animation system unavailable - cannot clear')
    }

    // Reset tracking
    currentAnimation = null
    animationCooldown = 0
  }

  // Helper function to force reset animation state (for debugging)
  function resetAnimationState() {
    console.log('[pistol] Force resetting animation state')
    currentAnimation = null
    animationCooldown = 0
    clearAllAnimations()
  }

  // Helper function to play pistol grip animation
  function playPistolGripAnimation() {
    // console.log('[pistol] ===== PLAY PISTOL GRIP ANIMATION DEBUG =====')
    // console.log('[pistol] Playing pistol grip animation')

    // Play pistol idle animation if available
    const pistolIdleUrl = getAnimationUrl('pistolIdle')
    // console.log('[pistol] pistolIdleUrl:', pistolIdleUrl)
    // console.log('[pistol] player.applyAdditiveAnimation exists:', !!player.applyAdditiveAnimation)

    if (pistolIdleUrl && player.applyAdditiveAnimation) {
      // console.log('[pistol] Applying grip pose via additive system')
      // console.log('[pistol] About to call player.applyAdditiveAnimation with URL:', pistolIdleUrl)

      try {
        player.applyAdditiveAnimation(pistolIdleUrl, {
          weight: 1.0,
          loop: true,
          fadeDuration: 0.3,
          debugArmRotations: props.debugArmRotations === true
        })
        // console.log('[pistol] Grip pose applied via additive system - SUCCESS')
      } catch (error) {
        console.error('[pistol] Error applying grip pose:', error)
      }
    } else {
      // console.log('[pistol] No pistolIdle animation or additive system unavailable')
      if (!pistolIdleUrl) {
        // console.log('[pistol] No pistolIdle animation configured - letting natural locomotion continue')
      }
      if (!player.applyAdditiveAnimation) {
        // console.log('[pistol] Additive animation system unavailable')
      }
    }
    // console.log('[pistol] ===== END PLAY PISTOL GRIP ANIMATION DEBUG =====')
  }

  // Helper function to play aim animation
  function playAimAnimation() {
    // console.log('[pistol] Playing aim animation')

    // Play aim idle animation
    const aimIdleUrl = getAnimationUrl('aimIdle')
    if (aimIdleUrl && player.applyAdditiveAnimation) {
      // console.log('[pistol] Applying aim pose via additive system')
      player.applyAdditiveAnimation(aimIdleUrl, {
        weight: 1.0,
        loop: true,
        fadeDuration: 0.3,
        debugArmRotations: props.debugArmRotations === true
      })
      // console.log('[pistol] Aim pose applied via additive system')
    } else {
      // console.log('[pistol] No aimIdle animation or additive system unavailable')
      if (!aimIdleUrl) {
        // console.log('[pistol] No aimIdle animation configured')
      }
      if (!player.applyAdditiveAnimation) {
        // console.log('[pistol] Additive animation system unavailable')
      }
    }
  }

  // Helper function to transition to up pose (aiming)
  function transitionToUpPose() {
    console.log('[pistol] Transitioning to UP pose (aiming)')
    playAimAnimation()
  }

  // Helper function to transition to down pose (not aiming)
  function transitionToDownPose() {
    console.log('[pistol] Transitioning to DOWN pose (not aiming)')
    playPistolGripAnimation()
  }

  // Helper function to update pose weights for smooth crossfading
  function updatePoseWeights(delta) {
    // This function handles smooth transitions between pose weights
    // Currently a placeholder for future implementation
    // The actual pose management is handled by the additive animation system
  }

  // Helper function to detect player movement state
  function getPlayerMovementState() {
    if (!control) return 'idle'

    // Check if player is moving (WASD keys)
    const isMoving = (control.keyW && control.keyW.down) ||
      (control.keyA && control.keyA.down) ||
      (control.keyS && control.keyS.down) ||
      (control.keyD && control.keyD.down)

    // Check if player is running (Shift key)
    const isRunning = control.keyShift && control.keyShift.down

    if (isRunning && isMoving) return 'run'
    if (isMoving) return 'walk'
    return 'idle'
  }

  // Helper function to play movement-based animation
  function playMovementAnimation() {
    const movementState = getPlayerMovementState()
    console.log(`[pistol] Player movement state: ${movementState}`)

    let animType = ''
    if (isAiming) {
      // Aiming animations
      if (movementState === 'run') animType = 'aimRun'
      else if (movementState === 'walk') animType = 'aimWalk'
      else animType = 'aimIdle'
    } else {
      // Pistol grip animations
      if (movementState === 'run') animType = 'pistolRun'
      else if (movementState === 'walk') animType = 'pistolWalk'
      else animType = 'pistolIdle'
    }

    const animUrl = getAnimationUrl(animType)
    if (animUrl && player.applyAdditiveAnimation) {
      console.log(`[pistol] Playing ${animType} animation for ${movementState} state`)
      player.applyAdditiveAnimation(animUrl, {
        weight: 1.0,
        loop: true,
        fadeDuration: 0.2,
        debugArmRotations: props.debugArmRotations === true
      })
    } else {
      console.log(`[pistol] No ${animType} animation configured, falling back to basic pose`)
      // Fallback to basic pose
      if (isAiming) {
        playAimAnimation()
      } else {
        playPistolGripAnimation()
      }
    }
  }

  // Helper function to play pistol model animations
  function playPistolAnimation(animName, loop = false) {
    console.log(`[pistol] Attempting to play pistol animation: ${animName}, loop: ${loop}`)

    // CRITICAL FIX: Play on the cloned pistolSkin, not the original app
    let foundAnim = false
    if (pistolSkin) {
      // Traverse the cloned pistolSkin to find and play animations
      pistolSkin.traverse(node => {
        if (node.anims && node.anims.includes(animName)) {
          console.log(`[pistol] Found animation '${animName}' on cloned node: ${node.id}`)

          // Stop current animation first to allow restart
          if (node.stop) {
            node.stop({ fade: 0 }) // Stop with no fade for instant restart
          }

          node.play({ name: animName, loop: loop, fade: 0.1 })
          foundAnim = true
        }
      })
    }

    if (!foundAnim) {
      console.warn(`[pistol] Animation '${animName}' not found on cloned pistolSkin`)
      if (pistolSkin) {
        console.log('[pistol] Available animations on cloned pistolSkin:')
        pistolSkin.traverse(node => {
          if (node.anims && node.anims.length > 0) {
            console.log(`  - Node ${node.id}:`, node.anims)
          }
        })
      }
    } else {
      console.log(`[pistol] Successfully started pistol animation: ${animName}`)
    }
  }

  // Helper function to play sound effects
  function playSound(soundType) {
    const soundUrl = props[soundType]?.url
    if (!soundUrl) return

    const audio = app.create('audio')
    audio.src = soundUrl
    audio.spatial = true
    audio.volume = 0.8
    audio.group = 'sfx'

    // Configure spatial audio properties for better 3D sound
    audio.distanceModel = 'exponential'
    audio.refDistance = 1
    audio.maxDistance = 50
    audio.rolloffFactor = 2

    // Position at muzzle if available, otherwise at pistol position
    if (muzzleBone && muzzleBone.matrixWorld && world.isClient) {
      const muzzlePos = new Vector3()
      muzzlePos.setFromMatrixPosition(muzzleBone.matrixWorld)
      audio.position.copy(muzzlePos)
      debugLog(`Playing spatial sound at muzzle position:`, muzzlePos.toArray())
    } else if (pistolSkin) {
      audio.position.copy(pistolSkin.position)
      debugLog(`Playing spatial sound at pistol position:`, pistolSkin.position.toArray())
    }

    world.add(audio)
    audio.play()
    debugLog(`Spatial gunshot sound played - other players should hear this!`)

    // Auto-cleanup after sound finishes
    setTimeout(() => {
      world.remove(audio)
    }, 2000)
  }

  // Helper function to create muzzle flash burst
  function createMuzzleFlash() {
    if (!props.enableParticles || !muzzleBone || !muzzleBone.matrixWorld) return

    // Create particle-based muzzle flash
    const muzzleFlash = app.create('particles', {
      shape: ['sphere', 0.1, 1],
      direction: 1,
      rate: 0,
      max: 30,
      bursts: [
        { time: 0, count: 30 }
      ],
      color: props.muzzleFlashColor || '#ffaa00',
      size: '0.05~0.15',
      alphaOverLife: '1,1|1,0',
      emissive: '10',
      speed: '2~5',
      life: '0.1~0.3'
    })

    // Position at muzzle bone
    const muzzlePos = new Vector3()
    muzzlePos.setFromMatrixPosition(muzzleBone.matrixWorld)
    muzzleFlash.position.copy(muzzlePos)

    world.add(muzzleFlash)

    // Remove after particles fade
    setTimeout(() => {
      world.remove(muzzleFlash)
    }, 500)
  }


  // Helper function to create shell casing ejection
  function createShellEjection() {
    if (!props.enableParticles || !ejectBone || !ejectBone.matrixWorld) return

    const shellCasing = app.create('particles', {
      shape: ['sphere', 0.02, 0.5], // Smaller, more detailed particles
      direction: 1,
      rate: 0,
      max: 8,
      bursts: [
        { time: 0, count: 8 } // Fewer, more realistic count
      ],
      color: props.shellCasingColor || '#c0c0c0', // Metallic silver
      size: '0.008~0.015', // Much smaller particles
      alphaOverLife: '1,1|0.8,0',
      emissive: '0.5', // Subtle glow
      speed: '1~3', // Slower, more realistic
      life: '0.5~1.2', // Longer life for visibility
      gravity: '0.5' // Add gravity for realistic fall
    })

    // Position at ejection bone
    const ejectPos = new Vector3()
    ejectPos.setFromMatrixPosition(ejectBone.matrixWorld)
    shellCasing.position.copy(ejectPos)

    world.add(shellCasing)

    // Remove after particles fade
    setTimeout(() => {
      world.remove(shellCasing)
    }, 1500)
  }

  // Helper function to create bullet trail particle
  function createBulletTrail(startPos, direction) {
    if (!props.enableParticles) return null

    const trail = app.create('particles', {
      shape: ['sphere', 0.01, 1],
      direction: 1,
      rate: 0,
      color: props.bulletTrailColor || '#ffff00',
      rateOverDistance: 50,
      life: '0.05~0.15',
      size: '0.005~0.015',
      alphaOverLife: '1,1|1,0',
      emissive: '8'
    })

    trail.position.copy(startPos)
    world.add(trail)

    return trail
  }

  // Helper function to create impact spark effect
  function createImpactSparks(position) {
    if (!props.enableParticles) return

    const sparks = app.create('particles', {
      shape: ['sphere', 0.1, 1],
      direction: 1,
      rate: 0,
      max: 15,
      bursts: [
        { time: 0, count: 15 }
      ],
      color: props.impactSparkColor || '#ff8800',
      size: '0.02~0.08',
      alphaOverLife: '1,1|1,0',
      emissive: '10',
      speed: '1~4',
      life: '0.1~0.3',
      force: new Vector3(0, -5, 0)
    })

    sparks.position.copy(position)
    world.add(sparks)

    // Play impact sound
    playSound('impactSound')

    // Remove after particles fade
    setTimeout(() => {
      world.remove(sparks)
    }, 400)
  }


  // Client-scoped variables (accessible in all client methods)
  let zoomLevels = []
  let currentZoomLevelIndex = 0
  let currentZoom = 1.5
  let targetZoom = 1.5
  let isAiming = false
  let aimIdleAnimationUrl = null
  let currentAnimation = null // Track current additive animation
  let animationCooldown = 0 // Prevent rapid animation changes
  const ZOOM_TRANSITION_SPEED = 8.0

  // Pistol state management for proper transitions
  let pistolState = 'unequipped' // 'unequipped', 'equipped', 'aiming', 'firing', 'reloading'

  // State transition functions
  function setPistolState(newState) {
    console.log(`[pistol] State transition: ${pistolState} → ${newState}`)
    pistolState = newState
  }

  function returnToIdleState() {
    console.log(`[pistol] ===== RETURN TO IDLE STATE DEBUG =====`)
    console.log(`[pistol] Returning to idle state from: ${pistolState}`)
    console.log(`[pistol] Is aiming: ${isAiming}`)
    console.log(`[pistol] Additive system available: ${!!player.applyAdditiveAnimation}`)
    console.log(`[pistol] Player.avatar exists: ${!!player.avatar}`)
    if (player.avatar) {
      console.log(`[pistol] Player.avatar.instance exists: ${!!player.avatar.instance}`)
      if (player.avatar.instance) {
        console.log(`[pistol] Player.avatar.instance.setAdditiveAnimation exists: ${!!player.avatar.instance.setAdditiveAnimation}`)
        console.log(`[pistol] Current additive animations: ${player.avatar.instance.getAdditiveAnimations?.() || 'method not available'}`)
      }
    }

    // Wait for additive animation system to be available
    if (!player.applyAdditiveAnimation) {
      console.log('[pistol] Additive animation system temporarily unavailable, retrying in 100ms...')
      setTimeout(() => {
        console.log('[pistol] Retrying returnToIdleState after delay...')
        returnToIdleState()
      }, 100)
      return
    }

    // Determine the correct state based on aiming status
    if (isAiming) {
      // Return to aim idle
      const aimIdleUrl = getAnimationUrl('aimIdle')
      console.log(`[pistol] Aim idle URL: ${aimIdleUrl}`)
      if (aimIdleUrl && player.applyAdditiveAnimation) {
        console.log('[pistol] Reapplying aim pose via additive system')
        try {
          player.applyAdditiveAnimation(aimIdleUrl, {
            weight: 1.0,
            loop: true,
            fadeDuration: 0.3,
            debugArmRotations: props.debugArmRotations === true
          })
          setPistolState('aiming')
          console.log('[pistol] Aim pose reapplied successfully')
        } catch (error) {
          console.error('[pistol] Error reapplying aim pose:', error)
        }
      } else {
        console.log('[pistol] Cannot reapply aim pose - additive system unavailable or no URL')
        if (!aimIdleUrl) console.log('[pistol] No aimIdle animation configured')
        if (!player.applyAdditiveAnimation) console.log('[pistol] Additive animation system unavailable')
      }
    } else {
      // Return to pistol grip idle
      const pistolIdleUrl = getAnimationUrl('pistolIdle')
      console.log(`[pistol] Pistol idle URL: ${pistolIdleUrl}`)
      if (pistolIdleUrl && player.applyAdditiveAnimation) {
        console.log('[pistol] Reapplying grip pose via additive system')
        try {
          player.applyAdditiveAnimation(pistolIdleUrl, {
            weight: 1.0,
            loop: true,
            fadeDuration: 0.3,
            debugArmRotations: props.debugArmRotations === true
          })
          setPistolState('equipped')
          console.log('[pistol] Grip pose reapplied successfully')
        } catch (error) {
          console.error('[pistol] Error reapplying grip pose:', error)
        }
      } else {
        console.log('[pistol] Cannot reapply grip pose - additive system unavailable or no URL')
        if (!pistolIdleUrl) console.log('[pistol] No pistolIdle animation configured')
        if (!player.applyAdditiveAnimation) console.log('[pistol] Additive animation system unavailable')
      }
    }

  }

  // Debug function to test additive blending
  function testAdditiveBlending() {
    console.log(`[pistol] Testing additive blending...`)
    console.log(`[pistol] props.useAdditiveAnimations:`, props.useAdditiveAnimations)
    console.log(`[pistol] player.applyAdditiveAnimation exists:`, !!player.applyAdditiveAnimation)
    console.log(`[pistol] player.clearAdditiveAnimations exists:`, !!player.clearAdditiveAnimations)

    const testUrl = getAnimationUrl('aimIdle')
    console.log(`[pistol] Test URL: ${testUrl}`)

    if (testUrl && player.applyAdditiveAnimation) {
      console.log(`[pistol] Attempting to play test additive animation...`)
      player.applyAdditiveAnimation(testUrl, {
        weight: 1.0,
        loop: true,
        fadeDuration: 0.3,
        debugArmRotations: props.debugArmRotations === true
      })
    } else {
      console.log(`[pistol] Testing via playAnimation with isPose flag...`)
      if (testUrl) {
        playAnimation(testUrl, { loop: true, duration: 2.0, isPose: true })
      }
    }
  }

  // Helper function to debug emote state
  function debugEmoteState() {
    console.log('[pistol] === EMOTE STATE DEBUG ===')
    console.log('[pistol] player.avatar exists:', !!player.avatar)
    if (player.avatar) {
      console.log('[pistol] player.avatar.emote:', player.avatar.emote)
      console.log('[pistol] player.avatar.instance exists:', !!player.avatar.instance)
      if (player.avatar.instance) {
        console.log('[pistol] player.avatar.instance.currentEmote:', player.avatar.instance.currentEmote)
        console.log('[pistol] player.avatar.instance.locomotionDisabled:', player.avatar.instance.locomotionDisabled)
      }
    }

    const worldPlayer = world.getPlayer()
    console.log('[pistol] worldPlayer.avatar exists:', !!worldPlayer?.avatar)
    if (worldPlayer?.avatar) {
      console.log('[pistol] worldPlayer.avatar.emote:', worldPlayer.avatar.emote)
      console.log('[pistol] worldPlayer.avatar.instance exists:', !!worldPlayer.avatar.instance)
      if (worldPlayer.avatar.instance) {
        console.log('[pistol] worldPlayer.avatar.instance.currentEmote:', worldPlayer.avatar.instance.currentEmote)
        console.log('[pistol] worldPlayer.avatar.instance.locomotionDisabled:', worldPlayer.avatar.instance.locomotionDisabled)
      }
    }
    console.log('[pistol] === END EMOTE STATE DEBUG ===')
  }

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

        // Create mobile buttons
        if (props.showMobileButtons && player.local) {
          console.log('[pistol] Creating mobile buttons')

          if (props.mobileShootButton) {
            mobileShootBtn = app.create('ui', {
              space: 'screen',
              width: 50,
              height: 50,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 25,
              pivot: 'top-right',
              position: [1, 1],
              offset: [-90, -160],
              cursor: 'pointer',
              onPointerDown: () => {
                const now = world.getTime()
                const canFire = now - lastFireTime > FIRE_RATE

                if (!canFire) return

                if (ammo <= 0) {
                  debugLog('Cannot fire - no ammo')
                  return
                }

                let dir
                if (control.camera && control.camera.quaternion) {
                  dir = v1.set(0, 0, -1).applyQuaternion(control.camera.quaternion)
                } else {
                  const e1 = new Euler(0, 0, 0, 'YXZ')
                  e1.setFromQuaternion(player.quaternion)
                  const q1 = new Quaternion()
                  q1.setFromEuler(e1)
                  dir = v1.set(0, 0, -1).applyQuaternion(q1)
                }

                // Rotate player to face camera direction (like dash.js)
                if (control.camera && control.camera.quaternion) {
                  e1.setFromQuaternion(control.camera.quaternion)
                  e1.x = 0 // Keep player upright
                  e1.z = 0 // Keep player upright
                  q1.setFromEuler(e1)

                  // Use applyEffect with turn:true to rotate player (like dash.js)
                  player.applyEffect({
                    turn: true, // This rotates the player to face the direction
                    duration: 0.1, // Quick rotation
                  })
                }

                const origin = player.position.clone()
                origin.y += 1.5

                if (muzzleBone && muzzleBone.matrixWorld) {
                  origin.setFromMatrixPosition(muzzleBone.matrixWorld)
                  const forwardOffset = dir.clone().multiplyScalar(0.3)
                  origin.add(forwardOffset)
                }

                hooks.call('fire', {
                  origin: origin.toArray(),
                  dir: dir.toArray(),
                  ammo,
                })
                lastFireTime = now

                ammo -= 1
                if (props.showAmmoCount) {
                  world.emit('elemental-item:ammo-update', {
                    playerId: player.id,
                    itemId: props.id,
                    ammo: ammo,
                    maxAmmo: props.maxAmmo || 100
                  })
                }

                playPistolAnimation('EmoteShoot')
                playSound('fireSound')
                createMuzzleFlash()
                createShellEjection()

                const fireUrl = getAnimationUrl('fire')
                if (fireUrl) {
                  setPistolState('firing')
                }
              },
              alignItems: 'center',
              justifyContent: 'center',
            })
            const shootLabel = app.create('uitext', {
              value: 'SHOOT',
              color: 'white',
              fontSize: 9,
              fontWeight: 'bold'
            })
            mobileShootBtn.add(shootLabel)
            app.add(mobileShootBtn)
            console.log('[pistol] Mobile shoot button created')
          }

          if (props.mobileAdsButton) {
            mobileAdsBtn = app.create('ui', {
              space: 'screen',
              width: 50,
              height: 50,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 25,
              pivot: 'top-right',
              position: [1, 1],
              offset: [-155, -155],
              cursor: 'pointer',
              onPointerDown: () => {
                isAiming = !isAiming
                debugLog('ADS toggled (mobile):', isAiming ? 'Aiming' : 'Not aiming')

                if (isAiming) {
                  setPistolState('aiming')
                  playAimAnimation()
                } else {
                  setPistolState('equipped')
                  playPistolGripAnimation()
                }
              },
              alignItems: 'center',
              justifyContent: 'center',
            })
            const adsLabel = app.create('uitext', {
              value: 'ADS',
              color: 'white',
              fontSize: 10,
              fontWeight: 'bold'
            })
            mobileAdsBtn.add(adsLabel)
            app.add(mobileAdsBtn)
            console.log('[pistol] Mobile ADS button created')
          }
        }

        // Clear any existing additive animations before equipping
        if (player.clearAdditiveAnimations) {
          console.log('[pistol] Clearing existing additive animations before equip')
          player.clearAdditiveAnimations({ fadeDuration: 0.1 })
        }

        // Clear any existing animations first
        clearAllAnimations()

        // Play equip animation (non-looping action)
        const equipUrl = getAnimationUrl('equip')
        if (equipUrl) {
          setPistolState('equipping')
          playAnimation(equipUrl, {
            duration: props.equipDuration || 0.5,
            loop: false,
            fadeDuration: 0.3,
            isAction: true, // Mark as action animation
          })
        }

        // Set initial pistol grip animation after equip
        const equipDuration = props.equipDuration || 0.5
        setTimeout(() => {
          console.log('[pistol] Equip animation completed, setting up grip pose')

          // CRITICAL: Reset currentAnimation so maintenance system knows to reapply poses
          currentAnimation = null
          console.log('[pistol] Reset currentAnimation to null for pose maintenance')

          setPistolState('equipped')
          playPistolGripAnimation()
        }, equipDuration * 1000)

        console.log('[pistol] Pistol equipped - natural locomotion preserved')

        // Take control of zoom system
        world.emit('weapon:take-zoom-control', { playerId: player.id, source: 'pistol' })

        console.log('[pistol] ✓ Pistol zoom system active')
        console.log('[pistol] Player has addBoneRotation method:', !!player.addBoneRotation)

        // Debug: List available bone names
        if (player.avatar && player.avatar.instance) {
          const avatar = player.avatar.instance
          if (avatar.bones) {
            const boneNames = Object.keys(avatar.bones)
            console.log('[pistol] Available bone names:', boneNames.slice(0, 10), '... (showing first 10)')
          }
        }

        // Debug: List all configured animations
        console.log('[pistol] Configured targeted action animations:')
        console.log('  - equip:', props.equipEmote?.url || 'not configured')
        console.log('  - fire:', props.fireEmote?.url || 'not configured')
        console.log('  - reload:', props.reloadEmote?.url || 'not configured')
        console.log('  - pistol idle:', props.pistolIdleEmote?.url || 'not configured')
        console.log('  - aim idle:', props.aimIdleEmote?.url || 'not configured')
        console.log('[pistol] Natural locomotion preserved - no overrides needed!')

        // Handle fire effects from server (projectile trail, muzzle flash, sound for other players)
        app.on('fireEffects', (data) => {
          // Don't show effects for local player firing (they play client-side)
          if (player.local) return

          const startPos = new Vector3().fromArray(data.start)
          const dir = new Vector3().fromArray(data.direction)
          const muzzlePos = data.muzzlePos ? new Vector3().fromArray(data.muzzlePos) : startPos

          // Play shot sound at muzzle position
          playSound('fireSound')

          // Create muzzle flash at the shooter's muzzle position
          if (props.enableParticles) {
            const muzzleFlash = app.create('particles', {
              shape: ['sphere', 0.1, 1],
              direction: 1,
              rate: 0,
              max: 30,
              bursts: [
                { time: 0, count: 30 }
              ],
              color: props.muzzleFlashColor || '#ffaa00',
              size: '0.05~0.15',
              alphaOverLife: '1,1|1,0',
              emissive: '10',
              speed: '2~5',
              life: '0.1~0.3'
            })
            muzzleFlash.position.copy(muzzlePos)
            world.add(muzzleFlash)

            // Remove after particles fade
            setTimeout(() => {
              world.remove(muzzleFlash)
            }, 500)
          }

          // Create bullet trail
          const trail = createBulletTrail(startPos, dir)
          if (!trail) return

          // Animate bullet travel
          const distance = data.distance
          const speed = PROJECTILE_SPEED
          let traveled = 0

          const updateHandler = (delta) => {
            const step = speed * delta
            traveled += step

            v1.copy(dir).multiplyScalar(step)
            trail.position.add(v1)

            // Check if reached target
            if (traveled >= distance) {
              // Create impact effect
              if (data.hit) {
                const impactPos = new Vector3().fromArray(data.hit.position)
                createImpactSparks(impactPos)
              }

              // Cleanup
              world.remove(trail)
              app.off('update', updateHandler)
            }
          }

          app.on('update', updateHandler)
        })

        // Handle reload effects from server (animation and sound for other players)
        app.on('reloadEffects', (data) => {
          // Don't show effects for local player (they play reload client-side)
          if (player.local) return

          const reloadUrl = getAnimationUrl('reload')
          if (reloadUrl) {
            setPistolState('reloading')
            playAnimation(reloadUrl, {
              duration: props.reloadDuration || 0.917,
              loop: false,
              fadeDuration: 0.2,
              isPose: true,
            })

            // Restore pose after reload
            const reloadDuration = props.reloadDuration || 0.917
            setTimeout(() => {
              // CRITICAL: Reset currentAnimation so maintenance system knows to reapply poses
              currentAnimation = null
              returnToIdleState()
            }, reloadDuration * 1000 + 500)
          }

          // Play reload sound
          playSound('reloadSound')

          // Play pistol model reload animation
          playPistolAnimation('EmoteReload')
        })
      },

      update(delta) {
        if (!control) return


        // ===== Get configurable keybinds =====
        const fireButton = props.fireButton || 'mouseLeft'
        const reloadButton = props.reloadButton || 'keyR'
        const requirePointerLock = props.requirePointerLock === true // Default false for easier testing

        // ===== TASK 4: Fire weapon with configurable button =====
        const fireInput = control?.[fireButton]
        const pointerLocked = control?.pointer?.locked
        const canFire = requirePointerLock ? pointerLocked : true

        // Debug control input availability (reduced logging)
        // if (isAiming && fireInput && fireInput.pressed) {
        //   console.log('[pistol] Fire button pressed while aiming - fireInput.pressed:', fireInput.pressed, 'canFire:', canFire)
        // }

        // Debug firing conditions
        // if (fireInput && fireInput.pressed) {
        //   console.log('[pistol] FIRE ATTEMPT - button:', fireButton, 'pressed:', fireInput.pressed, 'canFire:', canFire, 'requirePointerLock:', requirePointerLock, 'pointerLocked:', pointerLocked, 'isAiming:', isAiming, 'ammo:', ammo)
        // }

        if (fireInput && fireInput.pressed && canFire) {
          // console.log('[pistol] FIRE TRIGGERED - button:', fireButton, 'pressed:', fireInput.pressed, 'canFire:', canFire, 'isAiming:', isAiming)
          const now = world.getTime()

          if (now - lastFireTime > FIRE_RATE) {
            // Check if player has ammunition available
            if (!checkHasAmmunition()) {
              return
            }
            // Get firing direction from camera/reticle (full 3D aiming)
            let dir
            if (control.camera && control.camera.quaternion) {
              // Use camera direction directly for accurate aiming
              dir = v1.set(0, 0, -1).applyQuaternion(control.camera.quaternion)
            } else {
              // Fallback to player rotation if camera not available
              const e1 = new Euler(0, 0, 0, 'YXZ')
              e1.setFromQuaternion(player.quaternion)
              const q1 = new Quaternion()
              q1.setFromEuler(e1)
              dir = v1.set(0, 0, -1).applyQuaternion(q1)
            }

            // Rotate player to face camera direction (like dash.js)
            if (control.camera && control.camera.quaternion) {
              e1.setFromQuaternion(control.camera.quaternion)
              e1.x = 0 // Keep player upright
              e1.z = 0 // Keep player upright
              q1.setFromEuler(e1)

              // Use applyEffect with turn:true to rotate player (like dash.js)
              player.applyEffect({
                turn: true, // This rotates the player to face the direction
                duration: 0.1, // Quick rotation
              })
            }

            // Get muzzle position from bone (like tackle.js - project forward to avoid self-hits)
            const origin = player.position.clone()
            origin.y += 1.5 // Fallback height

            if (muzzleBone && muzzleBone.matrixWorld) {
              origin.setFromMatrixPosition(muzzleBone.matrixWorld)
              // Project origin significantly forward to avoid self-hits during movement
              // 2.0 units ensures we're well clear of the player's bounding box even during animations
              const forwardOffset = dir.clone().multiplyScalar(2.0)
              origin.add(forwardOffset)
            } else {
              // Fallback: Use camera direction from player's position if muzzle bone unavailable
              const forwardOffset = dir.clone().multiplyScalar(2.0)
              origin.add(forwardOffset)
            }

            // Send fire event to server
            // console.log(`[pistol] CLIENT: Sending fire event to server - ammo: ${ammo}`)
            hooks.call('fire', {
              origin: origin.toArray(),
              dir: dir.toArray(),
              ammo,
              // Client sends muzzle position for networking
              muzzlePos: muzzleBone && muzzleBone.matrixWorld ? new Vector3().setFromMatrixPosition(muzzleBone.matrixWorld).toArray() : null,
              worldPos: player.position.toArray() // For fallbacks
            })
            lastFireTime = now
            // console.log(`[pistol] CLIENT: Fire event sent`)

            // Visual feedback
            ammo -= 1
            // console.log(`[pistol] BANG! Ammo: ${ammo}/${props.maxAmmo || 100}`)

            // Notify core inventory of ammo change
            if (props.showAmmoCount) {
              world.emit('elemental-item:ammo-update', {
                playerId: player.id,
                itemId: props.id,
                ammo: ammo,
                maxAmmo: props.maxAmmo || 100
              })
            }

            // Play pistol model animation (visual feedback)
            playPistolAnimation('EmoteShoot')

            // Add sound and particle effects
            playSound('fireSound')
            createMuzzleFlash()
            createShellEjection()

            // Play fire animation
            const fireUrl = getAnimationUrl('fire')
            if (fireUrl) {
              setPistolState('firing')
              console.log('[pistol] ===== FIRE ANIMATION START DEBUG =====')
              console.log('[pistol] About to play fire animation as additive')
              console.log('[pistol] Player.avatar exists before fire:', !!player.avatar)
              console.log('[pistol] Additive system available before fire:', !!player.applyAdditiveAnimation)

              playAnimation(fireUrl, {
                duration: props.fireDuration || 0.3,
                loop: false,
                fadeDuration: 0.1,
                isPose: true, // Mark as pose animation to use additive blending
              })

              console.log('[pistol] Fire animation started, checking avatar state...')
              console.log('[pistol] Player.avatar exists after fire start:', !!player.avatar)
              console.log('[pistol] Additive system available after fire start:', !!player.applyAdditiveAnimation)

              // Fire animation is now additive, so we just need to restore the appropriate pose
              const fireDuration = props.fireDuration || 0.3
              setTimeout(() => {
                console.log('[pistol] ===== FIRE ANIMATION COMPLETION DEBUG =====')
                console.log('[pistol] Fire animation completed, restoring pose')
                console.log('[pistol] Current pistol state:', pistolState)
                console.log('[pistol] Is aiming:', isAiming)
                console.log('[pistol] Additive system available:', !!player.applyAdditiveAnimation)
                console.log('[pistol] Player.avatar exists:', !!player.avatar)

                // CRITICAL: Reset currentAnimation so maintenance system knows to reapply poses
                currentAnimation = null
                console.log('[pistol] Reset currentAnimation to null for pose maintenance')


                // Since fire is now additive, we can immediately restore the pose
                console.log('[pistol] Calling returnToIdleState() immediately (fire is additive)')
                returnToIdleState()
              }, fireDuration * 1000 + 500) // Add 500ms delay to ensure additive animation has time to load
            } else {
              // No fire animation, just restore pose immediately
              console.log('[pistol] No fire animation, restoring pose immediately')
              returnToIdleState()
            }
          }
        }

        // ===== Reload with configurable button =====
        const reloadInput = control[reloadButton]
        if (reloadInput && reloadInput.pressed) {
          reloadPistol()
        }

        // ===== Debug: Reset animation state with T key =====
        if (control.keyT && control.keyT.pressed) {
          console.log('[pistol] DEBUG: Resetting animation state')
          resetAnimationState()
        }

        // ===== Debug: Test additive blending with Y key =====
        if (control.keyY && control.keyY.pressed) {
          console.log('[pistol] DEBUG: Testing additive blending')
          testAdditiveBlending()
        }

        if (control.keyU && control.keyU.pressed) {
          console.log('[pistol] DEBUG: Checking emote state')
          debugEmoteState()
        }

        // ===== Detect ADS State with Toggle =====
        // Check if player toggled aiming (right-click pressed to toggle)
        const adsButton = props.adsButton || 'mouseRight'
        const adsInput = control[adsButton]
        const wasAiming = isAiming

        // Force capture the ADS button to prevent camera system from using it
        if (adsInput) {
          adsInput.capture = true

          // Only process ADS input if we're not in the middle of equipping
          const isEquipping = currentAnimation && currentAnimation.includes('equip')
          if (!isEquipping && adsInput.pressed) {
            isAiming = !isAiming
            debugLog('ADS toggled:', isAiming ? 'Aiming' : 'Not aiming')

            // Handle aim animations with proper state management
            if (isAiming) {
              // Transition to UP pose (arms raised)
              setPistolState('aiming')
              transitionToUpPose()
            } else {
              // Transition to DOWN pose (arms lowered)
              setPistolState('equipped')
              transitionToDownPose()
            }
          }
        }

        // ===== Movement-based animation system =====
        // Check if we should update animation based on movement state
        if (pistolState === 'equipped' || pistolState === 'aiming') {
          // Only update if we're not in the middle of an action animation
          const isActionAnimation = currentAnimation && (
            currentAnimation.includes('equip') ||
            currentAnimation.includes('fire') ||
            currentAnimation.includes('reload')
          )

          if (!isActionAnimation) {
            // Update animation based on current movement state
            playMovementAnimation()
          }
        }

        // ===== Animation maintenance is now handled by the animation system =====

        // ===== Continuous pose maintenance check =====
        // DISABLED: This was causing conflicts by reapplying animations too frequently
        // The returnToIdleState() function should handle pose restoration after actions
        /*
        if (pistolState === 'aiming' && !currentAnimation && player.applyAdditiveAnimation) {
          // Check if aim pose is still active
          const aimIdleUrl = getAnimationUrl('aimIdle')
          if (aimIdleUrl) {
            // Reapply aim pose to ensure it stays active
            console.log('[pistol] Reapplying aim pose for continuous maintenance')
            player.applyAdditiveAnimation(aimIdleUrl, {
              weight: 1.0,
              loop: true,
              fadeDuration: 0.1
            })
          }
        } else if (pistolState === 'equipped' && !currentAnimation && player.applyAdditiveAnimation) {
          // Check if grip pose is still active
          const pistolIdleUrl = getAnimationUrl('pistolIdle')
          if (pistolIdleUrl) {
            // Reapply grip pose to ensure it stays active
            console.log('[pistol] Reapplying grip pose for continuous maintenance')
            player.applyAdditiveAnimation(pistolIdleUrl, {
              weight: 1.0,
              loop: true,
              fadeDuration: 0.1
            })
          }
        }
        */

        // Debug ADS input state (removed excessive logging)

        // ===== Handle smooth zoom via focal length =====
        const adsFocalLength = props.adsFocalLength || 85
        const normalFocalLength = 24
        const zoomSpeed = props.zoomSpeed || 8.0 // How fast to interpolate between zoom levels

        // Initialize zoom state if not exists
        if (currentZoom === undefined) {
          currentZoom = normalFocalLength
          targetZoom = normalFocalLength
        }

        // Set target zoom based on aiming state
        if (isAiming) {
          targetZoom = adsFocalLength
        } else {
          targetZoom = normalFocalLength
        }

        // Smooth interpolation to target zoom
        if (Math.abs(currentZoom - targetZoom) > 0.1) {
          currentZoom += (targetZoom - currentZoom) * zoomSpeed * delta

          if (world.prefs?.setFocalLength) {
            world.prefs.setFocalLength(currentZoom)
            // console.log('[pistol] Smooth zoom:', Math.round(currentZoom) + 'mm focal length') // Commented out - zoom is working
          }
        }

        // ===== SKIP BONE ROTATION FOR NOW - FOCUS ON SHOOTING AND ZOOMING =====
        // Bone rotation system is broken - will fix later
        // if (isAiming) {
        //   // Bone rotation code removed for now
        // }

        // ===== Continuous pose maintenance check =====
        // DISABLED: This was causing conflicts by reapplying animations too frequently
        // The returnToIdleState() function should handle pose restoration after actions
        /*
        if (pistolState === 'aiming' && !currentAnimation && player.applyAdditiveAnimation) {
          // Check if aim pose is still active
          const aimIdleUrl = getAnimationUrl('aimIdle')
          if (aimIdleUrl) {
            // Reapply aim pose to ensure it stays active
            console.log('[pistol] Reapplying aim pose for continuous maintenance')
            player.applyAdditiveAnimation(aimIdleUrl, {
              weight: 1.0,
              loop: true,
              fadeDuration: 0.1
            })
          }
        } else if (pistolState === 'equipped' && !currentAnimation && player.applyAdditiveAnimation) {
          // Check if grip pose is still active
          const pistolIdleUrl = getAnimationUrl('pistolIdle')
          if (pistolIdleUrl) {
            // Reapply grip pose to ensure it stays active
            console.log('[pistol] Reapplying grip pose for continuous maintenance')
            player.applyAdditiveAnimation(pistolIdleUrl, {
              weight: 1.0,
              loop: true,
              fadeDuration: 0.1
            })
          }
        }
        */
      },

      lateUpdate(delta) {
        // ===== TASK 2: Anchor pistol grip bone to player's right hand =====
        if (!pistolSkin) return
        if (!pistolSkin.position) {
          console.error('[pistol] pistolSkin has no position property!')
          return
        }

        // Get player's right hand bone transform (world space)
        const handMatrix = player.getBoneTransform('rightHand')
        if (!handMatrix) {
          // Fallback: position at player's right side
          pistolSkin.position.copy(player.position)
          pistolSkin.position.x += 0.3 // Right side
          pistolSkin.position.y += 1.3 // Hand height
          pistolSkin.quaternion.copy(player.quaternion)
          return
        }

        // ===== SMART ANCHORING: Use grip bone as anchor point =====
        // Step 1: Get hand position and rotation from matrix
        pistolSkin.position.setFromMatrixPosition(handMatrix)
        pistolSkin.quaternion.setFromRotationMatrix(handMatrix)

        // Step 2: If we have a grip bone offset, apply it
        if (gripOffset.lengthSq() > 0) {
          // Transform the grip offset from pistol local space to world space
          const worldGripOffset = v1.copy(gripOffset)
          worldGripOffset.applyQuaternion(pistolSkin.quaternion)

          // Subtract the grip offset so the grip bone aligns with the hand
          pistolSkin.position.sub(worldGripOffset)
        }

        // ===== Apply configurable offsets and scale =====
        // Scale (from props)
        const scale = props.scale || 1
        pistolSkin.scale.setScalar(scale)

        // Position offsets (from props)
        const offsetX = props.offsetX || 0
        const offsetY = props.offsetY || 0
        const offsetZ = props.offsetZ || 0

        if (offsetX !== 0 || offsetY !== 0 || offsetZ !== 0) {
          // Apply offsets in local space (relative to hand orientation)
          const offset = v2.set(offsetX, offsetY, offsetZ)
          offset.applyQuaternion(pistolSkin.quaternion)
          pistolSkin.position.add(offset)
        }

        // Rotation offsets (from props)
        const rotX = props.rotationX || 0
        const rotY = props.rotationY || 0
        const rotZ = props.rotationZ || 0

        if (rotX !== 0 || rotY !== 0 || rotZ !== 0) {
          // Apply additional rotation in local space
          const additionalRotation = new Euler(rotX, rotY, rotZ, 'XYZ')
          const rotQuat = new Quaternion().setFromEuler(additionalRotation)
          pistolSkin.quaternion.multiply(rotQuat)
        }

        // ===== TASK 3: Show/hide magazine based on ammo =====
        // If magazine mesh exists, hide it when empty (optional visual)
        if (magazineMesh && magazineMesh.visible !== undefined) {
          magazineMesh.visible = ammo > 0
        }
      },

      // Called when server confirms fire
      fire(data) {
        // Update local ammo count from server
        ammo = data.ammo
      },

      // Called when server confirms reload
      reload(data) {
        ammo = data.ammo
        console.log(`[pistol] Server confirmed reload: ${ammo} rounds`)
      },

      destroy() {
        // Clean up pistol resources

        // Clear all animations and reset to default
        clearAllAnimations()

        // Reset zoom state and aiming
        isAiming = false
        currentZoomLevelIndex = 0
        currentZoom = 24 // Reset to normal focal length
        targetZoom = 24

        // Reset pistol state
        setPistolState('unequipped')

        // Reset camera to normal focal length
        if (world?.prefs?.setFocalLength) {
          world.prefs.setFocalLength(24)
          console.log('[pistol] Reset focal length to 24mm')
        }

        // Clear all additive animations from this weapon
        if (player && player.clearAdditiveAnimations) {
          player.clearAdditiveAnimations({ fadeDuration: 0.2 })
          console.log('[pistol] Cleared additive animations')
        }

        // Reset aim idle animation state
        aimIdleAnimationUrl = null
        currentAnimation = null

        // Release zoom control
        world.emit('weapon:release-zoom-control', { playerId: player.id, source: 'pistol' })

        console.log('[pistol] ✓ Aiming system cleaned up, zoom reset')

        if (pistolSkin) {
          world.remove(pistolSkin)
          pistolSkin = null
        }

        // Show pickup action again when pistol is unequipped
        if (pickupAction) {
          pickupAction.active = true
          debugLog('Showing pickup action (pistol unequipped)')
        } else {
          debugLog('Pickup action not found when trying to show')
        }

        // Release ADS button capture
        if (control) {
          const adsButton = props.adsButton || 'mouseRight'
          if (control[adsButton]) {
            control[adsButton].capture = false
            console.log('[pistol] Released ADS button:', adsButton)
          }
        }

        control?.release()

        // Remove mobile buttons if they exist
        if (mobileShootBtn) {
          app.remove(mobileShootBtn)
          mobileShootBtn = null
          console.log('[pistol] Removed mobile shoot button')
        }
        if (mobileAdsBtn) {
          app.remove(mobileAdsBtn)
          mobileAdsBtn = null
          console.log('[pistol] Removed mobile ADS button')
        }

        // Clean up all active projectiles to prevent memory leaks
        for (const [projectileId, projectile] of projectiles) {
          // Remove any world objects (like flash effects)
          if (projectile.flash) {
            world.remove(projectile.flash)
          }

          // Remove the update handler to prevent infinite loops
          const updateHandler = projectileUpdateHandlers.get(projectileId)
          if (updateHandler) {
            app.off('update', updateHandler)
          }
        }
        projectiles.clear()
        projectileUpdateHandlers.clear()

        // Don't call player.applyEffect during destruction - can cause freezes
        // The system will automatically clear effects when item is unequipped
      },

    },
    server: {
      init() {
        // Initialize server-side ammo tracking
        ammo = props.maxAmmo || 100
        console.log(`[pistol] Server: Pistol initialized with ${ammo} rounds`)
      },

      fire(data) {
        console.log(`[pistol] ========== FIRE START ==========`)
        console.log(`[pistol] server.fire() called - player: ${player.id}, ammo: ${ammo}, player.health: ${player.health}`)
        if (ammo <= 0) {
          console.log('[pistol] server.fire() - no ammo, returning')
          return
        }

        try {
          const origin = v1.fromArray(data.origin)
          const dir = v2.fromArray(data.dir).normalize()
          const layerMask = world.createLayerMask('player', 'environment')

          // ===== TASK 5: Authoritative raycast for hit detection =====
          const hit = world.raycast(origin, dir, RANGE, layerMask)
          const targetPos = hit ? hit.point : origin.clone().add(dir.multiplyScalar(RANGE))

          console.log(`[pistol] Raycast from:`, origin.toArray(), 'direction:', dir.toArray(), 'range:', RANGE)
          console.log(`[pistol] Raycast hit:`, hit ? 'HIT!' : 'no hit')
          if (hit) {
            console.log(`[pistol] Hit result properties:`, Object.keys(hit))
            console.log(`[pistol] Hit details:`, {
              playerId: hit.playerId,
              tag: hit.tag,
              entityId: hit.entityId,
              point: hit.point?.toArray(),
              distance: hit.distance
            })

            // Check if we hit a player (prevent self-hits like tackle.js)
            if (hit.playerId && hit.playerId !== player.id) {
              console.log(`[pistol] Hit detected - playerId: ${hit.playerId}, shooter: ${player.id}`)
              const playerB = world.getPlayer(hit.playerId)
              console.log(`[pistol] Got player object:`, !!playerB, 'has health:', !!playerB?.health, 'health value:', playerB?.health)

              // Additional safety checks to prevent self-hits
              if (playerB && playerB.id === player.id) {
                console.log(`[pistol] Preventing self-hit - same player ID detected`)
                return
              }

              // Prevent hits that are too close (likely self-hits in third person)
              // With 2.0 unit forward offset, allow hits beyond 1.0 unit (gives space for close combat)
              if (hit.distance < 1.0) {
                console.log(`[pistol] Preventing close-range hit - distance: ${hit.distance}`)
                return
              }

              if (playerB && playerB.health !== undefined) {
                let amount = num(MIN_DMG, MAX_DMG)
                let crit = false
                if (playerB.health > amount) {
                  crit = num(0, 1, 1) < CRIT_CHANCE
                  if (crit) amount *= CRIT_MULTIPLIER
                }
                if (amount > playerB.health) amount = playerB.health

                console.log(`[pistol] Calling hooks.damage for player ${playerB.id} - amount: ${amount}, crit: ${crit}`)
                console.log(`[pistol] Player health before damage:`, playerB.health)
                hooks.damage(playerB, amount, crit)
                console.log(`[pistol] Player health after damage:`, playerB.health)
              } else {
                console.warn(`[pistol] Cannot damage player - playerB:`, !!playerB, 'health:', playerB?.health)
              }
            }
            // Check if we hit a mob
            else if (hit.tag?.startsWith('elemental-mob:')) {
              try {
                const mobInstanceId = hit.tag.split(':')[1]
                let amount = num(MIN_DMG, MAX_DMG)
                const crit = num(0, 1) < CRIT_CHANCE
                if (crit) amount *= CRIT_MULTIPLIER

                console.log(`[pistol] Hit mob ${mobInstanceId} for ${amount} damage (crit: ${crit})`)
                app.emit('elemental-mob:hit', [mobInstanceId, player.id, amount, crit])
                console.log(`[pistol] Successfully emitted mob hit event (via app.emit)`)
              } catch (error) {
                console.error('[pistol] Error handling mob hit:', error)
              }
            }
          }

          // Consume ammo server-side (authoritative)
          ammo -= 1

          // Notify core inventory of ammo change
          if (props.showAmmoCount) {
            world.emit('elemental-item:ammo-update', {
              playerId: player.id,
              itemId: props.id,
              ammo: ammo,
              maxAmmo: props.maxAmmo || 100
            })
          }

          // Send updated ammo back to client
          hooks.call('fire', { ammo })

          // ===== Launch bullet projectile =====
          const projectileId = `bullet_${Date.now()}_${Math.random()}`
          const projectile = {
            id: projectileId,
            position: origin.clone(),
            target: targetPos,
            velocity: dir.clone().multiplyScalar(PROJECTILE_SPEED),
            lifetime: 0,
            owner: player.id,
          }
          projectiles.set(projectileId, projectile)

          console.log(`[pistol] Created projectile ${projectileId} with origin:`, origin.toArray(), 'target:', targetPos.toArray(), 'velocity:', dir.toArray(), 'speed:', PROJECTILE_SPEED)

          console.log(`[pistol] Created projectile ${projectileId}`)
          console.log(`[pistol] Origin:`, origin.toArray())
          console.log(`[pistol] Target:`, targetPos.toArray())
          console.log(`[pistol] Direction:`, dir.toArray())
          console.log(`[pistol] Velocity:`, projectile.velocity.toArray())
          console.log(`[pistol] Hit result:`, hit ? `hit ${hit.object?.id} at ${hit.point.toArray()}` : 'no hit')

          // Send comprehensive fire event to all clients for visual/audio effects
          app.send('fireEffects', {
            id: `${player.id}-${Date.now()}`,
            start: origin.toArray(),
            direction: dir.toArray(),
            distance: hit ? hit.distance : RANGE,
            muzzlePos: data.muzzlePos || data.worldPos, // Use client-provided muzzle position if available
            worldPos: data.worldPos || player.position.toArray(),
            hit: hit ? {
              position: hit.point.toArray(),
              playerId: hit.playerId,
              entityId: hit.entityId
            } : null
          })

          // Don't use projectile damage system - we already did instant raycast damage above
          // The projectile is just for visual effect, not for hit detection
          // Schedule bullet update with proper cleanup tracking
          const updateHandler = delta => updateProjectile(projectileId, delta)
          app.on('update', updateHandler)
          projectileUpdateHandlers.set(projectileId, updateHandler)

          console.log(`[pistol] ========== FIRE END ==========`)
        } catch (error) {
          console.error('[pistol] ERROR in server.fire():', error)
          console.error('[pistol] Error stack:', error.stack)
        }
      },

      reload(data) {
        // Restore ammo to max
        const maxAmmo = props.maxAmmo || 100
        ammo = maxAmmo
        console.log(`[pistol] Server: Reloaded to ${ammo} rounds`)

        // Notify core inventory of ammo change
        if (props.showAmmoCount) {
          world.emit('elemental-item:ammo-update', {
            playerId: player.id,
            itemId: props.id,
            ammo: ammo,
            maxAmmo: maxAmmo
          })
        }

        // Broadcast reload animation and sound to all clients
        app.send('reloadEffects', {
          playerId: player.id,
          muzzlePos: data.muzzlePos || null // Send muzzle position if available
        })

        // Send updated ammo to client
        hooks.call('reload', { ammo })
      },
    },
  }

  function updateProjectile(id, delta) {
    const proj = projectiles.get(id)
    if (!proj) return

    proj.lifetime += delta
    if (proj.lifetime > PROJECTILE_LIFETIME) {
      // Clean up update handler before removing projectile
      const updateHandler = projectileUpdateHandlers.get(id)
      if (updateHandler) {
        app.off('update', updateHandler)
        projectileUpdateHandlers.delete(id)
      }
      projectiles.delete(id)
      return
    }

    // Move bullet
    proj.position.add(proj.velocity.clone().multiplyScalar(delta))
    const distanceToTarget = proj.position.distanceTo(proj.target)

    console.log(`[pistol] Projectile ${id} at position:`, proj.position.toArray(), 'distance to target:', distanceToTarget.toFixed(2))

    if (distanceToTarget < 1) {
      console.log(`[pistol] Projectile ${id} reached target - cleaning up (damage already applied by raycast)`)

      // Damage was already applied by instant raycast in server.fire()
      // This projectile is just for visual effect
      // Clean up the projectile
      const updateHandler = projectileUpdateHandlers.get(id)
      if (updateHandler) {
        app.off('update', updateHandler)
        projectileUpdateHandlers.delete(id)
      }
      projectiles.delete(id)
    }
  }
})

// Item Configuration (Props for Customization)
app.configure([
  // ===== Basic Item Properties =====
  { key: 'id', type: 'text', label: 'ID', initial: 'pistol' },
  { key: 'icon', type: 'file', kind: 'texture', label: 'Icon' },
  { key: 'name', type: 'text', label: 'Name', initial: 'Combat Pistol' },
  { key: 'desc', type: 'textarea', label: 'Desc', initial: 'Semi-automatic sidearm. Uses magazines for reload.' },
  { key: 'stack', type: 'number', label: 'Stack', initial: 1 },
  { key: 'showAmmoCount', type: 'toggle', label: 'Show Ammo Count in Inventory', initial: true, hint: 'Display current ammo count in the inventory UI' },
  {
    key: 'droppable',
    type: 'switch',
    label: 'Droppable',
    options: [
      { label: 'No', value: false },
      { label: 'Yes', value: true },
    ],
    initial: false,
  },

  // ===== Ammo Settings =====
  { type: 'section', key: 'ammoSection', label: 'Ammo' },
  { key: 'maxAmmo', type: 'number', label: 'Max Ammo', initial: 100, hint: 'Total rounds available' },

  // ===== Visual Adjustments =====
  { type: 'section', key: 'visualSection', label: 'Position & Scale' },
  { key: 'scale', type: 'number', label: 'Scale', initial: 1, dp: 2, step: 0.1, hint: 'Overall size multiplier' },
  { key: 'offsetX', type: 'number', label: 'Offset X', initial: 0, dp: 3, step: 0.01, hint: 'Left/Right offset' },
  { key: 'offsetY', type: 'number', label: 'Offset Y', initial: 0, dp: 3, step: 0.01, hint: 'Up/Down offset' },
  { key: 'offsetZ', type: 'number', label: 'Offset Z', initial: 0, dp: 3, step: 0.01, hint: 'Forward/Back offset' },
  { key: 'rotationX', type: 'number', label: 'Rotation X', initial: 0, dp: 2, step: 0.1, hint: 'Pitch (radians)' },
  { key: 'rotationY', type: 'number', label: 'Rotation Y', initial: 0, dp: 2, step: 0.1, hint: 'Yaw (radians)' },
  { key: 'rotationZ', type: 'number', label: 'Rotation Z', initial: 0, dp: 2, step: 0.1, hint: 'Roll (radians)' },

  // ===== Debug Settings =====
  { type: 'section', key: 'debugSection', label: 'Debug' },
  { key: 'debugLogs', type: 'toggle', label: 'Enable Debug Logs', initial: false, hint: 'Show detailed console logs for debugging' },

  // ===== Keybinds =====
  { type: 'section', key: 'keybindSection', label: 'Keybinds' },
  {
    key: 'fireButton',
    type: 'switch',
    label: 'Fire Button',
    initial: 'mouseLeft',
    options: [
      { label: 'Left Mouse', value: 'mouseLeft' },
      { label: 'Right Mouse', value: 'mouseRight' },
      { label: 'Middle Mouse', value: 'mouseMiddle' },
      { label: 'Space', value: 'space' },
      { label: 'E Key', value: 'keyE' },
      { label: 'F Key', value: 'keyF' },
    ],
    hint: 'Button to fire weapon',
  },
  {
    key: 'reloadButton',
    type: 'switch',
    label: 'Reload Button',
    initial: 'keyR',
    options: [
      { label: 'R Key', value: 'keyR' },
      { label: 'E Key', value: 'keyE' },
      { label: 'F Key', value: 'keyF' },
      { label: 'Q Key', value: 'keyQ' },
      { label: 'X Key', value: 'keyX' },
    ],
    hint: 'Button to reload weapon',
  },
  {
    key: 'adsButton',
    type: 'switch',
    label: 'ADS Toggle Button',
    initial: 'mouseRight',
    options: [
      { label: 'Right Mouse', value: 'mouseRight' },
      { label: 'Middle Mouse', value: 'mouseMiddle' },
      { label: 'V Key', value: 'keyV' },
      { label: 'C Key', value: 'keyC' },
      { label: 'Z Key', value: 'keyZ' },
    ],
    hint: 'Button to toggle aim down sights (zoom) - click to toggle on/off',
  },
  {
    key: 'adsFocalLength',
    type: 'number',
    label: 'ADS Focal Length (mm)',
    initial: 85,
    min: 24,
    max: 200,
    step: 1,
    dp: 0,
    hint: 'Camera focal length when aiming (lower = more zoom)',
  },
  {
    key: 'zoomSpeed',
    type: 'number',
    label: 'Zoom Speed',
    initial: 15.0,
    min: 0.5,
    max: 30.0,
    step: 0.5,
    dp: 1,
    hint: 'How fast the zoom transitions (higher = faster)',
  },
  {
    key: 'requirePointerLock',
    type: 'switch',
    label: 'Require Pointer Lock',
    initial: false,
    options: [
      { label: 'No', value: false },
      { label: 'Yes', value: true },
    ],
    hint: 'Require mouse to be locked to fire',
  },

  // ===== Targeted Action Animations =====
  { type: 'section', key: 'animSection', label: 'Targeted Action Animations (Short GLB Emotes)' },

  // Short, targeted animations that layer over natural locomotion
  // These should be designed to work as additive layers over natural movement
  { key: 'equipEmote', type: 'file', kind: 'emote', label: 'Equip Animation (Short GLB)' },
  { key: 'fireEmote', type: 'file', kind: 'emote', label: 'Fire Animation (Short GLB - Arm Recoil)' },
  { key: 'reloadEmote', type: 'file', kind: 'emote', label: 'Reload Animation (Short GLB - Arm Movement)' },
  { key: 'pistolIdleEmote', type: 'file', kind: 'emote', label: 'Pistol Idle Animation (Looping GLB - Upper Body)', initial: 'asset://b11273c64ac6638f5407506681849c40e72f0ed016b87d9d2936bf2eead8302c.glb' },
  { key: 'aimIdleEmote', type: 'file', kind: 'emote', label: 'Aim Idle Animation (Looping GLB - Upper Body)' },
  { key: 'pistolWalkEmote', type: 'file', kind: 'emote', label: 'Pistol Walk Animation (Looping GLB - Upper Body)' },
  { key: 'pistolRunEmote', type: 'file', kind: 'emote', label: 'Pistol Run Animation (Looping GLB - Upper Body)' },
  { key: 'aimWalkEmote', type: 'file', kind: 'emote', label: 'Aim Walk Animation (Looping GLB - Upper Body)' },
  { key: 'aimRunEmote', type: 'file', kind: 'emote', label: 'Aim Run Animation (Looping GLB - Upper Body)' },

  // Animation timing controls
  { key: 'equipDuration', type: 'number', label: 'Equip Duration (seconds)', initial: 0.5, min: 0.1, max: 3, step: 0.1, dp: 1 },
  { key: 'fireDuration', type: 'number', label: 'Fire Duration (seconds)', initial: 0.3, min: 0.1, max: 2, step: 0.05, dp: 2 },
  { key: 'reloadDuration', type: 'number', label: 'Reload Duration (seconds)', initial: 0.917, min: 0.1, max: 5, step: 0.01, dp: 3 },
  { key: 'pistolIdleDuration', type: 'number', label: 'Pistol Idle Duration (seconds)', initial: 2.0, min: 0.5, max: 10, step: 0.1, dp: 1 },
  { key: 'aimIdleDuration', type: 'number', label: 'Aim Idle Duration (seconds)', initial: 2.0, min: 0.5, max: 10, step: 0.1, dp: 1, hint: 'How long the aim idle animation loop lasts' },
  { key: 'pistolWalkDuration', type: 'number', label: 'Pistol Walk Duration (seconds)', initial: 1.0, min: 0.5, max: 5, step: 0.1, dp: 1, hint: 'How long the pistol walk animation loop lasts' },
  { key: 'pistolRunDuration', type: 'number', label: 'Pistol Run Duration (seconds)', initial: 0.8, min: 0.5, max: 3, step: 0.1, dp: 1, hint: 'How long the pistol run animation loop lasts' },
  { key: 'aimWalkDuration', type: 'number', label: 'Aim Walk Duration (seconds)', initial: 1.0, min: 0.5, max: 5, step: 0.1, dp: 1, hint: 'How long the aim walk animation loop lasts' },
  { key: 'aimRunDuration', type: 'number', label: 'Aim Run Duration (seconds)', initial: 0.8, min: 0.5, max: 3, step: 0.1, dp: 1, hint: 'How long the aim run animation loop lasts' },

  // ===== Animation System =====
  { type: 'section', key: 'animSystemSection', label: 'Animation System' },
  {
    key: 'useAdditiveAnimations',
    type: 'switch',
    label: 'Use Additive Animations',
    initial: true,
    options: [
      { label: 'Yes (smart blending - poses layer, actions replace)', value: true },
      { label: 'No (all animations replace movement)', value: false },
    ],
    hint: 'Smart mode: poses layer over movement, actions replace movement',
  },

  // ===== Animation Weight Controls =====
  { type: 'section', key: 'weightSection', label: 'Animation Weight Controls' },
  {
    key: 'pistolAnimationWeight',
    type: 'range',
    label: 'Pistol Animation Weight',
    min: 0,
    max: 1,
    step: 0.05,
    initial: 1.0,
    hint: 'How much pistol animations influence bone rotations (0 = none, 1 = full)',
  },
  {
    key: 'baseLocomotionWeight',
    type: 'range',
    label: 'Base Locomotion Weight',
    min: 0,
    max: 1,
    step: 0.05,
    initial: 0.0,
    hint: 'How much base locomotion influences bone rotations (0 = none, 1 = full)',
  },
  {
    key: 'animationSmoothing',
    type: 'range',
    label: 'Animation Smoothing',
    min: 0.1,
    max: 1.0,
    step: 0.05,
    initial: 0.3,
    hint: 'How smooth bone rotations are (lower = more responsive, higher = smoother)',
  },
  {
    key: 'adaptiveSmoothing',
    type: 'toggle',
    label: 'Adaptive Smoothing',
    initial: true,
    hint: 'Automatically reduce smoothing when additive animations are active',
  },
  {
    key: 'conflictResolutionMode',
    type: 'switch',
    label: 'Bone Conflict Resolution',
    initial: 'additive_priority',
    options: [
      { label: 'Locomotion Priority (base movement wins)', value: 'locomotion_priority' },
      { label: 'Weighted Blend (balanced mixing)', value: 'weighted_blend' },
      { label: 'Pistol Priority (weapon poses win)', value: 'additive_priority' },
    ],
    hint: 'How to resolve conflicts when both locomotion and pistol animations try to control the same bones',
  },
  {
    key: 'maxBoneRotation',
    type: 'range',
    label: 'Max Bone Rotation (degrees)',
    min: 10,
    max: 180,
    step: 5,
    initial: 15,
    hint: 'Maximum rotation angle for hand/wrist bones to prevent over-rotation (lower = more restrictive)',
  },
  {
    key: 'disableLeftArm',
    type: 'toggle',
    label: 'Disable Left Arm Animation',
    initial: true,
    hint: 'Completely disable left arm animations to prevent incorrect rotations (right-handed weapons only)',
  },
  {
    key: 'disableRightArm',
    type: 'toggle',
    label: 'Disable Right Arm Animation',
    initial: true,
    hint: 'Completely disable right arm animations to prevent incorrect rotations',
  },
  {
    key: 'debugArmRotations',
    type: 'toggle',
    label: 'Debug Arm Rotations',
    initial: false,
    hint: 'Log arm bone rotations to console for debugging',
  },
  {
    key: 'rotationScale',
    type: 'range',
    label: 'Rotation Scale',
    min: 0.1,
    max: 1.0,
    step: 0.1,
    initial: 0.3,
    hint: 'Scale down additive animation intensity to prevent over-rotation (lower = more conservative)',
  },
  {
    key: 'disableEngineIdle',
    type: 'toggle',
    label: 'Disable Engine Idle Animation',
    initial: true,
    hint: 'Disable the engine\'s problematic idle animation when weapon is equipped (recommended)',
  },
  {
    key: 'resetRestPose',
    type: 'toggle',
    label: 'Reset Bone Rest Poses',
    initial: true,
    hint: 'Reset bone rest poses to proper T-pose to prevent crossed-arm issues (recommended)',
  },
  {
    key: 'useNeutralIdle',
    type: 'toggle',
    label: 'Use Neutral Idle Pose',
    initial: true,
    hint: 'Use neutral T-pose instead of missing mp-idle.glb for better additive blending (recommended)',
  },


  // ===== Sound Effects =====
  { type: 'section', key: 'soundSection', label: 'Sound Effects' },
  { key: 'fireSound', type: 'file', kind: 'audio', label: 'Fire Sound' },
  { key: 'reloadSound', type: 'file', kind: 'audio', label: 'Reload Sound' },
  { key: 'impactSound', type: 'file', kind: 'audio', label: 'Impact Sound' },

  // ===== Particle Effects =====
  { type: 'section', key: 'particleSection', label: 'Particle Effects' },
  { key: 'muzzleFlashColor', type: 'color', label: 'Muzzle Flash Color', initial: '#ffaa00' },
  { key: 'shellCasingColor', type: 'color', label: 'Shell Casing Color', initial: '#c0c0c0' },
  { key: 'bulletTrailColor', type: 'color', label: 'Bullet Trail Color', initial: '#ffff00' },
  { key: 'impactSparkColor', type: 'color', label: 'Impact Spark Color', initial: '#ff8800' },
  {
    key: 'enableParticles', type: 'switch', label: 'Enable Particles', initial: true, options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false }
    ]
  },

  // ===== Camera & Aiming =====
  { type: 'section', key: 'aimingSection', label: 'Aiming & Camera' },
  {
    key: 'zoomLevels',
    type: 'text',
    label: 'Zoom Levels (comma-separated)',
    initial: '1.5, 1.0, 0.5, 0.3',
    hint: 'Camera distances for each zoom level. Cycle with right-click.'
  },
  {
    key: 'aimIntensityByZoom',
    type: 'switch',
    label: 'Aim Intensity Mode',
    initial: 'binary',
    options: [
      { label: 'Binary (on/off)', value: 'binary' },
      { label: 'Progressive (increases with zoom)', value: 'progressive' }
    ],
    hint: 'How bone manipulation intensity scales with zoom level'
  },
  {
    key: 'maxSpineRotation',
    type: 'number',
    label: 'Max Spine Rotation',
    initial: 0.1,
    min: 0,
    max: 1,
    step: 0.05,
    dp: 2,
    hint: 'Maximum rotation for spine bone (radians)'
  },
  {
    key: 'maxChestRotation',
    type: 'number',
    label: 'Max Chest Rotation',
    initial: 0.15,
    min: 0,
    max: 1,
    step: 0.05,
    dp: 2,
    hint: 'Maximum rotation for chest bone (radians)'
  },
  {
    key: 'maxHeadRotation',
    type: 'number',
    label: 'Max Head Rotation',
    initial: 0.2,
    min: 0,
    max: 1,
    step: 0.05,
    dp: 2,
    hint: 'Maximum rotation for head bone (radians)'
  },
  {
    key: 'maxArmRotation',
    type: 'number',
    label: 'Max Arm Rotation',
    initial: 0.3,
    min: 0,
    max: 1,
    step: 0.05,
    dp: 2,
    hint: 'Maximum rotation for arm bones (radians)'
  },

  // ===== Pickup Action =====
  { type: 'section', key: 'pickupSection', label: 'Pickup Action' },
  {
    key: 'enablePickupAction',
    type: 'switch',
    label: 'Enable Pickup Action',
    initial: true,
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
  },
  {
    key: 'pickupActionDistance',
    type: 'number',
    label: 'Pickup Distance (meters)',
    initial: 3,
    min: 1,
    max: 10,
    step: 0.5,
  },
  {
    key: 'pickupActionDuration',
    type: 'number',
    label: 'Pickup Duration (seconds)',
    initial: 0.5,
    min: 0.1,
    max: 3,
    step: 0.1,
  },

  // ===== Mobile Controls =====
  { type: 'section', key: 'mobileSection', label: 'Mobile Controls' },
  {
    key: 'showMobileButtons',
    type: 'toggle',
    label: 'Show Mobile Buttons',
    initial: true,
    hint: 'Show Shoot and ADS buttons on mobile'
  },
  {
    key: 'mobileShootButton',
    type: 'toggle',
    label: 'Show Shoot Button',
    initial: true,
    hint: 'Show mobile shoot button (bottom-right)'
  },
  {
    key: 'mobileAdsButton',
    type: 'toggle',
    label: 'Show ADS Button',
    initial: true,
    hint: 'Show mobile ADS button (bottom-right)'
  },

  // ===== Admin Tools =====
  { type: 'section', key: 'adminSection', label: 'Admin' },
  {
    key: 'give',
    type: 'button',
    label: 'Give to Local Player',
    onClick: () => {
      const p = world.getPlayer()
      app.send('give', p.id)
    },
  },
])

function createItem(createInstance) {
  // Safely access props to prevent crashes during item destruction
  let id = null
  let icon = null
  let name = null
  let desc = null
  let stack = 1
  let droppable = false

  try {
    if (props && typeof props === 'object') {
      id = props.id || null
      name = props.name || null
      desc = props.desc || null
      stack = props.stack || 1
      droppable = props.droppable || false

      // Safely get icon URL
      if (props.icon && typeof props.icon === 'object' && props.icon.url && typeof props.icon.url === 'string') {
        icon = props.icon.url
      }
    }
  } catch (error) {
    console.warn('[pistol] Error accessing props during item creation:', error)
    return
  }

  // each item must have an id
  if (!id) return console.error(`item does not have an id`)
  // and the id must be unique in the world
  let unique = true
  world.on(`elemental-item:check:${id}`, instanceId => {
    if (app.instanceId === instanceId) return
    app.emit(`elemental-item:check:${id}:reply`)
  })
  world.on(`elemental-item:check:${id}:reply`, () => {
    unique = false
  })
  app.emit(`elemental-item:check:${id}`, app.instanceId)
  if (!unique) return console.error(`item with id '${id}' exists more than once in the world`)

  if (world.isServer) {
    const state = app.state
    state.active = new Set()
    state.ready = true
    const instances = new Map() // playerId -> instance
    app.send('init', state)
    app.on('give', playerId => {
      app.emit('elemental-item:give', [playerId, id, 1])
    })
    world.on(`elemental-shop:request-spec:${id}`, () => {
      app.emit('elemental-item:spec', { id, icon, name, desc, stack, showAmmoCount: props.showAmmoCount })
    })
    world.on('elemental-core:request-specs', () => {
      app.emit('elemental-item:spec', { id, icon, name, desc, stack, showAmmoCount: props.showAmmoCount })
    })
    world.on(`elemental-shop:purchase:${id}`, playerId => {
      app.emit('elemental-item:give', [playerId, id, 1])
    })
    world.on(`elemental-core:activate:${id}`, playerId => {
      if (state.active.has(playerId)) {
        return console.warn(`${id} activate: already active`)
      }
      const player = world.getPlayer(playerId)
      if (!player) {
        return console.warn(`${id} activate: player not found`)
      }
      state.active.add(playerId)
      const instance = createInstance({
        player,
        hooks: {
          call(method, data) {
            app.send('call', [playerId, method, data])
          },
          take(qty) {
            app.emit('elemental-item:take', [playerId, id, qty])
          },
          damage(player, amount, crit) {
            console.log(`[pistol hooks.damage] Called with player ${player.id}, amount: ${amount}, health before: ${player.health}`)
            player.damage(amount)
            console.log(`[pistol hooks.damage] Health after damage: ${player.health}`)
            app.send('dmg', [player.id, amount, crit])
            // Emit health event for elemental-combat to handle death/respawn
            console.log(`[pistol hooks.damage] Emitting health event`)
            app.emit('health', { playerId: player.id, health: player.health })
          },
        },
      })
      instances.set(playerId, instance)
      instance.server?.init?.()
      app.send('activate', playerId)
    })
    world.on(`elemental-core:deactivate:${id}`, playerId => {
      if (!state.active.has(playerId)) {
        return console.warn(`${id} deactivate: player not active`)
      }
      state.active.delete(playerId)
      instances.get(playerId).server.destroy?.()
      instances.delete(playerId)
      app.send('deactivate', playerId)
    })
    world.on(`elemental-core:drop:${id}`, playerId => {
      if (!droppable) return
      if (!state.active.has(playerId)) {
        return console.warn(`${id} drop: player not active`)
      }
      // instance could control this in future
      app.emit('elemental-item:take', [playerId, id, 1])
    })
    app.on('call', ([method, data], playerId) => {
      console.log(`[pistol] Server received call: method=${method}, playerId=${playerId}`)
      const instance = instances.get(playerId)
      if (!instance) {
        console.error('[pistol] No instance found for player:', playerId)
        console.error('[pistol] Available instances:', Array.from(instances.keys()))
        return
      }
      console.log(`[pistol] Instance found, calling server.${method}`)
      instance.server?.[method]?.(data)
    })
    world.on('leave', e => {
      if (!state.active.has(e.playerId)) return
      state.active.delete(e.playerId)
      instances.get(e.playerId).server.destroy?.()
      instances.delete(e.playerId)
      app.send('deactivate', e.playerId)
    })
    app.on('fixedUpdate', delta => {
      instances.forEach(instance => {
        instance.server?.fixedUpdate?.(delta)
      })
    })
    app.on('update', delta => {
      instances.forEach(instance => {
        instance.server?.update?.(delta)
      })
    })
    app.on('lateUpdate', delta => {
      instances.forEach(instance => {
        instance.server?.lateUpdate?.(delta)
      })
    })
    // broadcast item existence and metadata
    app.emit('elemental-item:spec', { id, icon, name, desc, stack, showAmmoCount: props.showAmmoCount })
  }

  if (world.isClient) {
    const localPlayer = world.getPlayer()

    // Create pickup action at world level (only once for local player)
    if (props.enablePickupAction && localPlayer && localPlayer.local && !pickupAction) {
      pickupAction = app.create('action')
      pickupAction.label = '[ PICK UP PISTOL ]'
      pickupAction.distance = props.pickupActionDistance || 3
      pickupAction.duration = props.pickupActionDuration || 0.5
      pickupAction.position.copy(app.position)
      pickupAction.position.y += 0.2
      pickupAction.onTrigger = () => {
        debugLog('Pickup action triggered!')
        const p = world.getPlayer()
        if (!p) {
          console.warn('[pistol] No local player found for pickup')
          return
        }
        app.send('give', p.id)
        world.chat({ message: `Picked up ${props.name || 'Pistol'}!` })
        pickupAction.active = false
      }
      world.add(pickupAction)
      debugLog('Pickup action created at world level')
    }

    let state = app.state
    if (state.ready) {
      init(state)
    } else {
      app.on('init', init)
    }
    function init(_state) {
      state = _state
      const instances = new Map()
      function activate(playerId) {
        const player = world.getPlayer(playerId)
        const instance = createInstance({
          player,
          hooks: {
            call(method, data) {
              app.send('call', [method, data])
            },
            take(qty) {
              console.error('[item] hooks.take() not available on the client')
            },
            damage(player, amount, crit) {
              console.error('[item] hooks.damage() not available on the client')
            },
          },
        })
        instances.set(playerId, instance)
        instance.client?.init?.()
      }
      for (const playerId of state.active) {
        activate(playerId)
      }
      app.on('activate', playerId => {
        activate(playerId)
      })
      app.on('call', ([playerId, method, data]) => {
        const instance = instances.get(playerId)
        if (!instance) return console.error('[item] error 1')
        instance.client?.[method]?.(data)
      })
      app.on('deactivate', playerId => {
        const instance = instances.get(playerId)
        instance.client?.destroy?.()
        instances.delete(playerId)
      })
      app.on('fixedUpdate', delta => {
        instances.forEach(instance => {
          instance.client?.fixedUpdate?.(delta)
        })
      })
      app.on('update', delta => {
        instances.forEach(instance => {
          instance.client?.update?.(delta)
        })
      })
      app.on('lateUpdate', delta => {
        instances.forEach(instance => {
          instance.client?.lateUpdate?.(delta)
        })
      })
      app.on('dmg', data => {
        app.emit('elemental-item:dmg', data)
      })
    }
  }
}
