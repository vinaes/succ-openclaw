import { z } from 'zod';
import {
  hybridSearchCode,
  hybridSearchDocs,
  hybridSearchMemories,
  getEmbedding,
} from 'succ/api';
import type { OpenClawSearchResult } from '../types.js';

export const memorySearchSchema = z.object({
  query: z.string().describe('Search query (semantic or keyword)'),
  maxResults: z.number().optional().default(10).describe('Maximum results to return'),
});

type MemorySearchParams = z.infer<typeof memorySearchSchema>;

/**
 * Unified memory search — replaces OpenClaw's native memory_search.
 *
 * Queries three succ indexes in parallel:
 * 1. Code index (source files)
 * 2. Docs index (brain vault / markdown)
 * 3. Memories (observations, decisions, learnings, etc.)
 *
 * Results are merged by similarity score and truncated to maxResults.
 */
export async function memorySearch(
  params: MemorySearchParams,
  snippetMaxChars: number = 700,
): Promise<OpenClawSearchResult[]> {
  const { query, maxResults } = params;
  const embedding = await getEmbedding(query);

  const [codeResults, docsResults, memoryResults] = await Promise.all([
    hybridSearchCode(query, embedding, maxResults, 0.25).catch(() => []),
    hybridSearchDocs(query, embedding, maxResults, 0.2).catch(() => []),
    hybridSearchMemories(query, embedding, maxResults, 0.3).catch(() => []),
  ]);

  const merged: OpenClawSearchResult[] = [
    ...codeResults.map((r: any) => ({
      snippet: truncateSnippet(r.content, snippetMaxChars),
      filePath: (r.file_path || '').replace(/^code:/, ''),
      lineRange: { start: r.start_line ?? 0, end: r.end_line ?? 0 },
      score: r.similarity ?? 0,
      vectorScore: r.similarity ?? 0,
      textScore: r.similarity ?? 0,
      provider: 'succ:code',
    })),
    ...docsResults.map((r: any) => ({
      snippet: truncateSnippet(r.content, snippetMaxChars),
      filePath: r.file_path || '',
      lineRange: { start: r.start_line ?? 0, end: r.end_line ?? 0 },
      score: r.similarity ?? 0,
      vectorScore: r.similarity ?? 0,
      textScore: r.similarity ?? 0,
      provider: 'succ:docs',
    })),
    ...memoryResults.map((r: any) => ({
      snippet: truncateSnippet(r.content, snippetMaxChars),
      filePath: `memory:${r.id}`,
      lineRange: { start: 0, end: 0 },
      score: r.similarity ?? 0,
      vectorScore: r.similarity ?? 0,
      textScore: r.similarity ?? 0,
      provider: 'succ:memory',
    })),
  ];

  return merged.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

function truncateSnippet(content: string, maxChars: number): string {
  if (!content) return '';
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars - 3) + '...';
}
