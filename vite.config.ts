import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  define: {
    'process.env': JSON.stringify(process.env),
    global: 'globalThis'
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      timers: 'timers-browserify',
      util: 'util',
      buffer: 'buffer'
    }
  },
  optimizeDeps: {
    include: ['stream-browserify', 'timers-browserify', 'buffer', 'util']
  },
  plugins: [react()]
})