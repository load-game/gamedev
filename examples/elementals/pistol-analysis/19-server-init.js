// ===== SERVER INITIALIZATION =====
    server: {
      init() {
        // Initialize server-side ammo tracking
        ammo = props.maxAmmo || 100
        console.log(`[pistol] Server: Pistol initialized with ${ammo} rounds`)
      },