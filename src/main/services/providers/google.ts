import {
  ProviderAdapter,
  NormalizedChatRequest,
  NormalizedChatResponse,
  StreamChunk,
  ErrorCategory,
} from './types';
import { redactSecrets } from '../credentials';

export class GoogleAiStudioAdapter implements ProviderAdapter {
  public readonly id = 'google-ai-studio';
  public readonly name = 'Google AI Studio (Gemini)';
  private endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  private validateUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  private mapHttpStatus(status: number): ErrorCategory {
    if (status === 400 || status === 401 || status === 403) return 'auth_error';
    if (status === 429) return 'rate_limit';
    if (status === 402) return 'quota_exceeded';
    if (status >= 500) return 'network_error';
    return 'unknown';
  }

  private normalizeModelName(rawModel: string): string {
    const cleaned = rawModel.replace(/^(google-ai-studio|google)\//i, '').trim();
    if (!cleaned || cleaned === 'default' || cleaned === 'auto') {
      return 'gemini-1.5-flash';
    }
    return cleaned;
  }

  public async testConnection(apiKey: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    if (!apiKey) {
      return { success: false, latencyMs: 0, error: 'API key Google AI Studio wajib diisi' };
    }

    const start = Date.now();
    try {
      // Test key validity against Google API models list endpoint
      const res = await fetch(`${this.validateUrl}?key=${encodeURIComponent(apiKey)}`, {
        method: 'GET',
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errorText = await res.text();
        const category = this.mapHttpStatus(res.status);
        const safeError = redactSecrets(`[${category}] HTTP ${res.status}: ${errorText}`, [apiKey]);
        return { success: false, latencyMs, error: safeError };
      }

      return { success: true, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const safeError = redactSecrets(err instanceof Error ? err.message : String(err), [apiKey]);
      return { success: false, latencyMs, error: safeError };
    }
  }

  public async execute(request: NormalizedChatRequest, apiKey: string): Promise<NormalizedChatResponse> {
    const start = Date.now();
    const model = this.normalizeModelName(request.model);

    const res = await fetch(this.endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      const category = this.mapHttpStatus(res.status);
      const safeMsg = redactSecrets(`HTTP ${res.status} [${category}]: ${errorText}`, [apiKey]);
      const err = new Error(safeMsg);
      (err as unknown as { category: ErrorCategory }).category = category;
      throw err;
    }

    const json = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const latencyMs = Date.now() - start;
    const content = json.choices?.[0]?.message?.content || '';

    return {
      content,
      model: json.model || model,
      latencyMs,
      finishReason: json.choices?.[0]?.finish_reason || 'stop',
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens || 0,
            completionTokens: json.usage.completion_tokens || 0,
            totalTokens: json.usage.total_tokens || 0,
            provenance: 'reported',
          }
        : undefined,
    };
  }

  public async executeStream(
    request: NormalizedChatRequest,
    apiKey: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<NormalizedChatResponse> {
    const start = Date.now();
    const model = this.normalizeModelName(request.model);

    const res = await fetch(this.endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(60000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      const category = this.mapHttpStatus(res.status);
      const safeMsg = redactSecrets(`HTTP ${res.status} [${category}]: ${errorText}`, [apiKey]);
      const err = new Error(safeMsg);
      (err as unknown as { category: ErrorCategory }).category = category;
      throw err;
    }

    if (!res.body) {
      throw new Error('Response body stream is not available');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedContent = '';
    let buffer = '';

    let isStreaming = true;
    try {
      while (isStreaming) {
        const { done, value } = await reader.read();
        if (done) {
          isStreaming = false;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') break;

          if (trimmed.startsWith('data: ')) {
            try {
              const payload = JSON.parse(trimmed.slice(6));
              const delta = payload.choices?.[0]?.delta?.content || '';
              if (delta) {
                accumulatedContent += delta;
                onChunk({ contentDelta: delta, model });
              }
            } catch {
              // Ignore partial JSON parse errors in chunk stream
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const latencyMs = Date.now() - start;
    return {
      content: accumulatedContent,
      model,
      latencyMs,
      finishReason: 'stop',
    };
  }
}
