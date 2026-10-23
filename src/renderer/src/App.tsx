import React, { useEffect } from 'react';
import { useAppStore } from './stores/useAppStore';
import { Header } from './components/Header';
import { LauncherScreen } from './screens/LauncherScreen';
import { WorkspaceScreen } from './screens/WorkspaceScreen';
import { RouterScreen } from './screens/RouterScreen';
import { SettingsScreen } from './screens/SettingsScreen';

export const App: React.FC = () => {
  const { currentScreen, theme, initialize } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const isObsidian = theme === 'obsidian';

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isObsidian
          ? 'bg-obsidian-bg text-obsidian-text'
          : 'bg-nordic-bg text-nordic-text'
      }`}
    >
      {/* Stratos Sleek Desktop Header */}
      <Header />

      {/* Main Dynamic Viewport */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentScreen === 'launcher' && <LauncherScreen />}
        {currentScreen === 'workspace' && <WorkspaceScreen />}
        {currentScreen === 'router' && <RouterScreen />}
        {currentScreen === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
};
