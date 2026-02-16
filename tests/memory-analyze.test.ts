import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  analyzeFile: vi.fn(),
  indexCodeFile: vi.fn(),
  reindexFiles: vi.fn(),
  getProjectRoot: vi.fn(),
  getStaleFiles: vi.fn(),
}));

import { memoryAnalyze, memoryIndexCode, memoryReindex, memoryStale } from '../src/tools/memory-analyze.js';
import { analyzeFile, indexCodeFile, reindexFiles, getProjectRoot, getStaleFiles } from '@vinaes/succ/api';

const mockAnalyze = vi.mocked(analyzeFile);
const mockIndexCode = vi.mocked(indexCodeFile);
const mockReindex = vi.mocked(reindexFiles);
const mockRoot = vi.mocked(getProjectRoot);
const mockStale = vi.mocked(getStaleFiles);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('memoryAnalyze', () => {
  it('analyzes a file and returns output path', async () => {
    mockAnalyze.mockResolvedValue({ outputPath: '/brain/src/auth.md' } as any);

    const result = await memoryAnalyze({ file: 'src/auth.ts' });
    expect(result.message).toContain('src/auth.ts');
    expect(result.outputPath).toBe('/brain/src/auth.md');
    expect(mockAnalyze).toHaveBeenCalledWith('src/auth.ts', undefined);
  });

  it('passes mode option', async () => {
    mockAnalyze.mockResolvedValue({} as any);

    await memoryAnalyze({ file: 'src/test.ts', mode: 'openrouter' });
    expect(mockAnalyze).toHaveBeenCalledWith('src/test.ts', { mode: 'openrouter' });
  });
});

describe('memoryIndexCode', () => {
  it('indexes a code file', async () => {
    mockIndexCode.mockResolvedValue({} as any);

    const result = await memoryIndexCode({ file: 'src/main.ts', force: false });
    expect(result.message).toContain('src/main.ts');
    expect(result.indexed).toBe(true);
    expect(mockIndexCode).toHaveBeenCalledWith('src/main.ts', { force: false });
  });
});

describe('memoryReindex', () => {
  it('reindexes stale files', async () => {
    mockRoot.mockReturnValue('/project');
    mockReindex.mockResolvedValue({ reindexed: 3, removed: 1 } as any);

    const result = await memoryReindex();
    expect(result).toEqual({ reindexed: 3, removed: 1 });
    expect(mockReindex).toHaveBeenCalledWith('/project');
  });
});

describe('memoryStale', () => {
  it('returns stale and deleted files', async () => {
    mockRoot.mockReturnValue('/project');
    mockStale.mockResolvedValue({
      stale: [{ path: 'src/old.ts' }, { path: 'src/changed.ts' }],
      deleted: [{ path: 'src/removed.ts' }],
    } as any);

    const result = await memoryStale();
    expect(result.stale).toEqual(['src/old.ts', 'src/changed.ts']);
    expect(result.deleted).toEqual(['src/removed.ts']);
    expect(result.message).toContain('2 stale');
    expect(result.message).toContain('1 deleted');
  });

  it('handles empty results', async () => {
    mockRoot.mockReturnValue('/project');
    mockStale.mockResolvedValue({ stale: [], deleted: [] } as any);

    const result = await memoryStale();
    expect(result.stale).toEqual([]);
    expect(result.deleted).toEqual([]);
    expect(result.message).toContain('0 stale');
  });
});
