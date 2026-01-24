app.configure([
  {
    key: 'rName',
    type: 'text',
    label: 'Rom Name',
  },
  {
    key: 'color',
    type: 'dropdown',
    label: 'Color',
    options: [
      { label: 'Red', value: '0.0957' },
      { label: 'Orange', value: '0' },
      { label: 'Yellow', value: '0.4824' },
      { label: 'Green', value: '0.2633' },
      { label: 'Blue', value: '0.389' },
      { label: 'Indigo', value: '0.1777' },
      { label: 'Violet', value: '0.5098' },
    ],
    initial: '0',
  },
  {
    key: 'chargeEmote',
    type: 'file',
    kind: 'emote',
    label: 'Charge Emote',
  },
  {
    key: 'dashKey',
    type: 'switch',
    label: 'Dash Key',
    initial: 'keyF',
    options: [
      { label: 'F', value: 'keyF' },
      { label: 'E', value: 'keyE' },
      { label: 'Q', value: 'keyQ' },
      { label: 'R', value: 'keyR' },
      { label: 'Space', value: 'space' },
    ],
  },
  {
    key: 'showMobileButton',
    type: 'toggle',
    label: 'Show Mobile Dash Button',
    initial: true,
  },
])

const CLASS_NAME = 'Vanguard'
const FORWARD = new Vector3(0, 0, -1)
const chargeEmote = props.chargeEmote?.url + '?l=0'
const v1 = new Vector3()
const q1 = new Quaternion()
const e1 = new Euler(0, 0, 0, 'YXZ')

if (world.isClient) {
  const player = world.getPlayer()
  const control = app.control()
  let canDash = true

  const dashKey = config.dashKey || 'keyF'

  console.log(`[Dash] Dash key: ${dashKey}`)

  if (control?.[dashKey]) {
    control[dashKey].capture = true
    console.log(`[Dash] Captured ${dashKey} for dash`)
  }

  function getDirection() {
    e1.setFromQuaternion(control.camera.quaternion)
    e1.x = 0
    e1.z = 0
    q1.setFromEuler(e1)
    const dir = v1.copy(FORWARD).applyQuaternion(q1)
    return dir
  }

  function charge() {
    if (player.hasEffect()) return
    if (!canDash) return
    canDash = false

    const dir = getDirection()
    const force = dir.multiplyScalar(30)
    player.push(force)
    player.applyEffect({
      emote: chargeEmote,
      turn: true,
      duration: 0.4,
      onEnd: () => {
        canDash = true
      },
    })
  }

  app.on('update', delta => {
    if (control?.[dashKey]?.pressed) {
      charge()
    }
  })

  if (config.showMobileButton) {
    const dashBtn = app.create('ui', {
      space: 'screen',
      width: 50,
      height: 50,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      borderRadius: 25,
      pivot: 'top-right',
      position: [1, 1],
      offset: [-120, -110],
      cursor: 'pointer',
      onPointerDown: charge,
      alignItems: 'center',
      justifyContent: 'center',
    })
    const label = app.create('uitext', {
      value: 'DASH',
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
    })
    dashBtn.add(label)
    app.add(dashBtn)
    console.log('[Dash] Mobile button created')
  }
}

const ui = app.create('ui')
ui.rotation.y = 180 * DEG2RAD
ui.position.z = -0.12
ui.position.y = -0.46
ui.width = 20
const romName = app.create('uitext')
romName.fontSize = 4
romName.textAlign = 'center'
romName.color = '#000000'
romName.value = props.rName
romName.backgroundColor = '#ffffff'
romName.fontFamily = 'Arial Black'
const mesh = app.get('hyper-rom-orange_mesh')
const mat = mesh.material
if (props.color == 0.1777) {
  mat.textureY = 0.0684
} else if (props.color == 0.0957) {
  mat.textureY = -0.0645
} else if (props.color == 0.2633) {
  mat.textureY = -0.1772
} else {
  mat.textureY = 0
}
mat.textureX = props.color
ui.add(romName)
app.add(ui)
