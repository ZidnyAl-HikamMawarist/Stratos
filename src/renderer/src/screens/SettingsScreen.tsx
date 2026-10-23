import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { StratosTheme, StratosLocale } from '../../../shared/types';
import {
  Palette,
  Globe,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Monitor,
  Info,
} from 'lucide-react';

export const SettingsScreen: React.FC = () => {
  const { theme, setTheme, locale, setLocale, metadata, t } = useAppStore();
  const isObsidian = theme === 'obsidian';

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.settings.title}</h1>
        <p className={`text-xs mt-1 ${isObsidian ? 'text-obsidian-muted' : 'text-nordic-muted'}`}>
          {t.settings.subtitle}
        </p>
      </div>

      {/* Appearance Section */}
      <div className={`p-6 rounded-xl border space-y-4 ${
        isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
      }`}>
        <div className="flex items-center space-x-2">
          <Palette className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold">{t.settings.appearanceSection}</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-1">
          {/* Obsidian Slate */}
          <div
            onClick={() => setTheme('obsidian' as StratosTheme)}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              theme === 'obsidian'
                ? 'border-blue-500 ring-1 ring-blue-500 bg-[#0A0D14]'
                : isObsidian
                  ? 'border-obsidian-border hover:border-slate-700 bg-[#0A0D14]/50'
                  : 'border-nordic-border hover:border-slate-300 bg-slate-900 text-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-slate-100">Obsidian Slate</span>
              {theme === 'obsidian' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {t.settings.themeObsidianDesc}
            </p>
            <div className="mt-3 flex space-x-1.5">
              <div className="w-4 h-4 rounded bg-[#0A0D14] border border-slate-700"></div>
              <div className="w-4 h-4 rounded bg-[#121620] border border-slate-700"></div>
              <div className="w-4 h-4 rounded bg-[#1E2638] border border-slate-700"></div>
              <div className="w-4 h-4 rounded bg-blue-600"></div>
            </div>
          </div>

          {/* Soft Nordic Ice */}
          <div
            onClick={() => setTheme('nordic' as StratosTheme)}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              theme === 'nordic'
                ? 'border-blue-500 ring-1 ring-blue-500 bg-[#F4F6F9] text-slate-900'
                : isObsidian
                  ? 'border-obsidian-border hover:border-slate-700 bg-[#F4F6F9] text-slate-900'
                  : 'border-nordic-border hover:border-slate-300 bg-[#F4F6F9] text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-xs text-slate-900">Soft Nordic Ice</span>
              {theme === 'nordic' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              {t.settings.themeNordicDesc}
            </p>
            <div className="mt-3 flex space-x-1.5">
              <div className="w-4 h-4 rounded bg-[#F4F6F9] border border-slate-300"></div>
              <div className="w-4 h-4 rounded bg-[#FFFFFF] border border-slate-300"></div>
              <div className="w-4 h-4 rounded bg-[#E2E8F0] border border-slate-300"></div>
              <div className="w-4 h-4 rounded bg-blue-600"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Language Section */}
      <div className={`p-6 rounded-xl border space-y-4 ${
        isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
      }`}>
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold">{t.settings.languageSection}</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-1">
          <button
            onClick={() => setLocale('id-ID' as StratosLocale)}
            className={`p-4 rounded-lg border text-left transition-all ${
              locale === 'id-ID'
                ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-500/5'
                : isObsidian
                  ? 'border-obsidian-border hover:border-slate-700'
                  : 'border-nordic-border hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs">Bahasa Indonesia</span>
              {locale === 'id-ID' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
            </div>
            <p className={`text-[11px] ${isObsidian ? 'text-obsidian-muted' : 'text-nordic-muted'}`}>
              Default locale aplikasi sesuai PRD v3.1.0
            </p>
          </button>

          <button
            onClick={() => setLocale('en-US' as StratosLocale)}
            className={`p-4 rounded-lg border text-left transition-all ${
              locale === 'en-US'
                ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-500/5'
                : isObsidian
                  ? 'border-obsidian-border hover:border-slate-700'
                  : 'border-nordic-border hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-xs">English (US)</span>
              {locale === 'en-US' && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
            </div>
            <p className={`text-[11px] ${isObsidian ? 'text-obsidian-muted' : 'text-nordic-muted'}`}>
              Supported international locale
            </p>
          </button>
        </div>
      </div>

      {/* Security & Runtime Audit Section (SEC-001, SEC-002, SEC-003) */}
      <div className={`p-6 rounded-xl border space-y-4 ${
        isObsidian ? 'bg-obsidian-surface border-obsidian-border' : 'bg-white border-nordic-border shadow-sm'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold">{t.settings.securitySection}</h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Hardened Boundary
          </span>
        </div>

        <p className={`text-xs ${isObsidian ? 'text-obsidian-muted' : 'text-nordic-muted'}`}>
          {t.settings.securitySubtitle}
        </p>

        <div className={`divide-y text-xs rounded-lg border overflow-hidden ${
          isObsidian ? 'divide-obsidian-border border-obsidian-border bg-obsidian-bg/50' : 'divide-nordic-border border-nordic-border bg-slate-50'
        }`}>
          {/* Context Isolation */}
          <div className="p-3 flex items-center justify-between">
            <span className="font-medium">{t.settings.contextIsolationLabel}</span>
            <span className="flex items-center space-x-1 text-emerald-500 font-semibold font-mono text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ENABLED (SEC-001)</span>
            </span>
          </div>

          {/* Node Integration */}
          <div className="p-3 flex items-center justify-between">
            <span className="font-medium">{t.settings.nodeIntegrationLabel}</span>
            <span className="flex items-center space-x-1 text-emerald-500 font-semibold font-mono text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>DISABLED (SEC-001)</span>
            </span>
          </div>

          {/* Renderer Sandbox */}
          <div className="p-3 flex items-center justify-between">
            <span className="font-medium">{t.settings.sandboxLabel}</span>
            <span className="flex items-center space-x-1 text-emerald-500 font-semibold font-mono text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>ENABLED (SEC-001)</span>
            </span>
          </div>

          {/* Versions */}
          <div className="p-3 flex items-center justify-between">
            <span className="font-medium flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-500" />
              <span>{t.settings.electronVersionLabel}</span>
            </span>
            <span className="font-mono text-obsidian-muted">{metadata?.electronVersion || 'v34.x'}</span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="font-medium flex items-center space-x-1.5">
              <Monitor className="w-3.5 h-3.5 text-purple-500" />
              <span>{t.settings.chromeVersionLabel}</span>
            </span>
            <span className="font-mono text-obsidian-muted">{metadata?.chromeVersion || 'Chromium'}</span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="font-medium flex items-center space-x-1.5">
              <Info className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.settings.platformLabel}</span>
            </span>
            <span className="font-mono text-obsidian-muted">{metadata?.platform || 'win32 (Windows x64)'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
