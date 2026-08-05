import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4300,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', '**/*.config.{ts,js}'],
      // Measured baseline (62 tests, `vitest run --coverage`): stmts 93.49%, branches
      // 89.75%, funcs 92.36%, lines 93.66%. Thresholds sit a few points under the lowest
      // observed metric (branches) so one new untested branch doesn't fail a build, without
      // letting coverage rot. Repo-wide, not per-file: per-file would fail on legitimately
      // small edge-case files.
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 88,
        lines: 90,
        perFile: false,
      },
    },
  },
});
