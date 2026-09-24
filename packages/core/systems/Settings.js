import { System } from './System.js'
import { Ranks } from '../extras/ranks.js'

export class Settings extends System {
  constructor(world) {
    super(world)

    this.title = null
    this.desc = null
    this.image = null
    this.avatar = null
    this.customAvatars = null
    this.voice = null
    this.voiceRefDistance = 4
    this.voiceRolloffFactor = 1
    this.rank = null
    this.playerLimit = null
    this.ao = null

    this.changes = null
  }

  setHasAdminCode(value) {
    this.hasAdminCode = value
  }

  get effectiveRank() {
    return this.hasAdminCode ? this.rank : Ranks.ADMIN
  }

  deserialize(data) {
    this.title = data.title
    this.desc = data.desc
    this.image = data.image
    this.avatar = data.avatar
    this.customAvatars = data.customAvatars
    this.voice = data.voice
    this.voiceRefDistance = normalizeVoiceDistance('voiceRefDistance', data.voiceRefDistance)
    this.voiceRolloffFactor = normalizeVoiceDistance('voiceRolloffFactor', data.voiceRolloffFactor)
    this.rank = data.rank
    this.playerLimit = data.playerLimit
    this.ao = data.ao
    this.emit('change', {
      title: { value: this.title },
      desc: { value: this.desc },
      image: { value: this.image },
      avatar: { value: this.avatar },
      customAvatars: { value: this.customAvatars },
      voice: { value: this.voice },
      voiceRefDistance: { value: this.voiceRefDistance },
      voiceRolloffFactor: { value: this.voiceRolloffFactor },
      rank: { value: this.rank },
      playerLimit: { value: this.playerLimit },
      ao: { value: this.ao },
    })
  }

  serialize() {
    return {
      desc: this.desc,
      title: this.title,
      image: this.image,
      avatar: this.avatar,
      customAvatars: this.customAvatars,
      voice: this.voice,
      voiceRefDistance: this.voiceRefDistance,
      voiceRolloffFactor: this.voiceRolloffFactor,
      rank: this.rank,
      playerLimit: this.playerLimit,
      ao: this.ao,
    }
  }

  preFixedUpdate() {
    if (!this.changes) return
    this.emit('change', this.changes)
    this.changes = null
  }

  modify(key, value) {
    value = normalizeVoiceDistance(key, value)
    if (this[key] === value) return
    const prev = this[key]
    this[key] = value
    if (!this.changes) this.changes = {}
    if (!this.changes[key]) this.changes[key] = { prev, value: null }
    this.changes[key].value = value
  }

  set(key, value, broadcast) {
    this.modify(key, value)
    if (broadcast) {
      if (this.world.network.isClient && this.world.admin?.settingsModify) {
        this.world.admin.settingsModify({ key, value }, { ignoreNetworkId: this.world.network.id })
      } else {
        this.world.network.send('settingsModified', { key, value })
      }
    }
  }
}

// Invalid or omitted values use conversational defaults, including older worlds.
export function normalizeVoiceDistance(key, value) {
  if (key === 'voiceRefDistance') return Number.isFinite(value) && value > 0 ? value : 4
  if (key === 'voiceRolloffFactor') return Number.isFinite(value) && value >= 0 ? value : 1
  return value
}
