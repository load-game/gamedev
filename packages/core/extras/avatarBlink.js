// Bind standard VRM blink morphs to each cloned avatar. The VRM expression
// manager references the source scene, so it must never animate shared assets.
function morphMeshes(scene) {
  const meshes = []
  scene.traverse(object => {
    if (object.isMesh && object.morphTargetInfluences?.length) meshes.push(object)
  })
  return meshes
}

export function createAvatarBlinkFactory(gltf) {
  const json = gltf.parser?.json
  const associations = gltf.parser?.associations
  if (!json || !associations) return null
  const sources = morphMeshes(gltf.scene)
  const legacy = json.extensions?.VRM?.blendShapeMaster?.blendShapeGroups
  const presets = json.extensions?.VRMC_vrm?.expressions?.preset
  const expression = name => {
    if (legacy) {
      const aliases = { blink: 'blink', blinkLeft: 'blink_l', blinkRight: 'blink_r' }
      const group = legacy.find(group => group.presetName?.toLowerCase() === aliases[name])
      return group && { binary: group.isBinary, binds: group.binds, legacy: true }
    }
    const group = presets?.[name]
    return group && { binary: group.isBinary, binds: group.morphTargetBinds, legacy: false }
  }
  function compile(group) {
    if (!group) return []
    const result = []
    for (const bind of group.binds || []) {
      const weight = bind.weight / (group.legacy ? 100 : 1)
      if (!Number.isFinite(weight) || weight <= 0 || !Number.isInteger(bind.index) || bind.index < 0) continue
      sources.forEach((source, mesh) => {
        if (bind.index >= source.morphTargetInfluences.length) return
        let matched = false
        if (group.legacy) matched = Number.isInteger(bind.mesh) && associations.get(source)?.meshes === bind.mesh
        else if (Number.isInteger(bind.node)) {
          // A glTF mesh with several materials is imported as a parent Group.
          let object = source
          while (object) {
            const node = associations.get(object)?.nodes
            if (node !== undefined) {
              matched = node === bind.node
              break
            }
            object = object.parent
          }
        }
        if (matched) result.push({ mesh, index: bind.index, weight: Math.min(weight, 1), binary: !!group.binary })
      })
    }
    return result
  }
  let bindings = compile(expression('blink'))
  if (!bindings.length) bindings = [...compile(expression('blinkLeft')), ...compile(expression('blinkRight'))]
  if (!bindings.length) return null
  const unique = new Map()
  for (const binding of bindings) {
    const key = `${binding.mesh}/${binding.index}`
    if (!unique.has(key) || unique.get(key).weight < binding.weight) unique.set(key, binding)
  }
  bindings = [...unique.values()]

  return (scene, random = Math.random) => {
    const meshes = morphMeshes(scene)
    let elapsed = 0
    let next = 1 + random() * 2.5
    let followup = false
    function apply(value) {
      for (const binding of bindings) {
        const values = meshes[binding.mesh]?.morphTargetInfluences
        if (values && binding.index < values.length) {
          values[binding.index] = (binding.binary ? Number(value > 0.5) : value) * binding.weight
        }
      }
    }
    apply(0)
    return {
      update(delta) {
        if (!Number.isFinite(delta) || delta <= 0) return
        elapsed += delta
        const phase = elapsed - next
        if (phase < 0) {
          apply(0)
          return
        }
        // Fast close, short rest, softer reopening. Long suspended-tab frames
        // reset to open instead of replaying an accumulated queue of blinks.
        if (phase >= 0.285) {
          apply(0)
          elapsed = 0
          const doubleBlink = !followup && delta < 0.5 && random() < 0.15
          next = doubleBlink ? 0.18 : 2.2 + random() * 3.8
          followup = doubleBlink
          return
        }
        let value = phase < 0.09 ? phase / 0.09 : phase < 0.135 ? 1 : 1 - (phase - 0.135) / 0.15
        value = Math.max(0, Math.min(1, value))
        apply(value * value * (3 - 2 * value))
      },
    }
  }
}
