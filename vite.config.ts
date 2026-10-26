import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { offlinePlugin } from './scripts/offlinePlugin.ts'

export default defineConfig({
  plugins: [react(), offlinePlugin()],
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
