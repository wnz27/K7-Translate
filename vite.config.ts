import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.ts'

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        options: 'src/options/index.html',
      },
    },
  },
})
