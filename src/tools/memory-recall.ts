import { z } from 'zod';
import {
  hybridSearchMemories,
  hybridSearchGlobalMemories,
  getEmbedding,
  getRecentMemories,
  getRecentGlobalMemories,
  findSimilarMemory,
  findSimilarGlobalMemory,
} from 'succ/api';

export const memoryRecallSchema = z.object({
  query: z.string().describe('What to recall (semantic search)'),
  limit: z.number().optional().default(5).describe('Max number of memories'),
  tags: z.array(z.string()).optional().describe('Filter by tags'),
  since: z.string().optional().describe('Only memories after this date (ISO or "yesterday", "last week")'),
  as_of_date: z.string().optional().describe('Point-in-time query — show memories as valid on this date (ISO format)'),
});

type MemoryRecallParams = z.infer<typeof memoryRecallSchema>;

/**
 * Semantic memory recall with filtering — separate from memory_search.
 *
 * memory_search is unified (code + docs + memories).
 * memory_recall is specifically for structured memories with temporal queries,
 * tag filtering, and point-in-time retrieval.
 */
export async function memoryRecall(params: MemoryRecallParams): Promise<any[]> {
  const { query, limit, tags, since, as_of_date } = params;
  const embedding = await getEmbedding(query);

  // Search local + global memories
  const [localResults, globalResults] = await Promise.all([
    hybridSearchMemories(query, embedding, limit, 0.3).catch(() => []),
    hybridSearchGlobalMemories(query, embedding, limit, 0.3).catch(() => []),
  ]);

  let results = [...localResults, ...globalResults] as any[];

  // Filter by tags
  if (tags && tags.length > 0) {
    results = results.filter((r: any) => {
      const memTags = typeof r.tags === 'string' ? r.tags.split(',').map((t: string) => t.trim()) : r.tags || [];
      return tags.some(t => memTags.includes(t));
    });
  }

  // Filter by since
  if (since) {
    const sinceDate = parseSince(since);
    results = results.filter((r: any) => new Date(r.created_at) >= sinceDate);
  }

  // Filter by as_of_date (temporal validity)
  if (as_of_date) {
    const asOf = new Date(as_of_date);
    results = results.filter((r: any) => {
      const validFrom = r.valid_from ? new Date(r.valid_from) : new Date(0);
      const validUntil = r.valid_until ? new Date(r.valid_until) : new Date('9999-12-31');
      return asOf >= validFrom && asOf <= validUntil;
    });
  }

  return results
    .sort((a: any, b: any) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, limit)
    .map((r: any) => ({
      id: r.id,
      content: r.content,
      type: r.type || 'observation',
      tags: typeof r.tags === 'string' ? r.tags.split(',').map((t: string) => t.trim()) : r.tags || [],
      source: r.source,
      created_at: r.created_at,
      similarity: r.similarity,
      valid_from: r.valid_from,
      valid_until: r.valid_until,
      is_global: !!r.is_global,
    }));
}

export const memorySimilarSchema = z.object({
  content: z.string().describe('Content to check for duplicates'),
  threshold: z
    .number()
    .optional()
    .default(0.85)
    .describe('Similarity threshold (0-1, default 0.85)'),
  global: z
    .boolean()
    .optional()
    .default(false)
    .describe('Check global memories instead of project-local'),
});

type MemorySimilarParams = z.infer<typeof memorySimilarSchema>;

/**
 * Find similar/duplicate memories before storing.
 * Prevents memory bloat by checking if content already exists.
 */
export async function memorySimilar(
  params: MemorySimilarParams,
): Promise<{ found: boolean; match?: { id: number; content: string; similarity: number } }> {
  const embedding = await getEmbedding(params.content);
  const searchFn = params.global ? findSimilarGlobalMemory : findSimilarMemory;
  const match = await searchFn(embedding, params.threshold);

  if (match) {
    return {
      found: true,
      match: {
        id: (match as any).id,
        content: (match as any).content,
        similarity: (match as any).similarity ?? params.threshold,
      },
    };
  }

  return { found: false };
}

function parseSince(since: string): Date {
  const now = new Date();
  switch (since.toLowerCase()) {
    case 'yesterday':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'last week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'last month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(since);
  }
}
