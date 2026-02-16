import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  saveMemoriesBatch: vi.fn(),
  deleteMemoriesByIds: vi.fn(),
  getEmbeddings: vi.fn(),
}));

import { memoryBatchStore, memoryBatchDelete } from '../src/tools/memory-batch.js';
import { saveMemoriesBatch, deleteMemoriesByIds, getEmbeddings } from '@vinaes/succ/api';

const mockSaveBatch = vi.mocked(saveMemoriesBatch);
const mockDeleteBatch = vi.mocked(deleteMemoriesByIds);
const mockGetEmbeddings = vi.mocked(getEmbeddings);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('memoryBatchStore', () => {
  it('saves multiple memories with embeddings', async () => {
    mockGetEmbeddings.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    mockSaveBatch.mockResolvedValue({
      saved: 2,
      skipped: 0,
      results: [
        { index: 0, isDuplicate: false, id: 1, reason: 'saved' },
        { index: 1, isDuplicate: false, id: 2, reason: 'saved' },
      ],
    } as any);

    const result = await memoryBatchStore({
      memories: [
        { content: 'first', type: 'observation', tags: [], source: 'openclaw' },
        { content: 'second', type: 'decision', tags: ['arch'], source: 'openclaw' },
      ],
    });

    expect(result.saved).toBe(2);
    expect(mockGetEmbeddings).toHaveBeenCalledWith(['first', 'second']);
    expect(mockSaveBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ content: 'first', tags: ['openclaw'] }),
        expect.objectContaining({ content: 'second', tags: expect.arrayContaining(['arch', 'openclaw']) }),
      ]),
    );
  });

  it('reports duplicates correctly', async () => {
    mockGetEmbeddings.mockResolvedValue([[0.1]]);
    mockSaveBatch.mockResolvedValue({
      saved: 0,
      skipped: 1,
      results: [{ index: 0, isDuplicate: true, reason: 'duplicate' }],
    } as any);

    const result = await memoryBatchStore({
      memories: [{ content: 'dupe', type: 'observation', tags: [], source: 'openclaw' }],
    });

    expect(result.saved).toBe(0);
    expect(result.message).toContain('1 duplicates skipped');
  });

  it('adds openclaw tag to all memories', async () => {
    mockGetEmbeddings.mockResolvedValue([[0.1]]);
    mockSaveBatch.mockResolvedValue({
      saved: 1,
      skipped: 0,
      results: [{ index: 0, isDuplicate: false, id: 1, reason: 'saved' }],
    } as any);

    await memoryBatchStore({
      memories: [{ content: 'test', type: 'observation', tags: ['custom'], source: 'openclaw' }],
    });

    const batch = mockSaveBatch.mock.calls[0][0];
    expect(batch[0].tags).toContain('openclaw');
    expect(batch[0].tags).toContain('custom');
  });
});

describe('memoryBatchDelete', () => {
  it('deletes multiple memories', async () => {
    mockDeleteBatch.mockResolvedValue(3);

    const result = await memoryBatchDelete({ ids: [1, 2, 3] });
    expect(result.deleted).toBe(3);
    expect(mockDeleteBatch).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('handles empty ids array', async () => {
    const result = await memoryBatchDelete({ ids: [] });
    expect(result.deleted).toBe(0);
    expect(mockDeleteBatch).not.toHaveBeenCalled();
  });
});
