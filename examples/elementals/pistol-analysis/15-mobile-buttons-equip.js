// ===== MOBILE BUTTONS AND EQUIP =====
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
              offset: [-145, -160],
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

        // Handle projectile visual effects from server
        app.on('projectile', (data) => {
          const startPos = new Vector3().fromArray(data.start)
          const dir = new Vector3().fromArray(data.direction)

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
      },