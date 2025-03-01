import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  define: {
    'process.env': {},
    global: 'globalThis'
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      timers: 'timers-browserify',
      buffer: 'buffer',
      util: 'util/'
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis'
      }
    }
  },
  plugins: [react()]
})