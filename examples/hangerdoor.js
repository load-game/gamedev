app.configure([
  {
    key: 'animState',
    type: 'switch',
    label: 'Door State',
    options: [
      { label: 'Close', value: 'Close' },
      { label: 'Open', value: 'Open' },
    ],
    initial: 'Close',
  },
  {
    key: 'openSound',
    type: 'file',
    label: 'Open Sound File',
    kind: 'audio',
  },
  {
    key: 'closeSound',
    type: 'file',
    label: 'Close Sound File',
    kind: 'audio',
  },
  {
    key: 'soundVolume',
    type: 'range',
    label: 'Sound Volume',
    min: 0,
    max: 1,
    step: 0.1,
    initial: 0.7,
  },
  {
    key: 'debug',
    type: 'toggle',
    label: 'Debug Mode',
    initial: true,
  },
])

const rig = app.get('GarageDoorRig')
const col = app.get('GarageDoorHitCollider')

let isAnimating = false
let hasOpened = false
let animState = 'Closed'
let openAudio = null
let closeAudio = null
let debugAction = null
let openSoundUrl = null
let closeSoundUrl = null
const debug = props.debug
const logDebug = msg => {if (debug) console.log(`[GARAGEDOOR DEBUG] ${msg}`)}

// Safe audio creation function
function createSafeAudio(soundUrl, label) {
  try {
    if (!soundUrl || !app?.create) return null
    return app.create('audio', {
      src: soundUrl,
      volume: props.soundVolume,
      group: 'sfx',
      spatial: false,
    })
  } catch (error) {
    logDebug(`Failed to create ${label} audio: ${error.message}`)
    return null
  }
}

// Safe audio play function
function playSafeAudio(audio, soundUrl, label) {
  try {
    let audioToPlay = audio

    // Create audio on-demand if needed
    if (!audioToPlay && soundUrl) {
      audioToPlay = createSafeAudio(soundUrl, label)
      if (audioToPlay && app && app.add) {
        app.add(audioToPlay)
      }
    }

    if (audioToPlay && typeof audioToPlay.play === 'function') {
      audioToPlay.volume = props.soundVolume
      audioToPlay.play()
      return true
    }
  } catch (error) {
    logDebug(`Audio play failed: ${error.message}`)
  }
  return false
}

function playDoorSequence() {
  if (isAnimating || hasOpened) return
  isAnimating = true
  animState = 'Opening'
  updateActionLabel()

  // Play sound and animation
  playSafeAudio(openAudio, openSoundUrl, 'open')
  rig.play({ name: 'Open', loop: false, fade: 0.5 })

  setTimeout(() => {
    animState = 'Open'
    col.active = false
    isAnimating = false
    hasOpened = true
    updateActionLabel()
  }, 1000)
}

function closeDoorSequence() {
  if (isAnimating || !hasOpened) return
  isAnimating = true
  animState = 'Closing'
  updateActionLabel()

  // Play sound and animation
  playSafeAudio(closeAudio, closeSoundUrl, 'close')
  rig.play({ name: 'Close', loop: false, fade: 0.5 })

  setTimeout(() => {
    animState = 'Closed'
    col.active = true
    isAnimating = false
    hasOpened = false
    updateActionLabel()
  }, 1000)
}

function updateActionLabel() {
  if (debugAction) {
    if (animState === 'Open') {
      debugAction.label = 'Close Door'
    } else if (animState === 'Closed') {
      debugAction.label = 'Open Door'
    } else {
      debugAction.label = 'Door Busy'
    }
  }
}

function toggleDoor() {
  if (animState === 'Open' && !isAnimating) {
    closeDoorSequence()
  } else if (animState === 'Closed' && !isAnimating) {
    playDoorSequence()
  }
}

// Load audio files
openSoundUrl = props.openSound?.url || props.openSound
closeSoundUrl = props.closeSound?.url || props.closeSound
openAudio = createSafeAudio(openSoundUrl, 'open')
closeAudio = createSafeAudio(closeSoundUrl, 'close')

// Add audio nodes to app
if (openAudio && app?.add) app.add(openAudio)
if (closeAudio && app?.add) app.add(closeAudio)

// Create debug action
if (debug) {
  debugAction = app.create('action', {
    label: 'Open Door',
    position: [0, 0.8, 0],
    distance: 2,
    onTrigger: toggleDoor,
  })
  app.add(debugAction)
  updateActionLabel()
}

app.on('update', () => {
  // Reset hasOpened if door is set to Closed manually in UI
  if (app.get('animState') === 'Close' && hasOpened) {
    hasOpened = false
    col.active = true
    animState = 'Closed'
    updateActionLabel()
  }
})
