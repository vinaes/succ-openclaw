import fs from 'node:fs';
import { upsertDocument, getEmbedding, setFileHash } from 'succ/api';
import { createHash } from 'node:crypto';

/**
 * File change hook — re-indexes files when they change in the workspace.
 *
 * Triggered by OpenClaw's file watcher. Only processes files we care about
 * (markdown, code files in the project).
 */
export async function onFileChanged(event: any): Promise<void> {
  try {
    const filePath: string = event?.path ?? event?.filePath;
    if (!filePath) return;

    // Only index markdown and common source files
    if (!shouldIndex(filePath)) return;

    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.trim()) return;

    const hash = createHash('sha256').update(content).digest('hex');
    const embedding = await getEmbedding(content);

    await upsertDocument(filePath, content, embedding);
    await setFileHash(filePath, hash);
  } catch (err) {
    console.error('[succ] file change hook error:', err);
  }
}

const INDEXABLE_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.php',
  '.swift',
  '.kt',
  '.c',
  '.cpp',
  '.h',
  '.cs',
]);

function shouldIndex(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (!INDEXABLE_EXTENSIONS.has(ext)) return false;

  // Skip node_modules, .git, dist, build
  if (/[/\\](node_modules|\.git|dist|build|\.next|__pycache__)[/\\]/.test(filePath)) return false;

  return true;
}
