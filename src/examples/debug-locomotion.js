// Debug Locomotion After Emote
// Simple test to check if locomotion resumes after emote ends

if (!world.isClient) return

console.log('=== Locomotion Debug Test ===')
console.log('')

// Simple test - play animation and observe
console.log('Playing animation with loop:false...')
console.log('Check if locomotion resumes after animation ends')
console.log('')

app.emit('animlib:play', {
  anim: 'vrmroll35',  // A clear, distinct animation
  target: 'player',
  playerId: 'local',
  options: {
    speed: 1,
    gaze: false,
    loop: false,  // Should end and return to... what?
    cancellable: true
  }
})

console.log('Animation triggered. Observe your character:')
console.log('1. Does it play the roll animation?')
console.log('2. After ~1 second, does it return to idle or resume locomotion?')
console.log('')
console.log('Expected issue: Returns to idle T-pose instead of walking/running')
console.log('')
// Note: Test completes immediately, observe console output above

console.log('Debug script complete')
