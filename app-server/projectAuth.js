import fs from 'fs'
import path from 'path'

import { normalizeWorldAdminBaseUrl } from './helpers.js'

const AUTH_DIR = '.lobby'
const AUTH_FILE = 'auth.json'
const AUTH_VERSION = 1

function normalizeString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeWorldUrl(value) {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return normalizeWorldAdminBaseUrl(normalized)
}

export function getProjectAuthFile(rootDir = process.cwd()) {
  return path.join(rootDir, AUTH_DIR, AUTH_FILE)
}

export function buildProjectAuthKey({ worldUrl, worldId } = {}) {
  const normalizedWorldUrl = normalizeWorldUrl(worldUrl)
  const normalizedWorldId = normalizeString(worldId)
  if (!normalizedWorldUrl || !normalizedWorldId) return null
  return `${normalizedWorldId}::${normalizedWorldUrl}`
}

export function readProjectAuthStore(rootDir = process.cwd()) {
  const filePath = getProjectAuthFile(rootDir)
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    const entries = parsed?.entries && typeof parsed.entries === 'object' ? parsed.entries : {}
    return {
      version: AUTH_VERSION,
      entries,
    }
  } catch {
    return {
      version: AUTH_VERSION,
      entries: {},
    }
  }
}

export function writeProjectAuthStore(rootDir = process.cwd(), store = {}) {
  const filePath = getProjectAuthFile(rootDir)
  const dirPath = path.dirname(filePath)
  fs.mkdirSync(dirPath, { recursive: true })
  const payload = {
    version: AUTH_VERSION,
    entries: store?.entries && typeof store.entries === 'object' ? store.entries : {},
  }
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  try {
    fs.chmodSync(filePath, 0o600)
  } catch {
    // ignore chmod failures on unsupported platforms
  }
}

export function readProjectAuthEntry(rootDir = process.cwd(), { worldUrl, worldId } = {}) {
  const key = buildProjectAuthKey({ worldUrl, worldId })
  if (!key) return null
  const store = readProjectAuthStore(rootDir)
  const entry = store.entries[key]
  if (!entry || typeof entry !== 'object') return null
  return {
    key,
    worldUrl: normalizeWorldUrl(entry.worldUrl) || normalizeWorldUrl(worldUrl),
    worldId: normalizeString(entry.worldId) || normalizeString(worldId),
    authToken: normalizeString(entry.authToken),
    userId: normalizeString(entry.userId),
    userName: normalizeString(entry.userName),
    updatedAt: normalizeString(entry.updatedAt),
  }
}

export function writeProjectAuthEntry(rootDir = process.cwd(), entry = {}) {
  const key = buildProjectAuthKey(entry)
  if (!key) {
    throw new Error('worldUrl and worldId are required')
  }
  const store = readProjectAuthStore(rootDir)
  store.entries[key] = {
    worldUrl: normalizeWorldUrl(entry.worldUrl),
    worldId: normalizeString(entry.worldId),
    authToken: normalizeString(entry.authToken),
    userId: normalizeString(entry.userId),
    userName: normalizeString(entry.userName),
    updatedAt: normalizeString(entry.updatedAt) || new Date().toISOString(),
  }
  writeProjectAuthStore(rootDir, store)
  return store.entries[key]
}

export function removeProjectAuthEntry(rootDir = process.cwd(), { worldUrl, worldId } = {}) {
  const key = buildProjectAuthKey({ worldUrl, worldId })
  if (!key) return false
  const store = readProjectAuthStore(rootDir)
  if (!Object.prototype.hasOwnProperty.call(store.entries, key)) return false
  delete store.entries[key]
  writeProjectAuthStore(rootDir, store)
  return true
}
