import { BrowserWindow, shell, session } from 'electron';

/**
 * Validates whether an external URL is safe to open via shell.openExternal.
 * Only http and https protocols are permitted (SEC-013).
 */
export function isSafeExternalUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Generates Content-Security-Policy header value.
 * In development, allows Vite HMR connections.
 * In production, strictly disallows inline scripts (MED-02).
 */
export function getCspPolicy(isDev: boolean, devServerUrl?: string): string {
  const scriptSrc = isDev ? "'self' 'unsafe-inline'" : "'self'";
  
  let connectSrc = "'self'";
  if (isDev) {
    if (devServerUrl) {
      try {
        const parsed = new URL(devServerUrl);
        const wsOrigin = `ws://${parsed.host}`;
        const httpOrigin = `${parsed.protocol}//${parsed.host}`;
        connectSrc = `'self' ${wsOrigin} ${httpOrigin}`;
      } catch {
        connectSrc = "'self' ws://localhost:* http://localhost:*";
      }
    } else {
      connectSrc = "'self' ws://localhost:* http://localhost:*";
    }
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Validates internal navigation URLs against expected development or production roots (MED-01).
 */
export function isAllowedNavigationUrl(navUrl: string, devServerUrl?: string, isDev = false): boolean {
  if (!navUrl || typeof navUrl !== 'string') return false;
  try {
    const parsed = new URL(navUrl);

    if (isDev && devServerUrl) {
      const devParsed = new URL(devServerUrl);
      return parsed.protocol === devParsed.protocol && parsed.host === devParsed.host;
    }

    if (parsed.protocol === 'file:') {
      // Deny remote UNC/SMB hostpaths (e.g. file://attacker.com/share/index.html)
      if (parsed.hostname && parsed.hostname !== 'localhost') {
        return false;
      }
      const normalizedPath = parsed.pathname.toLowerCase().replace(/\\/g, '/');
      return normalizedPath.endsWith('/renderer/index.html') || normalizedPath.endsWith('/dist/renderer/index.html');
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Validates whether an IPC sender meets SEC-003 requirements:
 * 1. Sender belongs to the expected application window.
 * 2. Sender is the top-level main frame (sub-frames rejected).
 * 3. Frame URL strictly matches dev server origin or production file location.
 */
export interface IpcSenderValidationContext {
  senderWebContentsId?: number;
  expectedWebContentsId?: number;
  isMainFrame: boolean;
  frameUrl?: string;
  isDev: boolean;
  devServerUrl?: string;
}

export function isAuthorizedIpcSender(ctx: IpcSenderValidationContext): boolean {
  // 1. Must belong to the expected BrowserWindow WebContents
  if (!ctx.senderWebContentsId || !ctx.expectedWebContentsId || ctx.senderWebContentsId !== ctx.expectedWebContentsId) {
    return false;
  }

  // 2. Must be top-level frame (reject sub-frames, iframes, and webviews)
  if (!ctx.isMainFrame) {
    return false;
  }

  // 3. Must have a frame URL
  if (!ctx.frameUrl) {
    return false;
  }

  // 4. Must originate from an allowed URL
  return isAllowedNavigationUrl(ctx.frameUrl, ctx.devServerUrl, ctx.isDev);
}

/**
 * Configure Content Security Policy and session-level permission guards.
 */
export function configureSecurityHeaders(): void {
  const defaultSession = session.defaultSession;

  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    const csp = getCspPolicy(isDev, devServerUrl);

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
      },
    });
  });

  defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    // Stratos desktop app does not require hardware sensor access in M1
    callback(false);
  });
}

/**
 * Apply window-level navigation guards and external link routing.
 */
export function setupWindowSecurity(win: BrowserWindow): void {
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;

    // Check if navigation is within authorized internal bounds
    if (!isAllowedNavigationUrl(navigationUrl, devServerUrl, isDev)) {
      event.preventDefault();
      if (isSafeExternalUrl(navigationUrl)) {
        shell.openExternal(navigationUrl).catch((err) => {
          console.error('[Security] Failed to open external URL safely:', err);
        });
      }
    }
  });

  win.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      shell.openExternal(details.url).catch((err) => {
        console.error('[Security] Failed to open window target in browser:', err);
      });
    }
    return { action: 'deny' };
  });
}
