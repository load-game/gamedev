import {
  createRuntimeIdleController,
  resolveRuntimeIdleShutdownTimeoutMs,
} from '@gamedev/runtime-adapters/hosting/runtimeIdleShutdown.js'
import { createAgonesHostingAdapter } from '@gamedev/runtime-adapters/hosting-agones'

export const resolveAgonesIdleShutdownTimeoutMs = resolveRuntimeIdleShutdownTimeoutMs

function normalizeAgonesTransport(agones) {
  if (!agones) return agones
  if (agones.name) return agones
  return { name: 'agones', ...agones }
}

export function createAgonesIdleController({ agones, ...options } = {}) {
  const hosting =
    options.hosting || (agones === undefined ? createAgonesHostingAdapter() : normalizeAgonesTransport(agones))
  return createRuntimeIdleController({
    ...options,
    hosting,
  })
}

export { createRuntimeIdleController, resolveRuntimeIdleShutdownTimeoutMs }
