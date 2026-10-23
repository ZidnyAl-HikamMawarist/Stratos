import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import { StratosScreen } from '../../../shared/types';
import { LayoutDashboard, Code2, Network, Settings as SettingsIcon } from 'lucide-react';

export const Navigation: React.FC = () => {
  const { currentScreen, setCurrentScreen, theme, t } = useAppStore();
  const isObsidian = theme === 'obsidian';

  const navItems: { id: StratosScreen; label: string; icon: React.ReactNode }[] = [
    {
      id: 'launcher',
      label: t.nav.launcher,
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'workspace',
      label: t.nav.workspace,
      icon: <Code2 className="w-4 h-4" />,
    },
    {
      id: 'router',
      label: t.nav.router,
      icon: <Network className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: t.nav.settings,
      icon: <SettingsIcon className="w-4 h-4" />,
    },
  ];

  return (
    <nav className={`h-11 px-6 border-b flex items-center space-x-1 transition-colors duration-200 ${
      isObsidian
        ? 'bg-obsidian-bg border-obsidian-border'
        : 'bg-nordic-bg border-nordic-border'
    }`}>
      {navItems.map((item) => {
        const isActive = currentScreen === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setCurrentScreen(item.id)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
              isActive
                ? isObsidian
                  ? 'bg-obsidian-elevated text-blue-400 border border-obsidian-border shadow-sm'
                  : 'bg-white text-blue-600 border border-nordic-border shadow-sm'
                : isObsidian
                  ? 'text-obsidian-muted hover:text-obsidian-text hover:bg-obsidian-surface/60'
                  : 'text-nordic-muted hover:text-nordic-text hover:bg-slate-200/60'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
