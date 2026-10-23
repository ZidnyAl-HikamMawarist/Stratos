import { spawn } from 'child_process';
import electronPath from 'electron';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

console.log('[VERIFY-STARTUP] Starting automated startup & DOM verification test (M1-UI-001)...');

const electronProcess = spawn(String(electronPath), ['.'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    STRATOS_VERIFY_STARTUP: '1',
  },
});

let stdoutBuffer = '';
let stderrBuffer = '';
let hasVerifiedSuccess = false;

electronProcess.stdout?.on('data', (data) => {
  const text = data.toString();
  stdoutBuffer += text;
  process.stdout.write(text);
  if (text.includes('[STRATOS_STARTUP_VERIFY_SUCCESS]')) {
    hasVerifiedSuccess = true;
  }
});

electronProcess.stderr?.on('data', (data) => {
  const text = data.toString();
  stderrBuffer += text;
  process.stderr.write(text);
});

const timer = setTimeout(() => {
  console.error('[VERIFY-STARTUP] TIMEOUT: Electron did not confirm DOM ready within 10 seconds.');
  electronProcess.kill('SIGKILL');
  process.exit(1);
}, 10000);

electronProcess.on('close', (code) => {
  clearTimeout(timer);
  if (code === 0 && hasVerifiedSuccess) {
    console.log('\n[VERIFY-STARTUP] PASS: Electron booted, loaded production bundle, and verified React root DOM mount.');
    process.exit(0);
  } else {
    console.error(`\n[VERIFY-STARTUP] FAIL: Process exited with code ${code}. Success confirmation was ${hasVerifiedSuccess ? 'RECEIVED' : 'NOT RECEIVED'}.`);
    if (stderrBuffer) {
      console.error('[VERIFY-STARTUP] Captured Stderr:\n', stderrBuffer);
    }
    process.exit(1);
  }
});
