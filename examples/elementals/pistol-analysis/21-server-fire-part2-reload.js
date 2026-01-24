// ===== SERVER FIRE FUNCTION - PART 2 =====
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

          // Send projectile data to clients for visual trail
          app.send('projectile', {
            id: `${player.id}-${Date.now()}`,
            start: origin.toArray(),
            direction: dir.toArray(),
            distance: hit ? hit.distance : RANGE,
            hit: hit ? {
              position: hit.point.toArray(),
              playerId: hit.playerId,
              entityId: hit.entityId
            } : null
          })

          // ===== TASK 5: Muzzle flash at correct bone position =====
          // Note: On server we don't have visual bones, so this would be
          // better handled client-side or as a particle effect
          // For now, create a temporary marker for debugging
          const flash = app.create('prim', {
            type: 'sphere',
            size: [0.1],
            color: '#ffaa00',
            emissive: '#ffaa00',
            emissiveIntensity: 5,
          })
          flash.position.copy(origin)
          world.add(flash)

          let flashTime = 0
          function flashUpdate(dt) {
            flashTime += dt
            if (flashTime > 0.05) {
              world.remove(flash)
              app.off('update', flashUpdate)
            }
          }
          app.on('update', flashUpdate)

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

        // Send updated ammo to client
        hooks.call('reload', { ammo })
      },
    },
  }