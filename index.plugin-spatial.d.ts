import 'gamedev'
import type { BaseNode } from './index.d.ts'
import type { WorldPlugin } from './index.plugins.d.ts'

export type LayerGroup = 'environment' | 'player' | (string & {})

export interface SpatialVector3 {
  x: number
  y: number
  z: number
  isVector3?: boolean
  copy?(v: SpatialVector3): this
}

export interface RaycastHit {
  point: SpatialVector3
  normal: SpatialVector3
  distance: number
  tag: string | null
  playerId: string | null
  bone: string | null
}

export declare const spatialScriptApi: {
  world: {
    createLayerMask(entity: any, ...groups: LayerGroup[]): number
    raycast(
      entity: any,
      origin: SpatialVector3,
      direction: SpatialVector3,
      maxDistance?: number | null,
      layerMask?: number | null,
      opts?: {
        ignoreLocalPlayer?: boolean
        ignorePlayerId?: string | null
      }
    ): RaycastHit | null
    overlapSphere(entity: any, radius: number, origin: SpatialVector3, layerMask?: number | null): BaseNode[]
  }
}

export declare const spatialPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    raycast(
      origin: SpatialVector3,
      direction: SpatialVector3,
      maxDistance?: number | null,
      layerMask?: number | null,
      opts?: {
        ignoreLocalPlayer?: boolean
        ignorePlayerId?: string | null
      }
    ): RaycastHit | null
    createLayerMask(...groups: LayerGroup[]): number
    overlapSphere(radius: number, origin: SpatialVector3, layerMask?: number | null): BaseNode[]
  }
}
