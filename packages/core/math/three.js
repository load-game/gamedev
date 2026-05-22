import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'

import * as THREE from 'three'

export * from 'three'

// override THREE.Vector3 with ours to support _onChange
export { Vector3Enhanced as Vector3 } from './Vector3Enhanced.js'

// install three-mesh-bvh
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

// utility to resize instanced mesh buffers
THREE.InstancedMesh.prototype.resize = function (size) {
  const prevSize = this.instanceMatrix.array.length / 16
  if (size <= prevSize) return
  const matrices = new Float32Array(size * 16)
  matrices.set(this.instanceMatrix.array)
  this.instanceMatrix = new THREE.InstancedBufferAttribute(matrices, 16)
  this.instanceMatrix.needsUpdate = true
  if (this.instanceColor) {
    const colors = new Float32Array(size * 3) // RGB values
    colors.set(this.instanceColor.array)
    this.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
    this.instanceColor.needsUpdate = true
  }
  if (this.instanceEmissive) {
    const colors = new Float32Array(size * 3) // RGB values
    colors.set(this.instanceEmissive.array)
    this.instanceEmissive = new THREE.InstancedBufferAttribute(colors, 3)
    this.instanceEmissive.needsUpdate = true
    this.geometry.setAttribute('instanceEmissive', this.instanceEmissive)
  }
  if (this.instanceEmissiveIntensity) {
    const values = new Float32Array(size) // floats
    values.set(this.instanceEmissiveIntensity.array)
    this.instanceEmissiveIntensity = new THREE.InstancedBufferAttribute(values, 1)
    this.instanceEmissiveIntensity.needsUpdate = true
    this.geometry.setAttribute('instanceEmissiveIntensity', this.instanceEmissiveIntensity)
  }
}

THREE.InstancedMesh.prototype.setEmissiveAt = function (index, color) {
  // similar to .setColorAt
  if (!this.instanceEmissive) {
    const colors = new Float32Array(this.instanceMatrix.count * 3)
    this.instanceEmissive = new THREE.InstancedBufferAttribute(colors, 3)
    this.geometry.setAttribute('instanceEmissive', this.instanceEmissive)
  }
  color.toArray(this.instanceEmissive.array, index * 3)
  this.instanceEmissive.needsUpdate = true
}

THREE.InstancedMesh.prototype.setEmissiveIntensityAt = function (index, amount) {
  // similar to .setColorAt
  if (!this.instanceEmissiveIntensity) {
    const values = new Float32Array(this.instanceMatrix.count)
    this.instanceEmissiveIntensity = new THREE.InstancedBufferAttribute(values, 1)
    this.geometry.setAttribute('instanceEmissiveIntensity', this.instanceEmissiveIntensity)
  }
  this.instanceEmissiveIntensity.array[index] = amount
  this.instanceEmissiveIntensity.needsUpdate = true
}
