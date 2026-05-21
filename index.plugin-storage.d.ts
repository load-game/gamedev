import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export interface WorldStorageEntry<T = unknown> {
  key: string
  exists: boolean
  value: T | undefined | null
  createdAt: string | null
  updatedAt: string | null
}

export interface WorldStorageCommitOperation<T = unknown> {
  key: string
  value: T | null
  expectedUpdatedAt?: string | null
}

export interface WorldStorageCommitResult {
  ok: boolean
  conflicts: WorldStorageEntry[]
  entries: WorldStorageEntry[]
}

export declare const storageScriptApi: {
  world: {
    get<T = unknown>(entity: any, key: string): T | undefined
    getFresh<T = unknown>(entity: any, key: string): Promise<T | undefined | null>
    getFreshEntry<T = unknown>(entity: any, key: string): Promise<WorldStorageEntry<T>>
    getFreshEntriesByPrefix<T = unknown>(entity: any, prefix?: string): Promise<WorldStorageEntry<T>[]>
    listStorageKeys(entity: any, prefix?: string): Promise<string[]>
    set<T = unknown>(entity: any, key: string, value: T): void
    setFresh<T = unknown>(entity: any, key: string, value: T | null): Promise<T | null>
    commitStorage(entity: any, operations: WorldStorageCommitOperation[]): Promise<WorldStorageCommitResult>
  }
}

export declare const storagePlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    get<T = unknown>(key: string): T | undefined
    set<T = unknown>(key: string, value: T): void
    getFresh<T = unknown>(key: string): Promise<T | undefined | null>
    getFreshEntry<T = unknown>(key: string): Promise<WorldStorageEntry<T>>
    getFreshEntriesByPrefix<T = unknown>(prefix?: string): Promise<WorldStorageEntry<T>[]>
    listStorageKeys(prefix?: string): Promise<string[]>
    setFresh<T = unknown>(key: string, value: T | null): Promise<T | null>
    commitStorage(operations: WorldStorageCommitOperation[]): Promise<WorldStorageCommitResult>
  }
}
