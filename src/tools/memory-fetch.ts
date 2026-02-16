import { z } from 'zod';
import { fetchAsMarkdown } from 'succ/api';

export const memoryFetchSchema = z.object({
  url: z.string().describe('URL to fetch and convert to markdown'),
  mode: z
    .enum(['fit', 'full'])
    .optional()
    .default('fit')
    .describe('Content mode: fit (30-50% fewer tokens) or full'),
  max_tokens: z.number().optional().describe('Truncate output to N tokens'),
  links: z
    .enum(['inline', 'citations'])
    .optional()
    .describe('Link format: inline (default) or citations (numbered references)'),
});

type FetchParams = z.infer<typeof memoryFetchSchema>;

/**
 * Fetch a web page and convert to clean markdown.
 *
 * Uses md.succ.ai with Readability content extraction and
 * optional Playwright fallback for JS-heavy pages.
 */
export async function memoryFetch(
  params: FetchParams,
): Promise<{ title: string; content: string; tokens: number; quality: string }> {
  const result = await fetchAsMarkdown(params.url, {
    mode: params.mode === 'fit' ? 'fit' : undefined,
    maxTokens: params.max_tokens,
    links: params.links === 'citations' ? 'citations' : undefined,
  });

  const content = params.mode === 'fit' && result.fitContent ? result.fitContent : result.content;
  const tokens = params.mode === 'fit' && result.fitTokens ? result.fitTokens : result.tokens;

  return {
    title: result.title || 'Untitled',
    content,
    tokens,
    quality: result.quality?.grade || 'unknown',
  };
}
