import 'gamedev'
import type { BaseNode, Euler, Matrix4, NodeInitBase, Quaternion, Vector3, Vector3Like } from './index.d.ts'
import type { WorldPlugin } from './index.plugins.d.ts'

export interface GroupNode extends BaseNode {}
export interface AnchorNode extends GroupNode {}

export interface AudioNode extends BaseNode {
  src: string | null
  volume: number
  loop: boolean
  group: 'music' | 'sfx'
  spatial: boolean
  distanceModel: 'linear' | 'inverse' | 'exponential'
  refDistance: number
  maxDistance: number
  rolloffFactor: number
  coneInnerAngle: number
  coneOuterAngle: number
  coneOuterGain: number
  currentTime: number
  play(): void
  pause(): void
  stop(): void
}

export interface VideoNode extends BaseNode {
  src: string | null
  linked?: number | string | boolean
  loop: boolean
  visible: boolean
  color: string
  lit: boolean
  doubleside: boolean
  castShadow: boolean
  receiveShadow: boolean
  aspect: number
  fit: 'none' | 'contain' | 'cover'
  width: number | null
  height: number | null
  geometry?: unknown
  volume: number
  group: 'music' | 'sfx'
  spatial: boolean
  distanceModel: 'linear' | 'inverse' | 'exponential'
  refDistance: number
  maxDistance: number
  rolloffFactor: number
  coneInnerAngle: number
  coneOuterAngle: number
  coneOuterGain: number
  readonly loading: boolean
  readonly duration: number
  readonly playing: boolean
  readonly isPlaying: boolean
  time: number
  currentTime: number
  onLoad?: () => void
  play(): void
  pause(): void
  stop(): void
}

export interface ImageNode extends BaseNode {
  src: string | null
  width: number | null
  height: number | null
  fit: 'none' | 'contain' | 'cover'
  color: string
  pivot:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'center-left'
    | 'center'
    | 'center-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
  lit: boolean
  doubleside: boolean
  castShadow: boolean
  receiveShadow: boolean
}

export interface SkyNode extends BaseNode {
  bg: string | null
  hdr: string | null
  rotationY: number | null
  sunDirection: Vector3 | null
  sunIntensity: number | null
  sunColor: string | null
  fogNear: number | null
  fogFar: number | null
  fogColor: string | null
}

export interface MeshNode extends BaseNode {
  type: 'box' | 'sphere' | 'geometry'
  width: number
  height: number
  depth: number
  radius: number
  geometry: unknown
  material: unknown
  linked: boolean
  castShadow: boolean
  receiveShadow: boolean
  visible: boolean
}

export interface SkinnedMeshNode extends BaseNode {
  anims: string[]
  castShadow: boolean
  receiveShadow: boolean
  play(opts: { name: string; fade?: number; loop?: boolean; speed?: number }): void
  stop(opts?: { fade?: number }): void
  getBone(name: string): {
    position: Vector3
    quaternion: Quaternion
    rotation: Euler
    scale: Vector3
    matrixWorld: Matrix4
  }
}

export interface SnapNode extends BaseNode {}

export interface NametagNode extends BaseNode {
  label: string
  health: number
}

export interface RigidBodyNode extends BaseNode {
  type: 'static' | 'kinematic' | 'dynamic'
  onContactStart?: (other: unknown) => void
  onContactEnd?: (other: unknown) => void
  onTriggerEnter?: (other: unknown) => void
  onTriggerLeave?: (other: unknown) => void
}

export interface ColliderNode extends BaseNode {
  type: 'box' | 'sphere' | 'geometry'
  setSize(width: number, height: number, depth: number): void
  radius: number
  geometry: unknown
  convex: boolean
  trigger: boolean
}

