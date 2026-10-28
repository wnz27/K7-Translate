import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'K7 Translate',
  description: '使用本地模型进行选文翻译和整页双语翻译。',
  version: '0.1.0',
  minimum_chrome_version: '116',
  action: {
    default_title: 'K7 Translate',
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  options_page: 'src/options/index.html',
  permissions: ['storage'],
  host_permissions: [
    'http://127.0.0.1/*',
    'http://localhost/*',
    'http://*/*',
    'https://*/*',
  ],
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
})
