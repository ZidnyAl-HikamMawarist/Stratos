import { describe, it, expect } from 'vitest';
import {
  isSafeExternalUrl,
  isAllowedNavigationUrl,
  isAuthorizedIpcSender,
  getCspPolicy,
} from '../src/main/security';
import { IPC_CHANNELS } from '../src/shared/types';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('SEC-013: External URL Validation', () => {
  it('allows valid https and http URLs', () => {
    expect(isSafeExternalUrl('https://electronjs.org')).toBe(true);
    expect(isSafeExternalUrl('https://github.com/google')).toBe(true);
    expect(isSafeExternalUrl('http://localhost:5173')).toBe(true);
    expect(isSafeExternalUrl('http://127.0.0.1:8080')).toBe(true);
  });

  it('rejects javascript: schemes to prevent XSS execution', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('JAVASCRIPT:void(0)')).toBe(false);
  });

  it('rejects file: schemes to prevent local filesystem traversal', () => {
    expect(isSafeExternalUrl('file:///C:/Windows/System32/cmd.exe')).toBe(false);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects data: schemes to prevent inline payload execution', () => {
    expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects malformed or empty URLs', () => {
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl('not-a-valid-url')).toBe(false);
    expect(isSafeExternalUrl('   ')).toBe(false);
  });
});

describe('MED-01: Dynamic Navigation Guard', () => {
  it('allows navigation to configured dev server URL in development', () => {
    const devUrl = 'http://localhost:5177';
    expect(isAllowedNavigationUrl('http://localhost:5177/', devUrl, true)).toBe(true);
    expect(isAllowedNavigationUrl('http://localhost:5177/settings', devUrl, true)).toBe(true);
  });

  it('rejects foreign ports or external domains during development', () => {
    const devUrl = 'http://localhost:5173';
    expect(isAllowedNavigationUrl('http://localhost:5177/', devUrl, true)).toBe(false);
    expect(isAllowedNavigationUrl('https://malicious.com', devUrl, true)).toBe(false);
    expect(isAllowedNavigationUrl('file:///C:/malicious.html', devUrl, true)).toBe(false);
  });

  it('allows legitimate local renderer bundle in production', () => {
    expect(isAllowedNavigationUrl('file:///C:/app/dist/renderer/index.html', undefined, false)).toBe(true);
    expect(isAllowedNavigationUrl('file:///C:/app/renderer/index.html', undefined, false)).toBe(true);
  });

  it('rejects unexpected file locations or remote origins in production', () => {
    expect(isAllowedNavigationUrl('file:///C:/Windows/System32/cmd.exe', undefined, false)).toBe(false);
    expect(isAllowedNavigationUrl('http://localhost:5173', undefined, false)).toBe(false);
    expect(isAllowedNavigationUrl('https://example.com', undefined, false)).toBe(false);
    // Remote UNC/SMB share should be rejected even if filename matches
    expect(isAllowedNavigationUrl('file://attacker-server.com/dist/renderer/index.html', undefined, false)).toBe(false);
  });
});

describe('SEC-003 & CRIT-01: IPC Sender & Frame Validation', () => {
  const PRIMARY_WINDOW_ID = 1;

  it('rejects IPC sender from an unknown window', () => {
    const result = isAuthorizedIpcSender({
      senderWebContentsId: 999, // unknown window
      expectedWebContentsId: PRIMARY_WINDOW_ID,
      isMainFrame: true,
      frameUrl: 'http://localhost:5173/',
      isDev: true,
      devServerUrl: 'http://localhost:5173',
    });
    expect(result).toBe(false);
  });

  it('rejects IPC sender originating from a subframe or iframe', () => {
    const result = isAuthorizedIpcSender({
      senderWebContentsId: PRIMARY_WINDOW_ID,
      expectedWebContentsId: PRIMARY_WINDOW_ID,
      isMainFrame: false, // subframe
      frameUrl: 'http://localhost:5173/',
      isDev: true,
      devServerUrl: 'http://localhost:5173',
    });
    expect(result).toBe(false);
  });

  it('rejects IPC sender with unauthorized or mismatched URL in development', () => {
    const result = isAuthorizedIpcSender({
      senderWebContentsId: PRIMARY_WINDOW_ID,
      expectedWebContentsId: PRIMARY_WINDOW_ID,
      isMainFrame: true,
      frameUrl: 'http://evil.com/',
      isDev: true,
      devServerUrl: 'http://localhost:5173',
    });
    expect(result).toBe(false);
  });

  it('accepts legitimate top-level main frame in development matching configured dev server', () => {
    const result = isAuthorizedIpcSender({
      senderWebContentsId: PRIMARY_WINDOW_ID,
      expectedWebContentsId: PRIMARY_WINDOW_ID,
      isMainFrame: true,
      frameUrl: 'http://localhost:5177/',
      isDev: true,
      devServerUrl: 'http://localhost:5177',
    });
    expect(result).toBe(true);
  });

  it('accepts legitimate top-level main frame in production loading renderer/index.html', () => {
    const result = isAuthorizedIpcSender({
      senderWebContentsId: PRIMARY_WINDOW_ID,
      expectedWebContentsId: PRIMARY_WINDOW_ID,
      isMainFrame: true,
      frameUrl: 'file:///C:/laragon/www/Stratos/dist/renderer/index.html',
      isDev: false,
    });
    expect(result).toBe(true);
  });

  it('rejects production IPC if frame URL points to non-renderer file', () => {
    const result = isAuthorizedIpcSender({
      senderWebContentsId: PRIMARY_WINDOW_ID,
      expectedWebContentsId: PRIMARY_WINDOW_ID,
      isMainFrame: true,
      frameUrl: 'file:///C:/laragon/www/Stratos/secret.html',
      isDev: false,
    });
    expect(result).toBe(false);
  });
});

describe('MED-02: Content Security Policy Verification', () => {
  it('disallows unsafe-inline in script-src for production CSP policy', () => {
    const prodCsp = getCspPolicy(false);
    expect(prodCsp).toContain("script-src 'self'");
    expect(prodCsp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(prodCsp).toContain("default-src 'self'");
    expect(prodCsp).toContain("object-src 'none'");
  });

  it('allows HMR and dev server connections in development CSP policy', () => {
    const devCsp = getCspPolicy(true, 'http://localhost:5177');
    expect(devCsp).toContain("script-src 'self' 'unsafe-inline'");
    expect(devCsp).toContain('ws://localhost:5177');
  });

  it('verifies production build of index.html does not contain inline scripts in script-src', () => {
    const prodHtmlPath = resolve(__dirname, '../dist/renderer/index.html');
    if (existsSync(prodHtmlPath)) {
      const htmlContent = readFileSync(prodHtmlPath, 'utf-8');
      // Assert that if CSP meta is present, it does NOT permit inline scripts
      expect(htmlContent).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(htmlContent).toMatch(/script-src 'self'/);
    }
  });
});

describe('SEC-002: IPC Channels Allowlist', () => {
  it('defines explicit, non-generic channels only', () => {
    const channels = Object.values(IPC_CHANNELS);
    expect(channels.length).toBeGreaterThan(0);
    expect(channels).not.toContain('*');
    expect(channels).not.toContain('all');
    expect(channels).not.toContain('generic');
    expect(channels).toContain('app:get-metadata');
    expect(channels).toContain('theme:get');
    expect(channels).toContain('theme:set');
    expect(channels).toContain('locale:get');
    expect(channels).toContain('locale:set');
    expect(channels).toContain('system:open-external');
  });
});
