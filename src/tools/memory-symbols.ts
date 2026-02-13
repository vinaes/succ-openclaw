import { z } from 'zod';
import { extractSymbolsFromFile } from 'succ/api';
import type { SymbolInfo } from 'succ/api';
import { assertPathWithinWorkspace } from '../security.js';

export const memorySymbolsSchema = z.object({
  file: z.string().describe('Path to the source file to extract symbols from'),
  type: z.enum(['all', 'function', 'method', 'class', 'interface', 'type_alias']).optional().default('all')
    .describe('Filter by symbol type (default: all)'),
});

type MemorySymbolsParams = z.infer<typeof memorySymbolsSchema>;

/**
 * Extract AST symbols from a source file using tree-sitter.
 *
 * Returns function names, class definitions, interfaces, type aliases
 * with signatures and line numbers. Supports 13 languages.
 */
export async function memorySymbols(params: MemorySymbolsParams): Promise<string> {
  const { file, type } = params;
  const safePath = assertPathWithinWorkspace(file, 'memory_symbols');

  const result = await extractSymbolsFromFile(safePath, {
    type: type as SymbolInfo['type'] | 'all',
  });

  if (result.symbols.length === 0) {
    return `No ${type === 'all' ? '' : type + ' '}symbols found in ${file}`;
  }

  const lines = result.symbols.map(s => {
    const sig = s.signature ? `: ${s.signature}` : '';
    const doc = s.docComment ? ` — ${s.docComment.split('\n')[0]}` : '';
    return `  ${s.type} **${s.name}**${sig} (L${s.startRow + 1}-${s.endRow + 1})${doc}`;
  });

  return `${result.symbols.length} symbols in ${file} (${result.language}):\n\n${lines.join('\n')}`;
}
