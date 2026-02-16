import { z } from 'zod';
import {
  hybridSearchCode,
  hybridSearchDocs,
  hybridSearchMemories,
  getEmbedding,
} from '@vinaes/succ/api';
import type { OpenClawSearchResult } from '../types.js';

export const memorySearchSchema = z.object({
  query: z.string().describe('Search query (semantic or keyword)'),
  maxResults: z.number().optional().default(10).describe('Maximum results to return'),
  scope: z.enum(['all', 'code', 'docs', 'memories']).optional().default('all')
    .describe('Search scope: all (default), code, docs, or memories only'),
  regex: z.string().optional()
    .describe('Regex filter for code results — only return results matching this pattern'),
  symbol_type: z.enum(['function', 'method', 'class', 'interface', 'type_alias']).optional()
    .describe('Filter code results by AST symbol type'),
  output: z.enum(['full', 'lean', 'signatures']).optional().default('full')
    .describe('Output mode: full (snippets), lean (file+lines only), signatures (symbol names+signatures, code only)'),
});

type MemorySearchParams = z.infer<typeof memorySearchSchema>;

/**
 * Unified memory search — replaces OpenClaw's native memory_search.
 *
 * Queries three succ indexes in parallel:
 * 1. Code index (source files) — supports regex, symbol_type filters
 * 2. Docs index (brain vault / markdown)
 * 3. Memories (observations, decisions, learnings, etc.)
 *
 * Results are merged by similarity score and truncated to maxResults.
 * Output modes: full (default), lean (file+lines), signatures (code symbols only).
 */
export async function memorySearch(
  params: MemorySearchParams,
  snippetMaxChars: number = 700,
): Promise<OpenClawSearchResult[] | string> {
  const { query, maxResults, regex, symbol_type } = params;
  const scope = params.scope ?? 'all';
  const output = params.output ?? 'full';
  const embedding = await getEmbedding(query);

  const codeFilters = (regex || symbol_type)
    ? { regex, symbolType: symbol_type }
    : undefined;

  const searchCode = scope === 'all' || scope === 'code';
  const searchDocs = scope === 'all' || scope === 'docs';
  const searchMemories = scope === 'all' || scope === 'memories';

  const [codeResults, docsResults, memoryResults] = await Promise.all([
    searchCode
      ? hybridSearchCode(query, embedding, maxResults, 0.25, undefined, codeFilters).catch((err) => { console.warn('[succ] Code search failed:', err.message); return []; })
      : Promise.resolve([]),
    searchDocs
      ? hybridSearchDocs(query, embedding, maxResults, 0.2).catch((err) => { console.warn('[succ] Docs search failed:', err.message); return []; })
      : Promise.resolve([]),
    searchMemories
      ? hybridSearchMemories(query, embedding, maxResults, 0.3).catch((err) => { console.warn('[succ] Memory search failed:', err.message); return []; })
      : Promise.resolve([]),
  ]);

  // --- Lean output: file+lines only ---
  if (output === 'lean') {
    const lines: string[] = [];
    let i = 1;
    for (const r of codeResults as any[]) {
      const score = ((r.similarity ?? 0) * 100).toFixed(1);
      lines.push(`${i++}. ${(r.file_path || '').replace(/^code:/, '')}:${r.start_line}-${r.end_line} (${score}%)`);
    }
    for (const r of docsResults as any[]) {
      const score = ((r.similarity ?? 0) * 100).toFixed(1);
      lines.push(`${i++}. ${r.file_path || ''}:${r.start_line}-${r.end_line} (${score}%)`);
    }
    for (const r of memoryResults as any[]) {
      const score = ((r.similarity ?? 0) * 100).toFixed(1);
      lines.push(`${i++}. memory:${r.id} (${score}%)`);
    }
    return lines.slice(0, maxResults).join('\n') || 'No results found.';
  }

  // --- Signatures output: symbol names + signatures (code only) ---
  if (output === 'signatures') {
    const lines: string[] = [];
    let i = 1;
    for (const r of codeResults as any[]) {
      const score = ((r.similarity ?? 0) * 100).toFixed(1);
      const filePath = (r.file_path || '').replace(/^code:/, '');
      const sig = extractSignatureLine(r.content);
      lines.push(`${i++}. ${filePath}:${r.start_line} (${score}%) — ${sig}`);
    }
    return lines.slice(0, maxResults).join('\n') || 'No code results found.';
  }

  // --- Full output: OpenClawSearchResult[] ---
  const merged: OpenClawSearchResult[] = [
    ...codeResults.map((r: any) => ({
      snippet: truncateSnippet(r.content, snippetMaxChars),
      filePath: (r.file_path || '').replace(/^code:/, ''),
      lineRange: { start: r.start_line ?? 0, end: r.end_line ?? 0 },
      score: r.similarity ?? 0,
      vectorScore: r.similarity ?? 0,
      textScore: r.similarity ?? 0,
      provider: 'succ:code',
      symbolType: r.symbol_type,
      symbolName: r.symbol_name,
      signature: r.signature,
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

/**
 * Extract the first meaningful line from code content for signatures output.
 * Skips JSDoc comments, blank lines, and decorator lines.
 */
function extractSignatureLine(content: string): string {
  if (!content) return '(no content)';
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('/**') || trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
    if (trimmed.startsWith('@') && !trimmed.startsWith('@param')) continue;
    return trimmed;
  }
  return lines[0]?.trim() || '(no content)';
}

function truncateSnippet(content: string, maxChars: number): string {
  if (!content) return '';
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars - 3) + '...';
}
