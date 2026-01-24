// ===== PISTOL MODEL ANIMATIONS =====
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
