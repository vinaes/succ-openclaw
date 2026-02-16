import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  getStats: vi.fn(),
  getMemoryStats: vi.fn(),
  isProjectInitialized: vi.fn(),
  isGlobalOnlyMode: vi.fn(),
  getTokenStatsAggregated: vi.fn(),
  getTokenStatsSummary: vi.fn(),
  calculateAIReadinessScore: vi.fn(),
  formatAIReadinessScore: vi.fn(),
  getConfigDisplay: vi.fn(),
  formatConfigDisplay: vi.fn(),
  getConfig: vi.fn(),
}));

import { memoryStatus, memoryStats, memoryScore, memoryConfig } from '../src/tools/memory-status.js';
import {
  getStats,
  getMemoryStats,
  isProjectInitialized,
  isGlobalOnlyMode,
  getTokenStatsAggregated,
  getTokenStatsSummary,
  calculateAIReadinessScore,
  formatAIReadinessScore,
  getConfigDisplay,
  formatConfigDisplay,
} from '@vinaes/succ/api';

const mockGetStats = vi.mocked(getStats);
const mockMemStats = vi.mocked(getMemoryStats);
const mockInitialized = vi.mocked(isProjectInitialized);
const mockGlobalOnly = vi.mocked(isGlobalOnlyMode);
const mockTokenAgg = vi.mocked(getTokenStatsAggregated);
const mockTokenSum = vi.mocked(getTokenStatsSummary);
const mockScore = vi.mocked(calculateAIReadinessScore);
const mockFormatScore = vi.mocked(formatAIReadinessScore);
const mockConfigDisplay = vi.mocked(getConfigDisplay);
const mockFormatConfig = vi.mocked(formatConfigDisplay);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('memoryStatus', () => {
  it('returns initialized status and stats', async () => {
    mockInitialized.mockReturnValue(true);
    mockGlobalOnly.mockReturnValue(false);
    mockGetStats.mockResolvedValue({ docs: 42 } as any);
    mockMemStats.mockResolvedValue({ total: 100 } as any);

    const result = await memoryStatus();
    expect(result.initialized).toBe(true);
    expect(result.globalOnly).toBe(false);
    expect(result.documents).toEqual({ docs: 42 });
    expect(result.memories).toEqual({ total: 100 });
  });

  it('handles DB errors gracefully', async () => {
    mockInitialized.mockReturnValue(false);
    mockGlobalOnly.mockReturnValue(true);
    mockGetStats.mockRejectedValue(new Error('DB not ready'));
    mockMemStats.mockRejectedValue(new Error('DB not ready'));

    const result = await memoryStatus();
    expect(result.initialized).toBe(false);
    expect(result.documents).toBeNull();
    expect(result.memories).toBeNull();
  });
});

describe('memoryStats', () => {
  it('returns token savings', async () => {
    mockTokenAgg.mockResolvedValue([{ tool: 'search', saved: 5000 }] as any);
    mockTokenSum.mockResolvedValue({ total_saved: 50000 } as any);

    const result = await memoryStats();
    expect(result.aggregated).toHaveLength(1);
    expect(result.summary).toEqual({ total_saved: 50000 });
  });

  it('returns empty on error', async () => {
    mockTokenAgg.mockRejectedValue(new Error('fail'));
    mockTokenSum.mockRejectedValue(new Error('fail'));

    const result = await memoryStats();
    expect(result.aggregated).toEqual([]);
    expect(result.summary).toBeNull();
  });
});

describe('memoryScore', () => {
  it('returns score with formatted output', async () => {
    const score = { overall: 75, metrics: {} };
    mockScore.mockResolvedValue(score as any);
    mockFormatScore.mockReturnValue('Score: 75/100');

    const result = await memoryScore();
    expect(result.score).toEqual(score);
    expect(result.formatted).toBe('Score: 75/100');
  });
});

describe('memoryConfig', () => {
  it('returns formatted config display', async () => {
    mockConfigDisplay.mockReturnValue({ sections: [] } as any);
    mockFormatConfig.mockReturnValue('embedding_mode: local');

    const result = await memoryConfig();
    expect(result).toBe('embedding_mode: local');
  });
});
