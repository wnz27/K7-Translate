type ProviderType = 'index-translate'
type PromptPreset = 'index' | 'simple'
type PageMode = 'original' | 'bilingual' | 'translated'

interface ExtensionSettings {
  providerType: ProviderType
  baseUrl: string
  model: string
  apiKey: string
  promptPreset: PromptPreset
  sourceLanguage: string
  targetLanguage: string
  autoSelection: boolean
  pageConcurrency: number
  requestTimeoutMs: number
}

type TranslationScene = 'selection' | 'page' | 'connection-test'
type TranslationResult = import('../core/translation/contracts').TranslationResult
type ServiceStatus = import('../core/translation/contracts').ServiceStatus

interface PageTranslationState {
  status: 'idle' | 'running' | 'done' | 'error'
  mode: PageMode
  total: number
  completed: number
  failed: number
  error?: string
}

type ContentMessage =
  | { type: 'start-page-translation' }
  | { type: 'set-page-mode'; mode: PageMode }
  | { type: 'restore-page' }
  | { type: 'get-page-state' }

type ContentResponse =
  | { ok: true; state: PageTranslationState }
  | { ok: false; error: string }

type ExtensionMessage =
  | { type: 'translate'; requestId: string; text: string; targetLanguage?: string; scene: TranslationScene }
  | { type: 'cancel'; requestId: string }
  | { type: 'check-status' }
  | { type: 'get-settings' }

type ExtensionResponse =
  | { ok: true; result: TranslationResult }
  | { ok: true; status: ServiceStatus }
  | { ok: true; settings: ExtensionSettings }
  | { ok: false; error: string }
