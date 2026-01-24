// ===== ADS SYSTEM AND MOVEMENT ANIMATIONS =====
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
              // Play aim animation
              setPistolState('aiming')
              playAimAnimation()
            } else {
              // Return to pistol grip animation
              setPistolState('equipped')
              playPistolGripAnimation()
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
          }
        }

        // ===== SKIP BONE ROTATION FOR NOW - FOCUS ON SHOOTING AND ZOOMING =====
        // Bone rotation system is broken - will fix later
        // if (isAiming) {
        //   // Bone rotation code removed for now
        // }
      },