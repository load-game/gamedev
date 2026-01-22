// List All Animations
// Outputs the complete animation list from the rig

if (!world.isClient) return

console.log('=== Current Animation List ===')
console.log('')

// Get the rig
const rig = app.get('VrmRig')

if (!rig) {
  console.error('VrmRig not found!')
  return
}

if (!rig.anims || rig.anims.length === 0) {
  console.error('No animations found on VrmRig!')
  return
}

console.log('Total animations:', rig.anims.length)
console.log('')
console.log('Animation Names:')
console.log('----------------')

rig.anims.forEach((name, index) => {
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  console.log(`${(index + 1).toString().padStart(2)}. ${name}`)
  console.log(`    ID: ${id}`)
})

console.log('')
console.log('=== End List ===')
