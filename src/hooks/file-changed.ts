import fs from 'node:fs';
import path from 'node:path';
import { upsertDocument, getEmbedding, setFileHash } from 'succ/api';
import { createHash } from 'node:crypto';
import { assertPathWithinWorkspace } from '../security.js';

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

    // Validate path is within workspace boundary
    let safePath: string;
    try {
      safePath = assertPathWithinWorkspace(filePath, 'file_changed_hook');
    } catch {
      return; // Silently skip files outside workspace
    }

    // Only index markdown and common source files
    if (!shouldIndex(safePath)) return;

    if (!fs.existsSync(safePath)) return;

    const content = fs.readFileSync(safePath, 'utf-8');
    if (!content.trim()) return;

    const hash = createHash('sha256').update(content).digest('hex');
    const embedding = await getEmbedding(content);
    const lineCount = content.split('\n').length;

    await upsertDocument(filePath, 0, content, 1, lineCount, embedding);
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
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (!INDEXABLE_EXTENSIONS.has(ext)) return false;

  // Skip node_modules, .git, dist, build — case-insensitive for Windows
  const normalized = path.normalize(filePath);
  const segments = normalized.split(path.sep);
  const ignored = /^(node_modules|\.git|dist|build|\.next|__pycache__)$/i;
  if (segments.some(seg => ignored.test(seg))) return false;

  return true;
}
