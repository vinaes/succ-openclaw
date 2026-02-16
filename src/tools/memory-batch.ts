import path from 'path';
import { z } from 'zod';
import { saveMemoriesBatch, deleteMemoriesByIds, getEmbeddings, parseDuration, scanSensitive } from '@vinaes/succ/api';
import { MEMORY_TYPES } from '../types.js';

export const memoryBatchStoreSchema = z.object({
  memories: z
    .array(
      z.object({
        content: z.string().describe('Content to remember'),
        type: z
          .enum(MEMORY_TYPES as unknown as [string, ...string[]])
          .optional()
          .default('observation')
          .describe('Memory type'),
        tags: z.array(z.string()).optional().default([]).describe('Tags'),
        source: z.string().optional().default('openclaw').describe('Source context'),
        files: z.array(z.string()).optional().describe('File paths for auto file:{basename} tags'),
        valid_from: z.string().optional().describe('When valid. ISO date or duration (7d, 2w).'),
        valid_until: z.string().optional().describe('When expires. ISO date or duration (30d).'),
      }),
    )
    .describe('Array of memories to save'),
});

export const memoryBatchDeleteSchema = z.object({
  ids: z.array(z.number()).describe('Memory IDs to delete'),
});

type BatchStoreParams = z.infer<typeof memoryBatchStoreSchema>;
type BatchDeleteParams = z.infer<typeof memoryBatchDeleteSchema>;

/**
 * Batch memory save — saves multiple memories in one call.
 */
export async function memoryBatchStore(
  params: BatchStoreParams,
): Promise<{ saved: number; message: string }> {
  // Filter out sensitive content
  const filtered = params.memories.filter((m) => {
    const result = scanSensitive(m.content);
    if (result.hasSensitive) {
      console.warn(`[succ] Blocked batch item: sensitive content (${result.matches.map((x) => x.type).join(', ')})`);
    }
    return !result.hasSensitive;
  });

  if (filtered.length === 0) {
    return { saved: 0, message: 'All items blocked: sensitive content detected.' };
  }

  const contents = filtered.map((m) => m.content);
  const embeddings = await getEmbeddings(contents);

  if (embeddings.length !== contents.length) {
    throw new Error(
      `Embedding count mismatch: got ${embeddings.length}, expected ${contents.length}`,
    );
  }

  const batch = filtered.map((m, i) => {
    let tags = [...new Set([...(m.tags || []), 'openclaw'])];
    if (m.files && m.files.length > 0) {
      const fileTags = m.files.map((f) => `file:${path.basename(f)}`);
      tags = [...new Set([...tags, ...fileTags])];
    }

    let validFrom: string | undefined;
    let validUntil: string | undefined;
    if (m.valid_from) {
      try { validFrom = parseDuration(m.valid_from).toISOString(); }
      catch { console.warn(`[succ] Invalid valid_from in batch item: ${m.valid_from}`); }
    }
    if (m.valid_until) {
      try { validUntil = parseDuration(m.valid_until).toISOString(); }
      catch { console.warn(`[succ] Invalid valid_until in batch item: ${m.valid_until}`); }
    }

    return {
      content: m.content,
      embedding: embeddings[i],
      tags,
      source: m.source || 'openclaw',
      type: m.type || 'observation',
      validFrom,
      validUntil,
    };
  });

  const result = await saveMemoriesBatch(batch);
  const saved = result.saved ?? 0;
  const skipped = result.skipped ?? 0;

  return {
    saved,
    message: `Saved ${saved}/${filtered.length} memories${params.memories.length !== filtered.length ? ` (${params.memories.length - filtered.length} blocked)` : ''} (${skipped} duplicates skipped)`,
  };
}

/**
 * Batch memory delete — deletes multiple memories by IDs.
 */
export async function memoryBatchDelete(
  params: BatchDeleteParams,
): Promise<{ deleted: number; message: string }> {
  if (params.ids.length === 0) {
    return { deleted: 0, message: 'No IDs provided' };
  }

  const deleted = await deleteMemoriesByIds(params.ids);
  return {
    deleted,
    message: `Deleted ${deleted}/${params.ids.length} memories`,
  };
}
