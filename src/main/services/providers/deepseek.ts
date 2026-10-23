import {
  ProviderAdapter,
  NormalizedChatRequest,
  NormalizedChatResponse,
  ErrorCategory,
} from './types';
import { redactSecrets } from '../credentials';

export class DeepSeekAdapter implements ProviderAdapter {
  public readonly id = 'deepseek';
  public readonly name = 'DeepSeek API';
  private endpoint = 'https://api.deepseek.com/chat/completions';
  private modelsUrl = 'https://api.deepseek.com/models';

  private mapHttpStatus(status: number): ErrorCategory {
    if (status === 401 || status === 403) return 'auth_error';
    if (status === 429) return 'rate_limit';
    if (status === 402) return 'quota_exceeded';
    if (status >= 500) return 'network_error';
    return 'unknown';
  }

  public async testConnection(apiKey: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    if (!apiKey) return { success: false, latencyMs: 0, error: 'API key DeepSeek wajib diisi' };
    const start = Date.now();
    try {
      const res = await fetch(this.modelsUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        const errorText = await res.text();
        const category = this.mapHttpStatus(res.status);
        return { success: false, latencyMs, error: redactSecrets(`[${category}] HTTP ${res.status}: ${errorText}`, [apiKey]) };
      }
      return { success: true, latencyMs };
    } catch (err: unknown) {
      return { success: false, latencyMs: Date.now() - start, error: redactSecrets(err instanceof Error ? err.message : String(err), [apiKey]) };
    }
  }

  public async execute(request: NormalizedChatRequest, apiKey: string): Promise<NormalizedChatResponse> {
    const start = Date.now();
    const model = request.model.replace(/^deepseek\//i, '') || 'deepseek-chat';

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
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      const category = this.mapHttpStatus(res.status);
      throw new Error(redactSecrets(`HTTP ${res.status} [${category}]: ${errorText}`, [apiKey]));
    }

    const json = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    return {
      content: json.choices?.[0]?.message?.content || '',
      model: json.model || model,
      latencyMs: Date.now() - start,
      finishReason: json.choices?.[0]?.finish_reason || 'stop',
      usage: json.usage ? {
        promptTokens: json.usage.prompt_tokens || 0,
        completionTokens: json.usage.completion_tokens || 0,
        totalTokens: json.usage.total_tokens || 0,
        provenance: 'reported',
      } : undefined,
    };
  }
}
