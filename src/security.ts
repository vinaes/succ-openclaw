import path from 'node:path';

/**
 * Validates that a file path is within the workspace boundary.
 * Prevents path traversal attacks (../../etc/passwd, absolute paths outside workspace).
 *
 * @throws Error if path escapes workspace boundary
 */
export function assertPathWithinWorkspace(filePath: string, context: string = 'file access'): string {
  const workspaceRoot = process.env.SUCC_PROJECT_ROOT;
  if (!workspaceRoot) {
    throw new Error(`[succ] SUCC_PROJECT_ROOT not set — cannot validate path for ${context}`);
  }

  const resolved = path.resolve(workspaceRoot, filePath);
  const normalizedRoot = path.resolve(workspaceRoot);

  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    throw new Error(`[succ] Access denied: path "${filePath}" is outside workspace boundary`);
  }

  return resolved;
}

/**
 * Validates that a file path is within .succ/brain/ directory.
 * Used by markdown bridge to prevent writing outside the brain vault.
 */
export function assertPathWithinBrainVault(filePath: string): string {
  const workspaceRoot = process.env.SUCC_PROJECT_ROOT;
  if (!workspaceRoot) {
    throw new Error('[succ] SUCC_PROJECT_ROOT not set — cannot validate brain vault path');
  }

  const brainDir = path.resolve(workspaceRoot, '.succ', 'brain');
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(brainDir + path.sep) && resolved !== brainDir) {
    throw new Error(`[succ] Access denied: path "${filePath}" is outside .succ/brain/ directory`);
  }

  return resolved;
}
