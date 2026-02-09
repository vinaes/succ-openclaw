import { z } from 'zod';
import {
  hybridSearchMemories,
  hybridSearchGlobalMemories,
  getEmbedding,
  getRecentMemories,
  getRecentGlobalMemories,
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
