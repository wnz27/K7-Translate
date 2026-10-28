import { getSettings } from '../shared/settings'
import { cancelTranslation, requestTranslation } from './messaging'

const BLOCK_SELECTOR = 'h1, h2, h3, h4, p, li, blockquote, td, th'
const EXCLUDED_SELECTOR = 'script, style, noscript, textarea, input, select, button, nav, pre, code, [contenteditable], [translate="no"], [data-k7-selection], [data-k7-translation]'
const STYLE_ID = 'k7-page-style'

interface PageBlock {
  element: HTMLElement
  text: string
}

export class PageTranslator {
  private state: PageTranslationState = { status: 'idle', mode: 'bilingual', total: 0, completed: 0, failed: 0 }
  private runId = 0
  private requests = new Set<string>()

  getState(): PageTranslationState {
    return { ...this.state }
  }

  async start(): Promise<void> {
    if (this.state.status === 'running') return
    this.restore()
    const blocks = this.collectBlocks()
    if (!blocks.length) {
      this.state = { ...this.state, status: 'error', error: '没有找到可翻译的正文段落。' }
      return
    }
    const runId = ++this.runId
    this.state = { status: 'running', mode: 'bilingual', total: blocks.length, completed: 0, failed: 0 }
    this.installStyles()
    document.documentElement.dataset.k7PageMode = 'bilingual'
    const settings = await getSettings()
    let cursor = 0
    const worker = async () => {
      while (cursor < blocks.length && runId === this.runId) {
        const block = blocks[cursor++]
        try {
          const translated = await this.translateBlock(block.text, runId)
          if (runId !== this.runId) return
          this.insertTranslation(block.element, translated)
          this.state.completed++
        } catch {
          if (runId === this.runId) this.state.failed++
        }
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(4, settings.pageConcurrency)) }, worker))
    if (runId !== this.runId) return
    this.state.status = this.state.completed ? 'done' : 'error'
    if (!this.state.completed) this.state.error = '所有段落均未翻译，请检查本地模型服务。'
  }

  setMode(mode: PageMode): void {
    this.state.mode = mode
    document.documentElement.dataset.k7PageMode = mode
  }

  restore(): void {
    this.runId++
    for (const requestId of this.requests) cancelTranslation(requestId)
    this.requests.clear()
    document.querySelectorAll('[data-k7-translation]').forEach((element) => element.remove())
    document.querySelectorAll<HTMLElement>('[data-k7-original]').forEach((element) => {
      delete element.dataset.k7Original
    })
    delete document.documentElement.dataset.k7PageMode
    document.getElementById(STYLE_ID)?.remove()
    this.state = { status: 'idle', mode: 'bilingual', total: 0, completed: 0, failed: 0 }
  }

  private collectBlocks(): PageBlock[] {
    const roots = Array.from(document.querySelectorAll('article, main'))
    const candidates = (roots.length ? roots : [document.body]).flatMap((root) =>
      Array.from(root.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)),
    )
    const unique = Array.from(new Set(candidates))
    return unique.flatMap((element) => {
      if (unique.some((parent) => parent !== element && parent.contains(element))) return []
      if (element.closest(EXCLUDED_SELECTOR) || !element.getClientRects().length) return []
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') return []
      const text = element.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      if (text.length < 2 || !/[\p{L}\p{N}]/u.test(text)) return []
      return [{ element, text }]
    })
  }

  private async translateBlock(text: string, runId: number): Promise<string> {
    const chunks = this.splitText(text)
    const translated: string[] = []
    for (const chunk of chunks) {
      if (runId !== this.runId) throw new Error('cancelled')
      const { requestId, response } = await requestTranslation(chunk, 'page')
      this.requests.add(requestId)
      try {
        if (!response.ok || !('result' in response)) throw new Error(response.ok ? 'invalid response' : response.error)
        translated.push(response.result.text)
      } finally {
        this.requests.delete(requestId)
      }
    }
    return translated.join(' ')
  }

  private splitText(text: string): string[] {
    if (text.length <= 1200) return [text]
    const chunks: string[] = []
    let remaining = text
    while (remaining.length > 1200) {
      const window = remaining.slice(0, 1200)
      const boundary = Math.max(window.lastIndexOf('。'), window.lastIndexOf('. '), window.lastIndexOf('！'), window.lastIndexOf('? '))
      const end = boundary > 500 ? boundary + 1 : 1200
      chunks.push(remaining.slice(0, end).trim())
      remaining = remaining.slice(end).trim()
    }
    if (remaining) chunks.push(remaining)
    return chunks
  }

  private insertTranslation(original: HTMLElement, text: string): void {
    const translation = original.cloneNode(false) as HTMLElement
    translation.textContent = text
    translation.dataset.k7Translation = ''
    translation.setAttribute('aria-label', 'K7 译文')
    original.dataset.k7Original = ''
    original.after(translation)
  }

  private installStyles(): void {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = `
      [data-k7-translation] { border-left: 2px solid #a64127 !important; padding-left: .85em !important; color: inherit; opacity: .88; }
      html[data-k7-page-mode="original"] [data-k7-translation] { display: none !important; }
      html[data-k7-page-mode="translated"] [data-k7-original] { display: none !important; }
    `
    document.head.append(style)
  }
}
