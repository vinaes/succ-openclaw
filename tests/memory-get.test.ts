import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

vi.mock('succ/api', () => ({
  getMemoryById: vi.fn(),
  hybridSearchCode: vi.fn(),
  hybridSearchDocs: vi.fn(),
  hybridSearchMemories: vi.fn(),
  getEmbedding: vi.fn(),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
    },
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

import { memoryGet } from '../src/tools/memory-get.js';
import { getMemoryById, hybridSearchCode, hybridSearchDocs, hybridSearchMemories, getEmbedding } from 'succ/api';

const mockGetMemoryById = vi.mocked(getMemoryById);
const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEmbedding).mockResolvedValue([0.1, 0.2]);
  vi.mocked(hybridSearchCode).mockResolvedValue([]);
  vi.mocked(hybridSearchDocs).mockResolvedValue([]);
  vi.mocked(hybridSearchMemories).mockResolvedValue([]);
});

describe('memoryGet', () => {
  it('reads literal file when path exists', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('line1\nline2\nline3' as any);

    const result = await memoryGet({ path: '/tmp/test.md' });
    expect(result.content).toBe('line1\nline2\nline3');
    expect(result.lineCount).toBe(3);
    expect(result.path).toBe('/tmp/test.md');
  });

  it('reads file slice with startLine and numLines', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('a\nb\nc\nd\ne' as any);

    const result = await memoryGet({ path: '/tmp/test.md', startLine: 2, numLines: 2 });
    expect(result.content).toBe('b\nc');
    expect(result.lineCount).toBe(2);
  });

  it('retrieves memory by ID with memory: prefix', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetMemoryById.mockResolvedValue({
      id: 42,
      content: 'important decision',
      type: 'decision',
      tags: 'arch',
      source: 'user',
      created_at: '2026-01-01',
    } as any);

    const result = await memoryGet({ path: 'memory:42' });
    expect(result.content).toBe('important decision');
    expect(result.path).toBe('memory:42');
  });

  it('throws on invalid memory ID', async () => {
    mockExistsSync.mockReturnValue(false);
    await expect(memoryGet({ path: 'memory:abc' })).rejects.toThrow('Invalid memory ID');
  });

  it('throws when memory not found', async () => {
    mockExistsSync.mockReturnValue(false);
    mockGetMemoryById.mockResolvedValue(null as any);
    await expect(memoryGet({ path: 'memory:999' })).rejects.toThrow('Memory 999 not found');
  });

  it('falls back to semantic search for unknown paths', async () => {
    mockExistsSync.mockReturnValue(false);
    vi.mocked(hybridSearchMemories).mockResolvedValue([
      { content: 'found via search', id: 7, similarity: 0.8 },
    ] as any);

    const result = await memoryGet({ path: 'how to setup auth' });
    expect(result.content).toBe('found via search');
  });

  it('throws when semantic search finds nothing', async () => {
    mockExistsSync.mockReturnValue(false);
    await expect(memoryGet({ path: 'completely unknown thing' })).rejects.toThrow('Not found');
  });
});
