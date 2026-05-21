export interface BuiltinAppTemplate {
  name: string
  image?: { url: string } | null
  model: string
  script: string
  scriptEntry?: string
  scriptFiles?: Record<string, string>
  scriptFormat?: 'module' | 'legacy-body'
  props?: Record<string, unknown>
  preload?: boolean
  public?: boolean
  locked?: boolean
  frozen?: boolean
  unique?: boolean
  scene?: boolean
  disabled?: boolean
}

export declare const BUILTIN_APP_TEMPLATES: BuiltinAppTemplate[]
