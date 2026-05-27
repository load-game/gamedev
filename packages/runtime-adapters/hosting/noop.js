export function createNoopRuntimeHosting() {
  return null
}

export function createNoopRuntimeIdleController() {
  return {
    clearIdleShutdownTimer() {},
    reconcileIdleShutdown() {},
    requestRuntimeShutdown() {},
    requestAgonesShutdown() {},
  }
}

export function createNoopRuntimePlayerTracker() {
  return {
    enabled: false,
    publishCapacity: async () => false,
    start: () => false,
    stop() {},
  }
}
