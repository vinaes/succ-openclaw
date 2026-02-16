import fs from 'node:fs';
import { z } from 'zod';
import { getMemoryById, incrementMemoryAccess } from '@vinaes/succ/api';
import { memorySearch } from './memory-search.js';
import { assertPathWithinWorkspace } from '../security.js';
import type { OpenClawGetResult } from '../types.js';

export const memoryGetSchema = z.object({
  path: z.string().describe('File path, memory:ID, or query string'),
  startLine: z.number().optional().describe('Starting line number (1-based)'),
  numLines: z.number().optional().describe('Number of lines to read'),
});

type MemoryGetParams = z.infer<typeof memoryGetSchema>;

/**
 * Tiered memory retrieval — replaces OpenClaw's native memory_get.
 *
 * 1. Literal file read (if path exists on disk)
 * 2. Memory by ID (if path = "memory:123")
 * 3. Semantic fallback (search for path as query, return best match)
 */
export async function memoryGet(params: MemoryGetParams): Promise<OpenClawGetResult> {
  const { path: filePath, startLine, numLines } = params;

  // Case 1: literal file path (validated against workspace boundary)
  const safePath = (() => { try { return assertPathWithinWorkspace(filePath, 'memory_get'); } catch { return null; } })();
  if (safePath && fs.existsSync(safePath)) {
    const fullContent = fs.readFileSync(safePath, 'utf-8');
    const lines = fullContent.split('\n');

    if (startLine !== undefined && numLines !== undefined) {
      const slice = lines.slice(startLine - 1, startLine - 1 + numLines);
      return { content: slice.join('\n'), path: safePath, lineCount: slice.length };
    }

    return { content: fullContent, path: safePath, lineCount: lines.length };
  }

  // Case 2: memory:ID
  if (filePath.startsWith('memory:')) {
    const id = parseInt(filePath.split(':')[1], 10);
    if (isNaN(id)) {
      throw new Error(`Invalid memory ID: ${filePath}`);
    }
    const memory = await getMemoryById(id);
    if (!memory) {
      throw new Error(`Memory ${id} not found`);
    }
    incrementMemoryAccess(id).catch((e) => console.warn('[succ] incrementMemoryAccess failed:', (e as Error).message));
    return {
      content: memory.content,
      path: `memory:${id}`,
      lineCount: memory.content.split('\n').length,
    };
  }

  // Case 3: semantic fallback
  const results = await memorySearch({ query: filePath, maxResults: 1, scope: 'all', output: 'full' });
  if (typeof results === 'string' || results.length === 0) {
    throw new Error(`Not found: ${filePath}`);
  }

  return {
    content: results[0].snippet,
    path: results[0].filePath,
    lineCount: results[0].lineRange.end - results[0].lineRange.start + 1,
  };
}
