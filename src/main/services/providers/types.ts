export type ErrorCategory =
  | 'auth_error'
  | 'rate_limit'
  | 'quota_exceeded'
  | 'network_error'
  | 'invalid_request'
  | 'timeout'
  | 'cancelled'
  | 'unknown';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NormalizedChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  provenance: 'reported' | 'estimated';
}

export interface NormalizedChatResponse {
  content: string;
  model: string;
  usage?: TokenUsage;
  finishReason?: string;
  latencyMs?: number;
}

export interface StreamChunk {
  contentDelta: string;
  model?: string;
  finishReason?: string;
  usage?: TokenUsage;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  testConnection(apiKey: string): Promise<{ success: boolean; latencyMs: number; error?: string }>;
  execute(request: NormalizedChatRequest, apiKey: string): Promise<NormalizedChatResponse>;
  executeStream?(
    request: NormalizedChatRequest,
    apiKey: string,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<NormalizedChatResponse>;
}
