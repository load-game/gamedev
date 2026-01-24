// Simple WebView example - displays a 3D webpage in the world
// Based on user's working example - NO app.on('init') needed

console.log('=== Simple WebView Test ===')

const webview = app.create('webview', {
  src: 'https://irb0gie.vercel.app',
  width: 4, // Width in meters
  height: 3, // Height in meters
  factor: 100, // Pixels per meter (higher = sharper)
  space: 'world', // 'world' for 3D positioned, 'screen' for 2D overlay
  position: [0, 1.5, -3], // Position in front of player at eye level
  pointerEvents: true, // Enable interaction with iframe
})

app.add(webview)
console.log('✅ WebView created with pointer events enabled!')
console.log('Position: [0, 1.5, -3]')
console.log('You should see a webpage and be able to scroll/click!')

// Keep app running
app.keepActive = true
