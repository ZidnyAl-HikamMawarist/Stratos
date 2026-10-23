import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { randomBytes, timingSafeEqual } from 'crypto';
import { RouterInfo, RouterStatus, RequestLogEntry } from '../../shared/types';
import { StratosDatabase } from './database';
import { SecureCredentialStore, redactSecrets } from './credentials';
import { ProviderAdapter, NormalizedChatRequest } from './providers/types';
import { MockProviderAdapter } from './providers/mock';
import { OpenRouterAdapter } from './providers/openrouter';

export class LocalRouterService {
  private server: Server | null = null;
  private status: RouterStatus = 'stopped';
  private port = 20128;
  private host = '127.0.0.1';
  private localToken: string;
  private totalRequests = 0;
  private errorMessage?: string;

  private db: StratosDatabase;
  private credentials: SecureCredentialStore;
  private adapters: Map<string, ProviderAdapter> = new Map();
  private providerCooldowns: Map<string, number> = new Map();

  constructor(db: StratosDatabase, credentials: SecureCredentialStore) {
    this.db = db;
    this.credentials = credentials;
    this.localToken = `stratos-local-${randomBytes(32).toString('hex')}`;

    // Register supported provider adapters
    const mockAdapter = new MockProviderAdapter();
    const openRouterAdapter = new OpenRouterAdapter();
    this.adapters.set(mockAdapter.id, mockAdapter);
    this.adapters.set(openRouterAdapter.id, openRouterAdapter);
  }

