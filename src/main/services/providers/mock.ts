import {
  ProviderAdapter,
  NormalizedChatRequest,
  NormalizedChatResponse,
  StreamChunk,
} from './types';

export class MockProviderAdapter implements ProviderAdapter {
  public readonly id = 'mock';
  public readonly name = 'Stratos Mock Adapter';

  // Configurable behaviors for testing edge cases & error paths
  public shouldFailAuth = false;
  public shouldRateLimit = false;
  public shouldTimeout = false;
  public shouldFailMidStream = false;
  public simulatedLatencyMs = 20;

  public async testConnection(apiKey: string): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    if (this.shouldFailAuth || apiKey === 'invalid-key') {
      return { success: false, latencyMs: 15, error: 'Unauthorized: Invalid API key' };
    }
    return { success: true, latencyMs: 12 };
  }

  public async execute(request: NormalizedChatRequest, apiKey: string): Promise<NormalizedChatResponse> {
    const start = Date.now();

    if (this.shouldFailAuth || apiKey === 'invalid-key') {
      const err = new Error('Authentication failed (401)');
      (err as unknown as { category: string }).category = 'auth_error';
      throw err;
    }

    if (this.shouldRateLimit) {
      const err = new Error('Rate limit exceeded (429)');
      (err as unknown as { category: string }).category = 'rate_limit';
      throw err;
    }

    if (this.shouldTimeout) {
      await new Promise((r) => setTimeout(r, 100));
      const err = new Error('Request timed out');
      (err as unknown as { category: string }).category = 'timeout';
      throw err;
    }

    if (this.simulatedLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.simulatedLatencyMs));
    }

    const promptText = request.messages.map((m) => m.content).join(' ');
    const promptTokens = Math.max(1, Math.ceil(promptText.length / 4));
    const replyContent = `[Mock Response to: "${request.messages[request.messages.length - 1]?.content || ''}"]`;
    const completionTokens = Math.max(1, Math.ceil(replyContent.length / 4));

    return {
      content: replyContent,
      model: request.model || 'stratos-mock/test-model',
      finishReason: 'stop',
      latencyMs: Date.now() - start,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        provenance: 'reported',
      },
    };
  }

  public async executeStream(
    request: NormalizedChatRequest,
    apiKey: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<NormalizedChatResponse> {
    const start = Date.now();

    if (this.shouldFailAuth || apiKey === 'invalid-key') {
      const err = new Error('Authentication failed (401)');
      (err as unknown as { category: string }).category = 'auth_error';
      throw err;
    }

    if (this.shouldRateLimit) {
      const err = new Error('Rate limit exceeded (429)');
      (err as unknown as { category: string }).category = 'rate_limit';
      throw err;
    }

    const words = ['Hello', 'from', 'Stratos', 'stream', 'mock', 'response.'];
    let fullContent = '';

    for (let i = 0; i < words.length; i++) {
      if (this.shouldFailMidStream && i === 3) {
        const err = new Error('Connection closed prematurely mid-stream');
        (err as unknown as { category: string }).category = 'network_error';
        throw err;
      }
      const token = (i === 0 ? '' : ' ') + words[i];
      fullContent += token;
      onChunk({ contentDelta: token });
      await new Promise((r) => setTimeout(r, 10));
    }

    const promptTokens = 12;
    const completionTokens = words.length;

    onChunk({
      contentDelta: '',
      finishReason: 'stop',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        provenance: 'reported',
      },
    });

    return {
      content: fullContent,
      model: request.model || 'stratos-mock/test-model',
      finishReason: 'stop',
      latencyMs: Date.now() - start,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        provenance: 'reported',
      },
    };
  }
}
