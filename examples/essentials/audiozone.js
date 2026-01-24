/*============================================================================
 * Spherea🔊🎶
 *============================================================================
 * - Upload an `.mp3` file for ambient sound
 * - Audio always plays
 * - Spatial audio settings control audibility by proximity
 * - Show/hide debug mesh via configuration
 *============================================================================*/

app.configure([
  {
    key: 'showMesh',
    type: 'switch',
    label: 'Audio Zone Mesh',
    options: [
      { value: 'visible', label: 'Visible' },
      { value: 'invisible', label: 'Invisible' },
    ],
    initial: 'invisible',
  },
  // #region AUDIO
  {
    type: 'section',
    key: 'audioSection',
    label: 'Audio Settings',
  },
  {
    type: 'file',
    key: 'audio',
    kind: 'audio',
    label: 'Audio File',
  },
  {
    key: 'loop',
    type: 'switch',
    label: 'Loop Audio',
    options: [
      { label: 'Yes', value: true },
      { label: 'No', value: false },
    ],
    initial: true,
  },
  {
    type: 'range',
    key: 'volume',
    label: 'Volume',
    min: 0,
    max: 1,
    step: 0.1,
    initial: 1,
  },
  {
    key: 'isSpatial',
    type: 'switch',
    label: 'Spatial Audio',
    options: [
      { label: 'Spatial (3D)', value: true },
      { label: 'Global', value: false },
    ],
    initial: true,
  },
  {
    key: 'distanceModel',
    type: 'switch',
    label: 'Distance Model',
    options: [
      { label: 'Linear', value: 'linear' },
      { label: 'Inverse', value: 'inverse' },
      { label: 'Exponential', value: 'exponential' },
    ],
    initial: 'inverse',
  },
  {
    key: 'audioType',
    type: 'switch',
    label: 'Audio Group',
    options: [
      { label: 'Music', value: 'music' },
      { label: 'Sound Effect', value: 'sfx' },
    ],
    initial: 'music',
  },
  {
    key: 'minDistance',
    type: 'number',
    label: 'Min Distance',
    initial: 5,
    min: 1,
    max: 50,
    description: 'Distance where audio starts to fade (in meters)',
  },
  {
    key: 'maxDistance',
    type: 'number',
    label: 'Max Distance',
    initial: 20,
    min: 1,
    max: 100,
    description: 'Distance where audio becomes inaudible (in meters)',
  },
  {
    key: 'rolloffFactor',
    type: 'switch',
    label: 'Falloff Rate',
    options: [
      { label: 'Gradual', value: 0.5 },
      { label: 'Medium', value: 1 },
      { label: 'Steep', value: 2 },
    ],
    initial: 2,
  },
  {
    type: 'section',
    key: 'coneSection',
    label: 'Sound Cone Settings',
  },
  {
    type: 'number',
    key: 'coneInnerAngle',
    label: 'Cone Inner Angle',
    min: 0,
    max: 360,
    step: 1,
    initial: 360,
  },
  {
    type: 'number',
    key: 'coneOuterAngle',
    label: 'Cone Outer Angle',
    min: 0,
    max: 360,
    step: 1,
    initial: 360,
  },
  {
    type: 'range',
    key: 'coneOuterGain',
    label: 'Cone Outer Gain',
    min: 0,
    max: 1,
    step: 0.1,
    initial: 0,
  },
  // #endregion
])

// Configuration values
const showMesh = props.showMesh === 'visible'

// Create or get mesh
const mesh = app.get('Sphere')
const rigidBody = app.get('AreaTrigger')
const collider = app.get('Collider')

// Configure mesh visibility - use update loop to ensure proper initialization
if (mesh) {
  app.on('update', () => {
    const shouldShow = props.showMesh === 'visible'
    if (mesh.active !== shouldShow) {
      mesh.active = shouldShow
      console.log(`[AudioZone] Mesh visibility: ${shouldShow ? 'visible' : 'invisible'}`)
    }
  })
}

// Create and configure spatial audio

const audio = app.create('audio', {
  src: props.audio?.url,
  group: props.audioType || 'music',
  loop: props.loop !== false,
  volume: props.volume || 1,
  spatial: props.isSpatial !== false,
  distanceModel: props.distanceModel || 'inverse',
  refDistance: props.minDistance || 1,
  maxDistance: props.maxDistance || 20,
  rolloffFactor: props.rolloffFactor || 2,
  coneInnerAngle: props.coneInnerAngle || 360,
  coneOuterAngle: props.coneOuterAngle || 360,
  coneOuterGain: props.coneOuterGain || 0,
})

rigidBody.add(audio)

// Audio zone info logged to console instead
if (showMesh) {
  console.log('🔊 Audio Zone Configuration:')
  console.log(`  - Min Distance: ${props.minDistance || 5}m (100% volume zone)`)
  console.log(`  - Max Distance: ${props.maxDistance || 20}m (0% volume zone)`)
  console.log(`  - Rolloff Factor: ${props.rolloffFactor || 2} (steepness)`)
  if (props.coneInnerAngle < 360 || props.coneOuterAngle < 360) {
    console.log(`  - Cone: Inner ${props.coneInnerAngle || 360}°, Outer ${props.coneOuterAngle || 360}°`)
  }
  console.log('  🎧 Spatial audio: volume decreases with distance from center')
}

rigidBody.onTriggerEnter = () => {
  console.log('[AudioZone] Trigger ENTER', world.isServer ? 'SERVER' : 'CLIENT')
  console.log(`🔊 Audio playing - Spatial: ${props.isSpatial !== false}`)
  if (props.isSpatial !== false) {
    console.log(`  📍 Volume based on distance from center`)
    console.log(`  📏 ${props.minDistance || 5}m = 100% volume`)
    console.log(`  📏 ${props.maxDistance || 20}m = 0% volume`)
  }
  audio.play()
}

rigidBody.onTriggerExit = () => {
  console.log('[AudioZone] Trigger EXIT')
}
