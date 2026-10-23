import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { monaco } from '../monaco-setup';
import { useAppStore } from '../stores/useAppStore';
import {
  WorkspaceFileNode,
  TerminalProcessInfo,
  ProposedDiff,
  AgentSession,
} from '../../../shared/types';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileCode,
  FileText,
  FileJson,
  Save,
  Play,
  Square,
  Terminal,
  AlertTriangle,
  Cpu,
  RefreshCw,
  GitPullRequest,
  Check,
  X,
  Code2,
  FileCheck,
  Sliders,
  FilePlus,
  Search,
  ArrowUp,
  Plus,
  Layers,
  FileDiff,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface OpenTab {
  relativePath: string;
  name: string;
  content: string;
  initialContent: string;
  mtimeMs?: number;
  isDirty: boolean;
}

// Map file extensions to Monaco language identifiers
const getMonacoLanguage = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
    case 'scss':
      return 'css';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'ps1':
      return 'powershell';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'sql':
      return 'sql';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'xml':
      return 'xml';
    default:
      return 'plaintext';
  }
};

// Helper to determine file icon based on filename extension
const getFileIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'ts' || ext === 'tsx') {
    return <FileCode size={14} className="text-sky-400 shrink-0" />;
  }
  if (ext === 'js' || ext === 'jsx') {
    return <FileCode size={14} className="text-amber-400 shrink-0" />;
  }
  if (ext === 'json') {
    return <FileJson size={14} className="text-emerald-400 shrink-0" />;
  }
  if (ext === 'css' || ext === 'scss') {
    return <FileText size={14} className="text-pink-400 shrink-0" />;
  }
  if (ext === 'md' || ext === 'txt') {
    return <FileText size={14} className="text-slate-400 shrink-0" />;
  }
  if (ext === 'html') {
    return <FileCode size={14} className="text-orange-400 shrink-0" />;
  }
  return <FileText size={14} className="text-muted-foreground shrink-0" />;
};

// Recursive File Tree Node Item
interface FileTreeNodeItemProps {
  node: WorkspaceFileNode;
  depth: number;
  expandedPaths: Set<string>;
  activeTabPath: string | null;
  isObsidian: boolean;
  onToggleFolder: (relativePath: string) => void;
  onOpenFile: (node: WorkspaceFileNode) => void;
}

