// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Resolve paths relative to the config file location
const rootDir = path.resolve(__dirname, '..')

export default defineConfig({
  plugins: [react()],
  root: rootDir,
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.idea/**', '**/.git/**', '**/.cache/**', '**/temp/**'],
    globals: true,
    setupFiles: [
      path.resolve(__dirname, 'setup.ts')
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/.idea/**', '**/.git/**', '**/.cache/**', '**/temp/**'],
      reportsDirectory: path.resolve(rootDir, 'coverage'),
      all: false
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
})