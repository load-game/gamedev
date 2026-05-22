import 'gamedev'
import type { Euler, Quaternion, Vector3 } from './index.d.ts'
import type { WorldPlugin } from './index.plugins.d.ts'

export interface ControlButton {
  onPress?: () => void
  onRelease?: () => void
  down: boolean
  pressed: boolean
  released: boolean
  capture?: boolean
}

export type ControlKeys =
  | 'keyA'
  | 'keyB'
  | 'keyC'
  | 'keyD'
  | 'keyE'
  | 'keyF'
  | 'keyG'
  | 'keyH'
  | 'keyI'
  | 'keyJ'
  | 'keyK'
  | 'keyL'
  | 'keyM'
  | 'keyN'
  | 'keyO'
  | 'keyP'
  | 'keyQ'
  | 'keyR'
  | 'keyS'
  | 'keyT'
  | 'keyU'
  | 'keyV'
  | 'keyW'
  | 'keyX'
  | 'keyY'
  | 'keyZ'
  | 'digit0'
  | 'digit1'
  | 'digit2'
  | 'digit3'
  | 'digit4'
  | 'digit5'
  | 'digit6'
  | 'digit7'
  | 'digit8'
  | 'digit9'
  | 'minus'
  | 'equal'
  | 'bracketLeft'
  | 'bracketRight'
  | 'backslash'
  | 'semicolon'
  | 'quote'
  | 'backquote'
  | 'comma'
  | 'period'
  | 'slash'
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowLeft'
  | 'arrowRight'
  | 'home'
  | 'end'
  | 'pageUp'
  | 'pageDown'
  | 'tab'
  | 'capsLock'
  | 'shiftLeft'
  | 'shiftRight'
  | 'controlLeft'
  | 'controlRight'
  | 'altLeft'
  | 'altRight'
  | 'enter'
  | 'space'
  | 'backspace'
  | 'delete'
  | 'escape'
  | 'mouseLeft'
  | 'mouseRight'
  | 'metaLeft'

export interface ControlPointer {
  coords: Vector3
  position: Vector3
  delta: Vector3
  locked: boolean
  lock(): void
  unlock(): void
}

export interface ControlScroll {
  value: number
  capture?: boolean
}

export interface ControlCamera {
  position: Vector3
  quaternion: Quaternion
  rotation: Euler
  zoom: number
  write: boolean
}

export interface ControlScreen {
  width: number
  height: number
}

export type ControlAPI = {
  [key in ControlKeys]: ControlButton
} & {
  pointer: ControlPointer
  scrollDelta: ControlScroll
  camera: ControlCamera
  screen: ControlScreen
  release(): void
}

export declare class ClientControls {
  constructor(world: any)
  actions: any[]
  pointer: {
    locked: boolean
    shouldLock: boolean
    coords: any
    position: any
    delta: any
  }
  bind(options?: any): any
  releaseAllButtons(): void
  setTouchBtn(prop: string, down: boolean): void
  simulateButton(prop: string, pressed: boolean): void
  lockPointer(): Promise<boolean | undefined>
  unlockPointer(): void
}

export declare const controlsClientScriptApi: {
  app: {
    control(entity: any, options?: Partial<{ priority: number }>): ControlAPI
  }
}

export declare const controlsClientPlugin: WorldPlugin

declare module 'gamedev' {
  interface AppAPI {
    control(options?: Partial<{ priority: number }>): ControlAPI
  }
}
