import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'out/**', '.vite/**'],
    passWithNoTests: true,
    environmentMatchGlobs: [
      ['tests/renderer/**', 'jsdom'],
      ['tests/main/**', 'node']
    ],
    setupFiles: ['tests/setup/global.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts']
    }
  }
});
