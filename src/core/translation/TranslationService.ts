import type { TranslationRequest, TranslationResult } from './contracts'
import { TranslationError, type TranslationProvider } from './TranslationProvider'

const CACHE_LIMIT = 100

export class TranslationService {
  private readonly cache = new Map<string, TranslationResult>()

  constructor(private readonly resolveProvider: () => Promise<TranslationProvider>) {}

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const provider = await this.resolveProvider()
    const key = JSON.stringify([
      provider.cacheKey,
      request.text,
      request.sourceLanguage,
      request.targetLanguage,
      request.scene,
    ])
    const cached = this.cache.get(key)
    if (cached) return cached

    const controller = new AbortController()
    const abort = () => controller.abort(request.signal?.reason)
    if (request.signal?.aborted) abort()
    else request.signal?.addEventListener('abort', abort, { once: true })
    const timeout = setTimeout(() => controller.abort('timeout'), provider.timeoutMs)

    try {
      const result = await provider.translate({ ...request, signal: controller.signal })
      this.cache.delete(key)
      this.cache.set(key, result)
      if (this.cache.size > CACHE_LIMIT) {
        const oldest = this.cache.keys().next().value
        if (oldest) this.cache.delete(oldest)
      }
      return result
    } catch (error) {
      if (controller.signal.aborted) {
        throw new TranslationError(controller.signal.reason === 'timeout' ? '翻译超时，请检查模型服务负载。' : '翻译已取消。', error)
      }
      throw error
    } finally {
      clearTimeout(timeout)
      request.signal?.removeEventListener('abort', abort)
    }
  }
}
