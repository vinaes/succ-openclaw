import { z } from 'zod';
import { saveMemory, getEmbedding } from '@vinaes/succ/api';
import { MEMORY_TYPES, type MemoryType } from '../types.js';

export const memoryStoreSchema = z.object({
  content: z.string().describe('Content to remember'),
  type: z
    .enum(MEMORY_TYPES as unknown as [string, ...string[]])
    .optional()
    .default('observation')
    .describe('Memory type: observation, decision, learning, error, pattern, dead_end'),
  tags: z.array(z.string()).optional().default([]).describe('Tags for categorization'),
  source: z.string().optional().default('openclaw').describe('Source context'),
});

type MemoryStoreParams = z.infer<typeof memoryStoreSchema>;

/**
 * Explicit memory storage — wraps succ_remember for OpenClaw.
 *
 * Saves content with type classification, tags, and auto-embedding.
 */
export async function memoryStore(params: MemoryStoreParams): Promise<{ id: number; message: string }> {
  const { content, type, tags, source } = params;
  const allTags = [...new Set([...tags, 'openclaw'])];
  const embedding = await getEmbedding(content);

  const result = await saveMemory(content, embedding, allTags, source, {
    type: type as MemoryType,
  });

  return {
    id: (result as any).id ?? 0,
    message: `Saved ${type} memory (tags: ${allTags.join(', ')})`,
  };
}
