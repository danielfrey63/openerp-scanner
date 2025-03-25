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
      include: [
        'src/components/OrderDetails.tsx',
        'test/components/OrderDetails/**/*.test.{ts,tsx}'
      ],
      reportsDirectory: path.resolve(rootDir, 'coverage'),
      all: true,
      extension: ['.ts', '.tsx'],
      reportOnFailure: true,
      thresholds: {
        lines: 90,
        functions: 80,
        branches: 90,
        statements: 90
      }
    },
    reporters: [
      ['default', {
        summary: false
      }]
    ],
    outputFile: {
      json: './test-results.json'
    },
    silent: true,
    watch: false,
    logHeapUsage: false
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
})