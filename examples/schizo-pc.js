const screen = app.get('PCRig')
const anims = screen.anims

let isOn = false

screen.play({ name: 'OFF', loop: false })

app.configure([
  {
    key: 'url',
    type: 'text',
    label: 'URL',
    initial: '',
    placeholder: 'https://example.com',
    description: 'The URL to open when clicked (opens in new tab)',
  },
  { type: 'section', key: 'soundSection', label: 'SFX' },
  { key: 'boot', type: 'file', kind: 'audio', label: 'Boot Sound' },
])

const bootAudio = app.create('audio', {
  src: props.boot?.url,
  group: 'sfx',
  loop: false,
  volume: 1,
  spatial: true,
  distanceModel: 'inverse',
  refDistance: 1,
  maxDistance: 20,
  rolloffFactor: 2,
  coneInnerAngle: 360,
  coneOuterAngle: 360,
  coneOuterGain: 0,
})

screen.add(bootAudio)

// ACTION TO OPEN WEBPAGE
if (world.isClient) {
  const action = app.create('action', {
    distance: 2,
    position: [0.3, 0, 0.1],
    label: '🫵🤡',
    onTrigger: () => {
      if (props.url) {
        world.open(props.url, true) //Open in new tab
      }
    },
  })
  // Click the app
  app.onPointerDown = () => {
    if (!isOn) {
      // Turn on
      screen.play({ name: 'ON', loop: false })
      bootAudio.play()
      screen.add(action)
      isOn = true
    } else {
      // Turn off
      screen.play({ name: 'OFF', loop: false })
      bootAudio.stop()
      screen.remove(action)
      isOn = false
    }
  }
}