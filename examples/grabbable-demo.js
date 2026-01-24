console.log('[Grabbable Demo] Initializing puzzle system')

let puzzleSolved = false
let doorOpened = false

// Create table
const table = app.create('prim', {
  type: 'box',
  size: [4, 0.1, 3],
  position: [0, 0.5, -3],
  color: '#8B4513',
})
app.add(table)

// Create snap points
const snapPoint1 = app.create('snap', {
  position: [-1, 1.1, -3],
})
app.add(snapPoint1)

const snapPoint2 = app.create('snap', {
  position: [0, 1.1, -3],
})
app.add(snapPoint2)

const snapPoint3 = app.create('snap', {
  position: [1, 1.1, -3],
})
app.add(snapPoint3)

// Create puzzle piece 1
const puzzlePiece1 = app.create('grabbable', {
  position: [-2, 1.5, -3],
  grabDistance: 3,
  snapDistance: 1.5,
  snapToPoints: true,	
  returnOnRelease: false,
  snapSignal: 'puzzle:piece1-snapped',
  unsnapSignal: 'puzzle:piece1-unsnapped',
  rigidbodyTypeOnSnap: 'static',
  rigidbodyTypeOnRelease: 'dynamic',
  onGrab: (grabbable, player) => {
    console.log('[Puzzle Piece 1] Grabbed by player:', player?.data?.name || 'unknown')
  },
  onSnap: (grabbable, snapPoint) => {
    console.log('[Puzzle Piece 1] Snapped to position!')
    checkPuzzleComplete()
  },
  onUnsnap: grabbable => {
    console.log('[Puzzle Piece 1] Removed from snap point')
    puzzleSolved = false
  },
})

const piece1Mesh = app.create('prim', {
  type: 'box',
  size: [0.3, 0.3, 0.3],
  color: '#FF0000',
})
puzzlePiece1.add(piece1Mesh)

const piece1Body = app.create('rigidbody', {
  type: 'dynamic',
  mass: 0.5,
})
puzzlePiece1.add(piece1Body)

app.add(puzzlePiece1)

// Create puzzle piece 2
const puzzlePiece2 = app.create('grabbable', {
  position: [-2.5, 1.5, -3],
  grabDistance: 3,
  snapDistance: 1.5,
  snapToPoints: true,
  returnOnRelease: false,
  snapSignal: 'puzzle:piece2-snapped',
  unsnapSignal: 'puzzle:piece2-unsnapped',
  rigidbodyTypeOnSnap: 'static',
  rigidbodyTypeOnRelease: 'dynamic',
  onGrab: (grabbable, player) => {
    console.log('[Puzzle Piece 2] Grabbed by player:', player?.data?.name || 'unknown')
  },
  onSnap: (grabbable, snapPoint) => {
    console.log('[Puzzle Piece 2] Snapped to position!')
    checkPuzzleComplete()
  },
  onUnsnap: grabbable => {
    console.log('[Puzzle Piece 2] Removed from snap point')
    puzzleSolved = false
  },
})

const piece2Mesh = app.create('prim', {
  type: 'box',
  size: [0.3, 0.3, 0.3],
  color: '#00FF00',
})
puzzlePiece2.add(piece2Mesh)

const piece2Body = app.create('rigidbody', {
  type: 'dynamic',
  mass: 0.5,
})
puzzlePiece2.add(piece2Body)

app.add(puzzlePiece2)

// Create puzzle piece 3
const puzzlePiece3 = app.create('grabbable', {
  position: [-1.5, 1.5, -3],
  grabDistance: 3,
  snapDistance: 1.5,
  snapToPoints: true,
  returnOnRelease: false,
  snapSignal: 'puzzle:piece3-snapped',
  unsnapSignal: 'puzzle:piece3-unsnapped',
  rigidbodyTypeOnSnap: 'static',
  rigidbodyTypeOnRelease: 'dynamic',
  onGrab: (grabbable, player) => {
    console.log('[Puzzle Piece 3] Grabbed by player:', player?.data?.name || 'unknown')
  },
  onSnap: (grabbable, snapPoint) => {
    console.log('[Puzzle Piece 3] Snapped to position!')
    checkPuzzleComplete()
  },
  onUnsnap: grabbable => {
    console.log('[Puzzle Piece 3] Removed from snap point')
    puzzleSolved = false
  },
})

const piece3Mesh = app.create('prim', {
  type: 'box',
  size: [0.3, 0.3, 0.3],
  color: '#0000FF',
})
puzzlePiece3.add(piece3Mesh)

const piece3Body = app.create('rigidbody', {
  type: 'dynamic',
  mass: 0.5,
})
puzzlePiece3.add(piece3Body)

app.add(puzzlePiece3)

// Create door
const door = app.create('prim', {
  type: 'box',
  size: [0.2, 3, 1.5],
  position: [5, 1.5, -3],
  color: '#654321',
})
app.add(door)

const doorBody = app.create('rigidbody', {
  type: 'static',
})
door.add(doorBody)

// Check puzzle completion
function checkPuzzleComplete() {
  const allSnapped = puzzlePiece1.isSnapped && puzzlePiece2.isSnapped && puzzlePiece3.isSnapped

  if (allSnapped && !puzzleSolved) {
    puzzleSolved = true
    console.log('[Puzzle] All pieces snapped! Puzzle solved!')

    setTimeout(() => {
      if (!doorOpened) {
        doorOpened = true
        door.position.x = 8
        console.log('✅ Door opened! You can now proceed!')
        world.emit('puzzle:completed', { playerId: world.getPlayer()?.data?.id })
      }
    }, 1000)
  }
}

// Listen for snap signals
world.on('puzzle:piece1-snapped', data => {
  console.log('[World] Puzzle piece 1 snap signal received:', data)
})

world.on('puzzle:piece2-snapped', data => {
  console.log('[World] Puzzle piece 2 snap signal received:', data)
})

world.on('puzzle:piece3-snapped', data => {
  console.log('[World] Puzzle piece 3 snap signal received:', data)
})

world.on('puzzle:completed', data => {
  console.log('[World] Puzzle completed! Player:', data.playerId)
})

// Update loop for grabbable nodes
app.on('update', () => {
  if (puzzlePiece1) puzzlePiece1.update()
  if (puzzlePiece2) puzzlePiece2.update()
  if (puzzlePiece3) puzzlePiece3.update()
})

// Cleanup
app.on('destroy', () => {
  console.log('[Grabbable Demo] Cleaning up')
  world.off('puzzle:piece1-snapped')
  world.off('puzzle:piece2-snapped')
  world.off('puzzle:piece3-snapped')
  world.off('puzzle:completed')
})
