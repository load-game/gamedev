import {
  ADMIN_SHUTDOWN_COMMAND,
  LEGACY_AGONES_SHUTDOWN_COMMAND,
  RUNTIME_SHUTDOWN_COMMAND,
  handleRuntimeShutdownCommand,
} from '@gamedev/hosting/adminShutdown.js'
import { createAgonesHostingAdapter, resolveAgonesSdkHttpBaseUrl } from '@gamedev/hosting-agones'

export {
  ADMIN_SHUTDOWN_COMMAND,
  LEGACY_AGONES_SHUTDOWN_COMMAND,
  RUNTIME_SHUTDOWN_COMMAND,
  handleRuntimeShutdownCommand,
}

function normalizeAgonesTransport(agones) {
  if (!agones) return agones
  if (agones.name) return agones
  return { name: 'agones', ...agones }
}

export function handleAdminShutdownCommand({ agones, ...options } = {}) {
  const hosting =
    options.hosting || (agones === undefined ? createAgonesHostingAdapter() : normalizeAgonesTransport(agones))
  return handleRuntimeShutdownCommand({
    ...options,
    hosting,
  })
}

export function resolveAgonesShutdownUrl(env = process.env) {
  return `${resolveAgonesSdkHttpBaseUrl(env)}/shutdown`
}
