export interface TranslationRequest {
  text: string
  sourceLanguage: string
  targetLanguage: string
  scene: 'selection' | 'page' | 'connection-test'
  signal?: AbortSignal
}

export interface TranslationResult {
  text: string
  model: string
}

export interface ServiceStatus {
  ok: boolean
  message: string
  models?: string[]
}
