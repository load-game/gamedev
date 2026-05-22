import type { WorldPlugin } from './index.plugins.d.ts'

export type ShadowPreference = 'none' | 'low' | 'med' | 'high'

export interface PrefsChange<T = unknown> {
  prev: T
  value: T
}

export type PrefsChanges = Partial<{
  ui: PrefsChange<number>
  actions: PrefsChange<boolean>
  stats: PrefsChange<boolean>
  dpr: PrefsChange<number>
  shadows: PrefsChange<ShadowPreference>
  postprocessing: PrefsChange<boolean>
  bloom: PrefsChange<boolean>
  ao: PrefsChange<boolean>
  music: PrefsChange<number>
  sfx: PrefsChange<number>
  voice: PrefsChange<number>
}>

export declare class ClientPrefs {
  constructor(world: any)
  ui: number
  actions: boolean
  stats: boolean
  dpr: number
  shadows: ShadowPreference
  postprocessing: boolean
  bloom: boolean
  ao: boolean
  music: number
  sfx: number
  voice: number
  on(event: 'change', callback: (changes: PrefsChanges) => void): this
  off(event: 'change', callback: (changes: PrefsChanges) => void): this
  setUI(value: number): void
  setActions(value: boolean): void
  setStats(value: boolean): void
  setDPR(value: number): void
  setShadows(value: ShadowPreference): void
  setPostprocessing(value: boolean): void
  setBloom(value: boolean): void
  setAO(value: boolean): void
  setMusic(value: number): void
  setSFX(value: number): void
  setVoice(value: number): void
  destroy(): void
}

export declare const prefsClientPlugin: WorldPlugin
