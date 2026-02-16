import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  analyzeRetention: vi.fn(),
  getAllMemoriesForRetention: vi.fn(),
}));

import { memoryRetention } from '../src/tools/memory-retention.js';
import { analyzeRetention, getAllMemoriesForRetention } from '@vinaes/succ/api';

const mockRetention = vi.mocked(analyzeRetention);
const mockGetMemories = vi.mocked(getAllMemoriesForRetention);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMemories.mockResolvedValue([{ id: 1, content: 'test', created_at: '2025-01-01' }]);
});

describe('memoryRetention', () => {
  it('fetches memories and returns retention analysis', async () => {
    const mockResult = {
      keep: [],
      warn: [],
      delete: [],
      stats: { total: 100, decaying: 15, stale: 8 },
    };
    mockRetention.mockReturnValue(mockResult as any);

    const result = await memoryRetention();

    expect(result).toEqual(mockResult);
    expect(mockGetMemories).toHaveBeenCalled();
    expect(mockRetention).toHaveBeenCalledWith([{ id: 1, content: 'test', created_at: '2025-01-01' }]);
  });

  it('handles empty memories', async () => {
    mockGetMemories.mockResolvedValue([]);
    mockRetention.mockReturnValue({ keep: [], warn: [], delete: [], stats: { total: 0 } } as any);

    const result = await memoryRetention();
    expect(result.stats.total).toBe(0);
  });
});