export interface ControllerNode extends BaseNode {
  radius: number
  height: number
  layer: 'environment' | 'prop' | 'tool'
  tag?: string | null
  onContactStart?: (other: unknown) => void
  onContactEnd?: (other: unknown) => void
  readonly isGrounded: boolean
  move(vec3: Vector3Like): void
  teleport(vec3: Vector3Like): void
}

export type JointType = 'fixed' | 'socket' | 'hinge' | 'distance'
export interface JointNode extends BaseNode {
  type: JointType
  body0: RigidBodyNode | null
  offset0: Vector3
  quaternion0: Quaternion
  rotation0: Euler
  body1: RigidBodyNode | null
  offset1: Vector3
  quaternion1: Quaternion
  rotation1: Euler
  axis: Vector3
  breakForce: number
  breakTorque: number
  limitY: number | null
  limitZ: number | null
  limitMin: number | null
  limitMax: number | null
  limitStiffness: number | null
  limitDamping: number | null
  collide: boolean
}

export interface LODNode extends BaseNode {
  scaleAware: boolean
  insert(node: BaseNode, maxDistance: number): void
}

export interface AvatarNode extends BaseNode {
  src: string | null
  emote?: string | null
  visible: boolean
  getHeight(): number | null
  getBoneTransform(boneName: string): Matrix4 | null
}

export type ParticleShape =
  | ['point']
  | ['sphere', radius: number, thickness?: number]
  | ['hemisphere', radius: number, thickness?: number]
  | ['cone', radius: number, thickness?: number, angle?: number]
  | [
      'box',
      width: number,
      height: number,
      depth: number,
      thickness?: number,
      origin?: 'volume' | 'edge',
      spherize?: number,
    ]
  | ['circle', radius: number, thickness?: number, spherize?: number]
  | ['rectangle', width: number, depth: number, thickness?: number, spherize?: number]

export interface ParticlesNode extends BaseNode {
  emitting: boolean
  shape: ParticleShape
  direction: number
  rate: number
  bursts: { time: number; count: number }[]
  duration: number
  loop: boolean
  max: number
  timescale: number
  life: string
  speed: string
  size: string
  rotate: string
  color: string
  alpha: string
  emissive: string
  image: string | null
  spritesheet: [rows: number, columns: number, fps: number, loop: boolean] | null
  blending: 'normal' | 'additive'
  lit: boolean
  billboard: 'full' | 'y' | 'direction'
  space: 'local' | 'world'
  force: Vector3 | null
  velocityLinear: Vector3 | null
  velocityOrbital: Vector3 | null
  velocityRadial: number | null
  rateOverDistance?: number
  sizeOverLife?: string
  rotateOverLife?: string
  colorOverLife?: string
  alphaOverLife?: string
  emissiveOverLife?: string
  onEnd?: () => void
}

export type PrimType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'plane'
export interface PrimNode extends BaseNode {
  type: PrimType
  size: number[]
  color: string
  emissive: string | null
  emissiveIntensity: number
  metalness: number
  roughness: number
  opacity: number
  transparent: boolean
  texture: string | null
  textureRepeat: [number, number]
  castShadow: boolean
  receiveShadow: boolean
  doubleside: boolean
  physics: null | 'static' | 'kinematic' | 'dynamic'
  mass: number
  linearDamping: number
  angularDamping: number
  staticFriction: number
  dynamicFriction: number
  restitution: number
  layer: string
  trigger: boolean
  tag: string | null
  onContactStart?: (other: unknown) => void
  onContactEnd?: (other: unknown) => void
  onTriggerEnter?: (other: unknown) => void
  onTriggerLeave?: (other: unknown) => void
}

