// Get individual platform nodes directly
const platform = app.get('Platform')
const mediumPlatform = app.get('MediumPlatform')
const largePlatform = app.get('LargePlatform')
const extraLargePlatform = app.get('ExtraLargePlatform')

const areaTrigger = app.get('AreaTrigger') // The trigger detection
const triggerMesh = app.get('LOD001') // Separate mesh for visualization
const fllnPltfrm = app.get('FllnPltfrm')

// Falling platform state
let originalPosition = null
let resetTimer = null

// init start with falling platform visible and static
if (platform) platform.active = false
if (mediumPlatform) mediumPlatform.active = false
if (largePlatform) largePlatform.active = false
if (extraLargePlatform) extraLargePlatform.active = false
if (fllnPltfrm) fllnPltfrm.type = 'static'


// Store original position for reset
if (fllnPltfrm) {
  originalPosition = fllnPltfrm.position.clone()
}

app.keepActive = true

// Handle trigger mesh visibility like cartridge.js
if (triggerMesh && props.triggerVisibility === 'invisible') {
  triggerMesh.active = false
}

// Configure props panel
app.configure([
  {
    type: 'switch',
    key: 'platformType',
    label: 'Platform Type',
    options: [
      { label: 'Platform', value: 'platform' },
      { label: 'Medium Platform', value: 'mediumPlatform' },
      { label: 'Large Platform', value: 'largePlatform' },
      { label: 'X-Large Platform', value: 'extraLargePlatform' },
      { label: 'Falling Platform', value: 'fallingPlatform' },
    ],
    initial: 'fallingPlatform',
    hint: 'Select which platform type to display. Falling Platform includes trigger-based physics.'
  },
  {
    type: 'switch',
    key: 'triggerVisibility',
    label: 'Area Trigger Visibility',
    options: [
      { label: 'Visible', value: 'visible' },
      { label: 'Invisible', value: 'invisible' },
    ],
    initial: 'invisible',
    hint: 'Control visibility of the falling platform trigger area. Keep invisible for gameplay.'
  },
  {
    type: 'range',
    key: 'fallDelay',
    label: 'Fall Delay (seconds)',
    min: 0,
    max: 5,
    step: 0.5,
    initial: 1,
    hint: 'Time in seconds before falling platform drops after player steps on trigger.'
  },
  {
    type: 'range',
    key: 'resetTime',
    label: 'Reset Time (seconds)',
    min: 2,
    max: 10,
    step: 0.5,
    initial: 5,
    hint: 'Time in seconds before fallen platform respawns to original position.',
  },
])

// Platform map
const platformMap = {
  platform: platform,
  mediumPlatform: mediumPlatform,
  largePlatform: largePlatform,
  extraLargePlatform: extraLargePlatform,
  fallingPlatform: fllnPltfrm,
}

// Show selected platform
function showPlatform(type) {
  // Hide all platforms first
  if (platform) platform.active = false
  if (mediumPlatform) mediumPlatform.active = false
  if (largePlatform) largePlatform.active = false
  if (extraLargePlatform) extraLargePlatform.active = false
  if (fllnPltfrm) fllnPltfrm.active = false

  // Show selected platform
  if (type === 'fallingPlatform') {
    // Show falling platform
    fllnPltfrm.active = true
    fllnPltfrm.type = 'static'

    // Control trigger mesh visibility - areaTrigger stays active for detection
    if (triggerMesh) {
      if (props.triggerVisibility === 'visible') {
        triggerMesh.active = true
      } else {
        triggerMesh.active = false
      }
    }

    // Make it fall when player enters trigger with delay
    areaTrigger.onTriggerEnter = hit => {
      if (hit.playerId && !resetTimer) {
        // Change to dynamic after delay
        setTimeout(() => {
          fllnPltfrm.type = 'dynamic'

          // Start reset timer - platform will respawn after resetTime
          resetTimer = setTimeout(() => {
            resetFallingPlatform()
          }, props.resetTime * 1000)
        }, props.fallDelay * 1000)
      }
    }

    // Platform reset function
    function resetFallingPlatform() {
      if (originalPosition && fllnPltfrm) {
        // Clear timer
        resetTimer = null

        // Reset position
        fllnPltfrm.position.copy(originalPosition)

        // Reset to static
        fllnPltfrm.type = 'static'
      }
    }
  } else {
    // Show selected platform
    const selectedPlatform = platformMap[type]
    if (selectedPlatform) {
      selectedPlatform.active = true
    }
  }
}


// Handle prop changes
let currentType = props.platformType || 'fallingPlatform'

app.on('update', () => {
  const newType = props.platformType || 'fallingPlatform'
  if (newType !== currentType) {
    currentType = newType
    showPlatform(currentType)
  }
})

// Initialize with falling platform
showPlatform(currentType)