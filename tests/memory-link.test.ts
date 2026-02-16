import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@vinaes/succ/api', () => ({
  createMemoryLink: vi.fn(),
  deleteMemoryLink: vi.fn(),
  getMemoryWithLinks: vi.fn(),
  getGraphStats: vi.fn(),
  autoLinkSimilarMemories: vi.fn(),
  enrichExistingLinks: vi.fn(),
  createProximityLinks: vi.fn(),
  detectCommunities: vi.fn(),
  updateCentralityCache: vi.fn(),
}));

import { memoryLink } from '../src/tools/memory-link.js';
import {
  createMemoryLink,
  deleteMemoryLink,
  getMemoryWithLinks,
  getGraphStats,
  autoLinkSimilarMemories,
  enrichExistingLinks,
  createProximityLinks,
  detectCommunities,
  updateCentralityCache,
} from '@vinaes/succ/api';

const mockCreate = vi.mocked(createMemoryLink);
const mockDelete = vi.mocked(deleteMemoryLink);
const mockShow = vi.mocked(getMemoryWithLinks);
const mockStats = vi.mocked(getGraphStats);
const mockAutoLink = vi.mocked(autoLinkSimilarMemories);
const mockEnrich = vi.mocked(enrichExistingLinks);
const mockProximity = vi.mocked(createProximityLinks);
const mockCommunities = vi.mocked(detectCommunities);
const mockCentrality = vi.mocked(updateCentralityCache);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('memoryLink', () => {
  it('creates a link', async () => {
    mockCreate.mockResolvedValue({ id: 1, created: true } as any);

    const result = await memoryLink({ action: 'create', sourceId: 1, targetId: 2, relation: 'caused_by' });
    expect(mockCreate).toHaveBeenCalledWith(1, 2, 'caused_by');
    expect(result.message).toContain('1');
    expect(result.message).toContain('2');
  });

  it('throws when create missing sourceId', async () => {
    await expect(memoryLink({ action: 'create', targetId: 2, relation: 'related' })).rejects.toThrow('sourceId and targetId required');
  });

  it('deletes a link', async () => {
    mockDelete.mockResolvedValue(undefined as any);

    const result = await memoryLink({ action: 'delete', sourceId: 1, targetId: 2, relation: 'related' });
    expect(mockDelete).toHaveBeenCalledWith(1, 2);
    expect(result.message).toContain('Unlinked');
  });

  it('shows links for a memory', async () => {
    const mockData = { id: 1, links: [{ targetId: 2, relation: 'related' }] };
    mockShow.mockResolvedValue(mockData as any);

    const result = await memoryLink({ action: 'show', sourceId: 1, relation: 'related' });
    expect(result).toEqual(mockData);
  });

  it('returns graph stats', async () => {
    const stats = { totalLinks: 42, totalMemories: 100 };
    mockStats.mockResolvedValue(stats as any);

    const result = await memoryLink({ action: 'stats', relation: 'related' });
    expect(result).toEqual(stats);
  });

  it('auto-links similar memories', async () => {
    mockAutoLink.mockResolvedValue(5);

    const result = await memoryLink({ action: 'auto', relation: 'related', threshold: 0.8 });
    expect(result.linksCreated).toBe(5);
    expect(result.message).toContain('Auto-linked');
    expect(mockAutoLink).toHaveBeenCalledWith(0.8);
  });

  it('enriches existing links with LLM', async () => {
    mockEnrich.mockResolvedValue({ enriched: 10, failed: 1, skipped: 3 } as any);

    const result = await memoryLink({ action: 'enrich', relation: 'related' });
    expect(result.message).toContain('Enriched');
    expect(result.enriched).toBe(10);
  });

  it('creates proximity links', async () => {
    mockProximity.mockResolvedValue({ created: 7, skipped: 2, total_pairs: 9 } as any);

    const result = await memoryLink({ action: 'proximity', relation: 'related' });
    expect(result.message).toContain('proximity');
    expect(result.created).toBe(7);
  });

  it('detects communities', async () => {
    mockCommunities.mockResolvedValue({ communities: 3, tagged: 15 } as any);

    const result = await memoryLink({ action: 'communities', relation: 'related' });
    expect(result.message).toContain('communities');
    expect(result.communities).toBe(3);
  });

  it('updates centrality scores', async () => {
    mockCentrality.mockResolvedValue({ updated: 20 } as any);

    const result = await memoryLink({ action: 'centrality', relation: 'related' });
    expect(result.message).toContain('centrality');
    expect(result.updated).toBe(20);
  });
});
