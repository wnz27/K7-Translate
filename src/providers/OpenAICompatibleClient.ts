import type { TranslationResult } from '../core/translation/contracts'
import { TranslationError } from '../core/translation/TranslationProvider'
import { normalizeBaseUrl } from '../shared/settings'

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

export class OpenAICompatibleClient {
  private readonly baseUrl: string

  constructor(private readonly settings: ExtensionSettings) {
    this.baseUrl = normalizeBaseUrl(settings.baseUrl)
  }

  async translate(prompt: string, signal?: AbortSignal): Promise<TranslationResult> {
    const payload = await this.request<ChatCompletionResponse>('/chat/completions', {
      method: 'POST',
      signal,
      body: JSON.stringify({
        model: this.settings.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 2048,
        stream: false,
        chat_template_kwargs: { enable_thinking: false },
      }),
    })
    const text = payload.choices?.[0]?.message?.content?.trim()
    if (!text) throw new TranslationError('模型返回了空译文，请检查模型名称和服务日志。')
    return { text, model: this.settings.model }
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const payload = await this.request<{ data?: Array<{ id?: string }> }>('/models', { signal })
    return payload.data?.flatMap((model) => model.id ? [model.id] : []) ?? []
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('Content-Type', 'application/json')
    if (this.settings.apiKey) headers.set('Authorization', `Bearer ${this.settings.apiKey}`)

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, { ...init, headers })
    } catch (error) {
      if (init.signal?.aborted) throw error
      throw new TranslationError(`无法连接 ${this.baseUrl}。请确认本地模型已启动、端口正确。`, error)
    }

    const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } }
    if (!response.ok) {
      throw new TranslationError(payload.error?.message ?? `模型服务返回 HTTP ${response.status}。`)
    }
    return payload
  }
}
