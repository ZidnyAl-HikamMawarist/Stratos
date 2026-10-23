import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../src/renderer/src/stores/useAppStore';
import { translations } from '../src/renderer/src/i18n';

describe('Milestone 1 Store & i18n Suite', () => {
  beforeEach(() => {
    // Reset store state
    useAppStore.setState({
      theme: 'obsidian',
      locale: 'id-ID',
      currentScreen: 'launcher',
      t: translations['id-ID'],
    });
  });

  it('M1-UI-002: switches theme between Obsidian Slate and Soft Nordic Ice', () => {
    const store = useAppStore.getState();
    expect(store.theme).toBe('obsidian');

    store.toggleTheme();
    expect(useAppStore.getState().theme).toBe('nordic');

    store.toggleTheme();
    expect(useAppStore.getState().theme).toBe('obsidian');

    store.setTheme('nordic');
    expect(useAppStore.getState().theme).toBe('nordic');
  });

  it('M1-UI-003: switches locale between id-ID and en-US with complete dynamic strings', () => {
    const store = useAppStore.getState();
    expect(store.locale).toBe('id-ID');
    expect(store.t.common.appName).toBe('Stratos');
    expect(store.t.nav.launcher).toBe('Beranda');

    store.setLocale('en-US');
    const updated = useAppStore.getState();
    expect(updated.locale).toBe('en-US');
    expect(updated.t.nav.launcher).toBe('Launcher');
    expect(updated.t.launcher.welcomeTitle).toBe('Welcome to Stratos');
  });

  it('M1-UI-005: navigates between all supported screens', () => {
    const store = useAppStore.getState();
    expect(store.currentScreen).toBe('launcher');

    store.setCurrentScreen('workspace');
    expect(useAppStore.getState().currentScreen).toBe('workspace');

    store.setCurrentScreen('router');
    expect(useAppStore.getState().currentScreen).toBe('router');

    store.setCurrentScreen('settings');
    expect(useAppStore.getState().currentScreen).toBe('settings');
  });

  it('LOW-03: initialize() synchronizes initial theme and locale to window.stratos', async () => {
    const mockThemeSet = vi.fn().mockResolvedValue(true);
    const mockLocaleSet = vi.fn().mockResolvedValue(true);
    const mockGetAppMetadata = vi.fn().mockResolvedValue({
      name: 'Stratos',
      version: '0.1.0',
      electronVersion: '34.0.0',
      nodeVersion: '20.0.0',
      chromeVersion: '130.0.0',
      platform: 'win32',
      isPackaged: false,
      security: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });

    // Provide mock window.stratos
    (globalThis as unknown as { window: unknown }).window = {
      stratos: {
        theme: { get: vi.fn(), set: mockThemeSet },
        locale: { get: vi.fn(), set: mockLocaleSet },
        getAppMetadata: mockGetAppMetadata,
        openExternal: vi.fn(),
      },
    };

    useAppStore.setState({ theme: 'nordic', locale: 'en-US' });

    await useAppStore.getState().initialize();

    expect(mockThemeSet).toHaveBeenCalledWith('nordic');
    expect(mockLocaleSet).toHaveBeenCalledWith('en-US');
    expect(mockGetAppMetadata).toHaveBeenCalled();
  });

  it('handles IPC synchronization errors gracefully during initialize()', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    (globalThis as unknown as { window: unknown }).window = {
      stratos: {
        theme: { get: vi.fn(), set: vi.fn().mockRejectedValue(new Error('IPC Disconnected')) },
        locale: { get: vi.fn(), set: vi.fn().mockRejectedValue(new Error('IPC Disconnected')) },
        getAppMetadata: vi.fn().mockRejectedValue(new Error('IPC Timeout')),
        openExternal: vi.fn(),
      },
    };

    // Should not throw or crash store
    await expect(useAppStore.getState().initialize()).resolves.toBeUndefined();
    consoleWarnSpy.mockRestore();
  });

  it('ensures translation dictionary parity across id-ID and en-US', () => {
    const idKeys = Object.keys(translations['id-ID']) as (keyof typeof translations['id-ID'])[];
    const enKeys = Object.keys(translations['en-US']) as (keyof typeof translations['en-US'])[];

    expect(idKeys).toEqual(enKeys);

    for (const section of idKeys) {
      const idSubKeys = Object.keys(translations['id-ID'][section]);
      const enSubKeys = Object.keys(translations['en-US'][section]);
      expect(idSubKeys).toEqual(enSubKeys);
    }
  });
});
