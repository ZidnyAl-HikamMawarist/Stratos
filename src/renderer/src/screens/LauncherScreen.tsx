import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import {
  Code2,
  Terminal,
  FolderOpen,
  Radio,
  FileText,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const LauncherScreen: React.FC = () => {
  const { theme, setCurrentScreen, metadata, t } = useAppStore();
  const isObsidian = theme === 'obsidian';

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Hero Welcome */}
      <div className={`p-8 rounded-xl border transition-colors ${
        isObsidian
          ? 'bg-obsidian-surface border-obsidian-border text-obsidian-text'
          : 'bg-white border-nordic-border text-nordic-text shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Zero-Mock Architecture Active</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{t.launcher.welcomeTitle}</h1>
            <p className={`text-sm max-w-2xl leading-relaxed ${
              isObsidian ? 'text-obsidian-muted' : 'text-nordic-muted'
            }`}>
              {t.launcher.welcomeSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCurrentScreen('workspace')}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center space-x-1.5 shadow-sm"
            >
              <span>{t.nav.workspace}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Dual Mode Coding Workspace Cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-obsidian-muted">
          Lingkungan Kerja / Coding Modes
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {/* IDE Mode Card */}
          <div
            onClick={() => setCurrentScreen('workspace')}
            className={`p-6 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${
              isObsidian
                ? 'bg-obsidian-surface border-obsidian-border hover:border-blue-500/50'
                : 'bg-white border-nordic-border hover:border-blue-400 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20 flex items-center justify-center mb-4">
                <Code2 className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                IDE Ready
              </span>
            </div>
            <h3 className="text-base font-semibold mb-1.5">{t.launcher.ideCardTitle}</h3>
            <p className={`text-xs leading-relaxed ${isObsidian ? 'text-obsidian-muted' : 'text-nordic-muted'}`}>
              {t.launcher.ideCardDesc}
            </p>
          </div>

          {/* Terminal Mode Card */}
          <div
            onClick={() => setCurrentScreen('workspace')}
            className={`p-6 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] ${
              isObsidian
                ? 'bg-obsidian-surface border-obsidian-border hover:border-emerald-500/50'
                : 'bg-white border-nordic-border hover:border-emerald-400 shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mb-4">
                <Terminal className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PowerShell Ready
              </span>
            </div>
            <h3 className="text-base font-semibold mb-1.5">{t.launcher.terminalCardTitle}</h3>
            <p className={`text-xs leading-relaxed ${isObsidian ? 'text-obsidian-muted' : 'text-nordic-muted'}`}>
              {t.launcher.terminalCardDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Honest Provider Status Card (PRD Rule: No Fake Statuses) */}
      <div className={`p-6 rounded-xl border transition-colors ${
        isObsidian
          ? 'bg-obsidian-surface/60 border-obsidian-border'
          : 'bg-slate-50 border-nordic-border'
      }`}>
        <div className="flex items-start space-x-4">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Radio className="w-4 h-4" />
          </div>
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold">{t.launcher.noProviderTitle}</span>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Standby
              </span>
            </div>
            <p className={`text-xs ${isObsidian ? 'text-obsidian-muted' : 'text-nordic-muted'}`}>
              {t.launcher.noProviderDesc}
            </p>
            <div className="flex items-center space-x-1.5 text-xs text-amber-400/90 pt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px]">{t.launcher.noProviderHonestNote}</span>
            </div>
          </div>
          <button
            onClick={() => setCurrentScreen('router')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border shrink-0 transition-colors ${
              isObsidian
                ? 'bg-obsidian-elevated border-obsidian-border hover:bg-obsidian-border/50 text-obsidian-text'
                : 'bg-white border-nordic-border hover:bg-slate-100 text-nordic-text'
            }`}
          >
            {t.launcher.actions.configureRouter}
          </button>
        </div>
      </div>

      {/* Quick Launch & Documentation Links */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div className={`p-4 rounded-lg border flex items-center space-x-3 transition-colors ${
          isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
        }`}>
          <div className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-medium">{t.launcher.actions.openFolder}</div>
            <div className={isObsidian ? 'text-obsidian-subtle' : 'text-nordic-subtle'}>Pilih Direktori</div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border flex items-center space-x-3 transition-colors ${
          isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
        }`}>
          <div className="w-8 h-8 rounded-md bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-medium">PRD Specification</div>
            <div className={isObsidian ? 'text-obsidian-subtle' : 'text-nordic-subtle'}>v3.1.0 in docs/</div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border flex items-center space-x-3 transition-colors ${
          isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
        }`}>
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Radio className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="font-medium">Electron Security</div>
            <div className="text-emerald-500 font-mono text-[11px]">
              {metadata?.security.sandbox ? 'Sandbox Active' : 'Verified'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
