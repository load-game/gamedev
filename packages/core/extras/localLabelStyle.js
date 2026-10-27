// Client-only presentation overrides. They never enter player/profile/chat
// network payloads and cannot assert item ownership or change sender identity.
const colorPattern = /^#[\da-f]{6}(?:[\da-f]{2})?$/i
const imagePattern = /^data:image\/(?:png|jpeg|webp|svg\+xml)(?:;charset=utf-8|;base64)?,/i

function decodeInlineImage(image) {
  if (typeof image !== 'string' || image.length > 200000 || !imagePattern.test(image))
    throw new Error('Label artwork must be an inline image')
  const comma = image.indexOf(','),
    meta = image.slice(5, comma),
    payload = image.slice(comma + 1)
  const data = meta.toLowerCase().endsWith(';base64')
    ? Uint8Array.from(atob(payload), char => char.charCodeAt(0))
    : decodeURIComponent(payload)
  if (!data.length) throw new Error('Label artwork must not be empty')
  return { data, type: meta.split(';')[0] }
}

export function normalizeLocalLabelStyle(value) {
  if (value === null) return null
  if (!value || typeof value !== 'object') throw new Error('Invalid local label style')
  function frame(input) {
    decodeInlineImage(input?.image)
    if (typeof input.color !== 'string' || !colorPattern.test(input.color)) throw new Error('Invalid label text color')
    const optional = {}
    for (const key of ['compactImage', 'compactLeftImage', 'compactRightImage']) {
      if (input[key] === undefined) continue
      decodeInlineImage(input[key])
      optional[key] = input[key]
    }
    return Object.freeze({
      image: input.image,
      color: input.color,
      ...optional,
    })
  }
  return Object.freeze({ nameTag: frame(value.nameTag), chat: frame(value.chat) })
}

export function createLocalLabelStyleState(onChange) {
  const owners = new Map()
  let current = null
  const publish = () => {
    current = [...owners.values()].at(-1) || null
    onChange(current)
  }
  return {
    get value() {
      return current
    },
    set(owner, value) {
      const next = normalizeLocalLabelStyle(value)
      owners.delete(owner)
      if (next) owners.set(owner, next)
      publish()
    },
    remove(owner) {
      if (owners.delete(owner)) publish()
    },
    clear() {
      owners.clear()
      publish()
    },
  }
}

export function localMessageFrame(style, message, playerId) {
  return playerId && message.fromId === playerId ? style?.chat || null : null
}

export function labelName(value) {
  const name = Array.from(String(value || 'Anonymous'))
  return name.length > 24 ? name.slice(0, 23).join('') + '…' : name.join('')
}

export function createPlayerLabelNodes(createNode, player, style) {
  const urls = []
  function source(data) {
    const image = decodeInlineImage(data)
    const url = URL.createObjectURL(new Blob([image.data], { type: image.type }))
    urls.push(url)
    return url
  }
  function frame(width, height, image, color, fontSize, inset, pivot = 'center') {
    const root = createNode('ui', {
      width,
      height,
      size: 0.0032,
      res: 2,
      billboard: 'full',
      scaler: [3, 24, height === 96 ? 0.6 : 0.7],
      pivot,
      lit: false,
      pointerEvents: false,
    })
    root.add(
      createNode('uiimage', { src: source(image), absolute: true, left: 0, top: 0, width, height, objectFit: 'fill' })
    )
    const holder = createNode('uiview', {
      absolute: true,
      left: inset,
      top: height === 96 ? 39 : 38,
      width: width - inset * 2,
      height: height - 50,
    })
    const text = createNode('uitext', {
      value: '',
      fontFamily: 'Arial, sans-serif',
      fontSize,
      fontWeight: 'bold',
      color,
      textAlign: 'center',
      lineHeight: 1.25,
    })
    holder.add(text)
    root.add(holder)
    return { root, text }
  }
  const name = frame(320, 96, style.nameTag.image, style.nameTag.color, 29, 67)
  // Retain the standard bubble's sizing and text flow; only its skin changes.
  const speech = {
    root: createNode('ui', {
      width: 328,
      height: 512,
      pivot: 'bottom-center',
      billboard: 'full',
      scaler: [3, 30],
      justifyContent: 'flex-end',
      alignItems: 'center',
      active: false,
      pointerEvents: false,
    }),
    text: createNode('uitext', { value: '', color: style.chat.color, fontWeight: 100, lineHeight: 1.4, fontSize: 16 }),
  }
  const speechBox = createNode('uiview', { padding: 10, margin: [0, 14, 0, 14] })
  const speechSource = source(style.chat.compactImage || style.chat.image)
  speechBox.add(
    createNode('uiimage', {
      src: speechSource,
      absolute: true,
      left: -14,
      right: -14,
      top: 0,
      bottom: 0,
      objectFit: 'fill',
    })
  )
  speechBox.add(speech.text)
  for (const [key, edge] of [
    ['compactLeftImage', 'left'],
    ['compactRightImage', 'right'],
  ]) {
    if (!style.chat[key]) continue
    const holder = createNode('uiview', {
      absolute: true,
      [edge]: -13,
      top: 0,
      bottom: 0,
      width: 24,
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: false,
    })
    holder.add(createNode('uiimage', { src: source(style.chat[key]), width: 24, height: 24, objectFit: 'contain' }))
    speechBox.add(holder)
  }
  speech.root.add(speechBox)
  void Promise.resolve(player.world?.loader?.load?.('image', speechSource)).catch(() => {})
  player.aura.add(name.root)
  player.aura.add(speech.root)
  const api = {
    name: name.root,
    speech: speech.root,
    update() {
      const y = player.nametag.position.y
      name.root.position.y = y + 0.1
      speech.root.position.y = y + 0.32
      name.text.value = labelName(player.data.name)
      name.text.fontSize = Math.min(29, 330 / Math.max(12, Array.from(name.text.value).length))
    },
    say(message) {
      speech.text.value = String(message)
      speech.root.active = true
    },
    destroy() {
      player.aura.remove(name.root)
      player.aura.remove(speech.root)
      for (const url of urls) {
        void Promise.resolve(player.world?.loader?.releaseAsset?.('image', url)).catch(() => {})
        URL.revokeObjectURL(url)
      }
    },
  }
  api.update()
  return api
}
