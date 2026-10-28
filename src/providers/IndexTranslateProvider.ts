import type { ServiceStatus, TranslationRequest, TranslationResult } from '../core/translation/contracts'
import type { TranslationProvider } from '../core/translation/TranslationProvider'
import { languageName } from '../shared/languages'
import { OpenAICompatibleClient } from './OpenAICompatibleClient'

export class IndexTranslateProvider implements TranslationProvider {
  readonly cacheKey: string
  readonly timeoutMs: number
  private readonly client: OpenAICompatibleClient

  constructor(private readonly settings: ExtensionSettings) {
    this.client = new OpenAICompatibleClient(settings)
    this.cacheKey = JSON.stringify([settings.baseUrl, settings.model, settings.promptPreset])
    this.timeoutMs = settings.requestTimeoutMs
  }

  translate(request: TranslationRequest): Promise<TranslationResult> {
    return this.client.translate(this.buildPrompt(request), request.signal)
  }

  async checkStatus(): Promise<ServiceStatus> {
    try {
      const models = await this.client.listModels(AbortSignal.timeout(5000))
      return { ok: true, message: `服务已连接${models.length ? `：${models.join(', ')}` : ''}`, models }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '连接失败' }
    }
  }

  private buildPrompt(request: TranslationRequest): string {
    const target = languageName(request.targetLanguage)
    const source = request.sourceLanguage === 'auto' ? '' : languageName(request.sourceLanguage)
    if (this.settings.promptPreset === 'simple') {
      return `Translate the following ${source} text into ${target}. Output only the translation.\n\n${request.text}`
    }
    return `请将以下${source}文本翻译为${target}，直接输出翻译结果，不要进行任何解释。\n\n${request.text}`
  }
}
