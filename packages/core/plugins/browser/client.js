import { definePlugin } from '../../plugins.js'
import { warn } from '../../extras/warn.js'

const isBrowser = typeof window !== 'undefined'

async function copyTextToClipboard(value) {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  if (!text) return false

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy clipboard path
    }
  }

  if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      document.body.removeChild(textarea)
      return copied
    } catch {
      return false
    }
  }

  return false
}

function resolveClipboardImageUrl(world, value) {
  if (typeof value === 'string' && value.trim()) {
    const url = value.trim()
    if (/^(data:|blob:|https?:\/\/|\/\/|\/)/i.test(url)) {
      return url
    }
    return world.resolveURL(url)
  }
  if (value && typeof value === 'object' && typeof value.url === 'string' && value.url.trim()) {
    const url = value.url.trim()
    if (/^(data:|blob:|https?:\/\/|\/\/|\/)/i.test(url)) {
      return url
    }
    return world.resolveURL(url)
  }
  return null
}

async function rasterizeClipboardImage(blob) {
  if (!blob || !blob.type?.startsWith('image/')) return null
  if (typeof document === 'undefined') return blob

  let url = null
  try {
    url = URL.createObjectURL(blob)
    const image = await new Promise((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = reject
      nextImage.src = url
    })

    const width = Math.max(1, Math.round(image.naturalWidth || image.width || 0))
    const height = Math.max(1, Math.round(image.naturalHeight || image.height || 0))
    if (!width || !height) {
      return blob
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      return blob
    }
    context.drawImage(image, 0, 0, width, height)

    const pngBlob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png')
    })
    return pngBlob || blob
  } catch {
    return blob
  } finally {
    if (url) {
      URL.revokeObjectURL(url)
    }
  }
}

async function createClipboardImageItem(world, value) {
  const url = resolveClipboardImageUrl(world, value)
  if (!url || typeof fetch !== 'function' || typeof ClipboardItem === 'undefined') return null

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const blob = await response.blob()
    const clipboardBlob = await rasterizeClipboardImage(blob)
    const mimeType = clipboardBlob?.type || blob?.type || 'image/png'
    if (!mimeType.startsWith('image/')) return null
    return new ClipboardItem({
      [mimeType]: clipboardBlob || blob,
    })
  } catch {
    return null
  }
}

async function copyImageToClipboard(world, value) {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.write !== 'function') {
    return false
  }

  const item = await createClipboardImageItem(world, value)
  if (!item) return false

  try {
    await navigator.clipboard.write([item])
    return true
  } catch {
    return false
  }
}

async function copyToClipboard(world, value, options = {}) {
  const kind = String(options?.kind || options?.type || '')
    .trim()
    .toLowerCase()
  const inferredImage =
    !kind &&
    ((typeof value === 'string' && /^data:image\//i.test(value.trim())) ||
      (value && typeof value === 'object' && typeof value.url === 'string' && value.url.trim()))

  if (kind === 'image' || inferredImage) {
    return copyImageToClipboard(world, value)
  }
  return copyTextToClipboard(value)
}

export const browserClientScriptApi = {
  world: {
    open(entity, url, newWindow = false) {
      if (!url) {
        warn('[world.open] URL is required')
        return
      }
      if (!isBrowser) {
        warn('[world.open] URL redirection only works in the browser')
        return
      }

      try {
        const resolvedUrl = entity.world.resolveURL(url)

        setTimeout(() => {
          if (newWindow) {
            window.open(resolvedUrl, '_blank')
          } else {
            window.location.href = resolvedUrl
          }
        }, 0)
      } catch (err) {
        warn(`[world.open] Failed to open URL: ${err?.message || err}`)
      }
    },
    async copy(entity, value, options = {}) {
      if (!isBrowser) {
        warn('[world.copy] Clipboard access only works in the browser')
        return false
      }
      return copyToClipboard(entity.world, value, options)
    },
    getQueryParam(_entity, key) {
      if (!isBrowser) {
        warn('getQueryParam() must be called in the browser')
        return null
      }
      const urlParams = new URLSearchParams(window.location.search)
      return urlParams.get(key)
    },
    setQueryParam(_entity, key, value) {
      if (!isBrowser) {
        warn('setQueryParam() must be called in the browser')
        return null
      }
      const urlParams = new URLSearchParams(window.location.search)
      if (value) {
        urlParams.set(key, value)
      } else {
        urlParams.delete(key)
      }
      const newUrl = `${window.location.pathname}?${urlParams.toString()}`
      window.history.replaceState({}, '', newUrl)
    },
  },
}

export const browserClientPlugin = definePlugin({
  name: '@gamedev/plugin-browser/client',
  requires: ['core', 'apps', 'client'],
  provides: ['@gamedev/plugin-browser', 'browser'],
  scripts: browserClientScriptApi,
})
