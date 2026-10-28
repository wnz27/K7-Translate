import { TARGET_LANGUAGES } from '../shared/languages'
import { getSettings } from '../shared/settings'
import { cancelTranslation, requestTranslation } from './messaging'

const panelStyles = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .panel { width: 370px; max-width: calc(100vw - 24px); overflow: hidden; border: 1px solid #d8d1c4; border-radius: 11px; color: #292923; background: #f8f5ee; box-shadow: 0 14px 44px #25221926, 0 2px 8px #25221912; font: 14px/1.65 "Avenir Next", "PingFang SC", sans-serif; }
  header { display: flex; align-items: center; gap: 8px; padding: 9px 11px; border-bottom: 1px solid #e3ddd2; }
  .mark { color: #a64127; font: 700 13px "Iowan Old Style", serif; letter-spacing: -.04em; }
  .title { flex: 1; color: #777269; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
  select, button { font: inherit; }
  select { max-width: 112px; padding: 2px 4px; border: 0; color: #575249; background: transparent; font-size: 11px; }
  button { cursor: pointer; }
  .close { width: 24px; height: 24px; padding: 0; border: 0; border-radius: 5px; color: #777269; background: transparent; font-size: 18px; line-height: 1; }
  .close:hover { background: #ece7dc; }
  .content { min-height: 58px; max-height: 280px; overflow: auto; padding: 14px 16px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .loading { display: flex; align-items: center; gap: 9px; color: #777269; font-size: 12px; }
  .pulse { width: 8px; height: 8px; border-radius: 50%; background: #a64127; animation: pulse 1s ease-in-out infinite alternate; }
  .error { color: #a64127; font-size: 12px; }
  footer { display: flex; justify-content: flex-end; gap: 6px; padding: 0 11px 10px; }
  .action { padding: 4px 9px; border: 1px solid #d8d1c4; border-radius: 5px; color: #575249; background: transparent; font-size: 11px; }
  .action:hover { background: #ece7dc; }
  [hidden] { display: none !important; }
  @keyframes pulse { to { opacity: .25; transform: scale(.7); } }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
`

export class SelectionTranslator {
  private host?: HTMLDivElement
  private timer?: number
  private generation = 0
  private activeRequest?: string
  private text = ''
  private targetLanguage = 'zh'

  initialize(): void {
    document.addEventListener('mouseup', (event) => {
      if (this.host && event.composedPath().includes(this.host)) return
      this.schedule()
    })
    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape') this.close()
      else if (event.shiftKey || event.key === 'Shift') this.schedule()
    })
    document.addEventListener('scroll', () => this.close(), true)
    window.addEventListener('resize', () => this.close())
  }

  private schedule(): void {
    clearTimeout(this.timer)
    this.timer = window.setTimeout(() => void this.prepare(), 280)
  }

  private async prepare(): Promise<void> {
    const settings = await getSettings()
    if (!settings.autoSelection) return
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ''
    if (!selection || selection.rangeCount === 0 || text.length < 2 || text.length > 4000) {
      if (!text) this.close()
      return
    }
    const anchor = selection.anchorNode
    const element = anchor instanceof Element ? anchor : anchor?.parentElement
    if (element?.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')) return
    if (this.host?.shadowRoot?.contains(anchor)) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (!rect.width && !rect.height) return
    this.text = text
    this.targetLanguage = settings.targetLanguage
    this.show(rect)
    await this.translate()
  }

  private show(rect: DOMRect): void {
    this.close()
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;z-index:2147483647;left:0;top:0;visibility:hidden;'
    host.dataset.k7Selection = ''
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = panelStyles
    const panel = document.createElement('section')
    panel.className = 'panel'
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', 'K7 选文翻译')
    panel.innerHTML = `
      <header><span class="mark">K7</span><span class="title">Translation</span><select aria-label="目标语言"></select><button class="close" aria-label="关闭">×</button></header>
      <div class="content"><div class="loading"><span class="pulse"></span>本地模型翻译中…</div></div>
      <footer><button class="action retry" hidden>重试</button><button class="action copy" hidden>复制译文</button></footer>
    `
    shadow.append(style, panel)
    const select = panel.querySelector<HTMLSelectElement>('select')!
    for (const language of TARGET_LANGUAGES) select.add(new Option(language.label, language.value))
    select.value = this.targetLanguage
    select.addEventListener('change', () => {
      this.targetLanguage = select.value
      void this.translate()
    })
    panel.querySelector('.close')!.addEventListener('click', () => this.close())
    panel.querySelector('.retry')!.addEventListener('click', () => void this.translate())
    panel.querySelector('.copy')!.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement
      void navigator.clipboard.writeText(this.textResult()).then(() => {
        button.textContent = '已复制'
        setTimeout(() => { button.textContent = '复制译文' }, 1200)
      })
    })
    document.documentElement.append(host)
    this.host = host
    const width = Math.min(370, window.innerWidth - 24)
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    const panelHeight = panel.offsetHeight
    const below = rect.bottom + 10
    const top = below + panelHeight <= window.innerHeight - 12 ? below : Math.max(12, rect.top - panelHeight - 10)
    host.style.left = `${left}px`
    host.style.top = `${top}px`
    host.style.visibility = 'visible'
  }

  private async translate(): Promise<void> {
    if (!this.host) return
    const generation = ++this.generation
    if (this.activeRequest) cancelTranslation(this.activeRequest)
    this.setLoading()
    const { requestId, response } = await requestTranslation(this.text, 'selection', this.targetLanguage)
    this.activeRequest = requestId
    if (generation !== this.generation || !this.host) return
    if (response.ok && 'result' in response) this.setResult(response.result.text)
    else this.setError(response.ok ? '翻译失败。' : response.error)
  }

  private setLoading(): void {
    const content = this.host?.shadowRoot?.querySelector<HTMLDivElement>('.content')
    if (!content) return
    content.innerHTML = '<div class="loading"><span class="pulse"></span>本地模型翻译中…</div>'
    this.host!.shadowRoot!.querySelector('.copy')!.setAttribute('hidden', '')
    this.host!.shadowRoot!.querySelector('.retry')!.setAttribute('hidden', '')
  }

  private setResult(text: string): void {
    const content = this.host?.shadowRoot?.querySelector<HTMLDivElement>('.content')
    if (!content) return
    content.textContent = text
    this.host!.shadowRoot!.querySelector('.copy')!.removeAttribute('hidden')
    this.host!.shadowRoot!.querySelector('.retry')!.setAttribute('hidden', '')
  }

  private setError(message: string): void {
    const content = this.host?.shadowRoot?.querySelector<HTMLDivElement>('.content')
    if (!content) return
    content.innerHTML = '<div class="error"></div>'
    content.firstElementChild!.textContent = message
    this.host!.shadowRoot!.querySelector('.copy')!.setAttribute('hidden', '')
    this.host!.shadowRoot!.querySelector('.retry')!.removeAttribute('hidden')
  }

  private textResult(): string {
    return this.host?.shadowRoot?.querySelector('.content')?.textContent ?? ''
  }

  private close(): void {
    clearTimeout(this.timer)
    this.generation++
    if (this.activeRequest) cancelTranslation(this.activeRequest)
    this.activeRequest = undefined
    this.host?.remove()
    this.host = undefined
  }
}
