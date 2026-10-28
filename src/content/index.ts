import { PageTranslator } from './page'
import { SelectionTranslator } from './selection'

const pageTranslator = new PageTranslator()
const selectionTranslator = new SelectionTranslator()
selectionTranslator.initialize()

chrome.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
  void handleMessage(message).then(sendResponse)
  return true
})

async function handleMessage(message: ContentMessage): Promise<ContentResponse> {
  try {
    if (message.type === 'get-page-state') return { ok: true, state: pageTranslator.getState() }
    if (message.type === 'start-page-translation') {
      void pageTranslator.start()
      return { ok: true, state: pageTranslator.getState() }
    }
    if (message.type === 'set-page-mode') {
      pageTranslator.setMode(message.mode)
      return { ok: true, state: pageTranslator.getState() }
    }
    pageTranslator.restore()
    return { ok: true, state: pageTranslator.getState() }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '页面翻译失败。' }
  }
}
