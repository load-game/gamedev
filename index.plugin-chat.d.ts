import 'gamedev'
import type { WorldPlugin } from './index.plugins.d.ts'

export interface ChatMessage {
  id?: string
  from?: string | null
  fromId?: string | null
  body: string
  createdAt?: string
}

export declare class Chat {
  constructor(world: any)
  add(message: ChatMessage, broadcast?: boolean): void
  command(text: string): void
  clear(broadcast?: boolean): void
  send(text: string): ChatMessage | undefined
  serialize(): ChatMessage[]
  deserialize(messages: ChatMessage[]): void
  subscribe(callback: (messages: ChatMessage[]) => void): () => void
  bindCommand(
    command: string,
    callback: (input: { playerId: string; cmd: string; value: string; args: string[] }) => void
  ): void
  destroy(): void
}

export declare const chatScriptApi: {
  world: {
    chat(entity: any, message: ChatMessage, broadcast?: boolean): void
  }
}

export declare const chatPlugin: WorldPlugin

declare module 'gamedev' {
  interface WorldAPI {
    chat(message: ChatMessage, broadcast?: boolean): void
  }
}
