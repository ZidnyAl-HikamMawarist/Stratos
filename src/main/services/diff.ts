import { ProposedDiff, DiffReviewResult } from '../../shared/types';
import { WorkspaceService } from './workspace';
import { randomUUID } from 'crypto';

/**
 * Service managing proposed file changes, diff generation,
 * review, rejection, and application.
 * Satisfies: M3-DIFF-001, M3-DIFF-002.
 */
export class DiffReviewService {
  private proposedDiffs = new Map<string, ProposedDiff>();

  public proposeDiff(
    filePath: string,
    originalContent: string,
    proposedContent: string,
    summary: string
  ): ProposedDiff {
    const id = `diff_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const diff: ProposedDiff = {
      id,
      filePath,
      originalContent,
      proposedContent,
      summary,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.proposedDiffs.set(id, diff);
    return diff;
  }

  public listDiffs(): ProposedDiff[] {
    return Array.from(this.proposedDiffs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getDiff(id: string): ProposedDiff | undefined {
    return this.proposedDiffs.get(id);
  }

  /**
   * M3-DIFF-002: Accepts proposed diff and writes the reviewed change to disk.
   */
  public applyDiff(diffId: string, workspace: WorkspaceService): DiffReviewResult {
    const diff = this.proposedDiffs.get(diffId);
    if (!diff) {
      return { success: false, applied: false, error: `Diff proposal not found: ${diffId}` };
    }

    if (diff.status !== 'pending') {
      return { success: false, applied: false, error: `Diff is already ${diff.status}` };
    }

    // Verify external file conflict before writing (M3-DIFF-002, M3-WS-003)
    const currentRead = workspace.readFile(diff.filePath);
    if (diff.originalContent !== '' && !currentRead.success) {
      return {
        success: false,
        applied: false,
        error: `Conflict detected: '${diff.filePath}' was deleted or inaccessible externally since this diff was proposed. Apply aborted.`,
      };
    }
    if (currentRead.success && currentRead.content !== undefined && currentRead.content !== diff.originalContent) {
      return {
        success: false,
        applied: false,
        error: `Conflict detected: '${diff.filePath}' was modified externally since this diff was proposed. Apply aborted to prevent silent overwrite.`,
      };
    }

    const writeResult = workspace.writeFile(diff.filePath, diff.proposedContent, currentRead.mtimeMs);
    if (!writeResult.success) {
      return { success: false, applied: false, error: writeResult.error };
    }

    diff.status = 'accepted';
    return { success: true, applied: true };
  }

  /**
   * M3-DIFF-001: Rejects proposed diff without modifying the original file.
   */
  public rejectDiff(diffId: string): DiffReviewResult {
    const diff = this.proposedDiffs.get(diffId);
    if (!diff) {
      return { success: false, applied: false, error: `Diff proposal not found: ${diffId}` };
    }

    if (diff.status !== 'pending') {
      return { success: false, applied: false, error: `Diff is already ${diff.status}` };
    }

    diff.status = 'rejected';
    // Original file remains unchanged
    return { success: true, applied: false };
  }
}
