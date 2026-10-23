import { createServer, build } from 'vite';
import { spawn } from 'child_process';
import electronPath from 'electron';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function startDev() {
  // 1. Build main and preload once initially
  console.log('[DEV] Building main process...');
  await build({
    configFile: resolve(root, 'vite.main.config.ts'),
    mode: 'development',
  });

  console.log('[DEV] Building preload script...');
  await build({
    configFile: resolve(root, 'vite.preload.config.ts'),
    mode: 'development',
  });

  // 2. Start Vite dev server for renderer
  console.log('[DEV] Starting Vite dev server for renderer...');
  const server = await createServer({
    configFile: resolve(root, 'vite.renderer.config.ts'),
    mode: 'development',
  });
  await server.listen();

  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const devUrl = `http://localhost:${port}`;
  console.log(`[DEV] Renderer dev server running at: ${devUrl}`);

  // 3. Launch Electron
  console.log('[DEV] Launching Electron...');
  const electronProcess = spawn(String(electronPath), ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      VITE_DEV_SERVER_URL: devUrl,
    },
  });

  electronProcess.on('close', async (code) => {
    console.log(`[DEV] Electron process exited with code ${code}`);
    await server.close();
    process.exit(code ?? 0);
  });
}

startDev().catch((err) => {
  console.error('[DEV] Failed to start dev server:', err);
  process.exit(1);
});
