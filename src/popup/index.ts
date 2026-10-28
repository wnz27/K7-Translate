const statusElement = document.querySelector<HTMLDivElement>('#service-status')!
const translateButton = document.querySelector<HTMLButtonElement>('#translate-page')!
const restoreButton = document.querySelector<HTMLButtonElement>('#restore')!
const messageElement = document.querySelector<HTMLParagraphElement>('#page-message')!
const progressElement = document.querySelector<HTMLSpanElement>('#progress')!
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mode]'))
let currentTabId: number | undefined
let pollTimer: number | undefined

function showStatus(element: HTMLElement, message: string, state?: 'ok' | 'error'): void {
  element.className = `status ${state ?? ''}`
  element.lastElementChild!.textContent = message
}

async function currentTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab.id) throw new Error('找不到当前标签页。')
  currentTabId = tab.id
  return tab
}

async function sendToPage(message: ContentMessage): Promise<ContentResponse> {
  const tab = await currentTab()
  try {
    return await chrome.tabs.sendMessage(tab.id!, message)
  } catch {
    return { ok: false, error: '此页面不支持翻译。请在普通 HTTP/HTTPS 页面重试。' }
  }
}

function renderPageState(state: PageTranslationState): void {
  progressElement.textContent = state.total ? `${state.completed + state.failed}/${state.total}` : ''
  restoreButton.hidden = state.status === 'idle'
  translateButton.disabled = state.status === 'running'
  translateButton.textContent = state.status === 'running' ? '正在逐段翻译…' : state.status === 'idle' ? '翻译本页正文' : '重新翻译本页'
  for (const button of modeButtons) button.classList.toggle('active', button.dataset.mode === state.mode)
  if (state.status === 'running') messageElement.textContent = '译文会逐段出现，可关闭此窗口继续阅读。'
  else if (state.status === 'done') messageElement.textContent = state.failed ? `完成，${state.failed} 段未翻译。` : '本页正文翻译完成。'
  else if (state.status === 'error') messageElement.textContent = state.error ?? '翻译失败。'
}

async function refreshPageState(): Promise<void> {
  const response = await sendToPage({ type: 'get-page-state' })
  if (response.ok && 'state' in response) renderPageState(response.state)
  else if (!response.ok) messageElement.textContent = response.error
}

translateButton.addEventListener('click', async () => {
  const response = await sendToPage({ type: 'start-page-translation' })
  if (!response.ok) {
    messageElement.textContent = response.error
    return
  }
  await refreshPageState()
})

restoreButton.addEventListener('click', async () => {
  const response = await sendToPage({ type: 'restore-page' })
  if (response.ok) {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = undefined
  }
  await refreshPageState()
})

for (const button of modeButtons) {
  button.addEventListener('click', async () => {
    await sendToPage({ type: 'set-page-mode', mode: button.dataset.mode as PageMode })
    await refreshPageState()
  })
}

document.querySelector('#options')!.addEventListener('click', () => void chrome.runtime.openOptionsPage())

chrome.runtime.sendMessage({ type: 'check-status' } satisfies ExtensionMessage).then((response: ExtensionResponse) => {
  if (response.ok && 'status' in response) showStatus(statusElement, response.status.message, response.status.ok ? 'ok' : 'error')
  else showStatus(statusElement, response.ok ? '状态未知' : response.error, 'error')
})

void refreshPageState().then(() => {
  if (currentTabId) {
    pollTimer = window.setInterval(() => {
      if (translateButton.disabled) void refreshPageState()
    }, 1000)
  }
})
