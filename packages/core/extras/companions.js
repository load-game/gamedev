export function createCompanionsAPI(world) {
  return {
    list: () => structuredClone(world.network.isServer ? world.network.companions.list() : world.companions.agents),
    request: (action, params) => {
      if (!world.network.isClient) throw new Error('client_only')
      return world.companions.request(action, params)
    },
  }
}
