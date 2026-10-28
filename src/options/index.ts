import { TARGET_LANGUAGES } from '../shared/languages'
import { getSettings, saveSettings } from '../shared/settings'

const form = document.querySelector<HTMLFormElement>('#settings-form')!
const result = document.querySelector<HTMLDivElement>('#result')!
const testButton = document.querySelector<HTMLButtonElement>('#test-connection')!
const targetSelect = document.querySelector<HTMLSelectElement>('#targetLanguage')!

for (const language of TARGET_LANGUAGES) {
  targetSelect.add(new Option(language.label, language.value))
}

function field(id: string): HTMLInputElement {
  return document.querySelector<HTMLInputElement>(`#${id}`)!
}

async function initialize(): Promise<void> {
  const settings = await getSettings()
  field('providerType').value = settings.providerType
  field('baseUrl').value = settings.baseUrl
  field('model').value = settings.model
  field('apiKey').value = settings.apiKey
  field('promptPreset').value = settings.promptPreset
  field('targetLanguage').value = settings.targetLanguage
  field('pageConcurrency').value = String(settings.pageConcurrency)
  field('requestTimeout').value = String(settings.requestTimeoutMs / 1000)
  field('autoSelection').checked = settings.autoSelection
}

function readSettings(): ExtensionSettings {
  return {
    providerType: 'index-translate',
    baseUrl: field('baseUrl').value.trim(),
    model: field('model').value.trim(),
    apiKey: field('apiKey').value,
    promptPreset: field('promptPreset').value as PromptPreset,
    sourceLanguage: 'auto',
    targetLanguage: field('targetLanguage').value,
    autoSelection: field('autoSelection').checked,
    pageConcurrency: Number(field('pageConcurrency').value),
    requestTimeoutMs: Number(field('requestTimeout').value) * 1000,
  }
}

function showResult(message: string, state: 'ok' | 'error' | 'loading'): void {
  result.className = `status ${state === 'loading' ? '' : state}`
  result.lastElementChild!.textContent = message
}

async function persist(): Promise<void> {
  await saveSettings(readSettings())
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  await persist()
  showResult('设置已保存。', 'ok')
})

testButton.addEventListener('click', async () => {
  if (!form.reportValidity()) return
  await persist()
  testButton.disabled = true
  showResult('正在调用模型翻译 “Hello, world.”…', 'loading')
  try {
    const response: ExtensionResponse = await chrome.runtime.sendMessage({
      type: 'translate',
      requestId: crypto.randomUUID(),
      text: 'Hello, world.',
      scene: 'connection-test',
    } satisfies ExtensionMessage)
    if (!response.ok || !('result' in response)) {
      showResult(response.ok ? '返回格式不正确。' : response.error, 'error')
      return
    }
    showResult(`连接成功，模型返回：${response.result.text}`, 'ok')
  } finally {
    testButton.disabled = false
  }
})

void initialize()
