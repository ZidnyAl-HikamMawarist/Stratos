import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { configureSecurityHeaders, setupWindowSecurity } from './security';
import { registerIpcHandlers, setPrimaryWindow, initializeServices, cleanupTerminalServices } from './ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    title: 'Stratos',
    backgroundColor: '#0A0D14', // Default Obsidian Slate background to prevent white flash
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: join(__dirname, '../preload/index.js'),
      webSecurity: true,
    },
  });

  // Bind the authorized primary window to the IPC sender validation registry (CRIT-01, SEC-003)
  setPrimaryWindow(mainWindow);

  // Apply security navigation guards and external link filtering (SEC-001, SEC-012, SEC-013)
  setupWindowSecurity(mainWindow);

  // Show window smoothly when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Automated startup & DOM verification mode (CRIT-02, M1-UI-001)
  if (process.env.STRATOS_VERIFY_STARTUP === '1') {
    const startupTimeout = setTimeout(() => {
      console.error('[STRATOS_STARTUP_VERIFY_ERROR] Timed out waiting for renderer to mount React DOM.');
      process.exit(1);
    }, 8000);

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      clearTimeout(startupTimeout);
      console.error(`[STRATOS_STARTUP_VERIFY_ERROR] Failed to load renderer: ${errorDescription} (${errorCode})`);
      process.exit(1);
    });

    mainWindow.webContents.on('did-finish-load', async () => {
      try {
        const result = await mainWindow?.webContents.executeJavaScript(`
          (() => {
            const root = document.getElementById('root');
            return {
              hasRoot: !!root,
              childCount: root ? root.children.length : 0,
              title: document.title,
            };
          })()
        `);

        if (result?.hasRoot && result.childCount > 0) {
          clearTimeout(startupTimeout);
          console.log(`[STRATOS_STARTUP_VERIFY_SUCCESS] DOM ready. Title="${result.title}", RootChildren=${result.childCount}`);
          // Exit cleanly after proving render success
          setTimeout(() => {
            app.quit();
            process.exit(0);
          }, 500);
        } else {
          clearTimeout(startupTimeout);
          console.error('[STRATOS_STARTUP_VERIFY_ERROR] DOM root missing or empty (blank screen detected).');
          process.exit(1);
        }
      } catch (err) {
        clearTimeout(startupTimeout);
        console.error('[STRATOS_STARTUP_VERIFY_ERROR] Error probing DOM state:', err);
        process.exit(1);
      }
    });
  }

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.error('[Main] Failed to load dev server URL:', err);
    });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html')).catch((err) => {
      console.error('[Main] Failed to load renderer production build:', err);
    });
  }

  mainWindow.on('closed', () => {
    setPrimaryWindow(null);
    mainWindow = null;
  });
}

// Ensure single application instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // 1. Configure security headers before any network requests take place
    configureSecurityHeaders();

    // 2. Initialize persistent storage and router backend services (M2)
    try {
      await initializeServices();
    } catch (err) {
      console.error('[Main] Failed to initialize backend services:', err);
    }

    // 3. Register strict IPC handlers
    registerIpcHandlers();

    // 4. Create the main application window
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    cleanupTerminalServices();
  });
}