export type UIPivot =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface UINode extends BaseNode {
  space: 'world' | 'screen'
  width: number
  height: number
  size: number
  lit: boolean
  doubleside: boolean
  billboard: 'none' | 'full' | 'y'
  pivot: UIPivot
  offset: Vector3
  scaler: [minDistance: number, maxDistance: number, baseScale?: number] | null
  pointerEvents: boolean
  backgroundColor: string | null
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
  padding: number
  flexDirection: 'column' | 'column-reverse' | 'row' | 'row-reverse'
  justifyContent: 'flex-start' | 'flex-end' | 'center'
  alignItems: 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'baseline'
  alignContent: 'flex-start' | 'flex-end' | 'stretch' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
  flexWrap: 'no-wrap' | 'wrap'
  gap: number
}

export interface UIViewNode extends BaseNode {
  display: 'none' | 'flex'
  width: number
  height: number
  backgroundColor: string | null
  borderWidth?: number
  borderColor?: string
  borderRadius?: number
  margin: number
  padding: number
  flexDirection: 'column' | 'column-reverse' | 'row' | 'row-reverse'
  justifyContent: 'flex-start' | 'flex-end' | 'center'
  alignItems: 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'baseline'
  alignContent: 'flex-start' | 'flex-end' | 'stretch' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
  flexBasis: number | null
  flexGrow: number | null
  flexShrink: number | null
  flexWrap: 'no-wrap' | 'wrap'
  gap: number
}

export interface UITextNode extends BaseNode {
  display: 'none' | 'flex'
  backgroundColor: string | null
  borderRadius?: number
  margin: number
  padding: number
  value: string
  fontSize: number
  color: string
  lineHeight: number
  textAlign: 'left' | 'center' | 'right'
  fontFamily: string
  fontWeight: 'normal' | 'bold' | number
}

export interface UIImageNode extends BaseNode {
  display: 'flex' | 'none'
  src: string | null
  height: number | null
  objectFit: 'contain' | 'cover' | 'fill'
  backgroundColor?: string | null
  borderRadius?: number
  flexDirection?: 'column' | 'column-reverse' | 'row' | 'row-reverse'
  justifyContent?: 'flex-start' | 'flex-end' | 'center'
  alignItems?: 'flex-start' | 'flex-end' | 'stretch' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
  flexWrap?: 'no-wrap' | 'wrap'
  gap?: number
  margin?: number
  padding?: number
  borderWidth?: number
  borderColor?: string | null
  loadImage(src: string): Promise<void>
}

export interface ActionNode extends BaseNode {
  label: string
  distance: number
  duration: number
  onStart?: () => void
  onTrigger?: () => void
  onCancel?: () => void
}

export interface MirrorNode extends BaseNode {}
export interface WaterNode extends BaseNode {}
export interface LightNode extends BaseNode {}
export interface WebViewNode extends BaseNode {}
export interface UIInputNode extends BaseNode {}
export interface SplatNode extends BaseNode {}

export type AnyNodeInit = NodeInitBase & Record<string, any>
export type AnchorInit = NodeInitBase
export type GroupInit = NodeInitBase
export type AudioInit = NodeInitBase &
  Partial<
    Pick<
      AudioNode,
      | 'src'
      | 'volume'
      | 'loop'
      | 'group'
      | 'spatial'
      | 'distanceModel'
      | 'refDistance'
      | 'maxDistance'
      | 'rolloffFactor'
      | 'coneInnerAngle'
      | 'coneOuterAngle'
      | 'coneOuterGain'
    >
  >
export type VideoInit = NodeInitBase &
  Partial<
    Pick<
      VideoNode,
      | 'src'
      | 'linked'
      | 'loop'
      | 'visible'
      | 'color'
      | 'lit'
      | 'doubleside'
      | 'castShadow'
      | 'receiveShadow'
      | 'aspect'
      | 'fit'
      | 'width'
      | 'height'
      | 'volume'
      | 'group'
      | 'spatial'
      | 'distanceModel'
      | 'refDistance'
      | 'maxDistance'
      | 'rolloffFactor'
      | 'coneInnerAngle'
      | 'coneOuterAngle'
      | 'coneOuterGain'
    >
  >
