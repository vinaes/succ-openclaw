import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  saveMemory: vi.fn(),
  getEmbedding: vi.fn(),
}));

import { memoryDeadEnd } from '../src/tools/memory-dead-end.js';
import { saveMemory, getEmbedding } from '@vinaes/succ/api';

const mockSaveMemory = vi.mocked(saveMemory);
const mockGetEmbedding = vi.mocked(getEmbedding);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEmbedding.mockResolvedValue([0.1]);
  mockSaveMemory.mockResolvedValue({ id: 99, isDuplicate: false } as any);
});

describe('memoryDeadEnd', () => {
  it('saves dead-end with correct format', async () => {
    const result = await memoryDeadEnd({
      approach: 'Redis for sessions',
      why_failed: 'Memory too high for VPS',
      tags: [],
    });

    expect(mockSaveMemory).toHaveBeenCalledWith(
      expect.stringContaining('DEAD END: Redis for sessions'),
      expect.any(Array),
      expect.arrayContaining(['dead-end', 'openclaw']),
      'dead-end',
      { type: 'dead_end' },
    );
    expect(result.id).toBe(99);
    expect(result.message).toContain('Redis for sessions');
  });

  it('includes context when provided', async () => {
    await memoryDeadEnd({
      approach: 'JWT in cookies',
      why_failed: 'CORS issues',
      context: 'src/auth.ts:42',
      tags: ['auth'],
    });

    const content = mockSaveMemory.mock.calls[0][0];
    expect(content).toContain('Context: src/auth.ts:42');
  });

  it('adds custom tags alongside defaults', async () => {
    await memoryDeadEnd({
      approach: 'test',
      why_failed: 'test',
      tags: ['performance', 'db'],
    });

    const tags = mockSaveMemory.mock.calls[0][2] as string[];
    expect(tags).toContain('dead-end');
    expect(tags).toContain('openclaw');
    expect(tags).toContain('performance');
    expect(tags).toContain('db');
  });
});
