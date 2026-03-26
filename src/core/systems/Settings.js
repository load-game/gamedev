import { System } from './System'
import { Ranks } from '../extras/ranks'

const ADMIN_AUTH_KIND_ADMIN_CODE = 'admin_code'
const ADMIN_AUTH_KIND_PLAYER_TOKEN = 'player_token'

function normalizeAdminAuthKind(value) {
  return value === ADMIN_AUTH_KIND_PLAYER_TOKEN ? ADMIN_AUTH_KIND_PLAYER_TOKEN : ADMIN_AUTH_KIND_ADMIN_CODE
}

function normalizeAuthMetadata(value) {
  const usesLobbyIdentity = !!value?.usesLobbyIdentity
  const usesLocalIdentity = value?.usesLocalIdentity === undefined ? !usesLobbyIdentity : !!value.usesLocalIdentity
  const adminKind = normalizeAdminAuthKind(value?.admin?.kind)
  const codeConfigured = adminKind === ADMIN_AUTH_KIND_ADMIN_CODE && !!value?.admin?.codeConfigured
  const openAccess = adminKind === ADMIN_AUTH_KIND_ADMIN_CODE && !!value?.admin?.openAccess
  return {
    usesLobbyIdentity,
    usesLocalIdentity,
    admin: {
      kind: adminKind,
      codeConfigured,
      openAccess,
    },
  }
}

function authMetadataChanged(previous, next) {
  return (
    previous?.usesLobbyIdentity !== next.usesLobbyIdentity ||
    previous?.usesLocalIdentity !== next.usesLocalIdentity ||
    previous?.admin?.kind !== next.admin.kind ||
    previous?.admin?.codeConfigured !== next.admin.codeConfigured ||
    previous?.admin?.openAccess !== next.admin.openAccess
  )
}

export class Settings extends System {
  constructor(world) {
    super(world)

    this.title = null
    this.desc = null
    this.image = null
    this.avatar = null
    this.customAvatars = null
    this.voice = null
    this.rank = null
    this.playerLimit = null
    this.ao = null
    this.auth = normalizeAuthMetadata()

    this.changes = null
  }

  setAuthMetadata(value) {
    const next = normalizeAuthMetadata(value)
    if (!authMetadataChanged(this.auth, next)) return
    const prev = this.auth
    this.auth = next
    this.emit('change', {
      auth: {
        prev,
        value: next,
      },
    })
  }

  get adminAuthKind() {
    return this.auth.admin.kind
  }

  get adminCodeConfigured() {
    return this.auth.admin.codeConfigured
  }

  get adminOpenAccess() {
    return this.auth.admin.openAccess
  }

  get effectiveRank() {
    const minimumRank = Number.isFinite(this.rank) ? this.rank : Ranks.VISITOR
    return this.adminOpenAccess ? Ranks.ADMIN : minimumRank
  }

  deserialize(data) {
    this.title = data.title
    this.desc = data.desc
    this.image = data.image
    this.avatar = data.avatar
    this.customAvatars = data.customAvatars
    this.voice = data.voice
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
