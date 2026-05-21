export type SystemConstructor<TWorld = any, TSystem = any> = new (world: TWorld) => TSystem

export type SystemEntry<TWorld = any, TSystem = any> =
  | [key: string, System: SystemConstructor<TWorld, TSystem>]
  | {
      key: string
      System?: SystemConstructor<TWorld, TSystem>
      system?: SystemConstructor<TWorld, TSystem>
    }

export type NodeConstructor<TNode = any> = new (data?: any) => TNode

export type NodeEntry<TNode = any> =
  | [key: string, Node: NodeConstructor<TNode>]
  | {
      key: string
      Node?: NodeConstructor<TNode>
      node?: NodeConstructor<TNode>
    }

export type EntityConstructor<TEntity = any, TWorld = any> = new (world: TWorld, data: any, local?: boolean) => TEntity

export type EntityFactory<TEntity = any, TWorld = any> = (world: TWorld, data: any, local?: boolean) => TEntity

export type EntityEntry<TEntity = any, TWorld = any> =
  | [key: string, Entity: EntityConstructor<TEntity, TWorld>]
  | {
      key: string
      Entity?: EntityConstructor<TEntity, TWorld>
      entity?: EntityConstructor<TEntity, TWorld>
      create?: EntityFactory<TEntity, TWorld>
      factory?: EntityFactory<TEntity, TWorld>
    }

export interface ScriptApiDescriptor<TOwner = any, TValue = any> {
  get?: (owner: TOwner) => TValue
  set?: (owner: TOwner, value: TValue) => void
}

export type ScriptApiMethod<TOwner = any> = (owner: TOwner, ...args: any[]) => any
export type ScriptApiEntry<TOwner = any> = ScriptApiMethod<TOwner> | ScriptApiDescriptor<TOwner>

export interface ScriptApiContribution {
  world?: Record<string, ScriptApiEntry>
  app?: Record<string, ScriptApiEntry>
  player?: Record<string, ScriptApiEntry>
}

export interface PluginDefinition<TWorld = any> {
  name: string
  requires?: string | string[]
  optional?: string | string[]
  provides?: string | string[]
  systems?: SystemEntry<TWorld> | Array<SystemEntry<TWorld>>
  nodes?: Record<string, NodeConstructor> | NodeEntry | Array<NodeEntry>
  entities?: Record<string, EntityConstructor<any, TWorld>> | EntityEntry<any, TWorld> | Array<EntityEntry<any, TWorld>>
  scripts?: ScriptApiContribution
  scriptApi?: ScriptApiContribution
  setup?: (world: TWorld) => void
}

export interface WorldPlugin<TWorld = any> {
  kind: 'plugin'
  name: string
  requires: readonly string[]
  optional: readonly string[]
  provides: readonly string[]
  systems: readonly { key: string; System: SystemConstructor<TWorld> }[]
  nodes: readonly { key: string; Node: NodeConstructor }[]
  entities: readonly {
    key: string
    Entity: EntityConstructor<any, TWorld> | null
    create: EntityFactory<any, TWorld> | null
  }[]
  scripts: ScriptApiContribution | null
  setup: ((world: TWorld) => void) | null
}

export interface PresetDefinition<TWorld = any> {
  name: string
  plugins?: WorldExtension<TWorld> | Array<WorldExtension<TWorld>>
  setup?: (world: TWorld) => void
}

export interface WorldPreset<TWorld = any> {
  kind: 'preset'
  name: string
  plugins: readonly WorldExtension<TWorld>[]
  setup: ((world: TWorld) => void) | null
}

export type WorldExtension<TWorld = any> =
  | WorldPlugin<TWorld>
  | WorldPreset<TWorld>
  | PluginDefinition<TWorld>
  | PresetDefinition<TWorld>

export declare function definePlugin<TWorld = any>(definition: PluginDefinition<TWorld>): WorldPlugin<TWorld>
export declare function definePreset<TWorld = any>(definition: PresetDefinition<TWorld>): WorldPreset<TWorld>
export declare function installWorldExtension<TWorld = any>(
  world: TWorld,
  extension: WorldExtension<TWorld> | Array<WorldExtension<TWorld>>
): WorldExtension<TWorld> | Array<WorldExtension<TWorld>>
