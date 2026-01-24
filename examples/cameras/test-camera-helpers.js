// Simple test to verify camera helpers are visible
// Creates a few cameras with helpers that should be visible from the default camera

if (world.isClient) {
  console.log('[CameraHelperTest] Starting camera helper visibility test...')

  // Create a few test cameras at different positions
  const testPositions = [
    { pos: [5, 2, 5], color: '#ff0000', name: 'Red Camera' },
    { pos: [-5, 2, 5], color: '#00ff00', name: 'Green Camera' },
    { pos: [0, 5, -5], color: '#0000ff', name: 'Blue Camera' },
  ]

  testPositions.forEach((config, index) => {
    const camera = app.create('camera', {
      name: `test-camera-${index}`,
      position: config.pos,
      rotation: [0, 0, 0],
      active: true,
      autoActivate: false,
      attachToRig: false,
      isPlayerCamera: false,
      showHelper: true, // This should make the helper visible
      helperScale: 0.2,
      fov: 60,
      near: 0.1,
      far: 100,
      dof: { enabled: false },
      bloom: { enabled: false },
      vignette: { enabled: false },
      filmGrain: { enabled: false },
    })

    app.add(camera)
    console.log(`[CameraHelperTest] Created ${config.name} at position:`, config.pos)
  })

  console.log('[CameraHelperTest] Test complete. You should see 3 camera frustums in the world.')
  console.log("[CameraHelperTest] If you don't see them, check the console for errors.")
}
