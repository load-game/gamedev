export declare class MemoryStorage {
  get<T = unknown>(key: string, defaultValue?: T | null): T | null
  set<T = unknown>(key: string, value: T | null | undefined): void
  remove(key: string): void
}

export declare class BrowserStorage {
  constructor(localStorageImpl?: Storage)
  get<T = unknown>(key: string, defaultValue?: T | null): T | null
  set<T = unknown>(key: string, value: T | null | undefined): void
  remove(key: string): void
}

export declare const storage: BrowserStorage | MemoryStorage
