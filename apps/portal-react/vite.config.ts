import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `host: '0.0.0.0'` and the `/api` proxy mirror apps/portal-angular's serve target
// (angular.json + proxy.conf.json) so both frontends are reachable the same way and talk
// to the same API without a CORS entry.
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
  },
});