const FileTreeNodeItem: React.FC<FileTreeNodeItemProps> = ({
  node,
  depth,
  expandedPaths,
  activeTabPath,
  isObsidian,
  onToggleFolder,
  onOpenFile,
}) => {
  const isExpanded = expandedPaths.has(node.relativePath);
  const isActive = activeTabPath === node.relativePath;

  if (node.isDirectory) {
    return (
      <div>
        <div
          onClick={() => onToggleFolder(node.relativePath)}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
          className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition select-none text-xs ${
            isObsidian
              ? 'hover:bg-white/5 text-obsidian-muted hover:text-obsidian-text'
              : 'hover:bg-black/5 text-nordic-muted hover:text-nordic-text'
          }`}
        >
          {isExpanded ? (
            <ChevronDown size={13} className="text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-muted-foreground shrink-0" />
          )}
          {isExpanded ? (
            <FolderOpen size={14} className="text-amber-400 shrink-0" />
          ) : (
            <Folder size={14} className="text-amber-400 shrink-0" />
          )}
          <span className="truncate font-medium">{node.name}</span>
        </div>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeNodeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                activeTabPath={activeTabPath}
                isObsidian={isObsidian}
                onToggleFolder={onToggleFolder}
                onOpenFile={onOpenFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onOpenFile(node)}
      style={{ paddingLeft: `${depth * 14 + 18}px` }}
      className={`flex items-center gap-2 py-1 px-1.5 rounded cursor-pointer transition select-none text-xs ${
        isActive
          ? isObsidian
            ? 'bg-blue-600/20 text-sky-400 font-medium'
            : 'bg-blue-50 text-blue-600 font-medium'
          : isObsidian
          ? 'hover:bg-white/5 text-obsidian-muted hover:text-obsidian-text'
          : 'hover:bg-black/5 text-nordic-muted hover:text-nordic-text'
      }`}
    >
      {getFileIcon(node.name)}
      <span className="truncate">{node.name}</span>
    </div>
  );
};

export const WorkspaceScreen: React.FC = () => {
  const { theme, setCurrentScreen, workspaceMode } = useAppStore();
  const isObsidian = theme === 'obsidian';

  // Sidebar visibility & active tab inside IDE sidebar
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'explorer' | 'diffs' | 'terminal'>('explorer');

  // Bottom panel tab & collapse state in IDE
  const [bottomTab, setBottomTab] = useState<'terminal' | 'output' | 'diffs'>('terminal');
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);

  // Workspace filesystem state
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<WorkspaceFileNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);

  // Editor cursor tracking
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });

  // Terminal state
  const [terminalCommand, setTerminalCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalStatus, setTerminalStatus] = useState<string>('idle');
  const [activePid, setActivePid] = useState<number | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const openCodeChatScrollRef = useRef<HTMLDivElement>(null);

  // Agent state
  const [agentSession, setAgentSession] = useState<AgentSession | null>(null);
  const [promptInput, setPromptInput] = useState('');
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);

  // OpenCode interactive pills state
  const [agentModePill, setAgentModePill] = useState<'Build' | 'Plan' | 'Ask'>('Build');
  const [agentPresetPill, setAgentPresetPill] = useState<'Default' | 'Fast' | 'Deep'>('Default');

  // Diff review state & filter
  const [diffs, setDiffs] = useState<ProposedDiff[]>([]);
  const [diffFilter, setDiffFilter] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Save As Modal state
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState('');

  // Router connection state
  const [routerPort, setRouterPort] = useState<number | null>(null);

  // Load initial workspace state
  useEffect(() => {
    loadWorkspace();
    loadDiffs();
    loadAgentSession();
    checkRouterStatus();
  }, []);

  // Auto-scroll terminal output
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Auto-scroll OpenCode chat stream
  useEffect(() => {
    if (openCodeChatScrollRef.current) {
      openCodeChatScrollRef.current.scrollTop = openCodeChatScrollRef.current.scrollHeight;
    }
  }, [agentSession?.messages, isSendingPrompt]);

  const checkRouterStatus = async () => {
    if (!window.stratos?.router) return;
    try {
      const status = await window.stratos.router.getStatus();
      if (status && status.status === 'active') {
        setRouterPort(status.port);
      }
    } catch {
      // Router offline
    }
  };

  const loadWorkspace = async () => {
    if (!window.stratos?.workspace) return;
    try {
      const root = await window.stratos.workspace.getRoot();
      setRootPath(root);
      if (root) {
        const tree = await window.stratos.workspace.getFileTree();
        setFileTree(tree);
      } else {
        setFileTree([]);
      }
    } catch (err) {
      console.error('[Workspace] Failed to load workspace:', err);
    }
  };

  const loadDiffs = async () => {
    if (!window.stratos?.diff) return;
    try {
      const list = await window.stratos.diff.list();
      setDiffs(list);
    } catch (err) {
      console.error('[Workspace] Failed to load diffs:', err);
    }
  };

  const loadAgentSession = async () => {
    if (!window.stratos?.agent) return;
    try {
      const session = await window.stratos.agent.getSession();
      setAgentSession(session);
    } catch (err) {
      console.error('[Workspace] Failed to load agent session:', err);
    }
  };

  const handleSelectRoot = async () => {
    if (!window.stratos?.workspace) return;
    const dirtyTabs = openTabs.filter((t) => t.isDirty);
    if (dirtyTabs.length > 0) {
      if (
        !confirm(
          `Terdapat ${dirtyTabs.length} berkas yang belum disimpan. Berpindah folder akan menutup tab saat ini. Lanjutkan?`
        )
      ) {
        return;
      }
    }

    try {
      const res = await window.stratos.workspace.selectRoot();
      if (res.success && res.rootPath) {
        setRootPath(res.rootPath);
        setOpenTabs([]);
        setActiveTabPath(null);
        const tree = await window.stratos.workspace.getFileTree();
        setFileTree(tree);
        const initialExpanded = new Set<string>();
        tree.forEach((node) => {
          if (node.isDirectory) initialExpanded.add(node.relativePath);
        });
        setExpandedPaths(initialExpanded);
        setStatusMessage(`Workspace root: ${res.rootPath}`);
      }
    } catch (err) {
      setStatusMessage(`Error selecting workspace root: ${(err as Error).message}`);
    }
  };

  const handleToggleFolder = (relativePath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(relativePath)) {
        next.delete(relativePath);
      } else {
        next.add(relativePath);
      }
      return next;
    });
  };

  const handleOpenFile = async (node: WorkspaceFileNode) => {
    if (node.isDirectory) return;

    // Check if tab already open
    const existing = openTabs.find((t) => t.relativePath === node.relativePath);
    if (existing) {
      setActiveTabPath(existing.relativePath);
      return;
    }

    if (!window.stratos?.workspace) return;
    try {
      const res = await window.stratos.workspace.readFile(node.relativePath);
      if (res.success && res.content !== undefined) {
        const newTab: OpenTab = {
          relativePath: node.relativePath,
          name: node.name,
          content: res.content,
          initialContent: res.content,
          mtimeMs: res.mtimeMs,
          isDirty: false,
        };
        setOpenTabs((prev) => [...prev, newTab]);
        setActiveTabPath(node.relativePath);
      } else {
        setStatusMessage(`Gagal membaca berkas: ${res.error}`);
      }
    } catch (err) {
      setStatusMessage(`Error opening file: ${(err as Error).message}`);
    }
  };

  const handleContentChange = (newContent: string) => {
    if (!activeTabPath) return;
    setOpenTabs((prev) =>
      prev.map((t) => {
        if (t.relativePath === activeTabPath) {
          return {
            ...t,
            content: newContent,
            isDirty: newContent !== t.initialContent,
          };
        }
        return t;
      })
    );
  };

  const handleSaveFile = async () => {
    const activeTab = openTabs.find((t) => t.relativePath === activeTabPath);
    if (!activeTab || !window.stratos?.workspace) return;

    try {
      const res = await window.stratos.workspace.writeFile(
        activeTab.relativePath,
        activeTab.content,
        activeTab.mtimeMs
      );

      if (res.success) {
        setOpenTabs((prev) =>
          prev.map((t) =>
            t.relativePath === activeTab.relativePath
              ? { ...t, isDirty: false, initialContent: t.content, mtimeMs: res.mtimeMs }
              : t
          )
        );
        setStatusMessage(`Tersimpan: ${activeTab.relativePath}`);
      } else if (res.conflict) {
        setStatusMessage(`KONFLIK: ${res.error}`);
      } else {
        setStatusMessage(`Gagal menyimpan: ${res.error}`);
      }
    } catch (err) {
      setStatusMessage(`Error writing file: ${(err as Error).message}`);
    }
  };

  const handleSaveAsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeTab = openTabs.find((t) => t.relativePath === activeTabPath);
    if (!activeTab || !saveAsPath.trim() || !window.stratos?.workspace) return;

    try {
      const targetRel = saveAsPath.trim().replace(/\\/g, '/');
      const res = await window.stratos.workspace.writeFile(targetRel, activeTab.content);
      if (res.success) {
        setIsSaveAsOpen(false);
        setSaveAsPath('');
        setStatusMessage(`Berkas tersimpan sebagai: ${targetRel}`);
        loadWorkspace();
        const fileName = targetRel.split('/').pop() || targetRel;
        const newTab: OpenTab = {
          relativePath: targetRel,
          name: fileName,
          content: activeTab.content,
          initialContent: activeTab.content,
          mtimeMs: res.mtimeMs,
          isDirty: false,
        };
        setOpenTabs((prev) => [...prev, newTab]);
        setActiveTabPath(targetRel);
      } else {
        setStatusMessage(`Save As gagal: ${res.error}`);
      }
    } catch (err) {
      setStatusMessage(`Save As error: ${(err as Error).message}`);
    }
  };

  const handleCloseTab = (relPath: string) => {
    const tab = openTabs.find((t) => t.relativePath === relPath);
    if (tab && tab.isDirty) {
      if (!confirm(`Berkas '${tab.name}' memiliki perubahan yang belum disimpan. Yakin ingin menutup tab ini?`)) {
        return;
      }
    }
    setOpenTabs((prev) => prev.filter((t) => t.relativePath !== relPath));
    if (activeTabPath === relPath) {
      const remaining = openTabs.filter((t) => t.relativePath !== relPath);
      setActiveTabPath(remaining.length > 0 ? remaining[0].relativePath : null);
    }
  };

  // Terminal commands execution
  const handleExecuteCommand = async (confirmed = false) => {
    if (!terminalCommand.trim() || !window.stratos?.terminal) return;

    const cmd = terminalCommand;
    setCommandHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setTerminalCommand('');
    setTerminalStatus('running');
    setNeedsConfirmation(false);
    setTerminalOutput((prev) => `${prev}\nPS ${rootPath ? rootPath : 'C:\\Workspace'}> ${cmd}\n`);

    try {
      const res: TerminalProcessInfo = await window.stratos.terminal.execute(
        cmd,
        rootPath || undefined,
        confirmed
      );

      if (res.status === 'needs_confirmation') {
        setNeedsConfirmation(true);
        setTerminalStatus('needs_confirmation');
        setTerminalOutput((prev) => `${prev}[PERINGATAN KEAMANAN] ${res.error}\n`);
        return;
      }

      setActivePid(res.pid || null);
      if (res.output) {
        setTerminalOutput((prev) => `${prev}${res.output}`);
      }
      setTerminalStatus(res.status);
      setTerminalOutput((prev) => `${prev}\n[Command finished with Exit Code: ${res.exitCode}]\n`);
      setActivePid(null);
    } catch (err) {
      setTerminalStatus('error');
      setTerminalOutput((prev) => `${prev}[Execution Error] ${(err as Error).message}\n`);
    }
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExecuteCommand(false);
    } else if (e.key === 'ArrowUp') {
      if (commandHistory.length > 0) {
        e.preventDefault();
        const nextIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIndex);
        setTerminalCommand(commandHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex !== -1) {
        e.preventDefault();
        const nextIndex = historyIndex + 1;
        if (nextIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setTerminalCommand('');
        } else {
          setHistoryIndex(nextIndex);
          setTerminalCommand(commandHistory[nextIndex]);
        }
      }
    }
  };

  const handleStopCommand = async () => {
    if (!activePid || !window.stratos?.terminal) return;
    try {
      await window.stratos.terminal.stop(activePid);
      setTerminalStatus('terminated');
      setTerminalOutput((prev) => `${prev}[Proses dihentikan oleh pengguna]\n`);
      setActivePid(null);
    } catch (err) {
      console.error('[Terminal] Stop error:', err);
    }
  };

  // Agent prompt submission
  const handleSendPrompt = async () => {
    if (!promptInput.trim() || !window.stratos?.agent || isSendingPrompt) return;
    const input = promptInput;
    setPromptInput('');
    setIsSendingPrompt(true);

    try {
      const activeTab = openTabs.find((t) => t.relativePath === activeTabPath);
      // Map mode to IPC contracts ('terminal_agent' or 'ide')
      const targetIpcMode = workspaceMode === 'opencode' ? 'terminal_agent' : 'ide';
      const session = await window.stratos.agent.sendPrompt(
        input,
        targetIpcMode,
        activeTab?.relativePath,
        activeTab?.content
      );
      setAgentSession(session);
      loadDiffs();
    } catch (err) {
      setStatusMessage(`Agent error: ${(err as Error).message}`);
    } finally {
      setIsSendingPrompt(false);
    }
  };

  const handleCancelAgent = async () => {
    if (!window.stratos?.agent) return;
    try {
      await window.stratos.agent.cancelTask();
      loadAgentSession();
      setStatusMessage('Tugas agen dibatalkan.');
    } catch (err) {
      console.error('[Agent] Cancel error:', err);
    }
  };

  const handleApplyDiff = async (diffId: string) => {
    if (!window.stratos?.diff) return;
    try {
      const res = await window.stratos.diff.apply(diffId);
      if (res.success) {
        setStatusMessage(`Diff berhasil diterapkan ke berkas.`);
        loadDiffs();
        loadWorkspace();
        const activeTab = openTabs.find((t) => t.relativePath === activeTabPath);
        if (activeTab && window.stratos.workspace) {
          const updated = await window.stratos.workspace.readFile(activeTab.relativePath);
          if (updated.success && updated.content !== undefined) {
            setOpenTabs((prev) =>
              prev.map((t) =>
                t.relativePath === activeTab.relativePath
                  ? { ...t, content: updated.content!, initialContent: updated.content!, isDirty: false }
                  : t
              )
            );
          }
        }
      } else {
        setStatusMessage(`Gagal menerapkan diff: ${res.error}`);
      }
    } catch (err) {
      setStatusMessage(`Error applying diff: ${(err as Error).message}`);
    }
  };

  const handleRejectDiff = async (diffId: string) => {
    if (!window.stratos?.diff) return;
    try {
      const res = await window.stratos.diff.reject(diffId);
      if (res.success) {
        setStatusMessage(`Usulan diff ditolak. Berkas asli dipertahankan.`);
        loadDiffs();
      }
    } catch (err) {
      setStatusMessage(`Error rejecting diff: ${(err as Error).message}`);
    }
  };

  const activeTab = openTabs.find((t) => t.relativePath === activeTabPath);
  const pendingDiffs = diffs.filter((d) => d.status === 'pending');
  const filteredDiffs = diffs.filter((d) =>
    diffFilter ? d.filePath.toLowerCase().includes(diffFilter.toLowerCase()) : true
  );

  return (
    <div
      className={`flex-1 flex flex-col h-full overflow-hidden select-none font-sans ${
        isObsidian ? 'bg-[#18181b] text-[#f4f4f5]' : 'bg-[#f8fafc] text-[#0f172a]'
      }`}
    >
      {/* Notification Banner */}
      {statusMessage && (
        <div className="bg-sky-500/10 border-b border-sky-500/20 px-4 py-1 text-xs text-sky-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck size={13} />
            <span>{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="hover:text-white">
            <X size={12} />
          </button>
        </div>
      )}

      {/* MAIN VIEWPORT: SWITCH BETWEEN ANTIGRAVITY IDE & OPENCODE INTERPRETER */}
      {workspaceMode === 'ide' ? (
        /* ========================================================================= */
        /* 1. ANTIGRAVITY IDE MODE (Inspired by Antigravity / VS Code Image 2)      */
        /* ========================================================================= */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Slim Activity Bar (48px) */}
          <div
            className={`w-12 border-r flex flex-col items-center justify-between py-2 select-none z-10 ${
              isObsidian
                ? 'bg-[#121214] border-[#27272a] text-[#71717a]'
                : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]'
            }`}
          >
            {/* Top Activity Icons */}
            <div className="flex flex-col items-center space-y-2 w-full">
              {/* Explorer Tab Icon */}
              <button
                onClick={() => {
                  if (activeSidebarTab === 'explorer') {
                    setIsSidebarVisible(!isSidebarVisible);
                  } else {
                    setActiveSidebarTab('explorer');
                    setIsSidebarVisible(true);
                  }
                }}
                className={`w-10 h-10 flex items-center justify-center rounded-md relative transition ${
                  isSidebarVisible && activeSidebarTab === 'explorer'
                    ? isObsidian
                      ? 'text-white bg-[#27272a]'
                      : 'text-blue-600 bg-white shadow-sm'
                    : 'hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title="Penjelajah Berkas (Explorer)"
              >
                <Folder size={18} />
                {isSidebarVisible && activeSidebarTab === 'explorer' && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-blue-500 rounded-r" />
                )}
              </button>

              {/* Source Control / Diffs Review Icon */}
              <button
                onClick={() => {
                  setBottomTab('diffs');
                  setIsBottomCollapsed(false);
                }}
                className={`w-10 h-10 flex items-center justify-center rounded-md relative transition ${
                  bottomTab === 'diffs' && !isBottomCollapsed
                    ? isObsidian
                      ? 'text-white bg-[#27272a]'
                      : 'text-blue-600 bg-white shadow-sm'
                    : 'hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title="Tinjauan Usulan Perubahan File (Diff Review)"
              >
                <GitPullRequest size={18} />
                {pendingDiffs.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-black text-[9px] font-bold flex items-center justify-center">
                    {pendingDiffs.length}
                  </span>
                )}
              </button>

              {/* Integrated PowerShell Terminal Icon */}
              <button
                onClick={() => {
                  setBottomTab('terminal');
                  setIsBottomCollapsed(!isBottomCollapsed);
                }}
                className={`w-10 h-10 flex items-center justify-center rounded-md relative transition ${
                  bottomTab === 'terminal' && !isBottomCollapsed
                    ? isObsidian
                      ? 'text-white bg-[#27272a]'
                      : 'text-blue-600 bg-white shadow-sm'
                    : 'hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5'
                }`}
                title="Integrated Terminal Panel"
              >
                <Terminal size={18} />
              </button>
            </div>

            {/* Bottom Activity Icons */}
            <div className="flex flex-col items-center space-y-2 w-full">
              <button
                onClick={() => setCurrentScreen('settings')}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition"
                title="Pengaturan IDE"
              >
                <Sliders size={18} />
              </button>
            </div>
          </div>

          {/* Collapsible Left Sidebar (Explorer Tree) */}
          {isSidebarVisible && (
            <div
              className={`w-60 border-r flex flex-col overflow-hidden select-none ${
                isObsidian
                  ? 'bg-[#18181b] border-[#27272a]'
                  : 'bg-[#f8fafc] border-[#e2e8f0]'
              }`}
            >
              {/* Explorer Header */}
              <div
                className={`h-9 px-3 border-b flex items-center justify-between text-[11px] font-bold uppercase tracking-wider ${
                  isObsidian ? 'text-[#a1a1aa] border-[#27272a]' : 'text-[#64748b] border-[#e2e8f0]'
                }`}
              >
                <span>Penjelajah Berkas</span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={loadWorkspace}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
                    title="Segarkan Berkas"
                  >
                    <RefreshCw size={12} />
                  </button>
                  <button
                    onClick={() => setIsSidebarVisible(false)}
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
                    title="Sembunyikan Sidebar"
                  >
                    <PanelLeftClose size={12} />
                  </button>
                </div>
              </div>

              {/* Workspace Root Header */}
              {rootPath && (
                <div
                  className={`px-3 py-1.5 border-b flex items-center justify-between text-xs font-semibold ${
                    isObsidian
                      ? 'bg-[#121214] border-[#27272a] text-slate-200'
                      : 'bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <ChevronDown size={14} className="text-muted-foreground shrink-0" />
                    <span className="truncate">{rootPath.split(/[\\/]/).pop()}</span>
                  </div>
                  <button
                    onClick={handleSelectRoot}
                    className="text-[10px] text-sky-400 hover:underline shrink-0"
                  >
                    Ganti
                  </button>
                </div>
              )}

              {/* File Tree Items */}
              <div className="flex-1 overflow-y-auto p-1.5 text-xs">
                {!rootPath ? (
                  <div className="p-4 text-center space-y-3">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Belum ada folder proyek yang dibuka.
                    </p>
                    <button
                      onClick={handleSelectRoot}
                      className="w-full py-1.5 px-3 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <FolderOpen size={13} />
                      <span>Buka Folder Proyek</span>
                    </button>
                  </div>
                ) : fileTree.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-xs">
                    Folder proyek kosong.
                  </div>
                ) : (
                  fileTree.map((node) => (
                    <FileTreeNodeItem
                      key={node.path}
                      node={node}
                      depth={0}
                      expandedPaths={expandedPaths}
                      activeTabPath={activeTabPath}
                      isObsidian={isObsidian}
                      onToggleFolder={handleToggleFolder}
                      onOpenFile={handleOpenFile}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Center Work Area: Monaco Editor + Bottom Tabbed Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tab Bar (VS Code / Antigravity Style) */}
            <div
              className={`h-9 border-b flex items-center overflow-x-auto select-none ${
                isObsidian
                  ? 'bg-[#18181b] border-[#27272a]'
                  : 'bg-[#f1f5f9] border-[#e2e8f0]'
              }`}
            >
              {!isSidebarVisible && (
                <button
                  onClick={() => setIsSidebarVisible(true)}
                  className="px-2 h-full flex items-center border-r hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground hover:text-foreground transition"
                  title="Tampilkan Sidebar File Explorer"
                >
                  <PanelLeftOpen size={14} />
                </button>
              )}

              {openTabs.map((t) => (
                <div
                  key={t.relativePath}
                  onClick={() => setActiveTabPath(t.relativePath)}
                  className={`h-full px-3 flex items-center gap-2 border-r text-xs cursor-pointer select-none transition ${
                    activeTabPath === t.relativePath
                      ? isObsidian
                        ? 'bg-[#1e1e24] text-[#f4f4f5] font-medium border-t-2 border-t-sky-400'
                        : 'bg-white text-[#0f172a] font-medium border-t-2 border-t-blue-600'
                      : isObsidian
                      ? 'text-[#a1a1aa] hover:bg-white/5'
                      : 'text-[#64748b] hover:bg-black/5'
                  }`}
                >
                  {getFileIcon(t.name)}
                  <span className="truncate max-w-[140px]">{t.name}</span>
                  {t.isDirty && (
                    <span className="w-2 h-2 rounded-full bg-amber-400" title="Belum Disimpan" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(t.relativePath);
                    }}
                    className="hover:text-red-400 ml-1 p-0.5 rounded"
                    title="Tutup Tab"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}

              {/* Tab Bar Action Buttons */}
              {activeTab && (
                <div className="ml-auto pr-3 flex items-center space-x-2">
                  <button
                    onClick={() => {
                      setSaveAsPath(activeTab.relativePath);
                      setIsSaveAsOpen(true);
                    }}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                      isObsidian
                        ? 'border-[#27272a] bg-[#121214] hover:text-[#f4f4f5]'
                        : 'border-[#cbd5e1] bg-white hover:text-[#0f172a]'
                    }`}
                    title="Simpan Sebagai..."
                  >
                    <FilePlus size={12} />
                    <span>Simpan Sebagai</span>
                  </button>

                  <button
                    onClick={handleSaveFile}
                    disabled={!activeTab.isDirty}
                    className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium border transition ${
                      activeTab.isDirty
                        ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700 shadow-sm'
                        : 'opacity-40 cursor-not-allowed border-transparent text-muted-foreground'
                    }`}
                    title="Simpan Berkas (Ctrl+S)"
                  >
                    <Save size={12} />
                    <span>Simpan</span>
                  </button>
                </div>
              )}
            </div>

            {/* Breadcrumb Path Bar */}
            {activeTab && (
              <div
                className={`h-6 px-4 border-b flex items-center text-[11px] font-mono select-none ${
                  isObsidian
                    ? 'bg-[#18181b] border-[#27272a] text-[#71717a]'
                    : 'bg-white border-[#e2e8f0] text-[#64748b]'
                }`}
              >
                <span>{rootPath ? rootPath.split(/[\\/]/).pop() : 'Workspace'}</span>
                {activeTab.relativePath.split('/').map((segment, idx) => (
                  <React.Fragment key={idx}>
                    <ChevronRight size={11} className="mx-1 text-muted-foreground" />
                    <span className={idx === activeTab.relativePath.split('/').length - 1 ? 'text-sky-400 font-medium' : ''}>
                      {segment}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Monaco Editor Viewport */}
            <div className="flex-1 flex overflow-hidden bg-black/10">
              {activeTab ? (
                <div className="flex-1 h-full overflow-hidden">
                  <Editor
                    height="100%"
                    path={activeTab.relativePath}
                    language={getMonacoLanguage(activeTab.name)}
                    value={activeTab.content}
                    theme={isObsidian ? 'vs-dark' : 'light'}
                    onChange={(val) => handleContentChange(val || '')}
                    onMount={(editor) => {
                      editor.onDidChangeCursorPosition((e) => {
                        setCursorPos({ line: e.position.lineNumber, col: e.position.column });
                      });
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        handleSaveFile();
                      });
                    }}
                    options={{
                      fontSize: 12.5,
                      fontFamily: 'Consolas, "Fira Code", monospace',
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: 'off',
                      renderLineHighlight: 'all',
                      lineNumbers: 'on',
                      renderWhitespace: 'selection',
                      overviewRulerBorder: false,
                      hideCursorInOverviewRuler: true,
                    }}
                  />
                </div>
              ) : !rootPath ? (
                /* Welcome Screen when no project is opened */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shadow-sm">
                    <Code2 size={28} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold">Stratos IDE Workspace</h2>
                    <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                      Buka folder proyek lokal Anda untuk memulai pengeditan kode dengan Monaco Editor, terminal PowerShell bawaan, dan kolaborasi AI OpenCode.
                    </p>
                  </div>
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={handleSelectRoot}
                      className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-2 shadow-sm transition"
                    >
                      <FolderOpen size={14} />
                      <span>Buka Folder Proyek</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs space-y-2">
                  <FileCode size={40} className="opacity-20" />
                  <span>Pilih berkas dari penjelajah di panel kiri untuk mulai menyunting.</span>
                </div>
              )}
            </div>

            {/* Bottom Developer Panel (Antigravity Style: TERMINAL / OUTPUT / PROBLEMS / DIFFS) */}
            <div
              className={`border-t flex flex-col font-mono text-xs transition-all duration-150 ${
                isBottomCollapsed ? 'h-8' : 'h-52'
              } ${
                isObsidian
                  ? 'bg-[#121214] border-[#27272a] text-[#f4f4f5]'
                  : 'bg-slate-900 border-slate-800 text-emerald-400'
              }`}
            >
              {/* Bottom Panel Tab Header Bar */}
              <div className="px-3 border-b border-white/10 flex items-center justify-between bg-black/40 text-muted-foreground text-[11px] h-8">
                <div className="flex items-center space-x-1 h-full">
                  <button
                    onClick={() => {
                      setBottomTab('terminal');
                      setIsBottomCollapsed(false);
                    }}
                    className={`h-full px-3 flex items-center space-x-1.5 border-b-2 font-medium transition ${
                      bottomTab === 'terminal' && !isBottomCollapsed
                        ? 'border-blue-500 text-foreground bg-white/5'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Terminal size={12} className="text-emerald-400" />
                    <span>TERMINAL</span>
                    <span className="text-[9px] text-zinc-500 font-normal uppercase">
                      ({terminalStatus})
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setBottomTab('diffs');
                      setIsBottomCollapsed(false);
                    }}
                    className={`h-full px-3 flex items-center space-x-1.5 border-b-2 font-medium transition ${
                      bottomTab === 'diffs' && !isBottomCollapsed
                        ? 'border-blue-500 text-foreground bg-white/5'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <GitPullRequest size={12} className="text-amber-400" />
                    <span>DIFF PROPOSALS</span>
                    {pendingDiffs.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[9px] font-bold">
                        {pendingDiffs.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setBottomTab('output');
                      setIsBottomCollapsed(false);
                    }}
                    className={`h-full px-3 flex items-center space-x-1.5 border-b-2 font-medium transition ${
                      bottomTab === 'output' && !isBottomCollapsed
                        ? 'border-blue-500 text-foreground bg-white/5'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Layers size={12} />
                    <span>OUTPUT / LOGS</span>
                  </button>
                </div>

                {/* Right controls: Kill, Clear, Chevron Toggle */}
                <div className="flex items-center space-x-3 text-[11px]">
                  {activePid && (
                    <button
                      onClick={handleStopCommand}
                      className="flex items-center space-x-1 text-red-400 hover:text-red-300 transition"
                    >
                      <Square size={11} />
                      <span>Hentikan (PID: {activePid})</span>
                    </button>
                  )}
                  <button
                    onClick={() => setTerminalOutput('')}
                    className="hover:text-white transition"
                  >
                    Bersihkan
                  </button>
                  <button
                    onClick={() => setIsBottomCollapsed(!isBottomCollapsed)}
                    className="hover:text-white transition p-0.5"
                    title={isBottomCollapsed ? 'Perbesar Panel' : 'Perkecil Panel'}
                  >
                    {isBottomCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                </div>
              </div>

              {/* Bottom Panel Content */}
              {!isBottomCollapsed && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {bottomTab === 'terminal' ? (
                    <>
                      {/* Terminal Output Log */}
                      <div
                        ref={terminalScrollRef}
                        className="flex-1 p-3 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed font-mono text-[11.5px] bg-[#0c0d12] text-slate-200"
                      >
                        {terminalOutput || (
                          <div className="text-zinc-500">
                            Stratos PowerShell Terminal siap. Eksekusi perintah shell atau perkakas build di bawah.
                          </div>
                        )}
                      </div>

                      {/* Confirmation Banner */}
                      {needsConfirmation && (
                        <div className="bg-amber-500/20 border-t border-amber-500/30 px-3 py-1.5 text-[11px] text-amber-300 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                            <span>Perintah berisiko tinggi terdeteksi. Konfirmasi eksekusi terkontrol?</span>
                          </div>
                          <button
                            onClick={() => handleExecuteCommand(true)}
                            className="px-2.5 py-0.5 rounded bg-amber-500 text-black font-semibold hover:bg-amber-400 text-xs"
                          >
                            Lanjutkan Eksekusi
                          </button>
                        </div>
                      )}

                      {/* Terminal Input Box */}
                      <div className="p-2 border-t border-white/10 flex items-center gap-2 bg-[#12131a]">
                        <span className="text-emerald-400 font-bold shrink-0 text-xs">
                          PS {rootPath ? rootPath : 'C:\\Workspace'}&gt;
                        </span>
                        <input
                          type="text"
                          value={terminalCommand}
                          onChange={(e) => setTerminalCommand(e.target.value)}
                          onKeyDown={handleTerminalKeyDown}
                          placeholder="Ketik perintah (contoh: npm test, git status, dir)..."
                          className="flex-1 bg-transparent text-emerald-300 text-xs focus:outline-none font-mono"
                        />
                        <button
                          onClick={() => handleExecuteCommand(false)}
                          className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition text-xs flex items-center gap-1 font-medium"
                        >
                          <Play size={11} />
                          <span>Jalankan</span>
                        </button>
                      </div>
                    </>
                  ) : bottomTab === 'diffs' ? (
                    /* Diffs Review in Bottom Panel */
                    <div className="flex-1 p-3 overflow-y-auto space-y-2 bg-[#121214]">
                      {pendingDiffs.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-xs">
                          Tidak ada usulan perubahan berkas (diff) yang tertunda saat ini.
                        </div>
                      ) : (
                        pendingDiffs.map((d) => (
                          <div
                            key={d.id}
                            className="p-3 rounded border border-amber-500/20 bg-amber-500/5 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-mono font-medium text-foreground">{d.filePath}</span>
                                <p className="text-muted-foreground text-[11px]">{d.summary}</p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleApplyDiff(d.id)}
                                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition text-xs"
                                >
                                  <Check size={12} />
                                  <span>Terapkan</span>
                                </button>
                                <button
                                  onClick={() => handleRejectDiff(d.id)}
                                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition text-xs"
                                >
                                  <X size={12} />
                                  <span>Tolak</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    /* Output / Logs in Bottom Panel */
                    <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-zinc-400 bg-[#0c0d12]">
                      <div>[Stratos IDE] Sesi aktif terhubung ke Router 127.0.0.1:{routerPort || 'standby'}</div>
                      <div>[Monaco Editor] Aktif dengan engine VS Code language services.</div>
                      <div>[Security] Context Isolation: AKTIF | Node Integration: MATI | Sandbox: AKTIF</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. OPENCODE AI MODE (Inspired by OpenCode Interpreter Image 3)            */
        /* ========================================================================= */
        <div className="flex-1 flex overflow-hidden">
          {/* Split 50% Left Pane: OpenCode Chat & Tool Execution Stream */}
          <div
            className={`w-1/2 border-r flex flex-col overflow-hidden ${
              isObsidian
                ? 'bg-[#18181b] border-[#27272a]'
                : 'bg-white border-[#e2e8f0]'
            }`}
          >
            {/* OpenCode Top Conversation Tab Bar */}
            <div
              className={`h-10 px-4 border-b flex items-center justify-between select-none ${
                isObsidian
                  ? 'bg-[#121214] border-[#27272a] text-[#a1a1aa]'
                  : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div
                  className={`flex items-center space-x-2 px-3 py-1 rounded-md text-xs font-medium border ${
                    isObsidian
                      ? 'bg-[#18181b] border-[#27272a] text-white shadow-sm'
                      : 'bg-white border-[#cbd5e1] text-[#0f172a] shadow-sm'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-medium">
                    {agentSession?.title || 'Test conversation'}
                  </span>
                </div>
                <button
                  onClick={loadAgentSession}
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
                  title="Segarkan Sesi"
                >
                  <RefreshCw size={13} className={isSendingPrompt ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Conversation Messages Stream Viewport */}
            <div
              ref={openCodeChatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 text-xs select-text leading-relaxed"
            >
              {/* Initial Friendly Greeting Card */}
              <div className="flex items-start space-x-3 text-muted-foreground">
                <div className="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Sparkles size={14} />
                </div>
                <div className="pt-1">
                  <p className="font-medium text-foreground">
                    Running. What would you like me to do in{' '}
                    <span className="font-mono text-sky-400">{rootPath || 'C:\\Workspace'}</span>?
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Anda dapat meminta saya membaca berkas, menulis fitur, menganalisis bug, atau menjalankan build.
                  </p>
                </div>
              </div>

              {/* Chat Message History */}
              {agentSession?.messages.map((m) => {
                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div
                        className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-xs font-medium ${
                          isObsidian
                            ? 'bg-[#27272a] text-white shadow-sm'
                            : 'bg-slate-200 text-slate-900 shadow-sm'
                        }`}
                      >
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className="flex items-start space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Cpu size={14} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="whitespace-pre-wrap leading-relaxed text-foreground">
                        {m.content}
                      </div>

                      {/* Tool Calls Execution Pills */}
                      {m.toolCalls && m.toolCalls.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {m.toolCalls.map((tc) => (
                            <div
                              key={tc.id}
                              className={`p-2 rounded-lg text-[11px] font-mono border flex items-center justify-between ${
                                isObsidian
                                  ? 'bg-[#121214] border-[#27272a]'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-sky-400">{tc.tool}</span>
                                {tc.args && (
                                  <span className="text-muted-foreground truncate max-w-xs">
                                    {JSON.stringify(tc.args)}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  tc.status === 'completed'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : tc.status === 'rejected' || tc.status === 'cancelled'
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-amber-500/10 text-amber-400 animate-pulse'
                                }`}
                              >
                                {tc.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isSendingPrompt && (
                <div className="flex items-center space-x-2 text-muted-foreground text-xs py-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                  <span>Stratos AI sedang memproses instruksi dan mengevaluasi konteks...</span>
                </div>
              )}
            </div>

            {/* OPENCODE SIGNATURE PROMPT COMPOSER BOX (Inspired by OpenCode Image 3) */}
            <div className="p-4 select-none">
              <div
                className={`rounded-2xl border transition shadow-lg ${
                  isObsidian
                    ? 'bg-[#1e1e24] border-[#2e2e38] focus-within:border-blue-500/60'
                    : 'bg-white border-slate-300 focus-within:border-blue-500 shadow-md'
                }`}
              >
                {/* Active Context Preview Tag */}
                {activeTab && (
                  <div className="px-3 pt-2 text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                    <FileCode size={12} className="text-sky-400 shrink-0" />
                    <span>Konteks berkas: {activeTab.name}</span>
                  </div>
                )}

                {/* Main Textarea */}
                <div className="px-3 pt-2 pb-1">
                  <textarea
                    rows={2}
                    value={promptInput}
                    disabled={isSendingPrompt}
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendPrompt();
                      }
                    }}
                    placeholder="Ask anything, / for commands, @ for context..."
                    className="w-full bg-transparent resize-none outline-none text-xs leading-relaxed placeholder:text-muted-foreground/60 text-foreground"
                  />
                </div>

                {/* Bottom Pill Toolbar: Context +, Build ⌵, Model ⌵, Default ⌵, Send/Stop */}
                <div className="px-3 py-2 flex items-center justify-between border-t border-black/5 dark:border-white/5">
                  <div className="flex items-center space-x-1.5 overflow-x-auto text-xs">
                    {/* + Context Button */}
                    <button
                      onClick={() => {
                        if (activeTab) {
                          setPromptInput((prev) => `${prev} @${activeTab.name} `);
                        } else {
                          handleSelectRoot();
                        }
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition border ${
                        isObsidian
                          ? 'border-[#3f3f46] hover:bg-white/10 text-muted-foreground hover:text-white'
                          : 'border-slate-300 hover:bg-black/5 text-slate-600'
                      }`}
                      title="Tambah konteks (@ berkas atau folder)"
                    >
                      <Plus size={13} />
                    </button>

                    {/* Build ⌵ Mode Pill */}
                    <button
                      onClick={() =>
                        setAgentModePill((prev) =>
                          prev === 'Build' ? 'Plan' : prev === 'Plan' ? 'Ask' : 'Build'
                        )
                      }
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                        isObsidian
                          ? 'bg-[#121214] border-[#2e2e38] text-slate-200 hover:border-slate-600'
                          : 'bg-slate-100 border-slate-300 text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <span>{agentModePill}</span>
                      <ChevronDown size={11} className="text-muted-foreground" />
                    </button>

                    {/* Model Selector Pill */}
                    <button
                      onClick={() => setCurrentScreen('router')}
                      className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border transition ${
                        isObsidian
                          ? 'bg-[#121214] border-[#2e2e38] text-sky-400 hover:border-slate-600'
                          : 'bg-slate-100 border-slate-300 text-blue-600 hover:border-slate-400'
                      }`}
                      title="Ubah Model di Router AI"
                    >
                      <Sparkles size={11} />
                      <span className="truncate max-w-[120px]">
                        {routerPort ? `Router :${routerPort}` : 'OpenRouter Auto'}
                      </span>
                      <ChevronDown size={11} className="text-muted-foreground" />
                    </button>

                    {/* Preset Pill */}
                    <button
                      onClick={() =>
                        setAgentPresetPill((prev) =>
                          prev === 'Default' ? 'Fast' : prev === 'Fast' ? 'Deep' : 'Default'
                        )
                      }
                      className={`flex items-center space-x-1 px-2 py-1 rounded-full text-[11px] border transition ${
                        isObsidian
                          ? 'bg-[#121214] border-[#2e2e38] text-slate-300'
                          : 'bg-slate-100 border-slate-300 text-slate-700'
                      }`}
                    >
                      <span>{agentPresetPill}</span>
                      <ChevronDown size={11} className="text-muted-foreground" />
                    </button>
                  </div>

                  {/* Circular Submit Button ↑ (Turns into Square ■ when running) */}
                  {isSendingPrompt ? (
                    <button
                      onClick={handleCancelAgent}
                      className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition shadow-sm"
                      title="Batalkan Eksekusi AI"
                    >
                      <Square size={12} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSendPrompt}
                      disabled={!promptInput.trim()}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow-sm ${
                        promptInput.trim()
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-zinc-700/40 text-zinc-400 cursor-not-allowed'
                      }`}
                      title="Kirim Instruksi (Enter)"
                    >
                      <ArrowUp size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Split 50% Right Pane: OpenCode Review & Git Changes Panel */}
          <div
            className={`w-1/2 flex flex-col overflow-hidden select-none ${
              isObsidian
                ? 'bg-[#121214] text-[#f4f4f5]'
                : 'bg-[#f8fafc] text-[#0f172a]'
            }`}
          >
            {/* Top Review Tab Bar */}
            <div
              className={`h-10 px-4 border-b flex items-center justify-between ${
                isObsidian
                  ? 'bg-[#121214] border-[#27272a]'
                  : 'bg-[#f1f5f9] border-[#e2e8f0]'
              }`}
            >
              <div className="flex items-center space-x-2">
                <div
                  className={`flex items-center space-x-2 px-3 py-1 rounded-md text-xs font-medium border ${
                    isObsidian
                      ? 'bg-[#18181b] border-[#27272a] text-white shadow-sm'
                      : 'bg-white border-[#cbd5e1] text-[#0f172a] shadow-sm'
                  }`}
                >
                  <FileDiff size={14} className="text-amber-400" />
                  <span>Review</span>
                  {pendingDiffs.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[10px] font-bold">
                      {pendingDiffs.length}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sub-Header: Git Changes ⌵ + Filter files... Search Bar */}
            <div
              className={`px-4 py-2 border-b flex items-center justify-between text-xs ${
                isObsidian ? 'border-[#27272a]' : 'border-[#e2e8f0]'
              }`}
            >
              <div className="flex items-center space-x-1.5 font-medium text-muted-foreground">
                <span>Git changes</span>
                <ChevronDown size={12} />
              </div>

              <div className="relative w-52">
                <Search size={12} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  value={diffFilter}
                  onChange={(e) => setDiffFilter(e.target.value)}
                  placeholder="Filter files..."
                  className={`w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border outline-none ${
                    isObsidian
                      ? 'bg-[#18181b] border-[#27272a] text-white placeholder:text-zinc-500'
                      : 'bg-white border-slate-300 text-black placeholder:text-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* Content: Empty State OR Diff Inspector Cards */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredDiffs.length === 0 ? (
                /* Iconic OpenCode Empty State (From Image 3) */
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div
                    className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-muted-foreground ${
                      isObsidian
                        ? 'border-[#27272a] bg-[#18181b]'
                        : 'border-slate-200 bg-slate-100'
                    }`}
                  >
                    <FileText size={24} className="opacity-50" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">No file changes yet</h3>
                    <p className="text-xs text-muted-foreground">
                      Project changes will appear here
                    </p>
                  </div>
                </div>
              ) : (
                /* Populated State with Interactive Diff Cards */
                <div className="space-y-3">
                  {filteredDiffs.map((d) => (
                    <div
                      key={d.id}
                      className={`p-3.5 rounded-xl border text-xs space-y-2.5 transition ${
                        d.status === 'accepted'
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : d.status === 'rejected'
                          ? 'border-red-500/20 bg-red-500/5 opacity-60'
                          : isObsidian
                          ? 'border-[#2e2e38] bg-[#18181b] shadow-sm'
                          : 'border-slate-300 bg-white shadow-sm'
                      }`}
                    >
                      {/* Diff File Header */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-mono font-medium text-foreground flex items-center space-x-1.5">
                            {getFileIcon(d.filePath)}
                            <span>{d.filePath}</span>
                          </div>
                          <p className="text-muted-foreground text-[11px]">{d.summary}</p>
                        </div>

                        {/* Status Badge & Actions */}
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                              d.status === 'accepted'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : d.status === 'rejected'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-amber-400/20 text-amber-400'
                            }`}
                          >
                            {d.status}
                          </span>

                          {d.status === 'pending' && (
                            <div className="flex space-x-1.5">
                              <button
                                onClick={() => handleApplyDiff(d.id)}
                                className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center space-x-1 shadow-sm transition"
                                title="Terapkan usulan modifikasi ke berkas proyek"
                              >
                                <Check size={12} />
                                <span>Terapkan</span>
                              </button>
                              <button
                                onClick={() => handleRejectDiff(d.id)}
                                className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-medium transition"
                                title="Tolak perubahan dan pertahankan berkas asli"
                              >
                                <X size={12} />
                                <span>Tolak</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Diff Proposed Lines Preview */}
                      {d.proposedContent && (
                        <div
                          className={`p-2.5 rounded-lg font-mono text-[11px] max-h-36 overflow-y-auto leading-relaxed border select-text ${
                            isObsidian
                              ? 'bg-black/40 border-white/5 text-zinc-300'
                              : 'bg-slate-900 border-slate-800 text-slate-200'
                          }`}
                        >
                          {d.proposedContent.split('\n').slice(0, 20).map((line, idx) => (
                            <div
                              key={idx}
                              className={
                                line.trim().startsWith('+')
                                  ? 'text-emerald-400 bg-emerald-500/10 px-1 rounded-sm'
                                  : line.trim().startsWith('-')
                                  ? 'text-red-400 bg-red-500/10 px-1 rounded-sm'
                                  : 'text-zinc-400'
                              }
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Professional Bottom IDE Status Bar (VS Code Style) */}
      <div
        className={`h-6 px-3 flex items-center justify-between text-[11px] font-mono border-t select-none ${
          isObsidian
            ? 'bg-[#121214] border-[#27272a] text-[#71717a]'
            : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]'
        }`}
      >
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <Folder size={11} className="text-amber-400" />
            <span>{rootPath ? rootPath.split(/[\\/]/).pop() : 'Tidak ada folder'}</span>
          </span>
          <span>UTF-8</span>
          <span>Tab: 2</span>
          {activeTab && (
            <span className="text-sky-400 capitalize">
              {getMonacoLanguage(activeTab.name)}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {activeTab && (
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
          )}
          <span className="flex items-center space-x-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                routerPort ? 'bg-emerald-400' : 'bg-slate-400'
              }`}
            />
            <span>{routerPort ? `Router :${routerPort}` : 'Router Standby'}</span>
          </span>
        </div>
      </div>

      {/* Save As Modal Dialog */}
      {isSaveAsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md p-6 rounded-xl border shadow-xl text-xs space-y-4 ${
              isObsidian
                ? 'bg-[#18181b] border-[#27272a] text-[#f4f4f5]'
                : 'bg-white border-[#cbd5e1] text-[#0f172a]'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Simpan Berkas Sebagai...</h3>
              <button
                onClick={() => setIsSaveAsOpen(false)}
                className="hover:text-red-400 p-1"
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSaveAsSubmit} className="space-y-4">
              <div>
                <label className="block mb-1.5 font-medium text-muted-foreground">
                  Lokasi Relatif Berkas dalam Workspace:
                </label>
                <input
                  type="text"
                  required
                  placeholder="contoh: src/components/NewFile.tsx"
                  value={saveAsPath}
                  onChange={(e) => setSaveAsPath(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border outline-none font-mono ${
                    isObsidian
                      ? 'bg-[#121214] border-[#27272a] text-[#f4f4f5]'
                      : 'bg-slate-50 border-slate-300 text-[#0f172a]'
                  }`}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSaveAsOpen(false)}
                  className="px-4 py-2 rounded-lg border text-muted-foreground hover:text-foreground"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm"
                >
                  Simpan Berkas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
