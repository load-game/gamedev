// ===== PISTOL ITEM CREATION AND SHARED VARIABLES =====
// This file contains the main item creation and variables shared between client/server

createItem(({ player, hooks }) => {
  // ===== CLIENT & SERVER SHARED VARIABLES =====
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

  // ===== AMMUNITION HELPER FUNCTIONS =====
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