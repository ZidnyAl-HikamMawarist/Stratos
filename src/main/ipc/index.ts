import { ipcMain, IpcMainInvokeEvent, app, BrowserWindow, dialog } from 'electron';
import {
  IPC_CHANNELS,
  AppMetadata,
  StratosTheme,
  StratosLocale,
  ProviderAccount,
  ComboConfig,
  RequestLogEntry,
  AnalyticsSummary,
  PricingSnapshot,
  RouterInfo,
  WorkspaceFileNode,
  FileReadResult,
  FileWriteResult,
  TerminalProcessInfo,
  ProposedDiff,
  DiffReviewResult,
  AgentSession,
} from '../../shared/types';
import { isSafeExternalUrl, isAuthorizedIpcSender } from '../security';
import { StratosDatabase } from '../services/database';
import { SecureCredentialStore, maskSecret } from '../services/credentials';
import { LocalRouterService } from '../services/router';
import { OpenRouterAdapter } from '../services/providers/openrouter';
import { MockProviderAdapter } from '../services/providers/mock';
import { WorkspaceService } from '../services/workspace';
import { TerminalService } from '../services/terminal';
import { DiffReviewService } from '../services/diff';
import { AgentOrchestrator } from '../services/agent';

let currentTheme: StratosTheme = 'obsidian';
let currentLocale: StratosLocale = 'id-ID';
let primaryWindow: BrowserWindow | null = null;

let database: StratosDatabase;
let credentials: SecureCredentialStore;
let routerService: LocalRouterService;
let workspaceService: WorkspaceService;
let terminalService: TerminalService;
let diffService: DiffReviewService;
let agentOrchestrator: AgentOrchestrator;

/**
 * Initializes backend services and binds dependencies.
 */
export async function initializeServices(): Promise<void> {
  database = new StratosDatabase();
  await database.initialize();

  credentials = new SecureCredentialStore();
  routerService = new LocalRouterService(database, credentials);

  // Initialize M3 Services (First-launch zero-preload, real loopback agent)
  workspaceService = new WorkspaceService();
  terminalService = new TerminalService();
  diffService = new DiffReviewService();
  agentOrchestrator = new AgentOrchestrator(workspaceService, diffService, routerService, credentials);

  // Auto-start loopback router on launch (PRD 4.2)
  await routerService.start(20128);
}

export function cleanupTerminalServices(): void {
  if (terminalService) {
    terminalService.cleanupAllProcesses();
  }
}

export function setPrimaryWindow(win: BrowserWindow | null): void {
  primaryWindow = win;
}

export function validateIpcSender(event: IpcMainInvokeEvent): boolean {
  if (!primaryWindow || primaryWindow.isDestroyed()) {
    return false;
  }
  if (!event.sender || event.sender.isDestroyed()) {
    return false;
  }

  const senderFrame = event.senderFrame;
  if (!senderFrame) {
    return false;
  }

  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  return isAuthorizedIpcSender({
    senderWebContentsId: event.sender.id,
    expectedWebContentsId: primaryWindow.webContents.id,
    isMainFrame: senderFrame.parent === null,
    frameUrl: senderFrame.url,
    isDev,
    devServerUrl,
  });
}

