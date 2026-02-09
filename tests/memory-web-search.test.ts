import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('succ/api', () => ({
  callOpenRouterSearch: vi.fn(),
  saveMemory: vi.fn(),
  getEmbedding: vi.fn(),
}));

import { memoryQuickSearch, memoryWebSearch, memoryDeepResearch } from '../src/tools/memory-web-search.js';
import { callOpenRouterSearch, saveMemory, getEmbedding } from 'succ/api';

const mockSearch = vi.mocked(callOpenRouterSearch);
const mockSave = vi.mocked(saveMemory);
const mockEmbed = vi.mocked(getEmbedding);

beforeEach(() => {
  vi.clearAllMocks();
  mockEmbed.mockResolvedValue([0.1]);
  mockSave.mockResolvedValue({ id: 1 } as any);
});

describe('memoryQuickSearch', () => {
  it('calls OpenRouter with perplexity/sonar model', async () => {
    mockSearch.mockResolvedValue({ content: 'Node.js 22 is the latest LTS' } as any);

    const result = await memoryQuickSearch({ query: 'latest node lts', max_tokens: 2000, save_to_memory: false });
    expect(result.answer).toBe('Node.js 22 is the latest LTS');
    expect(result.model).toBe('perplexity/sonar');
    expect(mockSearch).toHaveBeenCalledWith(
      [{ role: 'user', content: 'latest node lts' }],
      'perplexity/sonar',
      120000,
      2000,
      0.1,
    );
  });

  it('saves to memory when requested', async () => {
    mockSearch.mockResolvedValue({ content: 'answer text' } as any);

    await memoryQuickSearch({ query: 'test', max_tokens: 2000, save_to_memory: true });
    expect(mockSave).toHaveBeenCalled();
    expect(mockEmbed).toHaveBeenCalledWith('answer text');
  });

  it('includes system prompt when provided', async () => {
    mockSearch.mockResolvedValue({ content: 'formatted' } as any);

    await memoryQuickSearch({ query: 'test', system_prompt: 'be concise', max_tokens: 2000, save_to_memory: false });
    expect(mockSearch).toHaveBeenCalledWith(
      [{ role: 'system', content: 'be concise' }, { role: 'user', content: 'test' }],
      expect.any(String),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });
});

describe('memoryWebSearch', () => {
  it('uses perplexity/sonar-pro by default', async () => {
    mockSearch.mockResolvedValue({ content: 'detailed answer' } as any);

    const result = await memoryWebSearch({ query: 'nginx config', max_tokens: 4000, save_to_memory: false });
    expect(result.model).toBe('perplexity/sonar-pro');
  });

  it('allows model override', async () => {
    mockSearch.mockResolvedValue({ content: 'answer' } as any);

    await memoryWebSearch({ query: 'test', model: 'perplexity/sonar', max_tokens: 4000, save_to_memory: false });
    expect(mockSearch).toHaveBeenCalledWith(
      expect.any(Array),
      'perplexity/sonar',
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });
});

describe('memoryDeepResearch', () => {
  it('uses sonar-deep-research model', async () => {
    mockSearch.mockResolvedValue({ content: 'deep answer' } as any);

    const result = await memoryDeepResearch({ query: 'compare frameworks', max_tokens: 8000, save_to_memory: false, include_reasoning: false });
    expect(result.answer).toBe('deep answer');
    expect(result.model).toBe('perplexity/sonar-deep-research');
  });

  it('includes reasoning when requested', async () => {
    mockSearch.mockResolvedValue({ content: 'answer', reasoning: 'step by step' } as any);

    const result = await memoryDeepResearch({ query: 'test', max_tokens: 8000, save_to_memory: false, include_reasoning: true });
    expect(result.answer).toContain('step by step');
    expect(result.answer).toContain('answer');
  });

  it('returns No response on empty content', async () => {
    mockSearch.mockResolvedValue({ content: '' } as any);

    const result = await memoryDeepResearch({ query: 'test', max_tokens: 8000, save_to_memory: false, include_reasoning: false });
    expect(result.answer).toBe('No response');
  });
});
