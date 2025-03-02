import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import path from 'path'

// Configuration to fix Node.js module warnings in the browser
export default defineConfig({
  define: {
    'process.env': {},
    global: 'globalThis'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
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
  plugins: [
    react(),
    nodePolyfills()
  ]
})