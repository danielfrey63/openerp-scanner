import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'

export default defineConfig({
  define: {
    'process.env': JSON.stringify(process.env)
  },
  optimizeDeps: {
    disabled: true,
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          process: true,
          buffer: true
        }) as any,
        NodeModulesPolyfillPlugin() as any
      ]
    }
  },
  server: {
    proxy: {
      '/xmlrpc': {
        target: 'https://erp.frey-champagne-import.ch',
        changeOrigin: true,
        secure: false,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      }
    }
  },
  plugins: [react()]
})