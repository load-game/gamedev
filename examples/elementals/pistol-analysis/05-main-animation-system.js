// ===== MAIN ANIMATION SYSTEM =====
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
  const isPoseAnimation =
    options.isPose ||
    animUrl.includes('grip') ||
    animUrl.includes('aim') ||
    animUrl.includes('idle') ||
    animUrl.includes('Idle') ||
    animUrl.includes('PistolIdle') ||
    animUrl.includes('AimIdle') ||
    animUrl.includes('fire') ||
    animUrl.includes('reload') ||
    animUrl.includes('Fire') ||
    animUrl.includes('Reload')
  const isActionAnimation = options.isAction || animUrl.includes('equip') || animUrl.includes('Equip')

  console.log(`[pistol] Animation analysis:`, {
    animUrl,
    isPoseAnimation,
    isActionAnimation,
    applyAdditiveAnimation: !!player.applyAdditiveAnimation,
    propsUseAdditive: props.useAdditiveAnimations,
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
        'Boolean(props.debugArmRotations)': Boolean(props.debugArmRotations),
      })

      player.applyAdditiveAnimation(animUrl, {
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
          },
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
  currentAnimation = animUrl
  if (!options.loop) {
    animationCooldown = now
  }

  console.log(
    `[pistol] Animation tracking - currentAnimation: ${currentAnimation}, cooldown: ${animationCooldown}, time: ${now}`
  )
}
