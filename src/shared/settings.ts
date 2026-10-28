export const DEFAULT_SETTINGS: ExtensionSettings = {
  providerType: 'index-translate',
  baseUrl: 'http://127.0.0.1:8000/v1',
  model: 'Index-Translate-2B',
  apiKey: '',
  promptPreset: 'index',
  sourceLanguage: 'auto',
  targetLanguage: 'zh',
  autoSelection: true,
  pageConcurrency: 2,
  requestTimeoutMs: 60_000,
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get('settings')
  return { ...DEFAULT_SETTINGS, ...(stored.settings ?? {}) }
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ settings })
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}
