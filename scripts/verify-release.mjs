import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

/**
 * M4-RELEASE-001 & M4-RELEASE-004 Release Readiness & Packaging Verification
 */
function verifyRelease() {
  console.log('[VERIFY-RELEASE] Auditing release artifacts and distribution integrity...');

  const root = process.cwd();
  const checks = [
    {
      name: 'Main process bundle',
      path: resolve(root, 'dist/main/index.js'),
      validator: (content) => content.length > 10000,
    },
    {
      name: 'WASM SQLite runtime',
      path: resolve(root, 'dist/main/sql-wasm.wasm'),
      validator: (content) => content.length > 50000,
    },
    {
      name: 'Preload script bundle',
      path: resolve(root, 'dist/preload/index.js'),
      validator: (content) => content.includes('contextBridge.exposeInMainWorld'),
    },
    {
      name: 'Renderer HTML production entry',
      path: resolve(root, 'dist/renderer/index.html'),
      validator: (content) => {
        // Assert SEC-002: script-src must not contain unsafe-inline in production
        const hasUnsafeInline = content.includes("script-src 'self' 'unsafe-inline'");
        const hasRoot = content.includes('id="root"');
        if (hasUnsafeInline) {
          throw new Error("Security Violation: Production HTML contains 'unsafe-inline' in script-src!");
        }
        return hasRoot;
      },
    },
  ];

  let passed = 0;
  for (const check of checks) {
    if (!existsSync(check.path)) {
      console.error(`[VERIFY-RELEASE] FAIL: Missing ${check.name} at ${check.path}`);
      process.exit(1);
    }
    const stat = statSync(check.path);
    const content = readFileSync(check.path);
    try {
      const ok = check.validator(content.toString('utf-8'));
      if (!ok) {
        console.error(`[VERIFY-RELEASE] FAIL: Validation check failed for ${check.name}`);
        process.exit(1);
      }
      console.log(`[VERIFY-RELEASE] PASS: ${check.name} verified (${Math.round(stat.size / 1024)} KB)`);
      passed++;
    } catch (err) {
      console.error(`[VERIFY-RELEASE] FAIL: ${check.name} error:`, err.message);
      process.exit(1);
    }
  }

  // Check package.json build metadata
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
  if (!pkg.build || !pkg.build.appId || !pkg.build.win) {
    console.error('[VERIFY-RELEASE] FAIL: package.json missing electron-builder metadata');
    process.exit(1);
  }

  console.log(`[VERIFY-RELEASE] SUCCESS: All ${passed} distribution checks passed.`);
  console.log(`[VERIFY-RELEASE] Application: ${pkg.build.productName} (${pkg.build.appId})`);
  console.log(`[VERIFY-RELEASE] Distribution Target: Windows NSIS Installer & Portable Executable`);
}

verifyRelease();
