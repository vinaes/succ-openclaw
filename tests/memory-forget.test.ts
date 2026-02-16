import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  deleteMemory: vi.fn(),
  deleteMemoriesOlderThan: vi.fn(),
  deleteMemoriesByTag: vi.fn(),
}));

import { memoryForget } from '../src/tools/memory-forget.js';
import { deleteMemory, deleteMemoriesOlderThan, deleteMemoriesByTag } from '@vinaes/succ/api';

const mockDeleteMemory = vi.mocked(deleteMemory);
const mockDeleteOlderThan = vi.mocked(deleteMemoriesOlderThan);
const mockDeleteByTag = vi.mocked(deleteMemoriesByTag);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('memoryForget', () => {
  it('deletes by ID', async () => {
    mockDeleteMemory.mockResolvedValue(true as any);

    const result = await memoryForget({ id: 42 });
    expect(mockDeleteMemory).toHaveBeenCalledWith(42);
    expect(result.deleted).toBe(1);
  });

  it('reports not found for invalid ID', async () => {
    mockDeleteMemory.mockResolvedValue(false as any);

    const result = await memoryForget({ id: 999 });
    expect(result.deleted).toBe(0);
    expect(result.message).toContain('not found');
  });

  it('deletes by tag', async () => {
    mockDeleteByTag.mockResolvedValue(5 as any);

    const result = await memoryForget({ tag: 'temp' });
    expect(mockDeleteByTag).toHaveBeenCalledWith('temp');
    expect(result.deleted).toBe(5);
  });

  it('deletes by age', async () => {
    mockDeleteOlderThan.mockResolvedValue(3 as any);

    const result = await memoryForget({ older_than: '30d' });
    expect(mockDeleteOlderThan).toHaveBeenCalledWith(expect.any(Date));
    expect(result.deleted).toBe(3);
  });

  it('throws when no params provided', async () => {
    await expect(memoryForget({})).rejects.toThrow('Provide at least one');
  });

  it('parses duration formats correctly', async () => {
    mockDeleteOlderThan.mockResolvedValue(0 as any);

    // days
    await memoryForget({ older_than: '7d' });
    const date7d = mockDeleteOlderThan.mock.calls[0][0] as Date;
    const diffDays = (Date.now() - date7d.getTime()) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(7);

    // weeks
    await memoryForget({ older_than: '2w' });
    const date2w = mockDeleteOlderThan.mock.calls[1][0] as Date;
    const diffWeeks = (Date.now() - date2w.getTime()) / (1000 * 60 * 60 * 24 * 7);
    expect(Math.round(diffWeeks)).toBe(2);
  });

  it('rejects invalid duration format', async () => {
    await expect(memoryForget({ older_than: 'abc' })).rejects.toThrow('Invalid duration');
  });
});
