import {
  ProviderAdapter,
  NormalizedChatRequest,
  NormalizedChatResponse,
  StreamChunk,
  ErrorCategory,
} from './types';
import { redactSecrets } from '../credentials';

export class OpenRouterAdapter implements ProviderAdapter {
  public readonly id = 'openrouter';
  public readonly name = 'OpenRouter API';
  private endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(customEndpoint?: string) {
    if (customEndpoint) {
      this.endpoint = customEndpoint;
    }
  }

  private mapHttpStatus(status: number): ErrorCategory {
    if (status === 401 || status === 403) return 'auth_error';
    if (status === 429) return 'rate_limit';
    if (status === 402) return 'quota_exceeded';
    if (status === 400 || status === 422) return 'invalid_request';
    if (status >= 500) return 'network_error';
    return 'unknown';
  }

  public async testConnection(apiKey: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    if (!apiKey) {
      return { success: false, latencyMs: 0, error: 'API key is required' };
    }

    const start = Date.now();
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://stratos.local',
          'X-Title': 'Stratos Desktop',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openrouter/auto',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
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

    const res = await fetch(this.endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://stratos.local',
        'X-Title': 'Stratos Desktop',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
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
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const choice = json.choices?.[0];
    const content = choice?.message?.content || '';

    return {
      content,
      model: json.model || request.model,
      finishReason: choice?.finish_reason || 'stop',
      latencyMs: Date.now() - start,
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

    const res = await fetch(this.endpoint, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://stratos.local',
        'X-Title': 'Stratos Desktop',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
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
      throw new Error('Streaming response body is unavailable');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedContent = '';
    let finalModel = request.model;
    let finalFinishReason = 'stop';

    let isReading = true;
    try {
      while (isReading) {
        const { done, value } = await reader.read();
        if (done) {
          isReading = false;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data.choices?.[0]?.delta?.content || '';
              if (data.model) finalModel = data.model;
              if (data.choices?.[0]?.finish_reason) {
                finalFinishReason = data.choices[0].finish_reason;
              }

              if (delta) {
                accumulatedContent += delta;
                onChunk({
                  contentDelta: delta,
                  model: finalModel,
                  finishReason: finalFinishReason,
                });
              }
            } catch {
              // Ignore malformed partial chunks gracefully
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Estimate token usage if provider stream didn't report final usage chunk
    const promptTokens = Math.max(1, Math.ceil(request.messages.map((m) => m.content).join('').length / 4));
    const completionTokens = Math.max(1, Math.ceil(accumulatedContent.length / 4));

    return {
      content: accumulatedContent,
      model: finalModel,
      finishReason: finalFinishReason,
      latencyMs: Date.now() - start,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        provenance: 'estimated',
      },
    };
  }
}