export type ImageInit = NodeInitBase &
  Partial<
    Pick<
      ImageNode,
      'src' | 'width' | 'height' | 'fit' | 'color' | 'pivot' | 'lit' | 'doubleside' | 'castShadow' | 'receiveShadow'
    >
  >
export type MeshInit = NodeInitBase & Partial<Pick<MeshNode, 'castShadow' | 'receiveShadow'>>
export type SkinnedMeshInit = NodeInitBase & Partial<Pick<SkinnedMeshNode, 'castShadow' | 'receiveShadow'>>
export type RigidBodyInit = NodeInitBase &
  Partial<Pick<RigidBodyNode, 'type' | 'onContactStart' | 'onContactEnd' | 'onTriggerEnter' | 'onTriggerLeave'>>
export type ColliderInit = NodeInitBase & Partial<Pick<ColliderNode, 'type' | 'radius' | 'convex' | 'trigger'>>
export type ControllerInit = NodeInitBase &
  Partial<Pick<ControllerNode, 'radius' | 'height' | 'layer' | 'tag' | 'onContactStart' | 'onContactEnd'>>
export type LODInit = NodeInitBase & Partial<Pick<LODNode, 'scaleAware'>>
export type AvatarInit = NodeInitBase & Partial<Pick<AvatarNode, 'src' | 'emote' | 'visible'>>
export type ParticlesInit = NodeInitBase &
  Partial<
    Pick<
      ParticlesNode,
      | 'emitting'
      | 'shape'
      | 'direction'
      | 'rate'
      | 'bursts'
      | 'duration'
      | 'loop'
      | 'max'
      | 'timescale'
      | 'life'
      | 'speed'
      | 'size'
      | 'rotate'
      | 'color'
      | 'alpha'
      | 'emissive'
      | 'image'
      | 'spritesheet'
      | 'blending'
      | 'lit'
      | 'billboard'
      | 'space'
      | 'force'
      | 'velocityLinear'
      | 'velocityOrbital'
      | 'velocityRadial'
      | 'rateOverDistance'
      | 'sizeOverLife'
      | 'rotateOverLife'
      | 'colorOverLife'
      | 'alphaOverLife'
      | 'emissiveOverLife'
      | 'onEnd'
    >
  >
export type PrimInit = NodeInitBase &
  Partial<
    Pick<
      PrimNode,
      | 'type'
      | 'size'
      | 'color'
      | 'emissive'
      | 'emissiveIntensity'
      | 'metalness'
      | 'roughness'
      | 'opacity'
      | 'transparent'
      | 'texture'
      | 'textureRepeat'
      | 'castShadow'
      | 'receiveShadow'
      | 'doubleside'
      | 'physics'
      | 'mass'
      | 'linearDamping'
      | 'angularDamping'
      | 'staticFriction'
      | 'dynamicFriction'
      | 'restitution'
      | 'layer'
      | 'trigger'
      | 'tag'
      | 'onContactStart'
      | 'onContactEnd'
      | 'onTriggerEnter'
      | 'onTriggerLeave'
    >
  >
export type UIInit = NodeInitBase &
  Partial<
    Pick<
      UINode,
      | 'space'
      | 'width'
      | 'height'
      | 'size'
      | 'lit'
      | 'doubleside'
      | 'billboard'
      | 'pivot'
      | 'offset'
      | 'scaler'
      | 'pointerEvents'
      | 'backgroundColor'
      | 'borderWidth'
      | 'borderColor'
      | 'borderRadius'
      | 'padding'
      | 'flexDirection'
      | 'justifyContent'
      | 'alignItems'
      | 'alignContent'
      | 'flexWrap'
      | 'gap'
    >
  >
