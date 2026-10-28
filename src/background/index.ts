import { TranslationService } from '../core/translation/TranslationService'
import { createProvider } from '../providers/ProviderFactory'
import { getSettings } from '../shared/settings'

const service = new TranslationService(async () => createProvider(await getSettings()))
const pending = new Map<string, AbortController>()

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void handleMessage(message).then(sendResponse)
  return true
})

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  try {
    if (message.type === 'get-settings') return { ok: true, settings: await getSettings() }
    if (message.type === 'cancel') {
      pending.get(message.requestId)?.abort()
      pending.delete(message.requestId)
      return { ok: true, status: { ok: true, message: '已取消' } }
    }
    if (message.type === 'check-status') {
      return { ok: true, status: await createProvider(await getSettings()).checkStatus() }
    }

    const settings = await getSettings()
    const controller = new AbortController()
    pending.set(message.requestId, controller)
    try {
      const result = await service.translate({
        text: message.text,
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: message.targetLanguage ?? settings.targetLanguage,
        scene: message.scene,
        signal: controller.signal,
      })
      return { ok: true, result }
    } finally {
      pending.delete(message.requestId)
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '翻译失败，请重试。' }
  }
}
