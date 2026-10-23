import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  AppMetadata,
  StratosTheme,
  StratosLocale,
  StratosApi,
  RouterInfo,
  ProviderAccount,
  ComboConfig,
  RequestLogEntry,
  AnalyticsSummary,
  PricingSnapshot,
  ProviderType,
} from '../shared/types';

/**
 * Expose narrow, strictly typed APIs to the renderer world (ADR-001, SEC-001, SEC-002).
 * Direct Node.js access is completely disabled.
 */
const api: StratosApi = {
  getAppMetadata: (): Promise<AppMetadata> => {
    return ipcRenderer.invoke(IPC_CHANNELS.APP_GET_METADATA);
  },

  openExternal: (url: string): Promise<boolean> => {
    if (typeof url !== 'string') {
      return Promise.reject(new Error('Invalid URL parameter'));
    }
    return ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, url);
  },

  theme: {
    get: (): Promise<StratosTheme> => {
      return ipcRenderer.invoke(IPC_CHANNELS.THEME_GET);
    },
    set: (theme: StratosTheme): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.THEME_SET, theme);
    },
  },

  locale: {
    get: (): Promise<StratosLocale> => {
      return ipcRenderer.invoke(IPC_CHANNELS.LOCALE_GET);
    },
    set: (locale: StratosLocale): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.LOCALE_SET, locale);
    },
  },

  // Milestone 2 APIs
  router: {
    getStatus: (): Promise<RouterInfo> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ROUTER_GET_STATUS);
    },
    start: (): Promise<RouterInfo> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ROUTER_START);
    },
    stop: (): Promise<RouterInfo> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ROUTER_STOP);
    },
  },

  providers: {
    list: (): Promise<ProviderAccount[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_LIST);
    },
    save: (provider: { id?: string; providerType: ProviderType; name: string; apiKey?: string }): Promise<ProviderAccount> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_SAVE, provider);
    },
    test: (providerId: string, apiKey?: string): Promise<{ success: boolean; latencyMs: number; error?: string }> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_TEST, providerId, apiKey);
    },
    delete: (providerId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PROVIDERS_DELETE, providerId);
    },
  },

  combos: {
    list: (): Promise<ComboConfig[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.COMBOS_LIST);
    },
    save: (combo: Omit<ComboConfig, 'createdAt'>): Promise<ComboConfig> => {
      return ipcRenderer.invoke(IPC_CHANNELS.COMBOS_SAVE, combo);
    },
    delete: (comboId: string): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.COMBOS_DELETE, comboId);
    },
  },

  logs: {
    query: (filter?: { providerId?: string; status?: RequestLogEntry['status']; limit?: number }): Promise<RequestLogEntry[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.LOGS_QUERY, filter);
    },
    clear: (): Promise<boolean> => {
      return ipcRenderer.invoke(IPC_CHANNELS.LOGS_CLEAR);
    },
  },

  analytics: {
    get: (): Promise<AnalyticsSummary> => {
      return ipcRenderer.invoke(IPC_CHANNELS.ANALYTICS_GET);
    },
  },

  pricing: {
    get: (): Promise<PricingSnapshot[]> => {
      return ipcRenderer.invoke(IPC_CHANNELS.PRICING_GET);
    },
  },

  // Milestone 3 Workspace & IDE / Agent APIs
  workspace: {
    selectRoot: (folderPath?: string) => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_SELECT_ROOT, folderPath);
    },
    getRoot: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_ROOT);
    },
    getFileTree: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_GET_FILE_TREE);
    },
    readFile: (relativePath: string) => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_READ_FILE, relativePath);
    },
    writeFile: (relativePath: string, content: string, expectedMtimeMs?: number) => {
      return ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE_WRITE_FILE, relativePath, content, expectedMtimeMs);
    },
  },

  terminal: {
    execute: (command: string, cwd?: string, isHighRiskConfirmed?: boolean) => {
      return ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_EXECUTE, command, cwd, isHighRiskConfirmed);
    },
    stop: (pid: number) => {
      return ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_STOP, pid);
    },
    listActive: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_LIST_ACTIVE);
    },
  },

  diff: {
    propose: (filePath: string, originalContent: string, proposedContent: string, summary: string) => {
      return ipcRenderer.invoke(IPC_CHANNELS.DIFF_PROPOSE, filePath, originalContent, proposedContent, summary);
    },
    list: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.DIFF_LIST);
    },
    apply: (diffId: string) => {
      return ipcRenderer.invoke(IPC_CHANNELS.DIFF_REVIEW_APPLY, diffId);
    },
    reject: (diffId: string) => {
      return ipcRenderer.invoke(IPC_CHANNELS.DIFF_REVIEW_REJECT, diffId);
    },
  },

  agent: {
    getSession: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.AGENT_SESSION_GET);
    },
    sendPrompt: (prompt: string, mode: 'ide' | 'terminal_agent') => {
      return ipcRenderer.invoke(IPC_CHANNELS.AGENT_SEND_PROMPT, prompt, mode);
    },
    cancelTask: () => {
      return ipcRenderer.invoke(IPC_CHANNELS.AGENT_CANCEL_TASK);
    },
  },

  window: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  },
};

contextBridge.exposeInMainWorld('stratos', api);

