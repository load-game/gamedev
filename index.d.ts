// App Runtime ambient declarations (globals for app scripts).
// Usage:
//  - Per-file:   /// <reference types="gamedev" />
//  - tsconfig:   { "compilerOptions": { "types": ["gamedev"] } }

export declare function server(env?: Record<string, string | number | boolean | undefined>): Promise<void>
export declare function nodeClient(): Promise<unknown>
/*
 Hyperfy App Runtime TypeScript bindings

 - Global variables: app, world, props, num
 - Node system: strongly-typed app.create(nodeName, props)
 - World helpers and Player API
 - Minimal THREE-like math types (Vector3, Quaternion, Euler, Matrix4)

 These are ambient declarations intended for editor IntelliSense and type-checking.
*/

// -----------------------------
// Math primitives (minimal)
// -----------------------------
export interface Vector3 {
  x: number
  y: number
  z: number
  set(x: number, y: number, z: number): this
  copy(v: Vector3): this
  clone(): Vector3
  add(v: Vector3): this
  addVectors(a: Vector3, b: Vector3): this
  sub(v: Vector3): this
  subVectors(a: Vector3, b: Vector3): this
  multiplyScalar(s: number): this
  distanceTo(v: Vector3): number
  normalize(): this
  applyQuaternion(q: Quaternion): this
  fromArray(array: number[], offset?: number): this
  toArray(array?: number[], offset?: number): number[]
  setFromMatrixPosition(m: Matrix4): this
  setFromMatrixColumn(m: Matrix4, index: number): this
}

export interface Quaternion {
  x: number
  y: number
  z: number
  w: number
  set(x: number, y: number, z: number, w: number): this
  copy(q: Quaternion): this
  clone(): Quaternion
  multiply(q: Quaternion): this
  setFromEuler(e: Euler): this
  setFromRotationMatrix(m: Matrix4): this
  normalize(): this
}

export interface Euler {
  x: number
  y: number
  z: number
  order?: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY'
  set(x: number, y: number, z: number, order?: Euler['order']): this
  setFromQuaternion(q: Quaternion, order?: Euler['order'], update?: boolean): this
  setFromRotationMatrix(m: Matrix4, order?: Euler['order'], update?: boolean): this
}

export interface Matrix4 {
  elements: number[]
  clone(): Matrix4
  copy(m: Matrix4): this
  multiply(m: Matrix4): this
  premultiply(m: Matrix4): this
  multiplyMatrices(a: Matrix4, b: Matrix4): this
  invert(): this
  decompose(position: Vector3, quaternion: Quaternion, scale: Vector3): void
}

export type Vector3Like = Vector3 | [number, number, number]
export type EulerLike = Euler | [number, number, number]

export interface ScreenBounds {
  x: number
  y: number
  left: number
  top: number
  width: number
  height: number
  right: number
  bottom: number
}

// -----------------------------
// Base Node
// -----------------------------
export interface BaseNode {
  // Identity
  id: string
  name: string

  // Transform
  position: Vector3
  quaternion: Quaternion
  rotation: Euler
  scale: Vector3
  matrixWorld: Matrix4
  active: boolean
  visible?: boolean
  geometry?: unknown
  material?: unknown

  // Hierarchy
  parent: BaseNode | null
  children: BaseNode[]

  // Methods
  add<T extends BaseNode>(child: T): this
  remove<T extends BaseNode>(child: T): this
  traverse(visitor: (node: BaseNode) => void): void
  get(id: string): BaseNode | null
  getScreenBounds(target?: Partial<ScreenBounds>): ScreenBounds | null

  // Pointer events
  onPointerEnter?: (event: { type: string; stopPropagation(): void }) => void
  onPointerLeave?: (event: { type: string; stopPropagation(): void }) => void
  onPointerDown?: (event: { type: string; stopPropagation(): void }) => void
  onPointerUp?: (event: { type: string; stopPropagation(): void }) => void
}

// -----------------------------
// Creation-time props (initializers)
// -----------------------------
export type NodeInitBase = Partial<{
  id: string
  position: Vector3Like
  quaternion: Quaternion
  rotation: EulerLike
  scale: Vector3Like
}>

// -----------------------------
// Node name mapping
// -----------------------------
export interface NodeRegistry {}
export interface NodeInitRegistry {}

export type NodeName = keyof NodeRegistry
export type NodeNameToType = NodeRegistry
export type NodeNameToInit = {
  [TName in NodeName]: TName extends keyof NodeInitRegistry ? NodeInitRegistry[TName] : NodeInitBase
}

