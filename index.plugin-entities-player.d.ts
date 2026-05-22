import 'gamedev'
import type { BaseNode, Matrix4, Player, Vector3, Vector3Like } from './index.d.ts'
import type { WorldPlugin } from './index.plugins.d.ts'

export declare class PlayerLocal {
  constructor(world: any, data: any, local?: boolean)
}

export declare class PlayerRemote {
  constructor(world: any, data: any, local?: boolean)
}

export interface PlayerEffectOptions {
  anchor?: BaseNode
  emote?: string
  snare?: number
  freeze?: boolean
  turn?: boolean
  duration?: number
  cancellable?: boolean
  onEnd?: () => void
}

export interface PlayerEffectHandle {
  readonly active: boolean
  cancel(): void
}

export interface PlayerPushOptions {
  bone?: string
  point?: Vector3 | null
}

export interface PlayerRagdollOptions {
  stiffness?: number
  damping?: number
  bounce?: number
  gravity?: number
  duration?: number | null
  flailDuration?: number
  muscleFadeDuration?: number
}

export declare const playerEntityScriptApi: {
  world: {
    getPlayer: {
      call(entity: any, playerId?: string): Player | null
    }
    getPlayers: {
      call(entity: any): Player[]
    }
  }
  player: {
    teleport: {
      call(player: any, position: Vector3Like, rotationY?: number): void
    }
    getBoneTransform: {
      call(player: any, boneName: string): Matrix4 | null
    }
    setAvatar: {
      call(player: any, url?: string | null): Promise<void>
    }
    setSessionAvatar: {
      call(player: any, url?: string | null): void
    }
    damage: {
      call(player: any, amount: number): void
    }
    heal: {
      call(player: any, amount?: number): void
    }
    hasEffect: {
      call(player: any): boolean
    }
    applyEffect: {
      call(player: any, options: PlayerEffectOptions | null): PlayerEffectHandle | void
    }
    cancelEffect: {
      call(player: any): void
    }
    ragdoll: {
      call(player: any, enable: boolean, force?: Vector3 | null, options?: PlayerRagdollOptions | null): void
    }
    push: {
      call(player: any, force: Vector3, options?: PlayerPushOptions): void
    }
    replaceAnimations: {
      call(player: any, newEmotes: Record<string, string>, reset?: boolean): void
    }
    firstPerson: {
      call(player: any, value?: boolean): void
    }
  }
}

export declare function cleanupPlayerEntityProxy(entity: any, player: any): void

export declare const playerEntitiesPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    getPlayer(playerId?: string): Player | null
    getPlayers(): Player[]
  }

  interface Player {
    teleport(position: Vector3Like, rotationY?: number): void
    push(force: Vector3, options?: PlayerPushOptions): void
    firstPerson(value?: boolean): void
    replaceAnimations(newEmotes: Record<string, string>, reset?: boolean): void
    getBoneTransform(boneName: string): Matrix4 | null
    setAvatar(url?: string | null): Promise<void>
    setSessionAvatar(url?: string | null): void
    damage(amount: number): void
    heal(amount?: number): void
    hasEffect(): boolean
    applyEffect(options: PlayerEffectOptions | null): PlayerEffectHandle | void
    cancelEffect(): void
    ragdoll(enable: boolean, force?: Vector3 | null, options?: PlayerRagdollOptions | null): void
  }
}
