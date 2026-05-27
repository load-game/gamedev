import { completeRuntimeStartup as completeGenericRuntimeStartup } from '@gamedev/hosting/runtimeStartup.js'

function normalizeAgonesTransport(agones) {
  if (!agones) return agones
  if (agones.name) return agones
  return { name: 'agones', ...agones }
}

export function completeRuntimeStartup({
  agones = null,
  agonesIdleController = null,
  agonesIdleControllerEnabled = false,
  requestAgonesReady,
  ...options
} = {}) {
  return completeGenericRuntimeStartup({
    ...options,
    hosting: options.hosting || normalizeAgonesTransport(agones),
    idleController: options.idleController || agonesIdleController,
    idleControllerEnabled: options.idleControllerEnabled ?? agonesIdleControllerEnabled,
    requestHostingReady: options.requestHostingReady ?? requestAgonesReady,
  })
}
