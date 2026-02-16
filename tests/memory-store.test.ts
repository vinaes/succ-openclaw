import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  saveMemory: vi.fn(),
  saveGlobalMemory: vi.fn(),
  saveMemoriesBatch: vi.fn(),
  getEmbedding: vi.fn(),
  getConfig: vi.fn(),
  getLLMConfig: vi.fn(),
  extractFactsWithLLM: vi.fn(),
  scoreMemory: vi.fn(),
  passesQualityThreshold: vi.fn(),
  scanSensitive: vi.fn(),
  parseDuration: vi.fn(),
}));

import { memoryStore } from '../src/tools/memory-store.js';
import {
  saveMemory,
  saveGlobalMemory,
  saveMemoriesBatch,
  getEmbedding,
  getConfig,
  getLLMConfig,
  extractFactsWithLLM,
  scoreMemory,
  passesQualityThreshold,
  scanSensitive,
  parseDuration,
} from '@vinaes/succ/api';

const mockSaveMemory = vi.mocked(saveMemory);
const mockSaveGlobalMemory = vi.mocked(saveGlobalMemory);
const mockSaveMemoriesBatch = vi.mocked(saveMemoriesBatch);
const mockGetEmbedding = vi.mocked(getEmbedding);
const mockGetConfig = vi.mocked(getConfig);
const mockGetLLMConfig = vi.mocked(getLLMConfig);
const mockExtractFacts = vi.mocked(extractFactsWithLLM);
const mockScoreMemory = vi.mocked(scoreMemory);
const mockPassesQuality = vi.mocked(passesQualityThreshold);
const mockScanSensitive = vi.mocked(scanSensitive);
const mockParseDuration = vi.mocked(parseDuration);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEmbedding.mockResolvedValue([0.1, 0.2]);
  mockSaveMemory.mockResolvedValue({ id: 1, isDuplicate: false } as any);
  mockSaveGlobalMemory.mockResolvedValue({ id: 2, isDuplicate: false } as any);
  mockSaveMemoriesBatch.mockResolvedValue({ ids: [10, 11], saved: 2, skipped: 0, duplicatesSkipped: 0 } as any);
  mockScanSensitive.mockReturnValue({ hasSensitive: false, matches: [], redactedText: '', originalText: '' });
  mockGetConfig.mockReturnValue({ remember_extract_default: false, quality_scoring_enabled: false } as any);
  mockGetLLMConfig.mockReturnValue({ backend: 'claude', model: 'haiku' } as any);
  mockPassesQuality.mockReturnValue(true);
});

describe('memoryStore — direct save', () => {
  it('saves memory with default type and openclaw tag', async () => {
    const result = await memoryStore({ content: 'hello', type: 'observation', tags: [], source: 'openclaw' });

    expect(mockSaveMemory).toHaveBeenCalledWith(
      'hello',
      [0.1, 0.2],
      ['openclaw'],
      'openclaw',
      { type: 'observation', validFrom: undefined, validUntil: undefined },
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
      expect.objectContaining({ type: 'decision' }),
    );
  });

  it('deduplicates openclaw tag', async () => {
    await memoryStore({ content: 'test', type: 'observation', tags: ['openclaw', 'other'], source: 'openclaw' });

    const call = mockSaveMemory.mock.calls[0];
    const tags = call[2] as string[];
    expect(tags.filter(t => t === 'openclaw')).toHaveLength(1);
  });
});

describe('memoryStore — files parameter', () => {
  it('adds file:{basename} tags from files array', async () => {
    await memoryStore({
      content: 'Important note about auth',
      type: 'observation',
      tags: ['auth'],
      source: 'openclaw',
      files: ['src/lib/auth.ts', 'src/lib/middleware.ts'],
    });

    const call = mockSaveMemory.mock.calls[0];
    const tags = call[2] as string[];
    expect(tags).toContain('file:auth.ts');
    expect(tags).toContain('file:middleware.ts');
    expect(tags).toContain('auth');
    expect(tags).toContain('openclaw');
  });
});

