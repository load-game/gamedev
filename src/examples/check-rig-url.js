// Check if rig node stores GLB URL
// Investigate what's available on the rig node

if (!world.isClient) return

const rig = app.get('VrmRig')

console.log('=== Rig Node Inspection ===')
console.log('')
console.log('Rig found:', rig ? 'YES' : 'NO')

if (!rig) {
  console.log('No rig found')
  return
}

console.log('')
console.log('Available properties:')
console.log('-------------------')

// Check for URL-related properties
const urlProps = ['url', 'src', 'source', 'model', 'glb', 'asset']
urlProps.forEach(prop => {
  if (rig[prop] !== undefined) {
    console.log(`✓ rig.${prop}:`, rig[prop])
  }
})

console.log('')
console.log('All rig properties:')
console.log('------------------')

for (const key in rig) {
  if (typeof rig[key] !== 'function') {
    console.log(`- ${key}:`, rig[key])
  }
}

console.log('')
console.log('Methods:')
console.log('--------')

for (const key in rig) {
  if (typeof rig[key] === 'function') {
    console.log(`- ${key}()`)
  }
}
