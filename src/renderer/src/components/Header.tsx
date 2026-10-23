import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { Moon, Sun, Globe, ShieldCheck, Settings } from 'lucide-react';

export const Header: React.FC = () => {
  const { theme, toggleTheme, locale, setLocale, setCurrentScreen, metadata, t } = useAppStore();

  const isObsidian = theme === 'obsidian';

  return (
    <header className={`h-14 px-6 border-b flex items-center justify-between transition-colors duration-200 ${
      isObsidian
        ? 'bg-obsidian-surface border-obsidian-border text-obsidian-text'
        : 'bg-nordic-surface border-nordic-border text-nordic-text'
    }`}>
      {/* Brand & Version */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentScreen('launcher')}>
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-sm">
            S
          </div>
          <span className="font-semibold text-base tracking-tight">Stratos</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-mono border ${
          isObsidian
            ? 'bg-obsidian-elevated border-obsidian-border text-obsidian-muted'
            : 'bg-nordic-elevated border-nordic-border text-nordic-muted'
        }`}>
          v{metadata?.version || '0.1.0'}
        </span>
        <div className={`hidden sm:flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full border ${
          isObsidian
            ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t.header.securityBadge}</span>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center space-x-2">
        {/* Language Switcher */}
        <button
          onClick={() => setLocale(locale === 'id-ID' ? 'en-US' : 'id-ID')}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            isObsidian
              ? 'bg-obsidian-elevated border-obsidian-border hover:bg-obsidian-border/50 text-obsidian-text'
              : 'bg-nordic-elevated border-nordic-border hover:bg-slate-200/50 text-nordic-text'
          }`}
          title="Ganti Bahasa / Switch Language"
          aria-label="Switch Language"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{locale === 'id-ID' ? 'ID' : 'EN'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            isObsidian
              ? 'bg-obsidian-elevated border-obsidian-border hover:bg-obsidian-border/50 text-obsidian-text'
              : 'bg-nordic-elevated border-nordic-border hover:bg-slate-200/50 text-nordic-text'
          }`}
          title={isObsidian ? t.header.themeLight : t.header.themeDark}
          aria-label="Toggle Theme"
        >
          {isObsidian ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
          <span className="hidden md:inline">{isObsidian ? 'Nordic Ice' : 'Obsidian'}</span>
        </button>

        {/* Settings Navigation */}
        <button
          onClick={() => setCurrentScreen('settings')}
          className={`p-1.5 rounded-md text-xs border transition-colors ${
            isObsidian
              ? 'bg-obsidian-elevated border-obsidian-border hover:bg-obsidian-border/50 text-obsidian-text'
              : 'bg-nordic-elevated border-nordic-border hover:bg-slate-200/50 text-nordic-text'
          }`}
          title={t.nav.settings}
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
