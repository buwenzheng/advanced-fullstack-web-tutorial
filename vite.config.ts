import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const htmlEntry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'baseline-widely-available',
    rollupOptions: {
      input: {
        main: htmlEntry('./web/index.html'),
        next: htmlEntry('./web/index.next.html'),
      },
    },
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
