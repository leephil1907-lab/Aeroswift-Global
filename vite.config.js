import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

const apiTarget = process.env.API_PROXY_TARGET || 'http://127.0.0.1:10000'
const apiProxy = { '/api': { target: apiTarget, changeOrigin: true } }

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'], proxy: apiProxy },
  preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app'], proxy: apiProxy },
  build: { rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), admin: resolve(process.cwd(), 'admin.html') } } }
})
