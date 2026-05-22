const SCRIPT_LOAD_TYPES = Object.freeze(new Set(['avatar', 'model', 'splat']))

export const loaderScriptApi = Object.freeze({
  world: Object.freeze({
    load(entity, type, url) {
      return new Promise((resolve, reject) => {
        const hook = entity.getDeadHook()
        async function loadAsset() {
          try {
            if (!SCRIPT_LOAD_TYPES.has(type)) {
              return reject(new Error(`cannot load type: ${type}`))
            }
            let asset = entity.world.loader.get(type, url)
            if (!asset) asset = await entity.world.loader.load(type, url)
            if (hook.dead) return
            const root = asset.toNodes()
            resolve(type === 'avatar' ? root.children[0] : root)
          } catch (err) {
            if (hook.dead) return
            reject(err)
          }
        }
        loadAsset()
      })
    },
  }),
})
