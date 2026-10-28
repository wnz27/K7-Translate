export async function requestTranslation(text: string, scene: TranslationScene, targetLanguage?: string) {
  const requestId = crypto.randomUUID()
  const response: ExtensionResponse = await chrome.runtime.sendMessage({
    type: 'translate',
    requestId,
    text,
    scene,
    targetLanguage,
  } satisfies ExtensionMessage)
  return { requestId, response }
}

export function cancelTranslation(requestId: string): void {
  void chrome.runtime.sendMessage({ type: 'cancel', requestId } satisfies ExtensionMessage)
}
