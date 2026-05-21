import type { WorldPlugin } from './index.plugins.d.ts'

export declare class ClientAudio {
  constructor(world: any)
  ctx: AudioContext
  masterGain: GainNode
  groupGains: {
    music: GainNode
    sfx: GainNode
    voice: GainNode
  }
  lastDelta: number
  ready(callback: () => void): void
  destroy(): void
}

export declare const audioClientPlugin: WorldPlugin
