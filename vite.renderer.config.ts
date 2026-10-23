import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Plugin to strip 'unsafe-inline' and dev connect sources from the CSP meta tag
 * during production build (MED-02).
 */
function productionCspPlugin() {
  return {
    name: 'production-csp-transform',
    apply: 'build' as const,
    transformIndexHtml(html: string) {
      return html
        .replace("script-src 'self' 'unsafe-inline'", "script-src 'self'")
        .replace("connect-src 'self' ws://localhost:* http://localhost:*", "connect-src 'self'");
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react(), productionCspPlugin()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
