import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { app } from 'electron';
import {
  ProviderAccount,
  ComboConfig,
  RequestLogEntry,
  PricingSnapshot,
  AnalyticsSummary,
} from '../../shared/types';

export class StratosDatabase {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private filePath?: string;

  constructor(filePath?: string) {
    if (filePath !== ':memory:') {
      const dir = filePath || (app ? app.getPath('userData') : join(process.cwd(), '.stratos'));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      this.filePath = filePath?.endsWith('.sqlite') ? filePath : join(dir, 'stratos.sqlite');
    }
  }

  private static getWasmBinary(): ArrayBuffer | undefined {
    const candidates = [
      join(__dirname, 'sql-wasm.wasm'),
      join(__dirname, '../main/sql-wasm.wasm'),
      join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
      join(process.cwd(), 'dist/main/sql-wasm.wasm'),
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        const buf = readFileSync(p);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      }
    }
    return undefined;
  }

  public async initialize(): Promise<void> {
    const wasmBinary = StratosDatabase.getWasmBinary();
    this.SQL = await initSqlJs(wasmBinary ? { wasmBinary } : undefined);

    const initFresh = () => {
      this.db = new this.SQL!.Database();
      this.runMigrations();
      this.seedDefaultPricing();
      this.persist();
    };

    if (this.filePath && existsSync(this.filePath)) {
      try {
        const fileBuffer = readFileSync(this.filePath);
        this.db = new this.SQL.Database(fileBuffer);
        this.runMigrations();
        this.seedDefaultPricing();
        this.persist();
      } catch (err) {
        console.warn(`[Database] Corrupted SQLite database detected at ${this.filePath}. Backing up and resetting (SEC-014):`, err);
        try {
          const backupPath = `${this.filePath}.corrupted-${Date.now()}-${randomBytes(4).toString('hex')}`;
          copyFileSync(this.filePath, backupPath);
          console.warn(`[Database] Corrupted database backed up to ${backupPath}`);
        } catch (backupErr) {
          console.error(`[Database] Failed to backup corrupted database:`, backupErr);
        }
        initFresh();
      }
    } else {
      initFresh();
    }
  }

  private persist(): void {
    if (!this.db || !this.filePath) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      writeFileSync(this.filePath, buffer);
    } catch (err) {
      console.error('[Database] Failed to persist SQLite data to disk:', err);
    }
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const result = this.db.exec('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1');
    const currentVersion = result.length > 0 && result[0].values.length > 0
      ? (result[0].values[0][0] as number)
      : 0;

    if (currentVersion < 1) {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS providers (
          id TEXT PRIMARY KEY,
          provider_type TEXT NOT NULL,
          name TEXT NOT NULL,
          auth_type TEXT NOT NULL,
          is_connected INTEGER NOT NULL DEFAULT 0,
          last_tested_at TEXT,
          models_json TEXT NOT NULL,
          capabilities_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS combos (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          candidates_json TEXT NOT NULL,
          is_default INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          retry_cooldown_ms INTEGER NOT NULL DEFAULT 5000,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY,
          correlation_id TEXT NOT NULL,
          provider_id TEXT NOT NULL,
          model_id TEXT NOT NULL,
          status TEXT NOT NULL,
          duration_ms INTEGER NOT NULL,
          latency_ms INTEGER,
          input_tokens INTEGER,
          output_tokens INTEGER,
          token_provenance TEXT NOT NULL,
          actual_cost REAL,
          reference_value REAL,
          error_category TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pricing_snapshots (
          id TEXT PRIMARY KEY,
          provider_id TEXT NOT NULL,
          model_id TEXT NOT NULL,
          input_price REAL NOT NULL,
          output_price REAL NOT NULL,
          currency TEXT NOT NULL,
          effective_date TEXT NOT NULL,
          source TEXT NOT NULL,
          is_estimated INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
        CREATE INDEX IF NOT EXISTS idx_requests_provider ON requests(provider_id);

        INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'));
      `);
    }
  }

  private seedDefaultPricing(): void {
    if (!this.db) return;
    const existing = this.db.exec('SELECT count(*) FROM pricing_snapshots');
    const count = existing[0]?.values[0][0] as number;
    if (count === 0) {
      // Seed transparent pricing snapshots from verified public sources (PRD 4.2 & ADR-010)
      this.db.run(`
        INSERT INTO pricing_snapshots (id, provider_id, model_id, input_price, output_price, currency, effective_date, source, is_estimated)
        VALUES
          ('p1', 'openrouter', 'anthropic/claude-3.5-sonnet', 3.00, 15.00, 'USD', '2026-10-01', 'https://openrouter.ai/models', 0),
          ('p2', 'openrouter', 'openai/gpt-4o', 2.50, 10.00, 'USD', '2026-10-01', 'https://openrouter.ai/models', 0),
          ('p3', 'openrouter', 'google/gemini-2.0-flash', 0.10, 0.40, 'USD', '2026-10-01', 'https://openrouter.ai/models', 0),
          ('p4', 'mock', 'stratos-mock/test-model', 0.00, 0.00, 'USD', '2026-10-01', 'local-mock', 1);
      `);
    }
  }

  // --- Providers Methods ---

  public listProviders(): ProviderAccount[] {
    if (!this.db) return [];
    const res = this.db.exec('SELECT * FROM providers ORDER BY created_at DESC');
    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const getVal = (col: string) => row[cols.indexOf(col)];
      return {
        id: getVal('id') as string,
        providerType: getVal('provider_type') as ProviderAccount['providerType'],
        name: getVal('name') as string,
        authType: getVal('auth_type') as 'api-key',
        isConnected: Boolean(getVal('is_connected')),
        lastTestedAt: getVal('last_tested_at') as string | undefined,
        models: JSON.parse(getVal('models_json') as string || '[]'),
        capabilities: JSON.parse(getVal('capabilities_json') as string || '{}'),
        createdAt: getVal('created_at') as string,
      };
    });
  }

  public saveProvider(provider: ProviderAccount): void {
    if (!this.db) return;
    this.db.run(`
      INSERT OR REPLACE INTO providers (
        id, provider_type, name, auth_type, is_connected, last_tested_at, models_json, capabilities_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      provider.id,
      provider.providerType,
      provider.name,
      provider.authType,
      provider.isConnected ? 1 : 0,
      provider.lastTestedAt || null,
      JSON.stringify(provider.models),
      JSON.stringify(provider.capabilities),
      provider.createdAt || new Date().toISOString(),
    ]);
    this.persist();
  }

  public deleteProvider(id: string): boolean {
    if (!this.db) return false;
    this.db.run('DELETE FROM providers WHERE id = ?', [id]);
    this.persist();
    return true;
  }

  // --- Combos Methods ---

  public listCombos(): ComboConfig[] {
    if (!this.db) return [];
    const res = this.db.exec('SELECT * FROM combos ORDER BY is_default DESC, created_at DESC');
    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const getVal = (col: string) => row[cols.indexOf(col)];
      return {
        id: getVal('id') as string,
        name: getVal('name') as string,
        candidates: JSON.parse(getVal('candidates_json') as string || '[]'),
        isDefault: Boolean(getVal('is_default')),
        maxAttempts: getVal('max_attempts') as number,
        retryCooldownMs: getVal('retry_cooldown_ms') as number,
        createdAt: getVal('created_at') as string,
      };
    });
  }

  public saveCombo(combo: ComboConfig): void {
    if (!this.db) return;
    if (combo.isDefault) {
      this.db.run('UPDATE combos SET is_default = 0');
    }
    this.db.run(`
      INSERT OR REPLACE INTO combos (
        id, name, candidates_json, is_default, max_attempts, retry_cooldown_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      combo.id,
      combo.name,
      JSON.stringify(combo.candidates),
      combo.isDefault ? 1 : 0,
      combo.maxAttempts ?? 3,
      combo.retryCooldownMs ?? 60000,
      combo.createdAt || new Date().toISOString(),
    ]);
    this.persist();
  }

  public deleteCombo(id: string): boolean {
    if (!this.db) return false;
    this.db.run('DELETE FROM combos WHERE id = ?', [id]);
    this.persist();
    return true;
  }

  // --- Requests & Logs Methods ---

  public insertRequest(req: RequestLogEntry): void {
    if (!this.db) return;
    this.db.run(`
      INSERT INTO requests (
        id, correlation_id, provider_id, model_id, status, duration_ms, latency_ms,
        input_tokens, output_tokens, token_provenance, actual_cost, reference_value,
        error_category, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.id,
      req.correlationId,
      req.providerId,
      req.modelId,
      req.status,
      req.durationMs ?? 0,
      req.latencyMs ?? null,
      req.inputTokens ?? 0,
      req.outputTokens ?? 0,
      req.tokenProvenance ?? 'unknown',
      req.actualCost ?? 0,
      req.referenceValue ?? 0,
      req.errorCategory ?? null,
      req.errorMessage ?? null,
      req.createdAt || new Date().toISOString(),
    ]);
    this.persist();
  }

  public queryRequests(filter?: { providerId?: string; status?: string; limit?: number }): RequestLogEntry[] {
    if (!this.db) return [];
    let sql = 'SELECT * FROM requests';
    const params: (string | number | null)[] = [];
    const conditions: string[] = [];

    if (filter?.providerId) {
      conditions.push('provider_id = ?');
      params.push(filter.providerId);
    }
    if (filter?.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(filter?.limit || 50);

    const res = this.db.exec(sql, params);
    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const getVal = (col: string) => row[cols.indexOf(col)];
      return {
        id: getVal('id') as string,
        correlationId: getVal('correlation_id') as string,
        providerId: getVal('provider_id') as string,
        modelId: getVal('model_id') as string,
        status: getVal('status') as RequestLogEntry['status'],
        durationMs: getVal('duration_ms') as number,
        latencyMs: getVal('latency_ms') as number | undefined,
        inputTokens: (getVal('input_tokens') as number) || 0,
        outputTokens: (getVal('output_tokens') as number) || 0,
        tokenProvenance: getVal('token_provenance') as RequestLogEntry['tokenProvenance'],
        actualCost: (getVal('actual_cost') as number) || 0,
        referenceValue: (getVal('reference_value') as number) || 0,
        errorCategory: getVal('error_category') as string | undefined,
        errorMessage: getVal('error_message') as string | undefined,
        createdAt: getVal('created_at') as string,
      };
    });
  }

  public clearRequests(): void {
    if (!this.db) return;
    this.db.run('DELETE FROM requests');
    this.persist();
  }

  // --- Pricing & Analytics ---

  public listPricing(): PricingSnapshot[] {
    if (!this.db) return [];
    const res = this.db.exec('SELECT * FROM pricing_snapshots ORDER BY provider_id, model_id');
    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const getVal = (col: string) => row[cols.indexOf(col)];
      return {
        providerId: getVal('provider_id') as string,
        modelId: getVal('model_id') as string,
        inputPricePerMillion: getVal('input_price') as number,
        outputPricePerMillion: getVal('output_price') as number,
        currency: getVal('currency') as string,
        effectiveDate: getVal('effective_date') as string,
        source: getVal('source') as string,
        isEstimated: Boolean(getVal('is_estimated')),
      };
    });
  }

  public getAnalytics(): AnalyticsSummary {
    if (!this.db) {
      return {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        retriedCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        actualCost: 0,
        referenceValue: 0,
      };
    }

    const res = this.db.exec(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failure,
        SUM(CASE WHEN status = 'retried' THEN 1 ELSE 0 END) as retried,
        SUM(COALESCE(input_tokens, 0)) as total_input,
        SUM(COALESCE(output_tokens, 0)) as total_output,
        SUM(COALESCE(actual_cost, 0)) as total_actual_cost,
        SUM(COALESCE(reference_value, 0)) as total_ref_value
      FROM requests
    `);

    if (res.length === 0 || res[0].values.length === 0) {
      return {
        totalRequests: 0,
        successCount: 0,
        failureCount: 0,
        retriedCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        actualCost: 0,
        referenceValue: 0,
      };
    }

    const row = res[0].values[0];
    return {
      totalRequests: (row[0] as number) || 0,
      successCount: (row[1] as number) || 0,
      failureCount: (row[2] as number) || 0,
      retriedCount: (row[3] as number) || 0,
      totalInputTokens: (row[4] as number) || 0,
      totalOutputTokens: (row[5] as number) || 0,
      actualCost: (row[6] as number) || 0,
      referenceValue: (row[7] as number) || 0,
    };
  }
}
