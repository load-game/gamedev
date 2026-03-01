import * as THREE from './three'
import { JOINT_DEFINITIONS } from './RagdollConfig'

const _v1 = new THREE.Vector3()
const _q1 = new THREE.Quaternion()
const _s1 = new THREE.Vector3(1, 1, 1)

export class RagdollDebug {
  constructor(world) {
    this.world = world
    this.group = null
    this.meshes = []        // { mesh, bodyName }
    this.lines = null       // LineSegments for joint connections
    this.linePosAttr = null
  }

  create(bodies) {
    this.group = new THREE.Group()
    this.group.name = 'ragdoll-debug'

    const colorMap = {
      hips: 0xffff00,
      chest: 0xffff00,
      head: 0xff0000,
    }
    const colorByKeyword = (name) => {
      if (colorMap[name]) return colorMap[name]
      if (name.includes('Arm')) return 0x00ff00
      if (name.includes('Leg')) return 0x0066ff
      return 0xffff00
    }

    for (const [name, body] of bodies) {
      const { segment } = body
      let geom
      if (segment.shape === 'sphere') {
        geom = new THREE.SphereGeometry(segment.dimensions.radius, 8, 6)
      } else {
        geom = new THREE.BoxGeometry(
          segment.dimensions.width,
          segment.dimensions.height,
          segment.dimensions.depth
        )
      }
      const mat = new THREE.MeshBasicMaterial({
        color: colorByKeyword(name),
        wireframe: true,
        depthTest: false,
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.matrixAutoUpdate = false
      mesh.frustumCulled = false
      this.group.add(mesh)
      this.meshes.push({ mesh, bodyName: name })
    }

    const jointCount = JOINT_DEFINITIONS.length
    const positions = new Float32Array(jointCount * 2 * 3)
    const lineGeom = new THREE.BufferGeometry()
    this.linePosAttr = new THREE.BufferAttribute(positions, 3)
    lineGeom.setAttribute('position', this.linePosAttr)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      depthTest: false,
    })
    this.lines = new THREE.LineSegments(lineGeom, lineMat)
    this.lines.frustumCulled = false
    this.group.add(this.lines)

    this.world.stage.scene.add(this.group)
  }

  destroy() {
    if (!this.group) return
    for (const { mesh } of this.meshes) {
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
    this.meshes.length = 0
    if (this.lines) {
      this.lines.geometry.dispose()
      this.lines.material.dispose()
      this.lines = null
      this.linePosAttr = null
    }
    this.world.stage.scene.remove(this.group)
    this.group = null
  }

  update(bodies) {
    if (!this.group) return

    for (const { mesh, bodyName } of this.meshes) {
      const body = bodies.get(bodyName)
      if (!body) continue
      const pose = body.actor.getGlobalPose()
      _v1.set(pose.p.x, pose.p.y, pose.p.z)
      _q1.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w)
      mesh.matrix.compose(_v1, _q1, _s1)
      mesh.matrixWorldNeedsUpdate = true
    }

    if (this.linePosAttr) {
      const arr = this.linePosAttr.array
      for (let i = 0; i < JOINT_DEFINITIONS.length; i++) {
        const def = JOINT_DEFINITIONS[i]
        const parentBody = bodies.get(def.parent)
        const childBody = bodies.get(def.child)
        if (!parentBody || !childBody) continue

        const pp = parentBody.actor.getGlobalPose()
        const cp = childBody.actor.getGlobalPose()
        const idx = i * 6
        arr[idx] = pp.p.x;     arr[idx + 1] = pp.p.y;  arr[idx + 2] = pp.p.z
        arr[idx + 3] = cp.p.x; arr[idx + 4] = cp.p.y;  arr[idx + 5] = cp.p.z
      }
      this.linePosAttr.needsUpdate = true
    }
  }
}
