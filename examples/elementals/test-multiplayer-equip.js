/**
 * Test: Multiplayer Pistol Equip
 *
 * This test verifies that multiple players can equip pistols simultaneously.
 * Run this in the browser console after loading the world with multiple players.
 */

// Test function to run on each client
function testPistolEquip() {
  console.log('=== Multiplayer Pistol Equip Test ===');

  // Get the pistol item spec
  const pistolSpec = Object.values(world.systems.elementalCore.specs)
    .find(spec => spec.name === 'Pistol');

  if (!pistolSpec) {
    console.error('❌ Pistol spec not found');
    return;
  }

  console.log('✓ Found pistol spec:', pistolSpec.id);

  // Give pistol to local player
  const localPlayer = world.getPlayer();
  if (!localPlayer) {
    console.error('❌ No local player found');
    return;
  }

  console.log('✓ Local player ID:', localPlayer.id);

  // Give pistol via console command simulation
  world.run(`give ${localPlayer.id} ${pistolSpec.id}`);
  console.log('✓ Gave pistol to local player');

  // Check if pistol is in inventory
  const inventory = world.systems.elementalCore.getInv(localPlayer.id);
  const pistolSlot = inventory.items.findIndex(item => item && item.id === pistolSpec.id);

  if (pistolSlot === -1) {
    console.error('❌ Pistol not found in inventory');
    return;
  }

  console.log('✓ Pistol in inventory at slot:', pistolSlot);

  // Try to equip pistol by setting active slot
  world.systems.elementalCore.setActiveSlot(pistolSlot);
  console.log('✓ Set active slot to pistol');

  // Wait a frame for activation
  setTimeout(() => {
    // Check if pistol instance was created
    const pistolApp = world.apps.find(app => app.id === pistolSpec.id);
    if (!pistolApp) {
      console.error('❌ Pistol app not found');
      return;
    }

    const instances = pistolApp.state?.instances || new Map();
    const localInstance = instances.get(localPlayer.id);

    if (!localInstance) {
      console.error('❌ No pistol instance for local player');
      console.log('Available instances:', Array.from(instances.keys()));
      return;
    }

    console.log('✓ Pistol instance created for local player');

    // Check if equip action is visible
    const actionsContainer = document.querySelector('[data-ui="actions"]');
    if (actionsContainer) {
      const equipButton = Array.from(actionsContainer.querySelectorAll('button'))
        .find(btn => btn.textContent.includes('EQUIP'));

      if (equipButton) {
        console.log('✓ Equip action button visible');
      } else {
        console.warn('⚠ Equip action button not found (may need to select pistol first)');
      }
    }

    console.log('=== Test Complete ===');
  }, 100);
}

// Run test
console.log('Run testPistolEquip() in each player\'s console');
console.log('All players should be able to see and use the equip action');
