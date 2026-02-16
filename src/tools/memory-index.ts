import fs from 'node:fs';
import { z } from 'zod';
import {
  upsertDocument,
  getEmbedding,
  getFileHash,
  setFileHash,
  invalidateDocsBm25Index,
} from '@vinaes/succ/api';
import { createHash } from 'node:crypto';
import { assertPathWithinWorkspace } from '../security.js';

export const memoryIndexSchema = z.object({
  path: z.string().describe('File path to index'),
  force: z.boolean().optional().default(false).describe('Force re-index even if unchanged'),
});

type MemoryIndexParams = z.infer<typeof memoryIndexSchema>;

/**
 * Incremental file indexing — NEW tool for OpenClaw.
 *
 * Index a documentation or source file into succ's search index.
 * Skips unchanged files unless force=true.
 */
export async function memoryIndex(params: MemoryIndexParams): Promise<{ message: string; indexed: boolean }> {
  const { path: filePath, force } = params;
  const safePath = assertPathWithinWorkspace(filePath, 'memory_index');

  if (!fs.existsSync(safePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(safePath, 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex');

  if (!force) {
    const existingHash = await getFileHash(filePath);
    if (existingHash === hash) {
      return { message: `File unchanged: ${filePath}`, indexed: false };
    }
  }

  const embedding = await getEmbedding(content);
  const lineCount = content.split('\n').length;
  await upsertDocument(filePath, 0, content, 1, lineCount, embedding);
  await setFileHash(filePath, hash);
  invalidateDocsBm25Index();

  return { message: `Indexed: ${filePath}`, indexed: true };
}