export type UIViewInit = NodeInitBase &
  Partial<
    Pick<
      UIViewNode,
      | 'display'
      | 'width'
      | 'height'
      | 'backgroundColor'
      | 'borderWidth'
      | 'borderColor'
      | 'borderRadius'
      | 'margin'
      | 'padding'
      | 'flexDirection'
      | 'justifyContent'
      | 'alignItems'
      | 'alignContent'
      | 'flexBasis'
      | 'flexGrow'
      | 'flexShrink'
      | 'flexWrap'
      | 'gap'
    >
  >
export type UITextInit = NodeInitBase &
  Partial<
    Pick<
      UITextNode,
      | 'display'
      | 'backgroundColor'
      | 'borderRadius'
      | 'margin'
      | 'padding'
      | 'value'
      | 'fontSize'
      | 'color'
      | 'lineHeight'
      | 'textAlign'
      | 'fontFamily'
      | 'fontWeight'
    >
  >
export type UIImageInit = NodeInitBase &
  Partial<
    Pick<
      UIImageNode,
      | 'display'
      | 'src'
      | 'height'
      | 'objectFit'
      | 'backgroundColor'
      | 'borderRadius'
      | 'flexDirection'
      | 'justifyContent'
      | 'alignItems'
      | 'flexWrap'
      | 'gap'
      | 'margin'
      | 'padding'
      | 'borderWidth'
      | 'borderColor'
    >
  >
export type ActionInit = NodeInitBase &
  Partial<Pick<ActionNode, 'label' | 'distance' | 'duration' | 'onStart' | 'onTrigger' | 'onCancel'>>

declare module 'gamedev' {
  interface NodeRegistry {
    group: GroupNode
    anchor: AnchorNode
    mesh: MeshNode
    skinnedmesh: SkinnedMeshNode
    lod: LODNode
    sky: SkyNode
    rigidbody: RigidBodyNode
    collider: ColliderNode
    controller: ControllerNode
    joint: JointNode
    audio: AudioNode
    video: VideoNode
    image: ImageNode
    avatar: AvatarNode
    particles: ParticlesNode
    prim: PrimNode
    action: ActionNode
    snap: SnapNode
    nametag: NametagNode
    ui: UINode
    uiview: UIViewNode
    uitext: UITextNode
    uiimage: UIImageNode
    mirror: MirrorNode
    water: WaterNode
    light: LightNode
    webview: WebViewNode
    uiinput: UIInputNode
    splat: SplatNode
  }

  interface NodeInitRegistry {
    group: GroupInit
    anchor: AnchorInit
    mesh: MeshInit
    skinnedmesh: SkinnedMeshInit
    lod: LODInit
    sky: NodeInitBase &
      Partial<
        Pick<
          SkyNode,
          'bg' | 'hdr' | 'rotationY' | 'sunDirection' | 'sunIntensity' | 'sunColor' | 'fogNear' | 'fogFar' | 'fogColor'
        >
      >
    rigidbody: RigidBodyInit
    collider: ColliderInit
    controller: ControllerInit
    joint: NodeInitBase &
      Partial<
        Pick<
          JointNode,
          | 'type'
          | 'breakForce'
          | 'breakTorque'
          | 'limitY'
          | 'limitZ'
          | 'limitMin'
          | 'limitMax'
          | 'limitStiffness'
          | 'limitDamping'
          | 'collide'
        >
      >
    audio: AudioInit
    video: VideoInit
    image: ImageInit
    avatar: AvatarInit
    particles: ParticlesInit
    prim: PrimInit
    action: ActionInit
    snap: NodeInitBase
    nametag: NodeInitBase & Partial<Pick<NametagNode, 'label' | 'health'>>
    ui: UIInit
    uiview: UIViewInit
    uitext: UITextInit
    uiimage: UIImageInit
    mirror: AnyNodeInit
    water: AnyNodeInit
    light: AnyNodeInit
    webview: AnyNodeInit
    uiinput: AnyNodeInit
    splat: AnyNodeInit
  }
}

export declare const builtinNodes: Record<string, new (data?: any) => any>
export declare const nodesPlugin: WorldPlugin
