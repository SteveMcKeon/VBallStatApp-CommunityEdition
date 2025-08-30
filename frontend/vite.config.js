import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

export default defineConfig(({ command }) => {
  const isServe = command === 'serve'
  const cfg = {
    base: '/',
    cacheDir: 'node_modules/.vite',
    plugins: [react()],
    server: isServe ? {
      watch: { usePolling: true, interval: 300},
      https: false,
      host: true,
      port: 5173,
    } : undefined,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
  }
  if (!isServe) {
    cfg.envDir = path.resolve(__dirname, '..')
  }
  return cfg
})
