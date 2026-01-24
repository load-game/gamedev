// Debug Area Trigger
// Attach to an entity with AreaTrigger to test if triggers work

app.configure([
  {
    key: 'debugMode',
    type: 'toggle',
    label: 'Debug Mode',
    initial: true,
  },
])

const body = app.get('AreaTrigger')

if (!body) {
  console.error('[Debug Trigger] Missing AreaTrigger node!')
  return
}

console.log('[Debug Trigger] Script loaded, waiting for trigger events...')

if (world.isServer) {
  body.onTriggerEnter = (hit) => {
    console.log('[Debug Trigger] onTriggerEnter fired!', hit)
    if (hit?.playerId) {
      console.log('[Debug Trigger] Player entered:', hit.playerId)
      const player = world.getPlayer(hit.playerId)
      console.log('[Debug Trigger] Player object:', player)
    }
  }
  
  body.onTriggerExit = (hit) => {
    console.log('[Debug Trigger] onTriggerExit fired!', hit)
  }
}

if (world.isClient) {
  console.log('[Debug Trigger] Client loaded')
}
