export type StratosTheme = 'obsidian' | 'nordic';
export type StratosLocale = 'id-ID' | 'en-US';

export type StratosScreen = 'launcher' | 'workspace' | 'router' | 'settings';

export interface AppMetadata {
  name: string;
  version: string;
  electronVersion: string;
  nodeVersion: string;
  chromeVersion: string;
  platform: string;
  isPackaged: boolean;
  security: {
    contextIsolation: boolean;
    nodeIntegration: boolean;
    sandbox: boolean;
  };
}

export type RouterStatus = 'stopped' | 'starting' | 'active' | 'degraded' | 'error';

export interface RouterInfo {
  status: RouterStatus;
  port: number;
  host: string;
  localToken: string;
  activeComboId?: string;
  totalRequests: number;
  errorMessage?: string;
}

export type ProviderType = 'openrouter' | 'google-ai-studio' | 'groq' | 'deepseek' | 'mock';

export interface ProviderCapabilities {
  streaming: boolean;
  toolCalling: boolean;
  usageReporting: boolean;
  contextLimit: number;
}

export interface ProviderAccount {
  id: string;
  providerType: ProviderType;
  name: string;
  authType: 'api-key';
  isConnected: boolean;
  maskedKey?: string;
  lastTestedAt?: string;
  models: string[];
  capabilities: ProviderCapabilities;
  createdAt: string;
}

export interface ComboCandidate {
  providerId: string;
  modelId: string;
  priority: number;
}

export interface ComboConfig {
  id: string;
  name: string;
  candidates: ComboCandidate[];
  isDefault?: boolean;
  maxAttempts?: number;
  retryCooldownMs?: number;
  createdAt: string;
}

export type RequestOutcome = 'completed' | 'failed' | 'retried' | 'cancelled' | 'rerouted' | 'retrying' | 'interrupted';
export type TokenProvenance = 'reported' | 'estimated' | 'unknown';

export interface ProviderError extends Error {
  category?: 'auth_failure' | 'rate_limit' | 'timeout' | 'context_length_exceeded' | 'network_error' | 'internal_error' | 'stream_error' | string;
  statusCode?: number;
}

export interface RequestLogEntry {
  id: string;
  correlationId: string;
  providerId: string;
  modelId: string;
  status: RequestOutcome;
  durationMs: number;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  tokenProvenance: TokenProvenance;
  actualCost?: number;
  referenceValue?: number;
  errorCategory?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface PricingSnapshot {
  providerId: string;
  modelId: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  currency: string;
  effectiveDate: string;
  source: string;
  isEstimated: boolean;
}

export interface AnalyticsSummary {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  retriedCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  actualCost: number;
  referenceValue: number;
}

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export const IPC_CHANNELS = {
  APP_GET_METADATA: 'app:get-metadata',
  THEME_GET: 'theme:get',
  THEME_SET: 'theme:set',
  LOCALE_GET: 'locale:get',
  LOCALE_SET: 'locale:set',
  SYSTEM_OPEN_EXTERNAL: 'system:open-external',

  // Milestone 2 IPC Channels
  ROUTER_GET_STATUS: 'router:get-status',
  ROUTER_START: 'router:start',
  ROUTER_STOP: 'router:stop',
  PROVIDERS_LIST: 'providers:list',
  PROVIDERS_SAVE: 'providers:save',
  PROVIDERS_TEST: 'providers:test',
  PROVIDERS_DELETE: 'providers:delete',
  COMBOS_LIST: 'combos:list',
  COMBOS_SAVE: 'combos:save',
  COMBOS_DELETE: 'combos:delete',
  LOGS_QUERY: 'logs:query',
  LOGS_CLEAR: 'logs:clear',
  ANALYTICS_GET: 'analytics:get',
  PRICING_GET: 'pricing:get',

  // Milestone 3 IPC Channels
  WORKSPACE_SELECT_ROOT: 'workspace:select-root',
  WORKSPACE_GET_ROOT: 'workspace:get-root',
  WORKSPACE_GET_FILE_TREE: 'workspace:get-file-tree',
  WORKSPACE_READ_FILE: 'workspace:read-file',
  WORKSPACE_WRITE_FILE: 'workspace:write-file',
  TERMINAL_EXECUTE: 'terminal:execute',
  TERMINAL_STOP: 'terminal:stop',
  TERMINAL_LIST_ACTIVE: 'terminal:list-active',
  DIFF_PROPOSE: 'diff:propose',
  DIFF_LIST: 'diff:list',
  DIFF_REVIEW_APPLY: 'diff:review-apply',
  DIFF_REVIEW_REJECT: 'diff:review-reject',
  AGENT_SESSION_GET: 'agent:session-get',
  AGENT_SEND_PROMPT: 'agent:send-prompt',
  AGENT_CANCEL_TASK: 'agent:cancel-task',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];

// Milestone 3 Data Models
export interface WorkspaceFileNode {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  children?: WorkspaceFileNode[];
  size?: number;
  mtimeMs?: number;
}

export interface FileReadResult {
  success: boolean;
  content?: string;
  mtimeMs?: number;
  error?: string;
}

export interface FileWriteResult {
  success: boolean;
  mtimeMs?: number;
  error?: string;
  conflict?: boolean;
}

export interface TerminalProcessInfo {
  pid: number;
  command: string;
  status: 'running' | 'completed' | 'terminated' | 'failed' | 'needs_confirmation';
  exitCode: number | null;
  output: string;
  error?: string;
}

export interface ProposedDiff {
  id: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  summary: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface DiffReviewResult {
  success: boolean;
  applied: boolean;
  error?: string;
}

export interface AgentToolCall {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'running' | 'completed' | 'cancelled' | 'rejected';
  result?: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: AgentToolCall[];
  timestamp: number;
}

export interface AgentSession {
  id: string;
  title: string;
  mode: 'ide' | 'terminal_agent';
  activeModel: string;
  messages: AgentMessage[];
  isRunning: boolean;
}

export interface StratosApi {
  getAppMetadata: () => Promise<AppMetadata>;
  openExternal: (url: string) => Promise<boolean>;
  theme: {
    get: () => Promise<StratosTheme>;
    set: (theme: StratosTheme) => Promise<boolean>;
  };
  locale: {
    get: () => Promise<StratosLocale>;
    set: (locale: StratosLocale) => Promise<boolean>;
  };

