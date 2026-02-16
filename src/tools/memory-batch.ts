import { z } from 'zod';
import { saveMemoriesBatch, deleteMemoriesByIds, getEmbeddings } from '@vinaes/succ/api';
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
  const contents = params.memories.map((m) => m.content);
  const embeddings = await getEmbeddings(contents);

  if (embeddings.length !== contents.length) {
    throw new Error(
      `Embedding count mismatch: got ${embeddings.length}, expected ${contents.length}`,
    );
  }

  const batch = params.memories.map((m, i) => ({
    content: m.content,
    embedding: embeddings[i],
    tags: [...new Set([...(m.tags || []), 'openclaw'])],
    source: m.source || 'openclaw',
    type: m.type || 'observation',
  }));

  const result = await saveMemoriesBatch(batch);
  const saved = result.saved ?? 0;
  const skipped = result.skipped ?? 0;

  return {
    saved,
    message: `Saved ${saved}/${params.memories.length} memories (${skipped} duplicates skipped)`,
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
