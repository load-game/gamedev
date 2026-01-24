// ===== CLIENT UPDATE LOOP =====
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

        if (fireInput && fireInput.pressed && canFire) {
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

            // Get muzzle position from bone (like tackle.js - project forward to avoid self-hits)
            const origin = player.position.clone()
            origin.y += 1.5 // Fallback height

            if (muzzleBone && muzzleBone.matrixWorld) {
              origin.setFromMatrixPosition(muzzleBone.matrixWorld)
              // Project origin slightly forward to avoid self-hits in third person
              const forwardOffset = dir.clone().multiplyScalar(0.3)
              origin.add(forwardOffset)
            }

            // Send fire event to server
            hooks.call('fire', {
              origin: origin.toArray(),
              dir: dir.toArray(),
              ammo,
            })
            lastFireTime = now

            // Visual feedback
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