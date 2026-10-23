import { spawn, ChildProcess } from 'child_process';
import { existsSync, statSync, realpathSync } from 'fs';
import { resolve, relative } from 'path';
import { TerminalProcessInfo } from '../../shared/types';

/**
 * Service managing controlled child processes, terminal streaming,
 * high-risk command detection, and process termination.
 * Satisfies: M3-TERM-001, M3-TERM-002, SEC-015.
 */
export class TerminalService {
  private activeProcesses = new Map<number, { proc: ChildProcess; info: TerminalProcessInfo }>();
  private defaultCwd: string;
  private readonly maxOutputBytes = 1024 * 1024; // 1MB buffer cap

  constructor(defaultCwd?: string) {
    this.defaultCwd = defaultCwd || process.cwd();
  }

  public setDefaultCwd(cwd: string): void {
    this.defaultCwd = cwd;
  }

  /**
   * Detects hazardous or destructive command patterns requiring explicit confirmation.
   */
  public isHighRiskCommand(command: string): boolean {
    const trimmed = command.trim().toLowerCase();
    const highRiskPatterns = [
      // POSIX & common shell removals
      /\brm\s+(-[a-z]*r[a-z]*f|-rf|-fr)\b/,
      // Windows CMD removals
      /\brmdir\b.*\/s/i,
      /\brd\b.*\/s/i,
      /\bdel\b.*\/[sf]/i,
      // PowerShell destructive cmdlets
      /\b(remove-item|ri)\b.*(-recurse|-r)\b/i,
      /\b(format-volume|clear-disk|stop-computer|restart-computer|set-executionpolicy)\b/i,
      // Disk and system utilities
      /\bformat\s+[a-z]:/i,
      /\breg\s+delete\b/,
      /\bdrop\s+(database|table)\b/,
      /\bkill\s+-9\s+1\b/,
      /\bshutdown\b/,
      /\bdiskpart\b/,
    ];

    return highRiskPatterns.some((pattern) => pattern.test(trimmed));
  }

  public async executeCommand(
    command: string,
    cwd?: string,
    isHighRiskConfirmed = false
  ): Promise<TerminalProcessInfo> {
    if (this.isHighRiskCommand(command) && !isHighRiskConfirmed) {
      return {
        pid: 0,
        command,
        status: 'needs_confirmation',
        exitCode: null,
        output: '',
        error: 'High-risk command detected. Explicit confirmation required before execution (SEC-015/PRD 6.2).',
      };
    }

    const workingDir = cwd ? resolve(cwd) : this.defaultCwd;

    if (!existsSync(workingDir)) {
      return {
        pid: 0,
        command,
        status: 'failed',
        exitCode: 1,
        output: '',
        error: `Working directory does not exist: ${workingDir}`,
      };
    }

    if (!statSync(workingDir).isDirectory()) {
      return {
        pid: 0,
        command,
        status: 'failed',
        exitCode: 1,
        output: '',
        error: `Working directory is not a directory: ${workingDir}`,
      };
    }

    // Validate cwd against allowed workspace root (SEC-015)
    if (this.defaultCwd && existsSync(this.defaultCwd)) {
      const canonicalBase = realpathSync(this.defaultCwd);
      const canonicalWorking = realpathSync(workingDir);
      const rel = relative(canonicalBase, canonicalWorking);
      const isWin = process.platform === 'win32';
      const isOutside =
        rel.startsWith('..') ||
        (isWin && /^[a-zA-Z]:|^\\\\/.test(rel)) ||
        (isWin
          ? resolve(canonicalBase, rel).toLowerCase() !== canonicalWorking.toLowerCase()
          : resolve(canonicalBase, rel) !== canonicalWorking);

      if (isOutside) {
        return {
          pid: 0,
          command,
          status: 'failed',
          exitCode: 1,
          output: '',
          error: `Security Violation: Terminal working directory must be within workspace root (${workingDir}) [SEC-015].`,
        };
      }
    }

    return new Promise<TerminalProcessInfo>((resolve) => {
      // Use powershell.exe on Windows, fallback to cmd or sh
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'powershell.exe' : '/bin/sh';
      const args = isWin ? ['-NoProfile', '-NonInteractive', '-Command', command] : ['-c', command];

      let child: ChildProcess;
      try {
        child = spawn(shell, args, {
          cwd: workingDir,
          env: { ...process.env, TERM: 'xterm-256color' },
          windowsHide: true,
        });
      } catch (err) {
        return resolve({
          pid: 0,
          command,
          status: 'failed',
          exitCode: 1,
          output: '',
          error: `Failed to spawn process: ${(err as Error).message}`,
        });
      }

      const pid = child.pid || 0;
      const processInfo: TerminalProcessInfo = {
        pid,
        command,
        status: 'running',
        exitCode: null,
        output: '',
      };

      this.activeProcesses.set(pid, { proc: child, info: processInfo });

      let isTruncated = false;
      const appendOutput = (text: string) => {
        if (processInfo.output.length + text.length > this.maxOutputBytes) {
          if (!isTruncated) {
            processInfo.output += text.slice(0, Math.max(0, this.maxOutputBytes - processInfo.output.length));
            processInfo.output += '\n[Output truncated: maximum 1MB buffer reached]';
            isTruncated = true;
          }
        } else {
          processInfo.output += text;
        }
      };

      child.stdout?.on('data', (chunk: Buffer) => {
        appendOutput(chunk.toString('utf-8'));
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        appendOutput(chunk.toString('utf-8'));
      });

      child.on('close', (code) => {
        processInfo.exitCode = code;
        if (processInfo.status === 'running') {
          processInfo.status = code === 0 ? 'completed' : 'failed';
        }
        this.activeProcesses.delete(pid);
        resolve(processInfo);
      });

      child.on('error', (err) => {
        processInfo.status = 'failed';
        processInfo.error = err.message;
        this.activeProcesses.delete(pid);
        resolve(processInfo);
      });
    });
  }

  public stopProcess(pid: number): boolean {
    const entry = this.activeProcesses.get(pid);
    if (!entry) return false;

    entry.info.status = 'terminated';
    try {
      if (process.platform === 'win32') {
        // Kill process tree cleanly using taskkill
        spawn('taskkill', ['/pid', pid.toString(), '/T', '/F']);
      } else {
        entry.proc.kill('SIGTERM');
      }
      this.activeProcesses.delete(pid);
      return true;
    } catch (err) {
      console.error(`[TerminalService] Error killing pid ${pid}:`, err);
      return false;
    }
  }

  public listActive(): TerminalProcessInfo[] {
    return Array.from(this.activeProcesses.values()).map((e) => e.info);
  }

  /**
   * SEC-015 / M4-RELEASE-005: Guaranteed child-process tree cleanup on app exit.
   */
  public cleanupAllProcesses(): void {
    for (const [pid, entry] of this.activeProcesses.entries()) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', pid.toString(), '/T', '/F']);
        } else {
          entry.proc.kill('SIGKILL');
        }
      } catch {
        // Best-effort termination during exit
      }
    }
    this.activeProcesses.clear();
  }
}
