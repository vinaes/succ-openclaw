import fs from 'node:fs';
import path from 'node:path';

/**
 * Initialize .succ/ directory for an OpenClaw workspace.
 * Called on plugin load if autoInit is enabled and .succ/ doesn't exist.
 */
export async function initializeSuccProject(workspaceRoot: string): Promise<void> {
  const succDir = path.join(workspaceRoot, '.succ');

  if (fs.existsSync(succDir)) {
    return;
  }

  fs.mkdirSync(succDir, { recursive: true });
  fs.mkdirSync(path.join(succDir, 'brain'), { recursive: true });
  fs.mkdirSync(path.join(succDir, '.tmp'), { recursive: true });

  const configPath = path.join(succDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          embedding_mode: 'local',
          quality_scoring_enabled: true,
          sensitive_filter_enabled: true,
          graph_auto_link: true,
        },
        null,
        2,
      ),
    );
  }

  const gitignorePath = path.join(succDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, '*.db\n*.db-shm\n*.db-wal\n.tmp/\n');
  }
}

/**
 * Check if .succ/ exists and is valid.
 */
export function isSuccInitialized(workspaceRoot: string): boolean {
  const succDir = path.join(workspaceRoot, '.succ');
  return fs.existsSync(succDir) && fs.existsSync(path.join(succDir, 'config.json'));
}
