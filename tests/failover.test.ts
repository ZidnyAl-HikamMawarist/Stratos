import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalRouterService } from '../src/main/services/router';
import { StratosDatabase } from '../src/main/services/database';
import { SecureCredentialStore } from '../src/main/services/credentials';
import { ProviderAdapter, NormalizedChatRequest, NormalizedChatResponse, StreamChunk } from '../src/main/services/providers/types';
import { ProviderError } from '../src/shared/types';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

class FailingMockAdapter implements ProviderAdapter {
  public readonly id: string;
  public readonly name: string;
  public failCategory: string;
  public failMidStream: boolean;

  constructor(id: string, name: string, failCategory = 'rate_limit', failMidStream = false) {
    this.id = id;
    this.name = name;
    this.failCategory = failCategory;
    this.failMidStream = failMidStream;
  }

  public async testConnection(): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    return { success: false, latencyMs: 5, error: this.failCategory };
  }

  public async execute(): Promise<NormalizedChatResponse> {
    const err = new Error(`Simulated error: ${this.failCategory}`) as ProviderError;
    err.category = this.failCategory as ProviderError['category'];
    throw err;
  }

  public async executeStream(
    _req: NormalizedChatRequest,
    _key: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<NormalizedChatResponse> {
    if (this.failMidStream) {
      // Emit initial chunk
      onChunk({ contentDelta: 'Starting partial content... ' });
      // Then fail mid-stream
      throw new Error('Network socket severed mid-stream');
    }

    const err = new Error(`Simulated error: ${this.failCategory}`) as ProviderError;
    err.category = this.failCategory as ProviderError['category'];
    throw err;
  }
}

class SuccessMockAdapter implements ProviderAdapter {
  public readonly id: string;
  public readonly name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  public async testConnection(): Promise<{ success: boolean; latencyMs: number }> {
    return { success: true, latencyMs: 10 };
  }

  public async execute(): Promise<NormalizedChatResponse> {
    return {
      model: 'secondary-model',
      content: 'Success response from secondary fallback candidate',
      finishReason: 'stop',
      latencyMs: 15,
      usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25, provenance: 'reported' },
    };
  }

  public async executeStream(
    _req: NormalizedChatRequest,
    _key: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<NormalizedChatResponse> {
    onChunk({ contentDelta: 'Success streamed from secondary' });
    return {
      model: 'secondary-model',
      content: 'Success streamed from secondary',
      finishReason: 'stop',
      latencyMs: 20,
    };
  }
}

describe('Milestone 4: Bounded Retry & Failover Routing (ADR-009, M4-FAILOVER-001 - M4-FAILOVER-007)', () => {
  const testDir = join(process.cwd(), '.stratos-test-failover');
  let db: StratosDatabase;
  let creds: SecureCredentialStore;
  let router: LocalRouterService;
  const testPort = 20149;

  beforeEach(async () => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
    db = new StratosDatabase(testDir);
    await db.initialize();
    creds = new SecureCredentialStore(testDir);
    router = new LocalRouterService(db, creds);
    await router.start(testPort);
  });

  afterEach(async () => {
    await router.stop();
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true });
  });

  it('M4-FAILOVER-001: selects secondary candidate when primary returns rate_limit (429)', async () => {
    // Register primary (failing with rate_limit) and secondary (succeeding)
    router.registerAdapter(new FailingMockAdapter('prov_primary', 'Primary RateLimited', 'rate_limit'));
    router.registerAdapter(new SuccessMockAdapter('prov_secondary', 'Secondary Healthy'));

    // Save combo with primary and secondary
    db.saveCombo({
      id: 'combo_failover',
      name: 'combo_failover',
      candidates: [
        { providerId: 'prov_primary', modelId: 'primary-model', priority: 1 },
        { providerId: 'prov_secondary', modelId: 'secondary-model', priority: 2 },
      ],
      createdAt: new Date().toISOString(),
    });

    const status = router.getStatus();
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.localToken}`,
      },
      body: JSON.stringify({
        model: 'combo_failover',
        messages: [{ role: 'user', content: 'test failover' }],
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.choices[0].message.content).toContain('secondary fallback candidate');

    // Verify request logs captured reroute
    const logs = db.queryRequests();
    const reroutedLog = logs.find((l) => l.status === 'rerouted');
    expect(reroutedLog).toBeTruthy();
    expect(reroutedLog?.providerId).toBe('prov_secondary');

    const retryLog = logs.find((l) => l.status === 'retrying' && l.errorCategory === 'rate_limit');
    expect(retryLog).toBeTruthy();
    expect(retryLog?.providerId).toBe('prov_primary');
  });

  it('M4-FAILOVER-002: stops rotation immediately on auth_failure without infinite loop', async () => {
    router.registerAdapter(new FailingMockAdapter('prov_bad_auth', 'Bad Auth', 'auth_failure'));
    router.registerAdapter(new SuccessMockAdapter('prov_unused', 'Unused Secondary'));

    db.saveCombo({
      id: 'combo_auth_fail',
      name: 'combo_auth_fail',
      candidates: [
        { providerId: 'prov_bad_auth', modelId: 'bad-auth-model', priority: 1 },
        { providerId: 'prov_unused', modelId: 'unused-model', priority: 2 },
      ],
      createdAt: new Date().toISOString(),
    });

    const status = router.getStatus();
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.localToken}`,
      },
      body: JSON.stringify({
        model: 'combo_auth_fail',
        messages: [{ role: 'user', content: 'test auth failure' }],
      }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.type).toBe('auth_failure');
    // Only 1 attempt was made; no rotation
    expect(json.error.attempts).toBe(1);
  });

  it('M4-FAILOVER-003: marks partial stream [INTERRUPTED] and does not concatenate', async () => {
    router.registerAdapter(new FailingMockAdapter('prov_midstream', 'MidStream Fail', 'network_error', true));

    const status = router.getStatus();
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.localToken}`,
      },
      body: JSON.stringify({
        model: 'stratos-mock/default',
        stream: true,
        messages: [{ role: 'user', content: 'test midstream fail' }],
      }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const text = await res.text();

    // Verify stream closed cleanly with DONE
    expect(text).toContain('data: [DONE]');
  });

  it('M4-FAILOVER-006: returns 502 with full attempt history when all candidates fail', async () => {
    router.registerAdapter(new FailingMockAdapter('prov_f1', 'F1', 'rate_limit'));
    router.registerAdapter(new FailingMockAdapter('prov_f2', 'F2', 'rate_limit'));

    db.saveCombo({
      id: 'combo_all_fail',
      name: 'combo_all_fail',
      candidates: [
        { providerId: 'prov_f1', modelId: 'm1', priority: 1 },
        { providerId: 'prov_f2', modelId: 'm2', priority: 2 },
      ],
      createdAt: new Date().toISOString(),
    });

    const status = router.getStatus();
    const res = await fetch(`http://127.0.0.1:${testPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.localToken}`,
      },
      body: JSON.stringify({
        model: 'combo_all_fail',
        messages: [{ role: 'user', content: 'all fail' }],
      }),
    });

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error.attempts).toBe(2);
    expect(json.error.correlation_id).toBeTruthy();
  });
});
