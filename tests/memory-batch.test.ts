import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  saveMemoriesBatch: vi.fn(),
  deleteMemoriesByIds: vi.fn(),
  getEmbeddings: vi.fn(),
  parseDuration: vi.fn(),
  scanSensitive: vi.fn(),
}));

import { memoryBatchStore, memoryBatchDelete } from '../src/tools/memory-batch.js';
import { saveMemoriesBatch, deleteMemoriesByIds, getEmbeddings, scanSensitive } from '@vinaes/succ/api';

const mockSaveBatch = vi.mocked(saveMemoriesBatch);
const mockDeleteBatch = vi.mocked(deleteMemoriesByIds);
const mockGetEmbeddings = vi.mocked(getEmbeddings);
const mockScanSensitive = vi.mocked(scanSensitive);

beforeEach(() => {
  vi.clearAllMocks();
  mockScanSensitive.mockReturnValue({ hasSensitive: false, matches: [], redactedText: '', originalText: '' } as any);
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

  it('adds file:{basename} tags from files array', async () => {
    mockGetEmbeddings.mockResolvedValue([[0.1]]);
    mockSaveBatch.mockResolvedValue({ saved: 1, skipped: 0, results: [{ index: 0, isDuplicate: false, id: 1, reason: 'saved' }] } as any);

    await memoryBatchStore({
      memories: [{
        content: 'auth note',
        type: 'observation',
        tags: [],
        source: 'openclaw',
        files: ['src/auth.ts'],
      }],
    });

    const batch = mockSaveBatch.mock.calls[0][0];
    expect(batch[0].tags).toContain('file:auth.ts');
    expect(batch[0].tags).toContain('openclaw');
  });

  it('shows blocked count when some items are sensitive', async () => {
    // First call: sensitive, second call: clean
    mockScanSensitive
      .mockReturnValueOnce({ hasSensitive: true, matches: [{ type: 'api_key', value: 'sk-x', start: 0, end: 4 }], redactedText: '', originalText: '' } as any)
      .mockReturnValueOnce({ hasSensitive: false, matches: [], redactedText: '', originalText: '' } as any);
    mockGetEmbeddings.mockResolvedValue([[0.1]]);
    mockSaveBatch.mockResolvedValue({ saved: 1, skipped: 0, results: [{ index: 0, isDuplicate: false, id: 1, reason: 'saved' }] } as any);

    const result = await memoryBatchStore({
      memories: [
        { content: 'sk-secret', type: 'observation', tags: [], source: 'openclaw' },
        { content: 'clean note', type: 'observation', tags: [], source: 'openclaw' },
      ],
    });

    expect(result.saved).toBe(1);
    expect(result.message).toContain('1 blocked');
  });

  it('blocks sensitive content in batch items', async () => {
    mockScanSensitive.mockReturnValue({
      hasSensitive: true,
      matches: [{ type: 'api_key', value: 'sk-test', start: 0, end: 7 }],
      redactedText: '',
      originalText: '',
    } as any);

    const result = await memoryBatchStore({
      memories: [{ content: 'sk-test-secret', type: 'observation', tags: [], source: 'openclaw' }],
    });

    expect(result.saved).toBe(0);
    expect(result.message).toContain('blocked');
    expect(mockSaveBatch).not.toHaveBeenCalled();
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
