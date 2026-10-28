import type { ServiceStatus, TranslationRequest, TranslationResult } from './contracts'

export interface TranslationProvider {
  readonly cacheKey: string
  readonly timeoutMs: number
  translate(request: TranslationRequest): Promise<TranslationResult>
  checkStatus(): Promise<ServiceStatus>
}

export class TranslationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'TranslationError'
  }
}
