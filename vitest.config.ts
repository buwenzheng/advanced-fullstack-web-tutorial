import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./web/scripts/test/setup.ts'],
    include: ['web/scripts/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'web/scripts/app/**/*.{ts,tsx}',
        'web/scripts/engine/**/*.{ts,tsx}',
        'web/scripts/state/**/*.{ts,tsx}',
        'web/scripts/content/**/*.{ts,tsx}',
      ],
      exclude: ['web/scripts/content/stages/**', 'web/scripts/content/**/*.d.ts'],
      thresholds: {
        'web/scripts/engine/**': { lines: 85, functions: 85, statements: 85, branches: 70 },
        'web/scripts/state/**': { lines: 85, functions: 85, statements: 85, branches: 75 },
        'web/scripts/content/**': { lines: 85, functions: 85, statements: 85, branches: 70 },
        'web/scripts/app/**': { lines: 60, functions: 60, statements: 60, branches: 55 },
      },
    },
  },
});
