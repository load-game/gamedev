// A parsed avatar shares geometry/materials between its live instances. Dispose
// only after the last instance has gone; never dispose shared resources per copy.
export function createAvatarAssetLifetime(scene) {
  let users = 0
  let disposed = false
  return {
    retain() {
      if (disposed) throw new Error('Avatar asset has been released')
      users++
      let released = false
      return () => {
        if (released) return
        released = true
        users--
      }
    },
    dispose() {
      if (users) return false
      if (disposed) return true
      disposed = true
      const geometries = new Set(),
        materials = new Set(),
        textures = new Set(),
        skeletons = new Set(),
        images = new Set()
      scene.traverse(node => {
        if (node.geometry) geometries.add(node.geometry)
        if (node.skeleton) skeletons.add(node.skeleton)
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!material) continue
          materials.add(material)
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value)
          for (const uniform of Object.values(material.uniforms || {})) {
            if (uniform?.value?.isTexture) textures.add(uniform.value)
          }
        }
      })
      for (const skeleton of skeletons) skeleton.dispose()
      for (const geometry of geometries) {
        geometry.disposeBoundsTree?.()
        geometry.dispose()
      }
      for (const material of materials) material.dispose()
      for (const texture of textures) {
        const data = texture.source?.data
        for (const image of Array.isArray(data) ? data : [data]) if (image?.close) images.add(image)
        texture.dispose()
      }
      for (const image of images) image.close()
      scene = null
      return true
    },
  }
}
