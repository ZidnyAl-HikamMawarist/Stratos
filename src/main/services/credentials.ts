import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const ALGORITHM = 'aes-256-gcm';
const SALT = 'stratos-local-credentials-salt-v1';

/**
 * Derives a machine-local encryption key.
 */
function getDerivedKey(): Buffer {
  const machineSeed = process.env.COMPUTERNAME || process.env.HOSTNAME || 'stratos-default-host';
  return scryptSync(machineSeed, SALT, 32);
}

/**
 * Masks an API key for safe user display (e.g., 'sk-or-v1-abcdef123456' -> 'sk-or...3456').
 */
export function maskSecret(secret?: string): string {
  if (!secret || typeof secret !== 'string') return '';
  if (secret.length <= 8) return '********';
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}...${suffix}`;
}

/**
 * Redacts secrets from string payloads, logs, or error messages (SEC-006).
 */
export function redactSecrets(content: string, knownSecrets: string[] = []): string {
  if (!content || typeof content !== 'string') return '';
  let sanitized = content;

  // 1. Redact explicit known secrets
  for (const secret of knownSecrets) {
    if (secret && secret.length >= 4) {
      sanitized = sanitized.split(secret).join('[REDACTED_SECRET]');
    }
  }

  // 2. Redact standard Authorization Bearer headers
  sanitized = sanitized.replace(/(Bearer\s+)[A-Za-z0-9_\-./+=]{6,}/gi, '$1[REDACTED_TOKEN]');

  // 3. Redact common AI provider key patterns (sk-..., gsk_..., etc.)
  sanitized = sanitized.replace(/sk-[A-Za-z0-9_-]{16,}/gi, 'sk-[REDACTED]');
  sanitized = sanitized.replace(/gsk_[A-Za-z0-9_-]{16,}/gi, 'gsk-[REDACTED]');

  return sanitized;
}

export class SecureCredentialStore {
  private filePath: string;
  private key: Buffer;
  private memoryCache: Map<string, string> = new Map();

  constructor(customPath?: string) {
    const dir = customPath || (app ? app.getPath('userData') : join(process.cwd(), '.stratos'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.filePath = join(dir, 'credentials.enc');
    this.key = getDerivedKey();
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const fileData = readFileSync(this.filePath);
      if (fileData.length < 28) return; // iv(12) + tag(16) + data
      const iv = fileData.subarray(0, 12);
      const tag = fileData.subarray(12, 28);
      const ciphertext = fileData.subarray(28);

      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const json = JSON.parse(decrypted.toString('utf-8'));
      this.memoryCache = new Map(Object.entries(json));
    } catch {
      console.warn('[CredentialStore] Failed to decrypt credentials store; resetting safe cache.');
      this.memoryCache = new Map();
    }
  }

  private saveToDisk(): void {
    try {
      const obj: Record<string, string> = {};
      for (const [k, v] of this.memoryCache.entries()) {
        obj[k] = v;
      }
      const plain = Buffer.from(JSON.stringify(obj), 'utf-8');
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, this.key, iv);
      const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
      const tag = cipher.getAuthTag();

      const output = Buffer.concat([iv, tag, ciphertext]);
      writeFileSync(this.filePath, output);
    } catch (err) {
      console.error('[CredentialStore] Failed to save encrypted credentials:', err);
    }
  }

  public setCredential(id: string, secret: string): void {
    this.memoryCache.set(id, secret);
    this.saveToDisk();
  }

  public getCredential(id: string): string | undefined {
    return this.memoryCache.get(id);
  }

  public deleteCredential(id: string): boolean {
    const deleted = this.memoryCache.delete(id);
    if (deleted) {
      this.saveToDisk();
    }
    return deleted;
  }

  public getAllKnownSecrets(): string[] {
    return Array.from(this.memoryCache.values());
  }

  public clearAll(): void {
    this.memoryCache.clear();
    this.saveToDisk();
  }
}
