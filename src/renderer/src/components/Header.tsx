import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { StratosScreen } from '../../../shared/types';
import {
  Moon,
  Sun,
  Globe,
  ShieldCheck,
  Settings,
  LayoutDashboard,
  Code2,
  Network,
  FolderOpen,
  Save,
  Terminal,
  HelpCircle,
  Sparkles,
  Minus,
  Square,
  X,
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    theme,
    toggleTheme,
    locale,
    setLocale,
    currentScreen,
    setCurrentScreen,
    workspaceMode,
    setWorkspaceMode,
    metadata,
    t,
  } = useAppStore();
  const [routerPort, setRouterPort] = useState<number | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isObsidian = theme === 'obsidian';

  useEffect(() => {
    const checkRouter = async () => {
      if (!window.stratos?.router) return;
      try {
        const res = await window.stratos.router.getStatus();
        if (res && res.status === 'active') {
          setRouterPort(res.port);
        } else {
          setRouterPort(null);
        }
      } catch {
        setRouterPort(null);
      }
    };
    checkRouter();
    const interval = setInterval(checkRouter, 4000);
    return () => clearInterval(interval);
  }, []);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems: { id: StratosScreen; label: string; icon: React.ReactNode }[] = [
    {
      id: 'launcher',
      label: t.nav.launcher,
      icon: <LayoutDashboard className="w-3.5 h-3.5" />,
    },
    {
      id: 'workspace',
      label: t.nav.workspace,
      icon: <Code2 className="w-3.5 h-3.5" />,
    },
    {
      id: 'router',
      label: t.nav.router,
      icon: <Network className="w-3.5 h-3.5" />,
    },
    {
      id: 'settings',
      label: t.nav.settings,
      icon: <Settings className="w-3.5 h-3.5" />,
    },
  ];

  const handleOpenFolder = async () => {
    setActiveMenu(null);
    setCurrentScreen('workspace');
    if (window.stratos?.workspace) {
      await window.stratos.workspace.selectRoot();
    }
  };

  return (
    <header
      className={`h-10 px-3 border-b flex items-center justify-between select-none relative z-50 transition-colors duration-150 ${
        isObsidian
          ? 'bg-[#121214] border-[#27272a] text-[#f4f4f5]'
          : 'bg-[#f8fafc] border-[#e2e8f0] text-[#0f172a]'
      }`}
    >
      {/* Left: Brand, Version & VS Code-style Application Menu */}
      <div className="flex items-center space-x-2">
        {/* Brand Logo & Name */}
        <div
          className="flex items-center space-x-2 cursor-pointer group shrink-0"
          onClick={() => setCurrentScreen('launcher')}
          title="Stratos Home / Launcher"
        >
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-sm group-hover:opacity-90 transition">
            S
          </div>
          <span className="font-semibold text-xs tracking-tight">Stratos</span>
        </div>

        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-mono border hidden sm:inline ${
            isObsidian
              ? 'bg-[#18181b] border-[#27272a] text-[#a1a1aa]'
              : 'bg-white border-[#cbd5e1] text-[#64748b]'
          }`}
        >
          v{metadata?.version || '0.1.0'}
        </span>

        {/* Divider */}
        <span className="text-zinc-600 dark:text-zinc-700 text-xs select-none">|</span>

        {/* Integrated Desktop Menu Bar: File, Edit, Selection, View, Terminal, Help */}
        <div ref={menuRef} className="flex items-center space-x-0.5 relative text-xs">
          {/* File Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
              className={`px-2 py-1 rounded text-[11px] transition ${
                activeMenu === 'file'
                  ? isObsidian
                    ? 'bg-[#27272a] text-white'
                    : 'bg-slate-200 text-black'
                  : isObsidian
                  ? 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
              }`}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div
                className={`absolute left-0 top-full mt-1 w-48 rounded-lg border shadow-xl p-1 z-50 text-xs ${
                  isObsidian
                    ? 'bg-[#18181b] border-[#27272a] text-[#f4f4f5]'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <button
                  onClick={handleOpenFolder}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between ${
                    isObsidian ? 'hover:bg-blue-600 hover:text-white' : 'hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FolderOpen size={13} />
                    <span>Buka Folder...</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+O</span>
                </button>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    setCurrentScreen('workspace');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between ${
                    isObsidian ? 'hover:bg-blue-600 hover:text-white' : 'hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Save size={13} />
                    <span>Simpan Berkas</span>
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">Ctrl+S</span>
                </button>
                <div className="my-1 border-t border-black/10 dark:border-white/10" />
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    setCurrentScreen('launcher');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 ${
                    isObsidian ? 'hover:bg-blue-600 hover:text-white' : 'hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <LayoutDashboard size={13} />
                  <span>Beranda Launcher</span>
                </button>
              </div>
            )}
          </div>

          {/* Edit Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
              className={`px-2 py-1 rounded text-[11px] transition ${
                activeMenu === 'edit'
                  ? isObsidian
                    ? 'bg-[#27272a] text-white'
                    : 'bg-slate-200 text-black'
                  : isObsidian
                  ? 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
              }`}
            >
              Edit
            </button>
            {activeMenu === 'edit' && (
              <div
                className={`absolute left-0 top-full mt-1 w-44 rounded-lg border shadow-xl p-1 z-50 text-xs ${
                  isObsidian
                    ? 'bg-[#18181b] border-[#27272a] text-[#f4f4f5]'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <div className="px-2.5 py-1 text-[11px] text-muted-foreground flex justify-between">
                  <span>Batalkan</span>
                  <span className="font-mono">Ctrl+Z</span>
                </div>
                <div className="px-2.5 py-1 text-[11px] text-muted-foreground flex justify-between">
                  <span>Ulangi</span>
                  <span className="font-mono">Ctrl+Y</span>
                </div>
                <div className="my-1 border-t border-black/10 dark:border-white/10" />
                <div className="px-2.5 py-1 text-[11px] text-muted-foreground flex justify-between">
                  <span>Potong</span>
                  <span className="font-mono">Ctrl+X</span>
                </div>
                <div className="px-2.5 py-1 text-[11px] text-muted-foreground flex justify-between">
                  <span>Salin</span>
                  <span className="font-mono">Ctrl+C</span>
                </div>
              </div>
            )}
          </div>

          {/* Selection Menu */}
          <div className="relative hidden md:block">
            <button
              onClick={() => setActiveMenu(activeMenu === 'selection' ? null : 'selection')}
              className={`px-2 py-1 rounded text-[11px] transition ${
                activeMenu === 'selection'
                  ? isObsidian
                    ? 'bg-[#27272a] text-white'
                    : 'bg-slate-200 text-black'
                  : isObsidian
                  ? 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
              }`}
            >
              Selection
            </button>
            {activeMenu === 'selection' && (
              <div
                className={`absolute left-0 top-full mt-1 w-44 rounded-lg border shadow-xl p-1 z-50 text-xs ${
                  isObsidian
                    ? 'bg-[#18181b] border-[#27272a] text-[#f4f4f5]'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <div className="px-2.5 py-1 text-[11px] text-muted-foreground flex justify-between">
                  <span>Pilih Semua</span>
                  <span className="font-mono">Ctrl+A</span>
                </div>
              </div>
            )}
          </div>

          {/* View Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
              className={`px-2 py-1 rounded text-[11px] transition ${
                activeMenu === 'view'
                  ? isObsidian
                    ? 'bg-[#27272a] text-white'
                    : 'bg-slate-200 text-black'
                  : isObsidian
                  ? 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
              }`}
            >
              View
            </button>
            {activeMenu === 'view' && (
              <div
                className={`absolute left-0 top-full mt-1 w-48 rounded-lg border shadow-xl p-1 z-50 text-xs ${
                  isObsidian
                    ? 'bg-[#18181b] border-[#27272a] text-[#f4f4f5]'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    setCurrentScreen('workspace');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 ${
                    isObsidian ? 'hover:bg-blue-600 hover:text-white' : 'hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <Code2 size={13} />
                  <span>Antigravity IDE Mode</span>
                </button>
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    setCurrentScreen('workspace');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 ${
                    isObsidian ? 'hover:bg-blue-600 hover:text-white' : 'hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <Sparkles size={13} className="text-blue-400" />
                  <span>OpenCode AI Mode</span>
                </button>
                <div className="my-1 border-t border-black/10 dark:border-white/10" />
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    setCurrentScreen('router');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 ${
                    isObsidian ? 'hover:bg-blue-600 hover:text-white' : 'hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <Network size={13} />
                  <span>Router & Providers</span>
                </button>
              </div>
            )}
          </div>

          {/* Terminal Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'terminal' ? null : 'terminal')}
              className={`px-2 py-1 rounded text-[11px] transition ${
                activeMenu === 'terminal'
                  ? isObsidian
                    ? 'bg-[#27272a] text-white'
                    : 'bg-slate-200 text-black'
                  : isObsidian
                  ? 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
              }`}
            >
              Terminal
            </button>
            {activeMenu === 'terminal' && (
              <div
                className={`absolute left-0 top-full mt-1 w-48 rounded-lg border shadow-xl p-1 z-50 text-xs ${
                  isObsidian
                    ? 'bg-[#18181b] border-[#27272a] text-[#f4f4f5]'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    setCurrentScreen('workspace');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 ${
                    isObsidian ? 'hover:bg-blue-600 hover:text-white' : 'hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <Terminal size={13} className="text-emerald-400" />
                  <span>Integrated PowerShell</span>
                </button>
              </div>
            )}
          </div>

          {/* Help Menu */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
              className={`px-2 py-1 rounded text-[11px] transition ${
                activeMenu === 'help'
                  ? isObsidian
                    ? 'bg-[#27272a] text-white'
                    : 'bg-slate-200 text-black'
                  : isObsidian
                  ? 'text-[#a1a1aa] hover:text-white hover:bg-white/5'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
              }`}
            >
              Help
            </button>
            {activeMenu === 'help' && (
              <div
                className={`absolute left-0 top-full mt-1 w-48 rounded-lg border shadow-xl p-1 z-50 text-xs ${
                  isObsidian
                    ? 'bg-[#18181b] border-[#27272a] text-[#f4f4f5]'
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <button
                  onClick={() => {
                    setActiveMenu(null);
                    setCurrentScreen('settings');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded flex items-center gap-1.5 ${
                    isObsidian ? 'hover:bg-blue-600 hover:text-white' : 'hover:bg-blue-50 hover:text-blue-600'
                  }`}
                >
                  <HelpCircle size={13} />
                  <span>Tentang Stratos IDE</span>
                </button>
                <div className="px-2.5 py-1.5 text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                  <ShieldCheck size={12} />
                  <span>Security Sandbox Aktif</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center: Slim Integrated Screen Switcher */}
      <div className="flex items-center space-x-1 bg-black/10 dark:bg-white/5 p-0.5 rounded-lg border border-black/5 dark:border-white/5">
        {navItems.map((item) => {
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                isActive
                  ? isObsidian
                    ? 'bg-[#27272a] text-blue-400 shadow-sm'
                    : 'bg-white text-blue-600 shadow-sm'
                  : isObsidian
                  ? 'text-[#a1a1aa] hover:text-[#f4f4f5] hover:bg-white/5'
                  : 'text-[#64748b] hover:text-[#0f172a] hover:bg-black/5'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Router Loopback Status, Language, Theme, Workspace Mode Portal & Window Controls */}
      <div className="flex items-center space-x-2">
        {/* Router Loopback Status Indicator */}
        <div
          onClick={() => setCurrentScreen('router')}
          className={`cursor-pointer flex items-center space-x-1.5 text-[10px] font-mono px-2 py-0.5 rounded border transition ${
            routerPort
              ? isObsidian
                ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-400 hover:border-emerald-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-300'
              : isObsidian
              ? 'bg-[#18181b] border-[#27272a] text-[#71717a] hover:text-[#a1a1aa]'
              : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700'
          }`}
          title={routerPort ? `Router aktif di http://127.0.0.1:${routerPort}` : 'Router standby'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              routerPort ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
            }`}
          />
          <span className="hidden md:inline">
            {routerPort ? `127.0.0.1:${routerPort}` : 'Router Standby'}
          </span>
        </div>

        {/* Language Switcher */}
        <button
          onClick={() => setLocale(locale === 'id-ID' ? 'en-US' : 'id-ID')}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium border transition ${
            isObsidian
              ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5]'
              : 'bg-white border-[#cbd5e1] hover:bg-slate-100 text-[#0f172a]'
          }`}
          title="Ganti Bahasa / Switch Language"
          aria-label="Switch Language"
        >
          <Globe className="w-3 h-3 text-[#a1a1aa]" />
          <span className="text-[11px] font-mono">{locale === 'id-ID' ? 'ID' : 'EN'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-1.5 rounded text-xs border transition ${
            isObsidian
              ? 'bg-[#18181b] border-[#27272a] hover:bg-[#27272a] text-[#f4f4f5]'
              : 'bg-white border-[#cbd5e1] hover:bg-slate-100 text-[#0f172a]'
          }`}
          title={isObsidian ? t.header.themeLight : t.header.themeDark}
          aria-label="Toggle Theme"
        >
          {isObsidian ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-slate-700" />
          )}
        </button>

        {/* Separator */}
        <span className="text-zinc-600 dark:text-zinc-700 text-xs select-none">|</span>

        {/* SINGLE COMPACT WORKSPACE MODE PORTAL (Placed directly adjacent to minimize button) */}
        <div
          className={`flex items-center p-0.5 rounded border text-[11px] font-medium transition ${
            isObsidian ? 'bg-[#18181b] border-[#27272a]' : 'bg-slate-200/80 border-slate-300'
          }`}
          title="Portal Mode Workspace (IDE Mode / OpenCode AI)"
        >
          <button
            onClick={() => {
              if (currentScreen !== 'workspace') setCurrentScreen('workspace');
              setWorkspaceMode('ide');
            }}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] transition ${
              currentScreen === 'workspace' && workspaceMode === 'ide'
                ? isObsidian
                  ? 'bg-[#27272a] text-sky-400 font-semibold shadow-sm'
                  : 'bg-white text-blue-600 font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Mode IDE: Monaco Code Editor, Tree, Terminal"
          >
            <Code2 size={12} />
            <span>IDE</span>
          </button>
          <button
            onClick={() => {
              if (currentScreen !== 'workspace') setCurrentScreen('workspace');
              setWorkspaceMode('opencode');
            }}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] transition ${
              currentScreen === 'workspace' && workspaceMode === 'opencode'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Mode OpenCode: Percakapan AI Interpreter & Diffs"
          >
            <Sparkles size={12} />
            <span>OpenCode</span>
          </button>
        </div>

        {/* Window Controls: Minimize, Maximize, Close */}
        <div className="flex items-center space-x-0.5 pl-1 -mr-1">
          <button
            onClick={() => window.stratos?.window?.minimize?.()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
            title="Minimize"
            aria-label="Minimize"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={() => window.stratos?.window?.maximize?.()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
            title="Maximize / Restore"
            aria-label="Maximize"
          >
            <Square size={11} />
          </button>
          <button
            onClick={() => window.stratos?.window?.close?.()}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500 hover:text-white text-muted-foreground transition"
            title="Close"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </header>
  );
};


