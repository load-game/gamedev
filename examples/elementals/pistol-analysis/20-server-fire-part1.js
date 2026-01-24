// ===== SERVER FIRE FUNCTION - PART 1 =====
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
              if (hit.distance < 0.5) {
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