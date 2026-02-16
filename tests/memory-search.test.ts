import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  hybridSearchCode: vi.fn(),
  hybridSearchDocs: vi.fn(),
  hybridSearchMemories: vi.fn(),
  getEmbedding: vi.fn(),
}));

import { memorySearch } from '../src/tools/memory-search.js';
import { hybridSearchCode, hybridSearchDocs, hybridSearchMemories, getEmbedding } from '@vinaes/succ/api';

const mockGetEmbedding = vi.mocked(getEmbedding);
const mockSearchCode = vi.mocked(hybridSearchCode);
const mockSearchDocs = vi.mocked(hybridSearchDocs);
const mockSearchMemories = vi.mocked(hybridSearchMemories);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
});

describe('memorySearch', () => {
  it('returns empty array when no results found', async () => {
    mockSearchCode.mockResolvedValue([]);
    mockSearchDocs.mockResolvedValue([]);
    mockSearchMemories.mockResolvedValue([]);

    const results = await memorySearch({ query: 'nothing', maxResults: 10 });
    expect(results).toEqual([]);
  });

  it('merges results from all three sources sorted by score', async () => {
    mockSearchCode.mockResolvedValue([
      { content: 'code result', file_path: 'code:src/app.ts', start_line: 1, end_line: 10, similarity: 0.8 },
    ] as any);
    mockSearchDocs.mockResolvedValue([
      { content: 'doc result', file_path: 'docs/readme.md', start_line: 1, end_line: 5, similarity: 0.9 },
    ] as any);
    mockSearchMemories.mockResolvedValue([
      { content: 'memory result', id: 42, similarity: 0.7 },
    ] as any);

    const results = await memorySearch({ query: 'test', maxResults: 10 });

    expect(results).toHaveLength(3);
    // Sorted by score descending
    expect(results[0].provider).toBe('succ:docs');
    expect(results[0].score).toBe(0.9);
    expect(results[1].provider).toBe('succ:code');
    expect(results[1].filePath).toBe('src/app.ts'); // stripped code: prefix
    expect(results[2].provider).toBe('succ:memory');
    expect(results[2].filePath).toBe('memory:42');
  });

  it('respects maxResults limit', async () => {
    mockSearchCode.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        content: `code ${i}`, file_path: `file${i}.ts`, start_line: 1, end_line: 1, similarity: 0.5 + i * 0.01,
      })) as any,
    );
    mockSearchDocs.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        content: `doc ${i}`, file_path: `doc${i}.md`, start_line: 1, end_line: 1, similarity: 0.6 + i * 0.01,
      })) as any,
    );
    mockSearchMemories.mockResolvedValue([]);

    const results = await memorySearch({ query: 'test', maxResults: 3 });
    expect(results).toHaveLength(3);
  });

  it('truncates long snippets', async () => {
    const longContent = 'x'.repeat(1000);
    mockSearchCode.mockResolvedValue([
      { content: longContent, file_path: 'big.ts', start_line: 1, end_line: 1, similarity: 0.9 },
    ] as any);
    mockSearchDocs.mockResolvedValue([]);
    mockSearchMemories.mockResolvedValue([]);

    const results = await memorySearch({ query: 'test', maxResults: 10 }, 100);
    expect(results[0].snippet.length).toBe(100);
    expect(results[0].snippet.endsWith('...')).toBe(true);
  });

  it('handles search failures gracefully', async () => {
    mockSearchCode.mockRejectedValue(new Error('DB error'));
    mockSearchDocs.mockResolvedValue([]);
    mockSearchMemories.mockResolvedValue([
      { content: 'still works', id: 1, similarity: 0.5 },
    ] as any);

    const results = await memorySearch({ query: 'test', maxResults: 10 });
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe('succ:memory');
  });
});
