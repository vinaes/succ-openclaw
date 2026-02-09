import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('succ/api', () => ({
  generatePrd: vi.fn(),
  listPrds: vi.fn(),
  findLatestPrd: vi.fn(),
  loadPrd: vi.fn(),
  loadTasks: vi.fn(),
  runPrd: vi.fn(),
  exportPrdToObsidian: vi.fn(),
  exportAllPrds: vi.fn(),
}));

import {
  memoryPrdGenerate,
  memoryPrdList,
  memoryPrdStatus,
  memoryPrdRun,
  memoryPrdExport,
} from '../src/tools/memory-prd.js';
import { generatePrd, listPrds, findLatestPrd, loadPrd, loadTasks, runPrd, exportPrdToObsidian, exportAllPrds } from 'succ/api';

const mockGenerate = vi.mocked(generatePrd);
const mockListPrds = vi.mocked(listPrds);
const mockFindLatest = vi.mocked(findLatestPrd);
const mockLoadPrd = vi.mocked(loadPrd);
const mockLoadTasks = vi.mocked(loadTasks);
const mockRun = vi.mocked(runPrd);
const mockExport = vi.mocked(exportPrdToObsidian);
const mockExportAll = vi.mocked(exportAllPrds);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('memoryPrdGenerate', () => {
  it('generates a PRD from description', async () => {
    const prd = { id: 'prd_abc', title: 'Auth System', tasks: [] };
    mockGenerate.mockResolvedValue(prd as any);

    const result = await memoryPrdGenerate({ description: 'Add user auth with JWT', mode: 'loop', auto_parse: true });
    expect(result).toEqual(prd);
    expect(mockGenerate).toHaveBeenCalledWith('Add user auth with JWT', {
      mode: 'loop',
      gates: undefined,
      autoParse: true,
      model: undefined,
    });
  });
});

describe('memoryPrdList', () => {
  it('lists all PRDs', async () => {
    const prds = [{ id: 'prd_1', title: 'Auth' }, { id: 'prd_2', title: 'Search' }];
    mockListPrds.mockReturnValue(prds as any);

    const result = await memoryPrdList({ all: false });
    expect(result).toEqual(prds);
  });
});

describe('memoryPrdStatus', () => {
  it('returns latest PRD status when no id given', async () => {
    mockFindLatest.mockReturnValue({ id: 'prd_latest' } as any);
    mockLoadPrd.mockReturnValue({ id: 'prd_latest', title: 'Latest' } as any);
    mockLoadTasks.mockReturnValue([{ id: 'task_1', status: 'done' }] as any);

    const result = await memoryPrdStatus({});
    expect(result.prd.id).toBe('prd_latest');
    expect(result.tasks).toHaveLength(1);
  });

  it('returns message when no PRDs found', async () => {
    mockFindLatest.mockReturnValue(undefined as any);

    const result = await memoryPrdStatus({});
    expect(result.message).toBe('No PRDs found');
  });

  it('uses provided prd_id', async () => {
    mockLoadPrd.mockReturnValue({ id: 'prd_123' } as any);
    mockLoadTasks.mockReturnValue([] as any);

    const result = await memoryPrdStatus({ prd_id: 'prd_123' });
    expect(mockLoadPrd).toHaveBeenCalledWith('prd_123');
  });
});

describe('memoryPrdRun', () => {
  it('runs a PRD', async () => {
    mockFindLatest.mockReturnValue({ id: 'prd_run' } as any);
    mockRun.mockResolvedValue({ status: 'completed' } as any);

    const result = await memoryPrdRun({
      resume: false,
      dry_run: false,
      no_branch: false,
      force: false,
      mode: 'loop',
    });
    expect(result.status).toBe('completed');
  });

  it('throws when no PRD found', async () => {
    mockFindLatest.mockReturnValue(undefined as any);

    await expect(memoryPrdRun({ resume: false, dry_run: false, no_branch: false, force: false, mode: 'loop' })).rejects.toThrow(
      'No PRD found',
    );
  });
});

describe('memoryPrdExport', () => {
  it('exports a single PRD', async () => {
    mockFindLatest.mockReturnValue({ id: 'prd_exp' } as any);
    mockExport.mockResolvedValue({ path: '/brain/prd_exp.md' } as any);

    const result = await memoryPrdExport({ all: false });
    expect(mockExport).toHaveBeenCalledWith('prd_exp', undefined);
  });

  it('exports all PRDs', async () => {
    mockExportAll.mockResolvedValue({ exported: 3 } as any);

    const result = await memoryPrdExport({ all: true });
    expect(mockExportAll).toHaveBeenCalledWith(undefined, false);
  });
});
