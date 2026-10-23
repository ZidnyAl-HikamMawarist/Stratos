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
  FileCode,
  FileText,
  FileJson,
  Save,
  Play,
  Square,
  Terminal,
  Send,
  AlertTriangle,
  Layout,
  Cpu,
  RefreshCw,
  GitPullRequest,
  Check,
  X,
  Code2,
  FileCheck,
  Sliders,
  ChevronUp,
  FilePlus,
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
            <FolderOpen size={14} className="text-sky-400 shrink-0" />
          ) : (
            <Folder size={14} className="text-sky-400 shrink-0" />
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
            ? 'bg-obsidian-elevated text-sky-400 font-medium'
            : 'bg-nordic-elevated text-sky-600 font-medium'
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
  const { theme, setCurrentScreen } = useAppStore();
  const isObsidian = theme === 'obsidian';

  // Workspace state
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<WorkspaceFileNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [mode, setMode] = useState<'ide' | 'terminal_agent'>('ide');

  // Editor cursor tracking & bottom panel visibility
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);

  // Terminal state
  const [terminalCommand, setTerminalCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [terminalOutput, setTerminalOutput] = useState('');
  const [terminalStatus, setTerminalStatus] = useState<string>('idle');
  const [activePid, setActivePid] = useState<number | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  // Agent state
  const [agentSession, setAgentSession] = useState<AgentSession | null>(null);
  const [promptInput, setPromptInput] = useState('');
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);

  // Diff review state
  const [diffs, setDiffs] = useState<ProposedDiff[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Save As Modal state
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState('');

  // Router connection state for honest status
  const [routerPort, setRouterPort] = useState<number | null>(null);

  // Load initial workspace state
  useEffect(() => {
    loadWorkspace();
    loadDiffs();
    loadAgentSession();
    checkRouterStatus();
  }, []);

  // Auto-scroll terminal output to bottom
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalOutput]);

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
        // Open the newly saved file in a new tab
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
    setTerminalOutput((prev) => `${prev}\nPS ${rootPath ? rootPath.split(/[\\/]/).pop() : '~'}> ${cmd}\n`);

    try {
      const res: TerminalProcessInfo = await window.stratos.terminal.execute(
        cmd,
        rootPath || undefined,
        confirmed
      );

      if (res.status === 'needs_confirmation') {
        setNeedsConfirmation(true);
        setTerminalStatus('needs_confirmation');
        setTerminalOutput((prev) => `${prev}[PERINGATAN RISIKO TINGGI] ${res.error}\n`);
        return;
      }

      setActivePid(res.pid || null);
      if (res.output) {
        setTerminalOutput((prev) => `${prev}${res.output}`);
      }
      setTerminalStatus(res.status);
      setTerminalOutput((prev) => `${prev}\n[Selesai dengan Exit Code: ${res.exitCode}]\n`);
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
      const session = await window.stratos.agent.sendPrompt(
        input,
        mode,
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

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none font-sans">
      {/* Top Workspace Header Bar */}
      <div
        className={`h-10 px-4 flex items-center justify-between border-b text-xs ${
          isObsidian
            ? 'bg-obsidian-surface border-obsidian-border text-obsidian-muted'
            : 'bg-nordic-surface border-nordic-border text-nordic-muted'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleSelectRoot}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-medium transition ${
              isObsidian
                ? 'border-obsidian-border bg-obsidian-card hover:text-obsidian-text hover:border-slate-700'
                : 'border-nordic-border bg-nordic-card hover:text-nordic-text'
            }`}
            title="Buka Folder Proyek"
          >
            <FolderOpen size={13} className="text-sky-400" />
            <span>{rootPath ? rootPath.split(/[\\/]/).pop() : 'Buka Folder'}</span>
          </button>
          {rootPath && (
            <span className="font-mono text-[11px] truncate max-w-sm text-obsidian-subtle" title={rootPath}>
              {rootPath}
            </span>
          )}
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2">
          <div
            className={`flex p-0.5 rounded border ${
              isObsidian ? 'bg-obsidian-card border-obsidian-border' : 'bg-nordic-card border-nordic-border'
            }`}
          >
            <button
              onClick={() => setMode('ide')}
              className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                mode === 'ide'
                  ? isObsidian
                    ? 'bg-obsidian-border text-sky-400'
                    : 'bg-nordic-border text-sky-600'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layout size={12} />
              <span>IDE Mode</span>
            </button>
            <button
              onClick={() => setMode('terminal_agent')}
              className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                mode === 'terminal_agent'
                  ? isObsidian
                    ? 'bg-obsidian-border text-emerald-400'
                    : 'bg-nordic-border text-emerald-600'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Cpu size={12} />
              <span>Terminal Agent</span>
            </button>
          </div>

          {agentSession?.isRunning && (
            <button
              onClick={handleCancelAgent}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition text-xs font-medium"
            >
              <Square size={11} />
              <span>Batal</span>
            </button>
          )}
        </div>
      </div>

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

      {/* Main Dual-Mode Viewport */}
      {mode === 'ide' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: File Explorer */}
            <div
              className={`w-64 border-r flex flex-col overflow-hidden ${
                isObsidian
                  ? 'bg-obsidian-bg border-obsidian-border'
                  : 'bg-nordic-bg border-nordic-border'
              }`}
            >
              <div className="p-2.5 border-b flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="text-[11px]">Penjelajah Berkas</span>
                <button
                  onClick={loadWorkspace}
                  className="hover:text-foreground p-1 rounded"
                  title="Segarkan Berkas"
                >
                  <RefreshCw size={12} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-1.5 text-xs">
                {!rootPath ? (
                  <div className="p-4 text-center space-y-3">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Belum ada folder proyek yang dibuka.
                    </p>
                    <button
                      onClick={handleSelectRoot}
                      className="w-full py-1.5 px-3 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center gap-1.5"
                    >
                      <FolderOpen size={13} />
                      <span>Buka Folder</span>
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

            {/* Center Area: Multi-Tab Monaco Code Editor & Diff Review */}
            <div className="flex-1 flex flex-col border-r overflow-hidden">
              {/* Tab Bar */}
              <div
                className={`h-9 border-b flex items-center overflow-x-auto ${
                  isObsidian
                    ? 'bg-obsidian-surface border-obsidian-border'
                    : 'bg-nordic-surface border-nordic-border'
                }`}
              >
                {openTabs.map((t) => (
                  <div
                    key={t.relativePath}
                    onClick={() => setActiveTabPath(t.relativePath)}
                    className={`h-full px-3 flex items-center gap-2 border-r text-xs cursor-pointer select-none transition ${
                      activeTabPath === t.relativePath
                        ? isObsidian
                          ? 'bg-obsidian-bg text-obsidian-text font-medium border-t-2 border-t-sky-400'
                          : 'bg-nordic-bg text-nordic-text font-medium border-t-2 border-t-sky-500'
                        : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5'
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

                {activeTab && (
                  <div className="ml-auto pr-3 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSaveAsPath(activeTab.relativePath);
                        setIsSaveAsOpen(true);
                      }}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                        isObsidian
                          ? 'border-obsidian-border bg-obsidian-card hover:text-obsidian-text'
                          : 'border-nordic-border bg-nordic-card hover:text-nordic-text'
                      }`}
                      title="Simpan Sebagai..."
                    >
                      <FilePlus size={12} />
                      <span>Simpan Sebagai</span>
                    </button>

                    <button
                      onClick={handleSaveFile}
                      disabled={!activeTab.isDirty}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition ${
                        activeTab.isDirty
                          ? 'bg-sky-500 text-white border-sky-400 hover:bg-sky-600 shadow-sm'
                          : 'opacity-50 cursor-not-allowed border-transparent text-muted-foreground'
                      }`}
                      title="Simpan Berkas (Ctrl+S)"
                    >
                      <Save size={12} />
                      <span>Simpan</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Code Editor Viewport Powered by Monaco Editor */}
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
                        fontSize: 12,
                        fontFamily: 'Consolas, "Courier New", monospace',
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
                  /* Welcome Screen when no folder is opened */
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20 flex items-center justify-center">
                      <Code2 size={24} />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold">Ruang Kerja Stratos IDE</h2>
                      <p className="text-xs text-muted-foreground max-w-md">
                        Buka folder proyek lokal Anda untuk memulai penyuntingan berkas dengan Monaco Editor profesional, eksekusi terminal PowerShell, dan peninjauan diff AI.
                      </p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleSelectRoot}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-2 shadow-sm transition"
                      >
                        <FolderOpen size={14} />
                        <span>Buka Folder Proyek</span>
                      </button>
                      <button
                        onClick={() => setCurrentScreen('router')}
                        className={`px-4 py-2 rounded-lg border text-xs font-medium transition flex items-center gap-2 ${
                          isObsidian
                            ? 'bg-obsidian-elevated border-obsidian-border hover:bg-obsidian-border text-obsidian-text'
                            : 'bg-white border-nordic-border hover:bg-slate-100 text-nordic-text'
                        }`}
                      >
                        <Sliders size={14} />
                        <span>Pengaturan Router AI</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-xs space-y-2">
                    <FileCode size={36} className="opacity-25" />
                    <span>Pilih berkas dari penjelajah di panel kiri untuk mulai menyunting.</span>
                  </div>
                )}
              </div>

              {/* Diff Proposal Review Inspector */}
              {diffs.filter((d) => d.status === 'pending').length > 0 && (
                <div
                  className={`h-48 border-t p-3 overflow-y-auto ${
                    isObsidian
                      ? 'bg-obsidian-card border-obsidian-border'
                      : 'bg-nordic-card border-nordic-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                      <GitPullRequest size={14} />
                      <span>Usulan Perubahan File (Diff Review Terverifikasi)</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {diffs.filter((d) => d.status === 'pending').length} usulan pending
                    </span>
                  </div>

                  {diffs
                    .filter((d) => d.status === 'pending')
                    .map((d) => (
                      <div
                        key={d.id}
                        className="p-3 mb-2 rounded border border-amber-500/20 bg-amber-500/5 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-mono font-medium text-foreground">{d.filePath}</div>
                            <div className="text-muted-foreground text-[11px]">{d.summary}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApplyDiff(d.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition text-xs"
                            >
                              <Check size={12} />
                              <span>Terapkan</span>
                            </button>
                            <button
                              onClick={() => handleRejectDiff(d.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition text-xs"
                            >
                              <X size={12} />
                              <span>Tolak</span>
                            </button>
                          </div>
                        </div>

                        {/* Diff proposed content preview */}
                        {d.proposedContent && (
                          <div className="p-2 rounded bg-black/40 font-mono text-[11px] max-h-24 overflow-y-auto leading-relaxed border border-white/5">
                            {d.proposedContent.split('\n').slice(0, 15).map((line, idx) => (
                              <div
                                key={idx}
                                className={
                                  line.trim().startsWith('+') || line.trim().startsWith('export')
                                    ? 'text-emerald-400 bg-emerald-500/10'
                                    : 'text-muted-foreground'
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

            {/* Right Panel: AI Coding Assistant */}
            <div
              className={`w-80 flex flex-col overflow-hidden ${
                isObsidian
                  ? 'bg-obsidian-surface border-obsidian-border'
                  : 'bg-nordic-surface border-nordic-border'
              }`}
            >
              <div className="p-2.5 border-b flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Cpu size={14} className="text-sky-400" />
                  <span>Agent Coding</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {routerPort ? `127.0.0.1:${routerPort}` : 'Zero-Mock'}
                </span>
              </div>

              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
                {agentSession?.messages.length === 0 ? (
                  <div className="text-center py-8 space-y-2 text-muted-foreground">
                    <Cpu size={28} className="mx-auto opacity-30 text-sky-400" />
                    <p className="text-xs">
                      Stratos Agent terhubung ke router AI loopback lokal.
                    </p>
                    <p className="text-[11px] text-obsidian-subtle">
                      Beri instruksi untuk menganalisis kode atau mengusulkan modifikasi berkas.
                    </p>
                  </div>
                ) : (
                  agentSession?.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded text-xs ${
                        m.role === 'user'
                          ? isObsidian
                            ? 'bg-obsidian-card ml-3 border border-obsidian-border'
                            : 'bg-nordic-card ml-3 border border-nordic-border'
                          : 'bg-sky-500/10 mr-3 border border-sky-500/20'
                      }`}
                    >
                      <div className="font-semibold text-[10px] uppercase text-muted-foreground mb-1">
                        {m.role === 'user' ? 'Anda' : 'Stratos Agent'}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                      {m.toolCalls && m.toolCalls.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {m.toolCalls.map((tc) => (
                            <div
                              key={tc.id}
                              className="p-1.5 rounded bg-black/30 text-[10px] font-mono flex items-center justify-between border border-white/5"
                            >
                              <span className="text-sky-300 font-semibold">{tc.tool}</span>
                              <span
                                className={
                                  tc.status === 'completed'
                                    ? 'text-emerald-400'
                                    : tc.status === 'rejected' || tc.status === 'cancelled'
                                    ? 'text-red-400'
                                    : 'text-amber-400'
                                }
                              >
                                [{tc.status}]
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Prompt Composer */}
              <div className="p-2.5 border-t">
                {activeTab && (
                  <div className="text-[11px] text-muted-foreground mb-1.5 truncate flex items-center gap-1">
                    <FileCode size={12} className="text-sky-400 shrink-0" />
                    <span>Konteks aktif: {activeTab.name}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promptInput}
                    disabled={isSendingPrompt}
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                    placeholder="Instruksikan agent coding..."
                    className={`flex-1 px-3 py-1.5 text-xs rounded border focus:outline-none ${
                      isObsidian
                        ? 'bg-obsidian-bg border-obsidian-border text-obsidian-text'
                        : 'bg-nordic-bg border-nordic-border text-nordic-text'
                    }`}
                  />
                  <button
                    onClick={handleSendPrompt}
                    disabled={isSendingPrompt || !promptInput.trim()}
                    className="p-1.5 rounded bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white transition"
                    title="Kirim Instruksi"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Area: Integrated Windows PowerShell Terminal (Collapsible) */}
          <div
            className={`border-t flex flex-col font-mono text-xs transition-all duration-150 ${
              isTerminalCollapsed ? 'h-8' : 'h-44'
            } ${
              isObsidian
                ? 'bg-obsidian-bg border-obsidian-border text-emerald-400'
                : 'bg-slate-900 border-nordic-border text-emerald-400'
            }`}
          >
            <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between bg-black/25 text-muted-foreground text-[11px]">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                title="Klik untuk buka/tutup terminal"
              >
                <Terminal size={13} className="text-emerald-400" />
                <span className="font-semibold text-foreground">Integrated PowerShell Terminal</span>
                <span className="text-white/40">| Status: {terminalStatus}</span>
              </div>
              <div className="flex items-center gap-3">
                {activePid && (
                  <button
                    onClick={handleStopCommand}
                    className="flex items-center gap-1 text-red-400 hover:text-red-300 transition"
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
                  onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                  className="hover:text-white transition p-0.5"
                  title={isTerminalCollapsed ? 'Perbesar Terminal' : 'Perkecil Terminal'}
                >
                  {isTerminalCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>

            {!isTerminalCollapsed && (
              <>
                {/* Terminal Output Viewport */}
                <div
                  ref={terminalScrollRef}
                  className="flex-1 p-3 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed font-mono"
                >
                  {terminalOutput || 'Terminal siap. Masukkan perintah PowerShell atau shell di bawah.'}
                </div>

                {/* High-Risk Confirmation Warning Banner */}
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

                {/* Terminal Command Input Prompt */}
                <div className="p-2 border-t border-white/10 flex items-center gap-2 bg-black/35">
                  <span className="text-emerald-500 font-bold shrink-0">
                    PS {rootPath ? rootPath.split(/[\\/]/).pop() : '~'}&gt;
                  </span>
                  <input
                    type="text"
                    value={terminalCommand}
                    onChange={(e) => setTerminalCommand(e.target.value)}
                    onKeyDown={handleTerminalKeyDown}
                    placeholder="Ketik perintah (contoh: npm test, git status, dir)..."
                    className="flex-1 bg-transparent text-emerald-300 text-xs focus:outline-none"
                  />
                  <button
                    onClick={() => handleExecuteCommand(false)}
                    className="px-3 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition text-xs flex items-center gap-1 font-medium"
                  >
                    <Play size={11} />
                    <span>Jalankan</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* TERMINAL AGENT MODE: 70% Terminal Stream & 30% Diff Inspector */
        <div className="flex-1 flex overflow-hidden">
          <div
            className={`w-[70%] border-r flex flex-col font-mono text-xs ${
              isObsidian
                ? 'bg-obsidian-bg border-obsidian-border text-emerald-400'
                : 'bg-slate-900 border-nordic-border text-emerald-400'
            }`}
          >
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between bg-black/25 text-muted-foreground text-xs">
              <div className="flex items-center gap-2">
                <Cpu size={14} className="text-sky-400" />
                <span className="font-semibold text-foreground">Terminal Agent Execution Stream</span>
              </div>
              <span className="text-[11px] text-muted-foreground">70% Viewport Mode</span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
              {terminalOutput || 'Menunggu instruksi terminal agent...'}
            </div>

            <div className="p-3 border-t border-white/10 flex items-center gap-2 bg-black/35">
              <span className="text-emerald-500 font-bold">&gt;</span>
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt()}
                placeholder="Masukkan prompt agent atau perintah CLI..."
                className="flex-1 bg-transparent text-emerald-300 text-xs focus:outline-none"
              />
              <button
                onClick={handleSendPrompt}
                disabled={isSendingPrompt}
                className="px-4 py-1.5 rounded bg-sky-500 text-white font-medium hover:bg-sky-600 transition text-xs"
              >
                Kirim
              </button>
            </div>
          </div>

          <div
            className={`w-[30%] flex flex-col overflow-hidden p-3 ${
              isObsidian
                ? 'bg-obsidian-surface border-obsidian-border'
                : 'bg-nordic-surface border-nordic-border'
            }`}
          >
            <div className="flex items-center gap-2 pb-2 border-b text-xs font-semibold uppercase text-muted-foreground">
              <GitPullRequest size={14} />
              <span>Daftar Usulan Diff</span>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
              {diffs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Tidak ada usulan diff yang tertunda.
                </div>
              ) : (
                diffs.map((d) => (
                  <div
                    key={d.id}
                    className={`p-3 rounded border text-xs ${
                      d.status === 'accepted'
                        ? 'border-emerald-500/20 bg-emerald-500/5'
                        : d.status === 'rejected'
                        ? 'border-red-500/20 bg-red-500/5 opacity-60'
                        : 'border-amber-500/20 bg-amber-500/5'
                    }`}
                  >
                    <div className="font-mono font-medium">{d.filePath}</div>
                    <div className="text-muted-foreground text-[11px] my-1">{d.summary}</div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                      <span className="uppercase text-[10px] font-bold tracking-wider">
                        [{d.status}]
                      </span>
                      {d.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApplyDiff(d.id)}
                            className="px-2 py-0.5 rounded bg-emerald-500 text-white text-[11px]"
                          >
                            Terapkan
                          </button>
                          <button
                            onClick={() => handleRejectDiff(d.id)}
                            className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[11px]"
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Professional Fixed Bottom IDE Status Bar */}
      <div
        className={`h-6 px-3 flex items-center justify-between text-[11px] font-mono border-t select-none ${
          isObsidian
            ? 'bg-obsidian-bg border-obsidian-border text-obsidian-muted'
            : 'bg-slate-200 border-nordic-border text-slate-600'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Folder size={11} className="text-sky-400" />
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

        <div className="flex items-center gap-3">
          {activeTab && (
            <span>
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
          )}
          <span className="flex items-center gap-1">
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
                ? 'bg-obsidian-surface border-obsidian-border text-obsidian-text'
                : 'bg-white border-nordic-border text-nordic-text'
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
                      ? 'bg-obsidian-bg border-obsidian-border text-obsidian-text'
                      : 'bg-slate-50 border-nordic-border text-nordic-text'
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
