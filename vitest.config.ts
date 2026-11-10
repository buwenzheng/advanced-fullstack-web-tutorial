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
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['web/scripts/engine/runner/**/*.ts', 'web/scripts/state/**/*.ts'],
      thresholds: { lines: 85, functions: 85, branches: 70, statements: 85 },
    },
  },
});
