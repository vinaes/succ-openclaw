import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  hybridSearchMemories: vi.fn(),
  hybridSearchGlobalMemories: vi.fn(),
  getEmbedding: vi.fn(),
  getRecentMemories: vi.fn(),
  getRecentGlobalMemories: vi.fn(),
  findSimilarMemory: vi.fn(),
  findSimilarGlobalMemory: vi.fn(),
  incrementMemoryAccess: vi.fn().mockResolvedValue(undefined),
}));

import { memoryRecall, memorySimilar } from '../src/tools/memory-recall.js';
import {
  hybridSearchMemories,
  hybridSearchGlobalMemories,
  getEmbedding,
  findSimilarMemory,
  findSimilarGlobalMemory,
} from '@vinaes/succ/api';

const mockLocal = vi.mocked(hybridSearchMemories);
const mockGlobal = vi.mocked(hybridSearchGlobalMemories);
const mockEmbed = vi.mocked(getEmbedding);
const mockFindSimilar = vi.mocked(findSimilarMemory);
const mockFindSimilarGlobal = vi.mocked(findSimilarGlobalMemory);

beforeEach(() => {
  vi.clearAllMocks();
  mockEmbed.mockResolvedValue([0.1, 0.2]);
});

describe('memoryRecall', () => {
  it('returns merged local + global results sorted by similarity', async () => {
    mockLocal.mockResolvedValue([
      { id: 1, content: 'local hit', similarity: 0.8, type: 'decision', tags: 'arch', source: 'test', created_at: '2025-01-01' },
    ] as any);
    mockGlobal.mockResolvedValue([
      { id: 2, content: 'global hit', similarity: 0.9, type: 'learning', tags: 'js', source: 'test', created_at: '2025-01-02', is_global: true },
    ] as any);

    const results = await memoryRecall({ query: 'auth', limit: 5 });
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(2); // higher similarity first
    expect(results[0].is_global).toBe(true);
    expect(results[1].id).toBe(1);
  });

  it('filters by tags', async () => {
    mockLocal.mockResolvedValue([
      { id: 1, content: 'a', similarity: 0.8, tags: 'arch,perf', created_at: '2025-01-01' },
      { id: 2, content: 'b', similarity: 0.7, tags: 'ui', created_at: '2025-01-01' },
    ] as any);
    mockGlobal.mockResolvedValue([] as any);

    const results = await memoryRecall({ query: 'test', limit: 5, tags: ['arch'] });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(1);
  });

  it('filters by since', async () => {
    mockLocal.mockResolvedValue([
      { id: 1, content: 'old', similarity: 0.8, tags: '', created_at: '2020-01-01' },
      { id: 2, content: 'new', similarity: 0.7, tags: '', created_at: '2025-06-01' },
    ] as any);
    mockGlobal.mockResolvedValue([] as any);

    const results = await memoryRecall({ query: 'test', limit: 5, since: '2025-01-01' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(2);
  });

  it('filters by as_of_date (temporal validity)', async () => {
    mockLocal.mockResolvedValue([
      { id: 1, content: 'expired', similarity: 0.9, tags: '', created_at: '2024-01-01', valid_from: '2024-01-01', valid_until: '2024-06-01' },
      { id: 2, content: 'valid', similarity: 0.8, tags: '', created_at: '2024-01-01', valid_from: '2024-01-01', valid_until: '2025-12-31' },
    ] as any);
    mockGlobal.mockResolvedValue([] as any);

    const results = await memoryRecall({ query: 'test', limit: 5, as_of_date: '2025-03-01' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(2);
  });

  it('handles empty results gracefully', async () => {
    mockLocal.mockResolvedValue([] as any);
    mockGlobal.mockResolvedValue([] as any);

    const results = await memoryRecall({ query: 'nothing', limit: 5 });
    expect(results).toEqual([]);
  });
});

describe('memorySimilar', () => {
  it('returns found=true with match when similar memory exists', async () => {
    mockFindSimilar.mockResolvedValue({
      id: 42,
      content: 'existing memory',
      similarity: 0.92,
    } as any);

    const result = await memorySimilar({ content: 'new content', threshold: 0.85, global: false });

    expect(result.found).toBe(true);
    expect(result.match?.id).toBe(42);
    expect(result.match?.similarity).toBe(0.92);
    expect(mockFindSimilar).toHaveBeenCalledWith([0.1, 0.2], 0.85);
  });

  it('returns found=false when no similar memory', async () => {
    mockFindSimilar.mockResolvedValue(null as any);

    const result = await memorySimilar({ content: 'unique content', threshold: 0.85, global: false });

    expect(result.found).toBe(false);
    expect(result.match).toBeUndefined();
  });

  it('uses global search when global=true', async () => {
    mockFindSimilarGlobal.mockResolvedValue(null as any);

    await memorySimilar({ content: 'test', threshold: 0.85, global: true });

    expect(mockFindSimilarGlobal).toHaveBeenCalled();
    expect(mockFindSimilar).not.toHaveBeenCalled();
  });
});
