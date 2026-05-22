function getRuntimeAuthBridge() {
  if (typeof globalThis === 'undefined') return null
  return globalThis.__runtimeAuth || null
}

function buildPatch({ name, avatar } = {}) {
  const patch = {}
  if (typeof name === 'string') {
    patch.name = name
  }
  if (avatar === null || typeof avatar === 'string') {
    patch.avatar = avatar
  }
  return patch
}

export async function syncLobbyProfilePatch(input) {
  const patch = buildPatch(input)
  if (!Object.keys(patch).length) {
    return { ok: true, guest: true, persisted: false }
  }

  const auth = getRuntimeAuthBridge()
  if (!auth?.enabled || typeof auth.updateProfile !== 'function') {
    return { ok: true, guest: true, persisted: false }
  }

  const session = await auth.getSessionUser?.().catch(() => null)
  if (!session?.user?.id) {
    return { ok: true, guest: true, persisted: false }
  }

  try {
    const response = await auth.updateProfile(patch)
    return {
      ok: true,
      guest: false,
      persisted: true,
      user: response?.user || null,
    }
  } catch (error) {
    return {
      ok: false,
      guest: false,
      persisted: false,
      error,
    }
  }
}
