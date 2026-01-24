// ===== CLIENT LATE UPDATE AND CLEANUP =====
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