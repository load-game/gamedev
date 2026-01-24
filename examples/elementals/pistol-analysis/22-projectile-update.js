// ===== PROJECTILE UPDATE FUNCTION =====
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