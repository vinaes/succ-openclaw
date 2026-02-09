import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('succ/api', () => ({
  saveMemory: vi.fn(),
  getEmbedding: vi.fn(),
}));

import { memoryStore } from '../src/tools/memory-store.js';
import { saveMemory, getEmbedding } from 'succ/api';

const mockSaveMemory = vi.mocked(saveMemory);
const mockGetEmbedding = vi.mocked(getEmbedding);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEmbedding.mockResolvedValue([0.1, 0.2]);
  mockSaveMemory.mockResolvedValue({ id: 1, isDuplicate: false } as any);
});

describe('memoryStore', () => {
  it('saves memory with default type and openclaw tag', async () => {
    const result = await memoryStore({ content: 'hello', type: 'observation', tags: [], source: 'openclaw' });

    expect(mockSaveMemory).toHaveBeenCalledWith(
      'hello',
      [0.1, 0.2],
      ['openclaw'],
      'openclaw',
      { type: 'observation' },
    );
    expect(result.id).toBe(1);
  });

  it('preserves custom tags and adds openclaw tag', async () => {
    await memoryStore({ content: 'test', type: 'decision', tags: ['auth', 'api'], source: 'openclaw' });

    expect(mockSaveMemory).toHaveBeenCalledWith(
      'test',
      expect.any(Array),
      expect.arrayContaining(['auth', 'api', 'openclaw']),
      'openclaw',
      { type: 'decision' },
    );
  });

  it('deduplicates openclaw tag', async () => {
    await memoryStore({ content: 'test', type: 'observation', tags: ['openclaw', 'other'], source: 'openclaw' });

    const call = mockSaveMemory.mock.calls[0];
    const tags = call[2] as string[];
    expect(tags.filter(t => t === 'openclaw')).toHaveLength(1);
  });
});
