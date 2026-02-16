import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  fetchAsMarkdown: vi.fn(),
}));

import { memoryFetch } from '../src/tools/memory-fetch.js';
import { fetchAsMarkdown } from '@vinaes/succ/api';

const mockFetch = vi.mocked(fetchAsMarkdown);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('memoryFetch', () => {
  it('fetches URL and returns markdown content', async () => {
    mockFetch.mockResolvedValue({
      title: 'Test Page',
      url: 'https://example.com',
      content: '# Hello World',
      excerpt: 'Hello',
      byline: '',
      siteName: 'Example',
      tokens: 100,
      tier: 'fetch',
      readability: true,
      method: 'readability',
      quality: { score: 0.9, grade: 'A' },
      time_ms: 500,
    } as any);

    const result = await memoryFetch({ url: 'https://example.com', mode: 'full' });

    expect(result.title).toBe('Test Page');
    expect(result.content).toBe('# Hello World');
    expect(result.tokens).toBe(100);
    expect(result.quality).toBe('A');
    expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
      mode: undefined,
      maxTokens: undefined,
      links: undefined,
    });
  });

  it('returns fitContent when mode=fit', async () => {
    mockFetch.mockResolvedValue({
      title: 'Fit Page',
      url: 'https://example.com',
      content: '# Full content with lots of stuff',
      fitContent: '# Optimized content',
      tokens: 200,
      fitTokens: 120,
      quality: { score: 0.8, grade: 'B' },
    } as any);

    const result = await memoryFetch({ url: 'https://example.com', mode: 'fit' });

    expect(result.content).toBe('# Optimized content');
    expect(result.tokens).toBe(120);
  });

  it('passes citations link mode', async () => {
    mockFetch.mockResolvedValue({
      title: 'Test',
      content: 'content',
      tokens: 50,
      quality: { grade: 'C' },
    } as any);

    await memoryFetch({ url: 'https://example.com', mode: 'fit', links: 'citations' });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com', {
      mode: 'fit',
      maxTokens: undefined,
      links: 'citations',
    });
  });
});
