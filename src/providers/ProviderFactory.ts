import type { TranslationProvider } from '../core/translation/TranslationProvider'
import { IndexTranslateProvider } from './IndexTranslateProvider'

type ProviderFactory = (settings: ExtensionSettings) => TranslationProvider

const registry = new Map<string, ProviderFactory>([
  ['index-translate', (settings) => new IndexTranslateProvider(settings)],
])

export function registerProvider(type: string, factory: ProviderFactory): void {
  registry.set(type, factory)
}

export function createProvider(settings: ExtensionSettings): TranslationProvider {
  const factory = registry.get(settings.providerType)
  if (!factory) throw new Error(`未注册的翻译提供者：${settings.providerType}`)
  return factory(settings)
}
