export function installEnvironmentMaterialApi(world) {
  world.setupMaterial = material => {
    world.environment?.csm?.setupMaterial(material)
  }
}