  // M2 Router & Dashboard API
  router: {
    getStatus: () => Promise<RouterInfo>;
    start: () => Promise<RouterInfo>;
    stop: () => Promise<RouterInfo>;
  };
  providers: {
    list: () => Promise<ProviderAccount[]>;
    save: (provider: { id?: string; providerType: ProviderType; name: string; apiKey?: string }) => Promise<ProviderAccount>;
    test: (providerId: string, apiKey?: string) => Promise<{ success: boolean; latencyMs: number; error?: string }>;
    delete: (providerId: string) => Promise<boolean>;
  };
  combos: {
    list: () => Promise<ComboConfig[]>;
    save: (combo: Omit<ComboConfig, 'createdAt'>) => Promise<ComboConfig>;
    delete: (comboId: string) => Promise<boolean>;
  };
  logs: {
    query: (filter?: { providerId?: string; status?: RequestOutcome; limit?: number }) => Promise<RequestLogEntry[]>;
    clear: () => Promise<boolean>;
  };
  analytics: {
    get: () => Promise<AnalyticsSummary>;
  };
  pricing: {
    get: () => Promise<PricingSnapshot[]>;
  };

  // M3 Workspace & IDE / Agent API
  workspace: {
    selectRoot: (folderPath?: string) => Promise<{ success: boolean; rootPath: string | null; error?: string }>;
    getRoot: () => Promise<string | null>;
    getFileTree: () => Promise<WorkspaceFileNode[]>;
    readFile: (relativePath: string) => Promise<FileReadResult>;
    writeFile: (relativePath: string, content: string, expectedMtimeMs?: number) => Promise<FileWriteResult>;
  };
  terminal: {
    execute: (command: string, cwd?: string, isHighRiskConfirmed?: boolean) => Promise<TerminalProcessInfo>;
    stop: (pid: number) => Promise<boolean>;
    listActive: () => Promise<TerminalProcessInfo[]>;
  };
  diff: {
    propose: (filePath: string, originalContent: string, proposedContent: string, summary: string) => Promise<ProposedDiff>;
    list: () => Promise<ProposedDiff[]>;
    apply: (diffId: string) => Promise<DiffReviewResult>;
    reject: (diffId: string) => Promise<DiffReviewResult>;
  };
  agent: {
    getSession: () => Promise<AgentSession>;
    sendPrompt: (prompt: string, mode: 'ide' | 'terminal_agent', activeFilePath?: string, activeFileContent?: string) => Promise<AgentSession>;
    cancelTask: () => Promise<boolean>;
  };
}

declare global {
  interface Window {
    stratos?: StratosApi;
  }
}
