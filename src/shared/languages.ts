export const TARGET_LANGUAGES = [
  { value: 'zh', label: '简体中文', prompt: '简体中文' },
  { value: 'zh-TW', label: '繁體中文', prompt: '繁体中文' },
  { value: 'en', label: 'English', prompt: '英语' },
  { value: 'ja', label: '日本語', prompt: '日语' },
  { value: 'ko', label: '한국어', prompt: '韩语' },
  { value: 'fr', label: 'Français', prompt: '法语' },
  { value: 'de', label: 'Deutsch', prompt: '德语' },
  { value: 'es', label: 'Español', prompt: '西班牙语' },
  { value: 'ru', label: 'Русский', prompt: '俄语' },
] as const

export function languageName(code: string): string {
  return TARGET_LANGUAGES.find((language) => language.value === code)?.prompt ?? code
}
