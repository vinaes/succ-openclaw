import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('succ/api', () => ({
  createMemoryLink: vi.fn(),
  deleteMemoryLink: vi.fn(),
  getMemoryWithLinks: vi.fn(),
  getGraphStats: vi.fn(),
}));

import { memoryLink } from '../src/tools/memory-link.js';
import { createMemoryLink, deleteMemoryLink, getMemoryWithLinks, getGraphStats } from 'succ/api';

const mockCreate = vi.mocked(createMemoryLink);
const mockDelete = vi.mocked(deleteMemoryLink);
const mockShow = vi.mocked(getMemoryWithLinks);
const mockStats = vi.mocked(getGraphStats);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('memoryLink', () => {
  it('creates a link', async () => {
    mockCreate.mockResolvedValue({ id: 1, created: true } as any);

    const result = await memoryLink({ action: 'create', sourceId: 1, targetId: 2, relation: 'caused_by' });
    expect(mockCreate).toHaveBeenCalledWith(1, 2, 'caused_by');
    expect(result.message).toContain('1');
    expect(result.message).toContain('2');
  });

  it('throws when create missing sourceId', async () => {
    await expect(memoryLink({ action: 'create', targetId: 2, relation: 'related' })).rejects.toThrow('sourceId and targetId required');
  });

  it('deletes a link', async () => {
    mockDelete.mockResolvedValue(undefined as any);

    const result = await memoryLink({ action: 'delete', sourceId: 1, targetId: 2, relation: 'related' });
    expect(mockDelete).toHaveBeenCalledWith(1, 2);
    expect(result.message).toContain('Unlinked');
  });

  it('shows links for a memory', async () => {
    const mockData = { id: 1, links: [{ targetId: 2, relation: 'related' }] };
    mockShow.mockResolvedValue(mockData as any);

    const result = await memoryLink({ action: 'show', sourceId: 1, relation: 'related' });
    expect(result).toEqual(mockData);
  });

  it('returns graph stats', async () => {
    const stats = { totalLinks: 42, totalMemories: 100 };
    mockStats.mockResolvedValue(stats as any);

    const result = await memoryLink({ action: 'stats', relation: 'related' });
    expect(result).toEqual(stats);
  });
});
