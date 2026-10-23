import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';
import { copyFileSync, existsSync } from 'fs';

function copySqlWasmPlugin() {
  return {
    name: 'copy-sql-wasm',
    closeBundle() {
      const src = resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm');
      const dest = resolve(__dirname, 'dist/main/sql-wasm.wasm');
      if (existsSync(src)) {
        copyFileSync(src, dest);
      }
    },
  };
}

export default defineConfig({
  plugins: [copySqlWasmPlugin()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/main'),
    emptyOutDir: true,
    target: 'node20',
    lib: {
      entry: resolve(__dirname, 'src/main/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    sourcemap: true,
  },
});
