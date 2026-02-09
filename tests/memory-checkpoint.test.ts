import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('succ/api', () => ({
  createCheckpoint: vi.fn(),
  listCheckpoints: vi.fn(),
}));

import { memoryCheckpoint } from '../src/tools/memory-checkpoint.js';
import { createCheckpoint, listCheckpoints } from 'succ/api';

const mockCreate = vi.mocked(createCheckpoint);
const mockList = vi.mocked(listCheckpoints);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('memoryCheckpoint', () => {
  it('creates a checkpoint', async () => {
    mockCreate.mockResolvedValue({
      outputPath: '/tmp/checkpoint-2025.json',
      checkpoint: { id: 'cp_1' },
    } as any);

    const result = await memoryCheckpoint({
      action: 'create',
      compress: false,
      include_brain: true,
      include_documents: true,
    });
    expect(result.message).toContain('Checkpoint created');
    expect(result.path).toContain('checkpoint');
    expect(mockCreate).toHaveBeenCalledWith({
      compress: false,
      includeBrain: true,
      includeDocuments: true,
    });
  });

  it('lists checkpoints', async () => {
    mockList.mockReturnValue([
      { name: 'cp1.json', path: '/tmp/cp1.json', size: 1024, compressed: false, created_at: '2025-01-01' },
    ] as any);

    const result = await memoryCheckpoint({
      action: 'list',
      compress: false,
      include_brain: true,
      include_documents: true,
    });
    expect(result.count).toBe(1);
    expect(result.checkpoints[0].name).toBe('cp1.json');
  });

  it('throws on unknown action', async () => {
    await expect(
      memoryCheckpoint({ action: 'restore' as any, compress: false, include_brain: true, include_documents: true }),
    ).rejects.toThrow('Unknown action');
  });
});