  public registerAdapter(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public getStatus(): RouterInfo {
    return {
      status: this.status,
      port: this.port,
      host: this.host,
      localToken: this.localToken,
      totalRequests: this.totalRequests,
      errorMessage: this.errorMessage,
    };
  }

  public async start(preferredPort = 20128): Promise<RouterInfo> {
    if (this.status === 'active' && this.server) {
      return this.getStatus();
    }

    this.status = 'starting';
    this.port = preferredPort;

    return new Promise((resolve) => {
      const srv = createServer((req, res) => this.handleHttpRequest(req, res));
      srv.requestTimeout = 30000;
      srv.headersTimeout = 10000;

      srv.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[Router] Port ${this.port} is in use; trying dynamic fallback port...`);
          // Try dynamic alternate port (M2-PORT-001)
          srv.listen(0, this.host, () => {
            const addr = srv.address();
            this.port = typeof addr === 'object' && addr ? addr.port : preferredPort;
            this.status = 'active';
            this.server = srv;
            console.log(`[Router] Started on fallback loopback port ${this.port}`);
            resolve(this.getStatus());
          });
        } else {
          this.status = 'error';
          this.errorMessage = err.message;
          console.error('[Router] Server error:', err);
          resolve(this.getStatus());
        }
      });

      srv.listen(this.port, this.host, () => {
        this.status = 'active';
        this.server = srv;
        console.log(`[Router] Loopback service active at http://${this.host}:${this.port}`);
        resolve(this.getStatus());
      });
    });
  }

  public async stop(): Promise<RouterInfo> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }
    this.status = 'stopped';
    return this.getStatus();
  }

  private isOriginAllowed(origin: string): boolean {
    if (!origin || origin === 'null') {
      // Explicitly disallow Origin: null and empty origin (SEC-004)
      return false;
    }
    return (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin === 'http://localhost' ||
      origin === 'http://127.0.0.1' ||
      origin.startsWith('file://')
    );
  }

  private validateRequestSecurity(req: IncomingMessage): { authorized: boolean; reason?: string; statusCode?: number } {
    // 1. Validate Origin header (SEC-004: Prevent malicious website origins from reaching loopback)
    const origin = req.headers.origin;
    if (origin && !this.isOriginAllowed(origin)) {
      return { authorized: false, reason: 'Disallowed request Origin (SEC-004)', statusCode: 403 };
    }

    // 2. Validate Host header (SEC-005: Host header confusion & DNS rebinding protection)
    const hostHeader = req.headers.host || '';
    const allowedHosts = [
      `127.0.0.1:${this.port}`,
      `localhost:${this.port}`,
      '127.0.0.1',
      'localhost',
    ];
    if (!allowedHosts.includes(hostHeader.toLowerCase())) {
      return { authorized: false, reason: 'Invalid or disallowed Host header (SEC-005)', statusCode: 401 };
    }

    // 3. Validate Local Access Token (SEC-004: CORS is not authentication; timing-safe verification)
    const authHeader = req.headers.authorization || '';
    const expected = `Bearer ${this.localToken}`;
    const authBuf = Buffer.from(authHeader);
    const expBuf = Buffer.from(expected);
    if (authBuf.length !== expBuf.length || !timingSafeEqual(authBuf, expBuf)) {
      return { authorized: false, reason: 'Unauthorized: missing or invalid local router token', statusCode: 401 };
    }

    return { authorized: true };
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '';
    const method = req.method || 'GET';
    const origin = req.headers.origin;

    // Early Security Gateway 1: Origin Validation (SEC-004)
    if (origin) {
      if (!this.isOriginAllowed(origin)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Disallowed request Origin (SEC-004)', type: 'forbidden' } }));
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Early Security Gateway 2: Host Header Validation (SEC-005) - strictly guard all endpoints including /health
    const hostHeader = req.headers.host || '';
    const allowedHosts = [
      `127.0.0.1:${this.port}`,
      `localhost:${this.port}`,
      '127.0.0.1',
      'localhost',
    ];
    if (!allowedHosts.includes(hostHeader.toLowerCase())) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid or disallowed Host header (SEC-005)', type: 'authentication_error' } }));
      return;
    }

    // Health check endpoint (open for loopback status inspection)
    if (url === '/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '0.1.0', routerStatus: this.status }));
      return;
    }

    // All operational endpoints require strict authentication
    const sec = this.validateRequestSecurity(req);
    if (!sec.authorized) {
      const code = sec.statusCode || 401;
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: sec.reason || 'Unauthorized', type: code === 403 ? 'forbidden' : 'authentication_error' } }));
      return;
    }

    if (url === '/v1/chat/completions' && method === 'POST') {
      await this.handleChatCompletion(req, res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Endpoint not found', type: 'invalid_request_error' } }));
  }

  private async handleChatCompletion(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const correlationId = `req_${randomBytes(8).toString('hex')}`;
    const startTime = Date.now();
    this.totalRequests++;

    // Content-Type validation
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      res.writeHead(415, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Unsupported Media Type: Content-Type must be application/json', type: 'invalid_request_error' } }));
      return;
    }

    const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB payload limit
    let bodyText = '';
    let bodyBytes = 0;
    try {
      for await (const chunk of req) {
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_PAYLOAD_BYTES) {
          req.on('data', () => {});
          req.resume();
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'Payload Too Large: maximum request size is 5MB', type: 'invalid_request_error' } }));
          return;
        }
        bodyText += chunk.toString();
      }
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Error reading request body', type: 'invalid_request_error' } }));
      return;
    }

    let parsedBody: {
      model?: string;
      messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      stream?: boolean;
      temperature?: number;
      max_tokens?: number;
    } = {};

    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Malformed JSON payload', type: 'invalid_request_error' } }));
      return;
    }

    const requestedModel = parsedBody.model || 'mock/default';
    const messages = parsedBody.messages || [];
    const stream = Boolean(parsedBody.stream);

    // Resolve candidates: check combo configuration or single model (ADR-009, M4-FAILOVER-001)
    let candidates: Array<{ providerId: string; modelId: string }> = [];
    const combos = this.db.listCombos();
    const matchingCombo = combos.find((c) => c.name === requestedModel || c.id === requestedModel);

    if (matchingCombo && matchingCombo.candidates.length > 0) {
      candidates = matchingCombo.candidates.map((c) => ({
        providerId: c.providerId,
        modelId: c.modelId,
      }));
    } else {
      let provId = 'openrouter';
      if (requestedModel.startsWith('mock/') || requestedModel.startsWith('stratos-mock/')) {
        provId = 'mock';
      }
      candidates = [{ providerId: provId, modelId: requestedModel }];
    }

    let attemptCount = 0;
    const maxAttempts = Math.min(candidates.length, 3); // Bounded retry: max 3 attempts
    let lastError: Error | null = null;
    let lastCategory = 'unknown';

    for (let i = 0; i < maxAttempts; i++) {
      const candidate = candidates[i];
      attemptCount++;

      // M4-FAILOVER-007: Check provider cooldown
      const cooldownUntil = this.providerCooldowns.get(candidate.providerId);
      if (cooldownUntil && cooldownUntil > Date.now()) {
        console.warn(`[Router] Skipping candidate ${candidate.providerId}/${candidate.modelId}: under cooldown.`);
        continue;
      }

      const adapter = this.adapters.get(candidate.providerId);
      if (!adapter) {
        continue;
      }

      const apiKey = this.credentials.getCredential(candidate.providerId) || (candidate.providerId === 'mock' ? 'mock-key' : '');
      const normalizedReq: NormalizedChatRequest = {
        model: candidate.modelId,
        messages,
        temperature: parsedBody.temperature,
        maxTokens: parsedBody.max_tokens,
        stream,
      };

      try {
        if (stream && adapter.executeStream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });

          try {
            const outcome = await adapter.executeStream(normalizedReq, apiKey, (chunk) => {
              const sseData = JSON.stringify({
                id: correlationId,
                object: 'chat.completion.chunk',
                created: Math.floor(startTime / 1000),
                model: chunk.model || candidate.modelId,
                choices: [{ index: 0, delta: { content: chunk.contentDelta }, finish_reason: chunk.finishReason || null }],
              });
              res.write(`data: ${sseData}\n\n`);
            });

            res.write('data: [DONE]\n\n');
            res.end();

            this.recordLogEntry({
              id: `log_${randomBytes(8).toString('hex')}`,
              correlationId,
              providerId: candidate.providerId,
              modelId: outcome.model,
              status: attemptCount > 1 ? 'rerouted' : 'completed',
              durationMs: Date.now() - startTime,
              latencyMs: outcome.latencyMs,
              inputTokens: outcome.usage?.promptTokens,
              outputTokens: outcome.usage?.completionTokens,
              tokenProvenance: outcome.usage?.provenance || 'estimated',
              createdAt: new Date().toISOString(),
            });
            return;
          } catch (streamErr) {
            // M4-FAILOVER-003: If primary fails mid-stream, mark interrupted, do NOT silently concatenate!
            res.write(`data: ${JSON.stringify({ error: { message: '[INTERRUPTED] Stream disconnected mid-flight', type: 'stream_error' } })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();

            this.recordLogEntry({
              id: `log_${randomBytes(8).toString('hex')}`,
              correlationId,
              providerId: candidate.providerId,
              modelId: candidate.modelId,
              status: 'interrupted',
              durationMs: Date.now() - startTime,
              tokenProvenance: 'unknown',
              errorCategory: 'stream_interrupted',
              errorMessage: (streamErr as Error).message,
              createdAt: new Date().toISOString(),
            });
            return;
          }
        } else {
          const outcome = await adapter.execute(normalizedReq, apiKey);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              id: correlationId,
              object: 'chat.completion',
              created: Math.floor(startTime / 1000),
              model: outcome.model,
              choices: [{ index: 0, message: { role: 'assistant', content: outcome.content }, finish_reason: outcome.finishReason || 'stop' }],
              usage: outcome.usage
                ? {
                    prompt_tokens: outcome.usage.promptTokens,
                    completion_tokens: outcome.usage.completionTokens,
                    total_tokens: outcome.usage.totalTokens,
                  }
                : undefined,
            })
          );

          this.recordLogEntry({
            id: `log_${randomBytes(8).toString('hex')}`,
            correlationId,
            providerId: candidate.providerId,
            modelId: outcome.model,
            status: attemptCount > 1 ? 'rerouted' : 'completed',
            durationMs: Date.now() - startTime,
            latencyMs: outcome.latencyMs,
            inputTokens: outcome.usage?.promptTokens,
            outputTokens: outcome.usage?.completionTokens,
            tokenProvenance: outcome.usage?.provenance || 'reported',
            createdAt: new Date().toISOString(),
          });
          return;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        lastCategory = (err as { category?: string })?.category || 'unknown';

        // M4-FAILOVER-002: Primary auth error -> do NOT rotate indefinitely. Stop immediately.
        if (lastCategory === 'auth_failure') {
          this.recordLogEntry({
            id: `log_${randomBytes(8).toString('hex')}`,
            correlationId,
            providerId: candidate.providerId,
            modelId: candidate.modelId,
            status: 'failed',
            durationMs: Date.now() - startTime,
            tokenProvenance: 'unknown',
            errorCategory: 'auth_failure',
            errorMessage: redactSecrets(lastError.message, this.credentials.getAllKnownSecrets()),
            createdAt: new Date().toISOString(),
          });
          break; // Stop attempt loop
        }

        // M4-FAILOVER-001 & M4-FAILOVER-007: Rate limit (429) -> apply cooldown & record retry event
        if (lastCategory === 'rate_limit') {
          this.providerCooldowns.set(candidate.providerId, Date.now() + 60000); // 60s cooldown
          this.recordLogEntry({
            id: `log_${randomBytes(8).toString('hex')}`,
            correlationId,
            providerId: candidate.providerId,
            modelId: candidate.modelId,
            status: 'retrying',
            durationMs: Date.now() - startTime,
            tokenProvenance: 'unknown',
            errorCategory: 'rate_limit',
            errorMessage: '429 Rate limited. Attempting compatible secondary candidate.',
            createdAt: new Date().toISOString(),
          });
          continue; // Loop continues to next candidate
        }

        // Other errors -> log attempt and try next candidate
        this.recordLogEntry({
          id: `log_${randomBytes(8).toString('hex')}`,
          correlationId,
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          status: 'retrying',
          durationMs: Date.now() - startTime,
          tokenProvenance: 'unknown',
          errorCategory: lastCategory,
          errorMessage: redactSecrets(lastError.message, this.credentials.getAllKnownSecrets()),
          createdAt: new Date().toISOString(),
        });
      }
    }

    // M4-FAILOVER-006: All candidates failed or non-retryable error
    const finalErrorMsg = redactSecrets(
      lastError?.message || 'All provider candidates failed or exhausted attempt limit',
      this.credentials.getAllKnownSecrets()
    );

    if (!res.headersSent) {
      const statusCode = lastCategory === 'auth_failure' ? 401 : 502;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: {
            message: finalErrorMsg,
            type: lastCategory,
            correlation_id: correlationId,
            attempts: attemptCount,
          },
        })
      );
    }
  }

  private recordLogEntry(entry: RequestLogEntry): void {
    try {
      // Calculate estimated cost and value if prices are recorded
      const pricings = this.db.listPricing();
      const pricing = pricings.find((p) => p.providerId === entry.providerId && p.modelId === entry.modelId);

      if (pricing && entry.inputTokens && entry.outputTokens) {
        const cost = (entry.inputTokens * pricing.inputPricePerMillion + entry.outputTokens * pricing.outputPricePerMillion) / 1_000_000;
        if (pricing.isEstimated) {
          entry.referenceValue = Math.round(cost * 10000) / 10000;
        } else {
          entry.actualCost = Math.round(cost * 10000) / 10000;
        }
      }

      this.db.insertRequest(entry);
    } catch (err) {
      console.error('[Router] Failed to record request log in database:', err);
    }
  }
}
