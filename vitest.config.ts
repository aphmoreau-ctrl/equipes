import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * Configuration distincte de « vite.config.ts » : les tests n'ont pas besoin
 * du service worker, et un service worker actif pendant les tests fausserait
 * les resultats.
 */
export default defineConfig({
  plugins: [react()],
  // Injecte en production par vite.config.ts ; valeur fixe pendant les tests.
  define: {
    __VERSION_APP__: JSON.stringify('tests'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/preparation.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    clearMocks: true,
  },
})