export function registerIpcHandlers(): void {
  // --- M1 Handlers ---
  ipcMain.handle(IPC_CHANNELS.APP_GET_METADATA, async (event): Promise<AppMetadata> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return {
      name: app.getName(),
      version: app.getVersion() || '0.1.0',
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      platform: process.platform,
      isPackaged: app.isPackaged,
      security: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    };
  });

  ipcMain.handle(IPC_CHANNELS.THEME_GET, async (event): Promise<StratosTheme> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return currentTheme;
  });

  ipcMain.handle(IPC_CHANNELS.THEME_SET, async (event, newTheme: unknown): Promise<boolean> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    if (newTheme === 'obsidian' || newTheme === 'nordic') {
      currentTheme = newTheme;
      return true;
    }
    currentTheme = 'obsidian';
    return false;
  });

  ipcMain.handle(IPC_CHANNELS.LOCALE_GET, async (event): Promise<StratosLocale> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return currentLocale;
  });

  ipcMain.handle(IPC_CHANNELS.LOCALE_SET, async (event, newLocale: unknown): Promise<boolean> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    if (newLocale === 'id-ID' || newLocale === 'en-US') {
      currentLocale = newLocale;
      return true;
    }
    currentLocale = 'id-ID';
    return false;
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, async (event, url: unknown): Promise<boolean> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    if (typeof url !== 'string' || !isSafeExternalUrl(url)) {
      throw new Error('Disallowed or malformed URL');
    }
    const { shell } = await import('electron');
    await shell.openExternal(url);
    return true;
  });

  // --- M2 Router Handlers ---
  ipcMain.handle(IPC_CHANNELS.ROUTER_GET_STATUS, async (event): Promise<RouterInfo> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return routerService.getStatus();
  });

  ipcMain.handle(IPC_CHANNELS.ROUTER_START, async (event): Promise<RouterInfo> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return routerService.start();
  });

  ipcMain.handle(IPC_CHANNELS.ROUTER_STOP, async (event): Promise<RouterInfo> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return routerService.stop();
  });

  // --- M2 Provider Management Handlers ---
  ipcMain.handle(IPC_CHANNELS.PROVIDERS_LIST, async (event): Promise<ProviderAccount[]> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    const providers = database.listProviders();
    return providers.map((p) => ({
      ...p,
      maskedKey: maskSecret(credentials.getCredential(p.id)),
    }));
  });

  ipcMain.handle(
    IPC_CHANNELS.PROVIDERS_SAVE,
    async (
      event,
      providerData: { id?: string; providerType: ProviderAccount['providerType']; name: string; apiKey?: string }
    ): Promise<ProviderAccount> => {
      if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');

      const id = providerData.id || `prov_${Date.now()}`;
      if (providerData.apiKey) {
        credentials.setCredential(id, providerData.apiKey.trim());
      }

      // Default models and capabilities per provider type
      let models = ['openrouter/auto', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o'];
      if (providerData.providerType === 'mock') {
        models = ['stratos-mock/test-model', 'stratos-mock/fast-model'];
      }

      const account: ProviderAccount = {
        id,
        providerType: providerData.providerType,
        name: providerData.name,
        authType: 'api-key',
        isConnected: Boolean(providerData.apiKey || credentials.getCredential(id)),
        models,
        capabilities: {
          streaming: true,
          toolCalling: true,
          usageReporting: true,
          contextLimit: 128000,
        },
        createdAt: new Date().toISOString(),
      };

      database.saveProvider(account);
      return {
        ...account,
        maskedKey: maskSecret(credentials.getCredential(id)),
      };
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.PROVIDERS_TEST,
    async (event, providerId: string, testApiKey?: string): Promise<{ success: boolean; latencyMs: number; error?: string }> => {
      if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');

      const key = testApiKey || credentials.getCredential(providerId);
      if (!key) {
        return { success: false, latencyMs: 0, error: 'No API key configured for this provider' };
      }

      const providers = database.listProviders();
      const prov = providers.find((p) => p.id === providerId);
      const adapter = prov?.providerType === 'mock' ? new MockProviderAdapter() : new OpenRouterAdapter();

      const result = await adapter.testConnection(key);

      if (prov) {
        prov.isConnected = result.success;
        prov.lastTestedAt = new Date().toISOString();
        database.saveProvider(prov);
      }

      return result;
    }
  );

  ipcMain.handle(IPC_CHANNELS.PROVIDERS_DELETE, async (event, providerId: string): Promise<boolean> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    credentials.deleteCredential(providerId);
    return database.deleteProvider(providerId);
  });

  // --- M2 Combos Handlers ---
  ipcMain.handle(IPC_CHANNELS.COMBOS_LIST, async (event): Promise<ComboConfig[]> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return database.listCombos();
  });

  ipcMain.handle(IPC_CHANNELS.COMBOS_SAVE, async (event, combo: Omit<ComboConfig, 'createdAt'>): Promise<ComboConfig> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    const fullCombo: ComboConfig = {
      ...combo,
      createdAt: new Date().toISOString(),
    };
    database.saveCombo(fullCombo);
    return fullCombo;
  });

  ipcMain.handle(IPC_CHANNELS.COMBOS_DELETE, async (event, comboId: string): Promise<boolean> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return database.deleteCombo(comboId);
  });

  // --- M2 Logs & Analytics Handlers ---
  ipcMain.handle(
    IPC_CHANNELS.LOGS_QUERY,
    async (event, filter?: { providerId?: string; status?: RequestLogEntry['status']; limit?: number }): Promise<RequestLogEntry[]> => {
      if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
      return database.queryRequests(filter);
    }
  );

  ipcMain.handle(IPC_CHANNELS.LOGS_CLEAR, async (event): Promise<boolean> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    database.clearRequests();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.ANALYTICS_GET, async (event): Promise<AnalyticsSummary> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return database.getAnalytics();
  });

  ipcMain.handle(IPC_CHANNELS.PRICING_GET, async (event): Promise<PricingSnapshot[]> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return database.listPricing();
  });

  // --- M3 Workspace Handlers (SEC-008, SEC-009, M3-WS-001, M3-WS-002, M3-WS-003) ---
  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_SELECT_ROOT,
    async (event, folderPath?: string): Promise<{ success: boolean; rootPath: string | null; error?: string }> => {
      if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');

      if (folderPath) {
        const res = workspaceService.setRoot(folderPath);
        if (res.success && res.rootPath) {
          terminalService.setDefaultCwd(res.rootPath);
        }
        return res;
      }

      if (primaryWindow && dialog) {
        const dialogRes = await dialog.showOpenDialog(primaryWindow, {
          properties: ['openDirectory', 'createDirectory'],
          title: 'Select Workspace Root Directory',
        });
        if (!dialogRes.canceled && dialogRes.filePaths.length > 0) {
          const selected = dialogRes.filePaths[0];
          const res = workspaceService.setRoot(selected);
          if (res.success && res.rootPath) {
            terminalService.setDefaultCwd(res.rootPath);
          }
          return res;
        }
      }

      return { success: true, rootPath: workspaceService.getRoot() };
    }
  );

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_ROOT, async (event): Promise<string | null> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return workspaceService.getRoot();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_GET_FILE_TREE, async (event): Promise<WorkspaceFileNode[]> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return workspaceService.getFileTree();
  });

  ipcMain.handle(IPC_CHANNELS.WORKSPACE_READ_FILE, async (event, relativePath: string): Promise<FileReadResult> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return workspaceService.readFile(relativePath);
  });

  ipcMain.handle(
    IPC_CHANNELS.WORKSPACE_WRITE_FILE,
    async (event, relativePath: string, content: string, expectedMtimeMs?: number): Promise<FileWriteResult> => {
      if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
      return workspaceService.writeFile(relativePath, content, expectedMtimeMs);
    }
  );

  // --- M3 Terminal Handlers (SEC-015, M3-TERM-001, M3-TERM-002) ---
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_EXECUTE,
    async (event, command: string, cwd?: string, isHighRiskConfirmed?: boolean): Promise<TerminalProcessInfo> => {
      if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
      return terminalService.executeCommand(command, cwd, isHighRiskConfirmed);
    }
  );

  ipcMain.handle(IPC_CHANNELS.TERMINAL_STOP, async (event, pid: number): Promise<boolean> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return terminalService.stopProcess(pid);
  });

  ipcMain.handle(IPC_CHANNELS.TERMINAL_LIST_ACTIVE, async (event): Promise<TerminalProcessInfo[]> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return terminalService.listActive();
  });

  // --- M3 Diff Review Handlers (M3-DIFF-001, M3-DIFF-002) ---
  ipcMain.handle(
    IPC_CHANNELS.DIFF_PROPOSE,
    async (event, filePath: string, originalContent: string, proposedContent: string, summary: string): Promise<ProposedDiff> => {
      if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
      return diffService.proposeDiff(filePath, originalContent, proposedContent, summary);
    }
  );

  ipcMain.handle(IPC_CHANNELS.DIFF_LIST, async (event): Promise<ProposedDiff[]> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return diffService.listDiffs();
  });

  ipcMain.handle(IPC_CHANNELS.DIFF_REVIEW_APPLY, async (event, diffId: string): Promise<DiffReviewResult> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return diffService.applyDiff(diffId, workspaceService);
  });

  ipcMain.handle(IPC_CHANNELS.DIFF_REVIEW_REJECT, async (event, diffId: string): Promise<DiffReviewResult> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return diffService.rejectDiff(diffId);
  });

  // --- M3 Agent Handlers (M3-AGENT-001, M3-AGENT-002, ADR-004) ---
  ipcMain.handle(IPC_CHANNELS.AGENT_SESSION_GET, async (event): Promise<AgentSession> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return agentOrchestrator.getSession();
  });

  ipcMain.handle(
    IPC_CHANNELS.AGENT_SEND_PROMPT,
    async (event, prompt: string, mode: 'ide' | 'terminal_agent'): Promise<AgentSession> => {
      if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
      return agentOrchestrator.sendPrompt(prompt, mode);
    }
  );

  ipcMain.handle(IPC_CHANNELS.AGENT_CANCEL_TASK, async (event): Promise<boolean> => {
    if (!validateIpcSender(event)) throw new Error('Unauthorized IPC sender');
    return agentOrchestrator.cancelTask();
  });
}
