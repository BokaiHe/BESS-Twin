import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/BESS-Twin/' : '/',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
}))
