import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SecureCredentialStore, maskSecret, redactSecrets } from '../src/main/services/credentials';
import { StratosDatabase } from '../src/main/services/database';
import { MockProviderAdapter } from '../src/main/services/providers/mock';
import { LocalRouterService } from '../src/main/services/router';
import { rmSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import http from 'http';

describe('Milestone 2: Secure Credentials & Secret Redaction (SEC-006, SEC-007, ADR-006)', () => {
  const testDir = join(process.cwd(), '.stratos-test-creds');

  beforeEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('securely stores, retrieves, and deletes encrypted credentials', () => {
    const store = new SecureCredentialStore(testDir);
    store.setCredential('prov_openrouter', 'sk-or-v1-my-secret-key-12345678');

    expect(store.getCredential('prov_openrouter')).toBe('sk-or-v1-my-secret-key-12345678');

    // Create a new instance pointing to same file to verify persistence
    const reloaded = new SecureCredentialStore(testDir);
    expect(reloaded.getCredential('prov_openrouter')).toBe('sk-or-v1-my-secret-key-12345678');

    expect(reloaded.deleteCredential('prov_openrouter')).toBe(true);
    expect(reloaded.getCredential('prov_openrouter')).toBeUndefined();
  });

  it('masks API keys for display without revealing sensitive characters', () => {
    expect(maskSecret('sk-or-v1-abcdef123456')).toBe('sk-o...3456');
    expect(maskSecret('short')).toBe('********');
    expect(maskSecret('')).toBe('');
  });

  it('SEC-006 & M2-LOG-002: redacts canary secret tokens from error and log messages', () => {
    const canarySecret = 'sk-canary-secret-token-xyz987654';
    const store = new SecureCredentialStore(testDir);
    store.setCredential('test_provider', canarySecret);

    const rawError = `Request to upstream failed with Authorization: Bearer ${canarySecret} and key=${canarySecret}`;
    const sanitized = redactSecrets(rawError, store.getAllKnownSecrets());

    expect(sanitized).not.toContain(canarySecret);
    expect(sanitized).toContain('[REDACTED_SECRET]');
  });
});

describe('Milestone 2: SQLite Persistence & Migrations (ADR-008)', () => {
  let db: StratosDatabase;

  beforeEach(async () => {
    db = new StratosDatabase(':memory:');
    await db.initialize();
  });

  it('runs schema migrations and seeds default pricing snapshots', () => {
    const pricings = db.listPricing();
    expect(pricings.length).toBeGreaterThan(0);
    const openRouterClaude = pricings.find((p) => p.modelId === 'anthropic/claude-3.5-sonnet');
    expect(openRouterClaude).toBeDefined();
    expect(openRouterClaude?.inputPricePerMillion).toBe(3.0);
  });

  it('saves, lists, and deletes providers with capabilities', () => {
    db.saveProvider({
      id: 'prov_test_1',
      providerType: 'openrouter',
      name: 'OpenRouter Account 1',
      authType: 'api-key',
      isConnected: true,
      models: ['anthropic/claude-3.5-sonnet'],
      capabilities: { streaming: true, toolCalling: true, usageReporting: true, contextLimit: 128000 },
      createdAt: new Date().toISOString(),
    });

    let list = db.listProviders();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('OpenRouter Account 1');

    db.deleteProvider('prov_test_1');
    list = db.listProviders();
    expect(list.length).toBe(0);
  });

  it('logs requests and computes accurate analytics summary', () => {
    db.insertRequest({
      id: 'req_1',
      correlationId: 'corr_1',
      providerId: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      status: 'completed',
      durationMs: 450,
      inputTokens: 100,
      outputTokens: 50,
      tokenProvenance: 'reported',
      actualCost: 0.00105,
      createdAt: new Date().toISOString(),
    });

    db.insertRequest({
      id: 'req_2',
      correlationId: 'corr_2',
      providerId: 'openrouter',
      modelId: 'anthropic/claude-3.5-sonnet',
      status: 'failed',
      durationMs: 120,
      tokenProvenance: 'unknown',
      errorCategory: 'rate_limit',
      errorMessage: 'Rate limit exceeded (429)',
      createdAt: new Date().toISOString(),
    });

    const requests = db.queryRequests();
    expect(requests.length).toBe(2);

    const analytics = db.getAnalytics();
    expect(analytics.totalRequests).toBe(2);
    expect(analytics.successCount).toBe(1);
    expect(analytics.failureCount).toBe(1);
    expect(analytics.totalInputTokens).toBe(100);
    expect(analytics.totalOutputTokens).toBe(50);
  });

  it('SEC-014: recovers gracefully from corrupted database file without crashing', async () => {
    const corruptDir = join(process.cwd(), '.stratos-test-corrupt-db');
    const corruptDbPath = join(corruptDir, 'stratos.sqlite');
    mkdirSync(corruptDir, { recursive: true });
    writeFileSync(corruptDbPath, 'CORRUPTED_GARBAGE_BYTES_NOT_A_SQLITE_FILE', 'utf-8');

    const recoveredDb = new StratosDatabase(corruptDbPath);
    await expect(recoveredDb.initialize()).resolves.toBeUndefined();

    // Verify it initialized with working tables
    const pricings = recoveredDb.listPricing();
    expect(pricings.length).toBeGreaterThan(0);

    // Clean up
    rmSync(corruptDir, { recursive: true, force: true });
  });
});

describe('Milestone 2: Provider Adapter Contract (ADR-002, PRD 4.2)', () => {
  it('executes normalized request on MockProviderAdapter', async () => {
    const adapter = new MockProviderAdapter();
    const res = await adapter.execute(
      {
        model: 'stratos-mock/test-model',
        messages: [{ role: 'user', content: 'Halo Stratos' }],
      },
      'valid-key'
    );

    expect(res.content).toContain('Halo Stratos');
    expect(res.usage?.promptTokens).toBeGreaterThan(0);
    expect(res.usage?.completionTokens).toBeGreaterThan(0);
    expect(res.usage?.provenance).toBe('reported');
  });

  it('handles auth errors and rate limits with standardized categories', async () => {
    const adapter = new MockProviderAdapter();
    adapter.shouldFailAuth = true;

    await expect(
      adapter.execute({ model: 'test', messages: [{ role: 'user', content: 'test' }] }, 'key')
    ).rejects.toThrow();

    adapter.shouldFailAuth = false;
    adapter.shouldRateLimit = true;

    await expect(
      adapter.execute({ model: 'test', messages: [{ role: 'user', content: 'test' }] }, 'key')
    ).rejects.toThrow();
  });
});

describe('Milestone 2: Local Router Endpoint Security & Execution (SEC-004, SEC-005, ADR-007)', () => {
  let db: StratosDatabase;
  let creds: SecureCredentialStore;
  let router: LocalRouterService;
  let testPort: number;

  beforeEach(async () => {
    db = new StratosDatabase(':memory:');
    await db.initialize();
    creds = new SecureCredentialStore(join(process.cwd(), '.stratos-router-test-creds'));
    router = new LocalRouterService(db, creds);
    // Use an unassigned port for test
    const info = await router.start(20139);
    testPort = info.port;
  });

  afterEach(async () => {
    await router.stop();
    const testDir = join(process.cwd(), '.stratos-router-test-creds');
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('SEC-004 / M2-SEC-001: rejects request without local auth token', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'mock/default', messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(401);
    const json = (await res.json()) as { error?: { message?: string } };
    expect(json.error?.message).toContain('Unauthorized');
  });

  it('SEC-005: rejects request with unexpected or forged Host header', async () => {
    const status = router.getStatus();
    const res = await new Promise<{ statusCode?: number }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: testPort,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${status.localToken}`,
            host: 'evil-rebinding-website.com',
          },
        },
        (res) => resolve(res)
      );
      req.on('error', reject);
      req.write(JSON.stringify({ model: 'mock/default', messages: [{ role: 'user', content: 'hi' }] }));
      req.end();
    });

    expect(res.statusCode).toBe(401);
  });

  it('SEC-004: rejects request with disallowed or untrusted Origin header', async () => {
    const status = router.getStatus();
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.localToken}`,
        Origin: 'http://malicious-website.com',
      },
      body: JSON.stringify({ model: 'mock/default', messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(403);
    const json = (await res.json()) as { error?: { message?: string } };
    expect(json.error?.message).toContain('Disallowed request Origin');
  });

  it('SEC-004: rejects preflight OPTIONS from disallowed Origin', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://evil-attacker.org',
      },
    });

    expect(res.status).toBe(403);
  });

  it('rejects malformed JSON payload with 400 Bad Request', async () => {
    const status = router.getStatus();
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.localToken}`,
      },
      body: '{ malformed json payload...',
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: { message?: string } };
    expect(json.error?.message).toContain('Malformed JSON payload');
  });

  it('M2-PROV-001 & M2-LOG-001: executes authorized request and persists request log', async () => {
    const status = router.getStatus();
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.localToken}`,
      },
      body: JSON.stringify({
        model: 'stratos-mock/test-model',
        messages: [{ role: 'user', content: 'Ping Stratos Router' }],
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    expect(json.choices?.[0]?.message?.content).toContain('Ping Stratos Router');

    // Verify request was logged in database
    const logs = db.queryRequests();
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe('completed');
    expect(logs[0].providerId).toBe('mock');
  });

  it('SEC-004: rejects request with Origin: null explicitly', async () => {
    const status = router.getStatus();
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.localToken}`,
        Origin: 'null',
      },
      body: JSON.stringify({ model: 'mock/default', messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(res.status).toBe(403);
    const json = (await res.json()) as { error?: { message?: string } };
    expect(json.error?.message).toContain('Disallowed request Origin');
  });

  it('SEC-004: generates high-entropy local access token (256-bit)', () => {
    const status = router.getStatus();
    expect(status.localToken.startsWith('stratos-local-')).toBe(true);
    const hex = status.localToken.replace('stratos-local-', '');
    expect(hex.length).toBe(64); // 32 bytes hex = 64 characters
  });

  it('rejects unsupported content type with 415 Unsupported Media Type', async () => {
    const status = router.getStatus();
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        Authorization: `Bearer ${status.localToken}`,
      },
      body: 'plain text body',
    });

    expect(res.status).toBe(415);
  });

  it('SEC-005: guards /health endpoint against spoofed or rebound Host header', async () => {
    const res = await new Promise<{ statusCode?: number }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: testPort,
          path: '/health',
          method: 'GET',
          headers: {
            host: 'attacker-rebinding-domain.com',
          },
        },
        (res) => resolve(res)
      );
      req.on('error', reject);
      req.end();
    });

    expect(res.statusCode).toBe(401);
  });

  it('rejects oversized payload exceeding 5MB with 413 Payload Too Large', async () => {
    const status = router.getStatus();
    const largeContent = 'a'.repeat(5.5 * 1024 * 1024);
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.localToken}`,
      },
      body: JSON.stringify({
        model: 'mock/default',
        messages: [{ role: 'user', content: largeContent }],
      }),
    });

    expect(res.status).toBe(413);
  });
});