describe('memoryStore — global save', () => {
  it('uses saveGlobalMemory when global=true', async () => {
    const result = await memoryStore({
      content: 'Cross-project rule',
      type: 'decision',
      tags: [],
      source: 'openclaw',
      global: true,
    });

    expect(mockSaveGlobalMemory).toHaveBeenCalledWith(
      'Cross-project rule',
      [0.1, 0.2],
      ['openclaw'],
      'openclaw',
      { type: 'decision' },
    );
    expect(mockSaveMemory).not.toHaveBeenCalled();
    expect(result.id).toBe(2);
  });
});

describe('memoryStore — valid_from / valid_until', () => {
  it('passes parsed dates to saveMemory', async () => {
    const futureDate = new Date('2025-12-31');
    mockParseDuration.mockReturnValue(futureDate);

    await memoryStore({
      content: 'Sprint goal',
      type: 'observation',
      tags: [],
      source: 'openclaw',
      valid_until: '30d',
    });

    expect(mockParseDuration).toHaveBeenCalledWith('30d');
    expect(mockSaveMemory).toHaveBeenCalledWith(
      'Sprint goal',
      expect.any(Array),
      expect.any(Array),
      'openclaw',
      expect.objectContaining({ validUntil: futureDate }),
    );
  });

  it('returns error message for invalid duration format', async () => {
    mockParseDuration.mockImplementation(() => { throw new Error('Invalid'); });

    const result = await memoryStore({
      content: 'test',
      type: 'observation',
      tags: [],
      source: 'openclaw',
      valid_until: 'bad-format',
    });

    expect(result.message).toContain('Invalid valid_until format');
    expect(mockSaveMemory).not.toHaveBeenCalled();
  });
});

describe('memoryStore — sensitive content filter', () => {
  it('blocks save when sensitive content detected', async () => {
    mockScanSensitive.mockReturnValue({
      hasSensitive: true,
      matches: [{ type: 'api_key', value: 'sk-test', start: 0, end: 7 }],
      redactedText: '',
      originalText: '',
    } as any);

    const result = await memoryStore({
      content: 'Secret: sk-test-1234',
      type: 'observation',
      tags: [],
      source: 'openclaw',
    });

    expect(result.message).toContain('Blocked');
    expect(result.message).toContain('sensitive data');
    expect(mockSaveMemory).not.toHaveBeenCalled();
  });
});

describe('memoryStore — LLM extraction', () => {
  it('extracts facts when extract=true', async () => {
    mockGetConfig.mockReturnValue({ remember_extract_default: false, quality_scoring_enabled: false } as any);
    mockExtractFacts.mockResolvedValue([
      { content: 'Fact A about auth flow', type: 'decision', confidence: 0.9, tags: ['auth'] },
      { content: 'Fact B about performance', type: 'learning', confidence: 0.8, tags: ['perf'] },
    ]);

    const result = await memoryStore({
      content: 'Long discussion about auth and performance',
      type: 'observation',
      tags: ['session'],
      source: 'openclaw',
      extract: true,
    });

    expect(mockExtractFacts).toHaveBeenCalled();
    expect(mockSaveMemoriesBatch).toHaveBeenCalled();
    expect(result.ids).toEqual([10, 11]);
    expect(result.message).toContain('Extracted 2 facts');
  });

  it('falls back to direct save when extraction fails', async () => {
    mockGetConfig.mockReturnValue({ remember_extract_default: false } as any);
    mockExtractFacts.mockRejectedValue(new Error('LLM timeout'));

    const result = await memoryStore({
      content: 'Some content',
      type: 'observation',
      tags: [],
      source: 'openclaw',
      extract: true,
    });

    expect(result.message).toContain('extraction fallback');
    expect(mockSaveMemory).toHaveBeenCalled();
  });

  it('falls back to direct save when no facts extracted', async () => {
    mockGetConfig.mockReturnValue({ remember_extract_default: false } as any);
    mockExtractFacts.mockResolvedValue([]);

    const result = await memoryStore({
      content: 'Short note',
      type: 'observation',
      tags: [],
      source: 'openclaw',
      extract: true,
    });

    expect(result.message).toContain('no facts extracted');
    expect(mockSaveMemory).toHaveBeenCalled();
  });
});
