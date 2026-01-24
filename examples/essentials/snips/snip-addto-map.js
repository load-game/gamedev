// App Tracking Snippet
// Paste this code at the end of your app to register it with the tracking billboard
// This will display your app as a colored cube on the map with your tracking name
//
// NOTE: If your app already has app.configure(), you may need to merge this field
// into your existing config array instead of using this separate configure call.

// Add tracking name config field
app.configure(() => {
  return [
    {
      key: 'trackingName',
      type: 'text',
      label: 'Tracking Name',
      placeholder: 'Enter a name for this app',
      initial: ''
    }
  ]
})

if (!world.isClient) return

// Track last update time for throttling
let lastUpdateTime = 0
const UPDATE_INTERVAL = 0.75 // Update every 0.75 seconds (periodic)

// Function to send position update
function sendTrackingUpdate() {
  if (!app.position) return

  const trackingName = app.config?.trackingName  props?.trackingName  'Unnamed App'
  const appId = app.instanceId

  // Get current position
  const position = {
    x: app.position.x,
    y: app.position.y,
    z: app.position.z
  }

  // Emit tracking update event
  app.emit('app-tracking-update', {
    appId: appId,
    position: position,
    trackingName: trackingName
  })
}

// Send initial update
sendTrackingUpdate()

// Update position periodically
app.on('update', (delta) => {
  lastUpdateTime += delta
  if (lastUpdateTime >= UPDATE_INTERVAL) {
    sendTrackingUpdate()
    lastUpdateTime = 0
  }
})

// Also send update when config changes (tracking name)
app.on('config', () => {
  sendTrackingUpdate()
})