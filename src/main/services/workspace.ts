import { existsSync, statSync, realpathSync, readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, rmSync } from 'fs';
import { resolve, relative, join, dirname, basename } from 'path';
import { randomBytes } from 'crypto';
import { WorkspaceFileNode, FileReadResult, FileWriteResult } from '../../shared/types';

/**
 * Service managing workspace project roots, secure file operations,
 * directory trees, and conflict prevention.
 * Satisfies: M3-WS-001, M3-WS-002, M3-WS-003, M3-SEC-001, M3-SEC-002.
 */
export class WorkspaceService {
  private currentRoot: string | null = null;
  private readonly defaultExcluded = new Set(['.git', 'node_modules', '.stratos', 'dist', '.env', '.DS_Store']);

  constructor(initialRoot?: string) {
    if (initialRoot && existsSync(initialRoot)) {
      this.currentRoot = realpathSync(initialRoot);
    }
  }

  public getRoot(): string | null {
    return this.currentRoot;
  }

  public setRoot(targetPath: string): { success: boolean; rootPath: string | null; error?: string } {
    try {
      if (!existsSync(targetPath)) {
        return { success: false, rootPath: this.currentRoot, error: `Directory does not exist: ${targetPath}` };
      }
      const stat = statSync(targetPath);
      if (!stat.isDirectory()) {
        return { success: false, rootPath: this.currentRoot, error: `Path is not a directory: ${targetPath}` };
      }
      const canonical = realpathSync(targetPath);
      this.currentRoot = canonical;
      return { success: true, rootPath: canonical };
    } catch (err) {
      return { success: false, rootPath: this.currentRoot, error: (err as Error).message };
    }
  }

  /**
   * Resolves a relative or absolute path and strictly verifies that it
   * remains within the active workspace root.
   * Throws on path traversal (SEC-008 / M3-SEC-001) or outside symlink (SEC-009 / M3-SEC-002).
   */
  public resolveSafePath(userPath: string): string {
    if (!this.currentRoot) {
      throw new Error('No workspace root is selected (M3-WS-001).');
    }

    if (!userPath || typeof userPath !== 'string') {
      throw new Error('Invalid path provided.');
    }

    // Check for null bytes or illegal characters
    if (userPath.includes('\0')) {
      throw new Error(`Security Violation: Null byte detected in path [SEC-008/M3-SEC-001]`);
    }

    // Check for NTFS alternate data streams (e.g. file.txt::$DATA or file.txt:stream)
    // On Windows, drive letters at position 1 (e.g. C:) are valid, but colons elsewhere indicate ADS
    const driveOffset = /^[a-zA-Z]:/.test(userPath) ? 2 : 0;
    if (userPath.slice(driveOffset).includes(':')) {
      throw new Error(`Security Violation: Alternate data stream syntax is denied (${userPath}) [SEC-008/M3-SEC-001]`);
    }

    // Check for Windows reserved DOS device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
    const isWin = process.platform === 'win32';
    if (isWin) {
      const parts = userPath.split(/[/\\]/);
      const dosDeviceRegex = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
      for (const part of parts) {
        if (dosDeviceRegex.test(part.trim())) {
          throw new Error(`Security Violation: Windows DOS device name is denied (${part}) [SEC-008/M3-SEC-001]`);
        }
      }
    }

    const resolved = resolve(this.currentRoot, userPath);
    const rel = relative(this.currentRoot, resolved);

    // 1. Path traversal check: must not escape with ../, be absolute (cross-drive on Windows), or diverge from root
    const isOutside =
      rel.startsWith('..') ||
      (isWin && /^[a-zA-Z]:|^\\\\/.test(rel)) ||
      (isWin
        ? resolve(this.currentRoot, rel).toLowerCase() !== resolved.toLowerCase()
        : resolve(this.currentRoot, rel) !== resolved);

    if (isOutside) {
      throw new Error(`Security Violation: Path traversal outside workspace root is denied (${userPath}) [SEC-008/M3-SEC-001]`);
    }

    // 2. Symlink escape check: if exists, verify canonical target is inside workspace root
    if (existsSync(resolved)) {
      const canonical = realpathSync(resolved);
      const canonicalRel = relative(this.currentRoot, canonical);
      const isSymlinkOutside =
        canonicalRel.startsWith('..') ||
        (isWin && /^[a-zA-Z]:|^\\\\/.test(canonicalRel)) ||
        (isWin
          ? resolve(this.currentRoot, canonicalRel).toLowerCase() !== canonical.toLowerCase()
          : resolve(this.currentRoot, canonicalRel) !== canonical);

      if (isSymlinkOutside) {
        throw new Error(`Security Violation: Symlink points outside workspace root (${userPath} -> ${canonical}) [SEC-009/M3-SEC-002]`);
      }
      return canonical;
    }

    return resolved;
  }

