import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
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
    nodePolyfills(),
    basicSsl(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/*.svg'],
      manifest: {
        name: 'OpenERP Scanner',
        short_name: 'ERP Scanner',
        description: 'QR Code Scanner für OpenERP Order Management',
        theme_color: '#667eea',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      devOptions: {
        enabled: false, // Disable in development to avoid SSL issues
        type: 'module'
      }
    })
  ],
  server: {
    host: true, // Use localhost for HTTPS/Service Worker compatibility
    port: 5174,
    strictPort: true,
    hmr: {
      host: '0.0.0.0'
    }
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Unterdrücke die Warnung über dynamische/statische Import-Inkonsistenz
        if (warning.code === 'MIXED_IMPORTS' ||
            (warning.message && warning.message.includes('dynamically imported by') && warning.message.includes('but also statically imported'))) {
          return;
        }
        warn(warning);
      }
    },
    chunkSizeWarningLimit: 1000,
  }
})