// -----------------------------
// Script loader type mapping
// -----------------------------
export interface LoaderScriptResultRegistry {}

export type LoaderScriptType = keyof LoaderScriptResultRegistry & string
export type LoaderScriptResult<T extends LoaderScriptType = LoaderScriptType> = LoaderScriptResultRegistry[T]

// -----------------------------
// Player API
// -----------------------------
export interface Player {
  // properties
  id: string
  name: string
  local: boolean
  admin: boolean
  position: Vector3
  quaternion: Quaternion
  rotation: Euler
}

export interface WorldAPI {
  // Scene management
  add(node: BaseNode): void
  remove(node: BaseNode): void
  attach(node: BaseNode): void

  // Events
  on(event: string, callback: (data?: any) => void): void
  off(event: string, callback: (data?: any) => void): void

  getTimestamp(format?: string): string
}

// -----------------------------
// App API
// -----------------------------
type AppEventName = 'update' | 'fixedUpdate' | 'lateUpdate' | (string & {})

export interface AppAPI extends BaseNode {
  // Properties
  readonly instanceId: string
  readonly version: string
  state: Record<string, any>
  props: Record<string, any>
  readonly config: Record<string, any>
  keepActive: boolean

  // Events
  on(name: AppEventName, callback: (arg?: any) => void): void
  off(name: AppEventName, callback: (arg?: any) => void): void

  emit(name: string, data?: any): void

  // Nodes
  get(id: string): BaseNode | null
  create<TName extends NodeName>(name: TName, props?: NodeNameToInit[TName]): NodeNameToType[TName]

  // Props UI
  configure(fields: AppFieldSpec[] | (() => AppFieldSpec[])): void
}

// -----------------------------
// App Props UI Spec
// -----------------------------
interface FieldBase {
  key: string
  label?: string
  hint?: string
  hidden?: boolean
}

interface TextFieldSpec extends FieldBase {
  type: 'text'
  placeholder?: string
  initial?: string
}

interface TextareaFieldSpec extends FieldBase {
  type: 'textarea'
  placeholder?: string
  initial?: string
}

interface NumberFieldSpec extends FieldBase {
  type: 'number'
  dp?: number
  min?: number
  max?: number
  step?: number
  bigStep?: number
  initial?: number
}

interface RangeFieldSpec extends FieldBase {
  type: 'range'
  min?: number
  max?: number
  step?: number
  initial?: number
}

interface ToggleFieldSpec extends FieldBase {
  type: 'toggle'
  trueLabel?: string
  falseLabel?: string
  initial?: string | boolean
}

interface SwitchFieldSpec extends FieldBase {
  type: 'switch'
  options: { label: string; value: string }[]
  initial?: string
}

interface FileFieldSpec extends FieldBase {
  type: 'file'
  kind: 'avatar' | 'emote' | 'model' | 'texture' | 'hdr' | 'audio'
}

interface ColorFieldSpec extends FieldBase {
  type: 'color'
  hint?: string
  initial?: string
}

interface ButtonFieldSpec extends FieldBase {
  type: 'button'
  onClick: () => void
}

interface SectionFieldSpec extends FieldBase {
  type: 'section'
  label: string
}

type AppFieldSpec =
  | TextFieldSpec
  | TextareaFieldSpec
  | NumberFieldSpec
  | RangeFieldSpec
  | ToggleFieldSpec
  | SwitchFieldSpec
  | FileFieldSpec
  | ColorFieldSpec
  | ButtonFieldSpec
  | SectionFieldSpec

// -----------------------------
// Global declarations
// -----------------------------
declare global {
  const app: AppAPI
  const world: WorldAPI
  const props: Record<string, any>
  function num(min: number, max: number, dp?: number): number
  // Additional scripting runtime globals
  function clamp(value: number, min: number, max: number): number
  function prng(...args: any[]): number
  function uuid(): string

  // three.js classes exposed in the runtime
  const Object3D: any
  const Vector3: { new (x?: number, y?: number, z?: number): Vector3 }
  const Quaternion: {
    new (x?: number, y?: number, z?: number, w?: number): Quaternion
  }
  const Euler: {
    new (x?: number, y?: number, z?: number, order?: Euler['order']): Euler
  }
  const Matrix4: { new (): Matrix4 }

  // Interpolation helpers (deprecated and buffered variants)
  const LerpVector3: any
  const LerpQuaternion: any
  const BufferedLerpVector3: any
  const BufferedLerpQuaternion: any

  // Curves and math constants
  const Curve: any
  const DEG2RAD: number
  const RAD2DEG: number
}
