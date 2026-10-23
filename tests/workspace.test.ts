import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkspaceService } from '../src/main/services/workspace';
import { TerminalService } from '../src/main/services/terminal';
import { DiffReviewService } from '../src/main/services/diff';
import { AgentOrchestrator } from '../src/main/services/agent';
import { SecureCredentialStore } from '../src/main/services/credentials';
import { StratosDatabase } from '../src/main/services/database';
import { LocalRouterService } from '../src/main/services/router';
import { mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'fs';
import { join } from 'path';

describe('Milestone 3: Dual-Mode Coding Workspace Verification', () => {
  const testWorkspaceDir = join(process.cwd(), '.stratos-test-ws');
  const outsideDir = join(process.cwd(), '.stratos-outside-ws');

  beforeEach(() => {
    try {
      if (existsSync(testWorkspaceDir)) rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch {
      // Ignore transient directory lock
    }
    try {
      if (existsSync(outsideDir)) rmSync(outsideDir, { recursive: true, force: true });
    } catch {
      // Ignore transient directory lock
    }

    mkdirSync(testWorkspaceDir, { recursive: true });
    mkdirSync(outsideDir, { recursive: true });

    writeFileSync(join(testWorkspaceDir, 'file1.txt'), 'Hello Stratos M3', 'utf-8');
    writeFileSync(join(testWorkspaceDir, 'code.ts'), 'export const x = 42;\n', 'utf-8');
    mkdirSync(join(testWorkspaceDir, 'src'), { recursive: true });
    writeFileSync(join(testWorkspaceDir, 'src', 'index.ts'), 'console.log("hello");\n', 'utf-8');

    writeFileSync(join(outsideDir, 'secret.env'), 'SUPER_SECRET_KEY=12345', 'utf-8');
  });

  afterEach(() => {
    try {
      if (existsSync(testWorkspaceDir)) rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch {
      // Ignore transient directory lock
    }
    try {
      if (existsSync(outsideDir)) rmSync(outsideDir, { recursive: true, force: true });
    } catch {
      // Ignore transient directory lock
    }
  });

  describe('Workspace Filesystem & Security Boundaries (M3-WS-001, M3-WS-002, M3-WS-003, M3-SEC-001, M3-SEC-002)', () => {
    it('M3-WS-001: selects workspace folder, enforces root, and builds file tree', () => {
      const ws = new WorkspaceService();
      const setRes = ws.setRoot(testWorkspaceDir);

      expect(setRes.success).toBe(true);
      expect(ws.getRoot()).toBeTruthy();

      const tree = ws.getFileTree();
      expect(tree.length).toBeGreaterThan(0);
      const fileNames = tree.map((n) => n.name);
      expect(fileNames).toContain('file1.txt');
      expect(fileNames).toContain('code.ts');
      expect(fileNames).toContain('src');
    });

    it('AC-01: First launch has null root and builds empty file tree without opening installation directory', () => {
      const ws = new WorkspaceService();
      expect(ws.getRoot()).toBeNull();
      expect(ws.getFileTree()).toEqual([]);
    });

    it('AC-02 & AC-10: supports createFile, deleteFile, and renameFile safely within workspace', () => {
      const ws = new WorkspaceService(testWorkspaceDir);

      // Create file
      const createRes = ws.createFile('new_module.ts', 'export const created = true;\n');
      expect(createRes.success).toBe(true);
      expect(ws.readFile('new_module.ts').content).toContain('export const created = true;');

      // Reject duplicate create
      const duplicateRes = ws.createFile('new_module.ts', 'duplicate content');
      expect(duplicateRes.success).toBe(false);
      expect(duplicateRes.error).toContain('already exists');

      // Rename file
      const renameRes = ws.renameFile('new_module.ts', 'renamed_module.ts');
      expect(renameRes.success).toBe(true);
      expect(ws.readFile('renamed_module.ts').content).toContain('export const created = true;');
      expect(ws.readFile('new_module.ts').success).toBe(false);

      // Delete file
      const deleteRes = ws.deleteFile('renamed_module.ts');
      expect(deleteRes.success).toBe(true);
      expect(ws.readFile('renamed_module.ts').success).toBe(false);
    });

    it('AC-07: save failure returns error and does not overwrite existing file', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      // Attempting to write to an invalid path such as a directory or path traversal
      const writeFailRes = ws.writeFile('src', 'should not overwrite folder');
      expect(writeFailRes.success).toBe(false);
      expect(writeFailRes.error).toBeTruthy();
    });

    it('AC-09: Save As creates file in new target location cleanly', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const original = ws.readFile('file1.txt');
      expect(original.success).toBe(true);

      const saveAsRes = ws.writeFile('copied_file.txt', original.content || '');
      expect(saveAsRes.success).toBe(true);

      const copied = ws.readFile('copied_file.txt');
      expect(copied.content).toBe(original.content);
    });

    it('M3-WS-002: reads and writes file safely with correct content and mtime tracking', () => {
      const ws = new WorkspaceService(testWorkspaceDir);

      const readRes = ws.readFile('file1.txt');
      expect(readRes.success).toBe(true);
      expect(readRes.content).toBe('Hello Stratos M3');
      expect(readRes.mtimeMs).toBeGreaterThan(0);

      const writeRes = ws.writeFile('file1.txt', 'Updated content for M3', readRes.mtimeMs);
      expect(writeRes.success).toBe(true);

      const reRead = ws.readFile('file1.txt');
      expect(reRead.content).toBe('Updated content for M3');
    });

    it('M3-WS-003: detects external file conflict and prevents silent overwrite', async () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const readRes = ws.readFile('code.ts');
      expect(readRes.success).toBe(true);
      const initialMtime = readRes.mtimeMs;

      // Simulate external edit
      await new Promise((r) => setTimeout(r, 100));
      writeFileSync(join(testWorkspaceDir, 'code.ts'), 'export const x = 999; // externally changed\n');

      // Attempt to save with old expected mtime
      const conflictRes = ws.writeFile('code.ts', 'export const x = 100;', initialMtime);
      expect(conflictRes.success).toBe(false);
      expect(conflictRes.conflict).toBe(true);
      expect(conflictRes.error).toContain('conflict');

      // Verify file wasn't overwritten
      const checkRes = ws.readFile('code.ts');
      expect(checkRes.content).toContain('999');
    });

    it('M3-SEC-001 / SEC-008: blocks path traversal attempts outside workspace root', () => {
      const ws = new WorkspaceService(testWorkspaceDir);

      expect(() => ws.resolveSafePath('../../secret.env')).toThrow(/Security Violation.*Path traversal/);
      expect(() => ws.resolveSafePath('../.stratos-outside-ws/secret.env')).toThrow(/Security Violation.*Path traversal/);
      
      const fileRes = ws.readFile('../../../windows/system32/cmd.exe');
      expect(fileRes.success).toBe(false);
      expect(fileRes.error).toMatch(/Security Violation.*Path traversal/);
    });

    it('M3-SEC-001 / SEC-008: blocks cross-drive paths, UNC paths, null bytes, and NTFS streams', () => {
      const ws = new WorkspaceService(testWorkspaceDir);

      // Cross-drive attempt (e.g. D:\outside.txt on Windows)
      expect(() => ws.resolveSafePath('D:\\outside_secret.txt')).toThrow(/Security Violation.*Path traversal/);
      expect(() => ws.resolveSafePath('\\\\evil-server\\share\\secret.txt')).toThrow(/Security Violation.*Path traversal/);

      // Null byte injection attempt
      expect(() => ws.resolveSafePath('file1.txt\0.evil')).toThrow(/Security Violation.*Null byte/);

      // NTFS alternate data stream attempt (e.g. file1.txt::$DATA)
      expect(() => ws.resolveSafePath('file1.txt::$DATA')).toThrow(/Security Violation.*Alternate data stream/);
      expect(() => ws.resolveSafePath('file1.txt:hidden_stream')).toThrow(/Security Violation.*Alternate data stream/);
    });

    it('M3-SEC-001 / SEC-008: blocks Windows reserved DOS device names', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      expect(() => ws.resolveSafePath('CON')).toThrow(/Security Violation.*DOS device name/);
      expect(() => ws.resolveSafePath('aux.txt')).toThrow(/Security Violation.*DOS device name/);
      expect(() => ws.resolveSafePath('NUL')).toThrow(/Security Violation.*DOS device name/);
      expect(() => ws.resolveSafePath('COM1.log')).toThrow(/Security Violation.*DOS device name/);
    });

    it('M3-WS-002: writes files atomically without leaving temporary artifacts', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const res = ws.writeFile('atomic_test.txt', 'Content for atomic write');
      expect(res.success).toBe(true);

      const check = ws.readFile('atomic_test.txt');
      expect(check.success).toBe(true);
      expect(check.content).toBe('Content for atomic write');

      // Verify no leftover .tmp files
      const tree = ws.getFileTree();
      const tmpFiles = tree.filter((f) => f.name.endsWith('.tmp'));
      expect(tmpFiles.length).toBe(0);
    });

    it('M3-SEC-002 / SEC-009: blocks access via symlink pointing outside workspace root', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const symlinkPath = join(testWorkspaceDir, 'leak_symlink.txt');
      const targetOutsideFile = join(outsideDir, 'secret.env');

      try {
        symlinkSync(targetOutsideFile, symlinkPath, 'file');
      } catch {
        // In environments without symlink privileges, test direct escape check
        return;
      }

      expect(() => ws.resolveSafePath('leak_symlink.txt')).toThrow(/Security Violation.*Symlink/);
      const res = ws.readFile('leak_symlink.txt');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Security Violation.*Symlink/);
    });
  });

  describe('Diff Review & Approval (M3-DIFF-001, M3-DIFF-002)', () => {
    it('M3-DIFF-001: rejects proposed diff without altering original file', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const diffService = new DiffReviewService();

      const original = ws.readFile('file1.txt').content || '';
      const diff = diffService.proposeDiff('file1.txt', original, 'MALICIOUS_OR_UNWANTED_DIFF', 'Update file1');

      const rejectResult = diffService.rejectDiff(diff.id);
      expect(rejectResult.success).toBe(true);
      expect(rejectResult.applied).toBe(false);

      const current = ws.readFile('file1.txt').content;
      expect(current).toBe(original);
      expect(diff.status).toBe('rejected');
    });

    it('M3-DIFF-002: accepts reviewed diff and applies change cleanly to file', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const diffService = new DiffReviewService();

      const original = ws.readFile('file1.txt').content || '';
      const diff = diffService.proposeDiff('file1.txt', original, 'APPROVED_REFINED_CONTENT', 'Apply refined change');

      const applyResult = diffService.applyDiff(diff.id, ws);
      expect(applyResult.success).toBe(true);
      expect(applyResult.applied).toBe(true);

      const current = ws.readFile('file1.txt').content;
      expect(current).toBe('APPROVED_REFINED_CONTENT');
      expect(diff.status).toBe('accepted');
    });

    it('M3-DIFF-002 & M3-WS-003: rejects diff application if file was modified externally after proposal', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const diffService = new DiffReviewService();

      const original = ws.readFile('file1.txt').content || '';
      const diff = diffService.proposeDiff('file1.txt', original, 'MODIFIED_DIFF_CONTENT', 'Change file1');

      // External process modifies file1.txt in the background
      writeFileSync(join(testWorkspaceDir, 'file1.txt'), 'EXTERNAL_CONCURRENT_EDIT', 'utf-8');

      // Attempt to apply diff should detect conflict and abort
      const applyResult = diffService.applyDiff(diff.id, ws);
      expect(applyResult.success).toBe(false);
      expect(applyResult.applied).toBe(false);
      expect(applyResult.error).toContain('Conflict detected');

      // Verify file was NOT overwritten
      expect(ws.readFile('file1.txt').content).toBe('EXTERNAL_CONCURRENT_EDIT');
    });

    it('M3-DIFF-002: rejects diff application if target file was deleted externally after proposal', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const diffService = new DiffReviewService();

      const original = ws.readFile('file1.txt').content || '';
      const diff = diffService.proposeDiff('file1.txt', original, 'REPLACED_CONTENT', 'Change deleted file');

      // External process deletes file1.txt
      rmSync(join(testWorkspaceDir, 'file1.txt'), { force: true });

      // Attempt to apply diff should detect deletion conflict and abort
      const applyResult = diffService.applyDiff(diff.id, ws);
      expect(applyResult.success).toBe(false);
      expect(applyResult.applied).toBe(false);
      expect(applyResult.error).toContain('Conflict detected');
      expect(applyResult.error).toContain('deleted or inaccessible');
    });
  });

  describe('Terminal Execution & Process Safety (M3-TERM-001, M3-TERM-002, SEC-015)', () => {
    it('M3-TERM-001: executes harmless command and captures output and exit code', async () => {
      const term = new TerminalService(testWorkspaceDir);
      const res = await term.executeCommand('echo "Stratos Terminal OK"');

      expect(res.exitCode).toBe(0);
      expect(res.status).toBe('completed');
      expect(res.output).toContain('Stratos Terminal OK');
    });

    it('M3-TERM-002: stops running command and reflects termination status', async () => {
      const term = new TerminalService(testWorkspaceDir);

      // Start long-running command in background
      const executionPromise = term.executeCommand(
        process.platform === 'win32' ? 'Start-Sleep -Seconds 10' : 'sleep 10'
      );

      // Give it 150ms to spawn and register
      await new Promise((r) => setTimeout(r, 150));
      const active = term.listActive();
      expect(active.length).toBeGreaterThan(0);

      const pid = active[0].pid;
      const stopped = term.stopProcess(pid);
      expect(stopped).toBe(true);

      const result = await executionPromise;
      expect(result.status === 'terminated' || result.status === 'failed').toBe(true);
    });

    it('SEC-015 / PRD 6.2: requires confirmation for high-risk destructive commands', async () => {
      const term = new TerminalService(testWorkspaceDir);

      const unconfirmed = await term.executeCommand('rmdir /s old_dir', testWorkspaceDir, false);
      expect(unconfirmed.status).toBe('needs_confirmation');
      expect(unconfirmed.error).toContain('confirmation required');

      // Test PowerShell cmdlets
      const psUnconfirmed = await term.executeCommand('Remove-Item -Recurse -Force node_modules', testWorkspaceDir, false);
      expect(psUnconfirmed.status).toBe('needs_confirmation');

      const formatUnconfirmed = await term.executeCommand('Format-Volume -DriveLetter D', testWorkspaceDir, false);
      expect(formatUnconfirmed.status).toBe('needs_confirmation');

      const delUnconfirmed = await term.executeCommand('del /s /q temp_data', testWorkspaceDir, false);
      expect(delUnconfirmed.status).toBe('needs_confirmation');

      const confirmed = await term.executeCommand('echo "safe"', testWorkspaceDir, true);
      expect(confirmed.status).toBe('completed');
    });

    it('SEC-015: rejects terminal command when working directory is outside workspace root', async () => {
      const term = new TerminalService(testWorkspaceDir);
      const res = await term.executeCommand('echo test', outsideDir, false);

      expect(res.status).toBe('failed');
      expect(res.error).toContain('Security Violation: Terminal working directory must be within workspace root');
    });

    it('M3-TERM-001: caps excessive terminal output buffer to prevent OOM crash', async () => {
      const term = new TerminalService(testWorkspaceDir);
      const cmd = process.platform === 'win32'
        ? "Write-Output ('StratosBufferOverrunLine' * 50000)"
        : 'head -c 1200000 /dev/zero | tr "\\0" "A"';
      const res = await term.executeCommand(cmd, testWorkspaceDir, true);

      expect(res.output.length).toBeLessThanOrEqual(1024 * 1024 + 200);
      expect(res.output).toContain('[Output truncated: maximum 1MB buffer reached]');
    });
  });

  describe('Agent Orchestration & Workspace Modes (M3-AGENT-001, M3-AGENT-002, ADR-004)', () => {
    it('M3-AGENT-001: mode switching preserves session and unsaved messages', async () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const diffService = new DiffReviewService();
      const agent = new AgentOrchestrator(ws, diffService);

      await agent.sendPrompt('Tolong jelaskan struktur project ini', 'ide');
      const session1 = agent.getSession();
      expect(session1.messages.length).toBe(3); // welcome + user + assistant
      expect(session1.mode).toBe('ide');

      // Switch mode to terminal_agent
      agent.setMode('terminal_agent');
      const session2 = agent.getSession();
      expect(session2.mode).toBe('terminal_agent');
      expect(session2.messages.length).toBe(3);
      expect(session2.messages[1].content).toBe('Tolong jelaskan struktur project ini');
    });

    it('M3-AGENT-002: cancels agent task and stops running state', () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const diffService = new DiffReviewService();
      const agent = new AgentOrchestrator(ws, diffService);

      const cancelled = agent.cancelTask();
      expect(cancelled).toBe(true);
      expect(agent.getSession().isRunning).toBe(false);
    });

    it('AC-22 / ZERO-MOCK: Agent returns honest unconfigured warning when router has no credentials without faking responses', async () => {
      const ws = new WorkspaceService(testWorkspaceDir);
      const diffService = new DiffReviewService();
      const testDbDir = join(process.cwd(), '.stratos-test-agent-db');
      const testCredDir = join(process.cwd(), '.stratos-test-agent-creds');

      if (existsSync(testDbDir)) rmSync(testDbDir, { recursive: true, force: true });
      if (existsSync(testCredDir)) rmSync(testCredDir, { recursive: true, force: true });

      const db = new StratosDatabase(testDbDir);
      await db.initialize();
      const creds = new SecureCredentialStore(testCredDir);
      const router = new LocalRouterService(db, creds);

      const agent = new AgentOrchestrator(ws, diffService, router, creds);

      const session = await agent.sendPrompt('Buatkan saya fungsi login', 'ide');
      expect(session.isRunning).toBe(false);
      const lastMsg = session.messages[session.messages.length - 1];
      expect(lastMsg.role).toBe('assistant');
      expect(lastMsg.content).toContain('⚠️ Belum ada API Key provider AI yang dikonfigurasi');

      if (existsSync(testDbDir)) rmSync(testDbDir, { recursive: true, force: true });
      if (existsSync(testCredDir)) rmSync(testCredDir, { recursive: true, force: true });
    });
  });
});

