// ROM Server Light - Simple Flashing Light

app.configure([
  {
    key: 'installSound',
    type: 'file',
    kind: 'audio',
    label: 'Installation Sound',
  },
])

const lightMesh = app.get('RomServerLight')

console.log('[ROM Server] Light mesh found:', !!lightMesh)

// Set emissive color to blue for glow effect
if (lightMesh && lightMesh.material) {
  lightMesh.material.emissive = '#0066ff'
}

// Flash the light continuously
let flashTimer = 0
app.on('update', (delta) => {
  if (!lightMesh || !lightMesh.material) return

  flashTimer += delta

  // Flash every 0.5 seconds (on for 0.25s, off for 0.25s)
  const flashOn = (flashTimer % 0.5) < 0.25
  lightMesh.material.emissiveIntensity = flashOn ? 50 : 0
})

console.log('[ROM Server] Light flashing started')