  public getFileTree(maxDepth = 4): WorkspaceFileNode[] {
    if (!this.currentRoot || !existsSync(this.currentRoot)) {
      return [];
    }

    const walk = (dir: string, depth: number): WorkspaceFileNode[] => {
      if (depth > maxDepth) return [];
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        const nodes: WorkspaceFileNode[] = [];

        for (const entry of entries) {
          if (this.defaultExcluded.has(entry.name)) continue;

          const fullPath = join(dir, entry.name);
          const relativePath = relative(this.currentRoot!, fullPath).replace(/\\/g, '/');
          const isDir = entry.isDirectory();

          if (isDir) {
            nodes.push({
              name: entry.name,
              path: fullPath,
              relativePath,
              isDirectory: true,
              children: walk(fullPath, depth + 1),
            });
          } else if (entry.isFile()) {
            const stat = statSync(fullPath);
            nodes.push({
              name: entry.name,
              path: fullPath,
              relativePath,
              isDirectory: false,
              size: stat.size,
              mtimeMs: stat.mtimeMs,
            });
          }
        }

        // Sort folders first, then files alphabetically
        return nodes.sort((a, b) => {
          if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
          }
          return a.isDirectory ? -1 : 1;
        });
      } catch (err) {
        console.error('[WorkspaceService] Error reading directory:', err);
        return [];
      }
    };

    return walk(this.currentRoot, 1);
  }

  public readFile(targetPath: string): FileReadResult {
    try {
      const safePath = this.resolveSafePath(targetPath);
      if (!existsSync(safePath)) {
        return { success: false, error: `File not found: ${targetPath}` };
      }
      const stat = statSync(safePath);
      if (stat.isDirectory()) {
        return { success: false, error: `Path is a directory, not a file: ${targetPath}` };
      }
      const content = readFileSync(safePath, 'utf-8');
      return { success: true, content, mtimeMs: stat.mtimeMs };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  public writeFile(targetPath: string, content: string, expectedMtimeMs?: number): FileWriteResult {
    try {
      const safePath = this.resolveSafePath(targetPath);

      // Conflict detection: if file exists and has been modified externally after expectedMtimeMs (M3-WS-003)
      if (existsSync(safePath)) {
        const stat = statSync(safePath);
        if (expectedMtimeMs !== undefined && stat.mtimeMs > expectedMtimeMs + 50) {
          return {
            success: false,
            conflict: true,
            mtimeMs: stat.mtimeMs,
            error: `File conflict: '${targetPath}' was modified externally since last read. Save aborted to prevent silent overwrite (M3-WS-003).`,
          };
        }
      } else {
        const parent = dirname(safePath);
        if (!existsSync(parent)) {
          mkdirSync(parent, { recursive: true });
        }
      }

      // Atomic write: write to sibling temp file and rename atomically (M3-WS-002, SEC-008)
      const parentDir = dirname(safePath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      const tmpPath = join(parentDir, `.${basename(safePath)}.${randomBytes(6).toString('hex')}.tmp`);
      try {
        writeFileSync(tmpPath, content, 'utf-8');
        renameSync(tmpPath, safePath);
      } catch (writeErr) {
        if (existsSync(tmpPath)) {
          try {
            unlinkSync(tmpPath);
          } catch {
            // Ignore temporary cleanup error
          }
        }
        throw writeErr;
      }

      const updatedStat = statSync(safePath);
      return { success: true, mtimeMs: updatedStat.mtimeMs };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  public createFile(targetPath: string, initialContent = ''): { success: boolean; error?: string } {
    try {
      const safePath = this.resolveSafePath(targetPath);
      if (existsSync(safePath)) {
        return { success: false, error: `File already exists: ${targetPath}` };
      }
      const parent = dirname(safePath);
      if (!existsSync(parent)) {
        mkdirSync(parent, { recursive: true });
      }
      writeFileSync(safePath, initialContent, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  public deleteFile(targetPath: string): { success: boolean; error?: string } {
    try {
      const safePath = this.resolveSafePath(targetPath);
      if (!existsSync(safePath)) {
        return { success: false, error: `File not found: ${targetPath}` };
      }
      const stat = statSync(safePath);
      if (stat.isDirectory()) {
        rmSync(safePath, { recursive: true, force: true });
      } else {
        unlinkSync(safePath);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  public renameFile(oldPath: string, newPath: string): { success: boolean; error?: string } {
    try {
      const safeOld = this.resolveSafePath(oldPath);
      const safeNew = this.resolveSafePath(newPath);
      if (!existsSync(safeOld)) {
        return { success: false, error: `Source not found: ${oldPath}` };
      }
      if (existsSync(safeNew)) {
        return { success: false, error: `Destination already exists: ${newPath}` };
      }
      const parent = dirname(safeNew);
      if (!existsSync(parent)) {
        mkdirSync(parent, { recursive: true });
      }
      renameSync(safeOld, safeNew);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

