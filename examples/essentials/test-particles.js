// Test script - creates particles at player position
// Attach this to test if particles work

if (world.isClient) {
  const player = world.getPlayer()

  function createTestParticles() {
    console.log('[Particle Test] Creating test particles at player position')

    const testParticles = app.create('particles', {
      shape: ['circle', 2, 1],
      direction: 0,
      speed: '0',
      size: '0.2',
      rate: 30,
      life: '3',
      emissive: '200',
      color: '#ff0000',  // Red for visibility
      alphaOverLife: '0,0|0.1,1|0.9,1|1,0',
      space: 'local',
      looping: true
    })

    app.add(testParticles)
    testParticles.position.copy(player.position)

    console.log('[Particle Test] Particles created at:', player.position)

    // Remove after 5 seconds
    app.setTimeout(() => {
      console.log('[Particle Test] Removing particles')
      world.remove(testParticles)
    }, 5000)
  }

  // Auto-create after 1 second
  app.setTimeout(() => {
    createTestParticles()
  }, 1000)

  console.log('[Particle Test] Test script loaded - particles will spawn in 1 second')
}
