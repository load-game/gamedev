import type { WorldPlugin } from './index.plugins.d.ts'

export interface AIProviderState {
  enabled: boolean
  provider: string | null
  model: string | null
  effort: string | null
}

export interface AIAttachment {
  type: 'doc' | 'script'
  path: string
}

export interface AICreatePromptInput {
  prompt: string
  attachments?: AIAttachment[]
  scriptRootId?: string
}

export declare class ClientAI {
  constructor(world: any)
  enabled: boolean
  provider: string | null
  model: string | null
  effort: string | null
  deserialize(data?: AIProviderState | null): void
  createFromPrompt(input: string | AICreatePromptInput): Promise<any>
}

export declare class ClientAIScripts {
  constructor(world: any)
  requestEdit(options?: { prompt?: string; app?: any; attachments?: AIAttachment[] }): string | null
  requestFix(options?: { error?: any; app?: any; attachments?: AIAttachment[] }): string | null
  request(options?: {
    mode?: 'edit' | 'fix'
    prompt?: string
    error?: any
    app?: any
    scriptRootId?: string
    attachments?: AIAttachment[]
  }): string | null
  isBlueprintPending(blueprintId: string): boolean
  isRootPending(scriptRootId: string): boolean
}

export declare const aiClientPlugin: WorldPlugin
