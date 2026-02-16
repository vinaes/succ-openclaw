import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('succ/api', () => ({
  initStorageDispatcher: vi.fn(),
  closeStorageDispatcher: vi.fn(),
  setConfigOverride: vi.fn(),
  getWebSearchHistory: vi.fn(),
}));

vi.mock('../src/init.js', () => ({
  initializeSuccProject: vi.fn(),
  isSuccInitialized: vi.fn().mockReturnValue(true),
}));

// Mock all tool modules to avoid deep dependency chains
vi.mock('../src/tools/memory-search.js', () => ({
  memorySearch: vi.fn(),
  memorySearchSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-get.js', () => ({
  memoryGet: vi.fn(),
  memoryGetSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-store.js', () => ({
  memoryStore: vi.fn(),
  memoryStoreSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-link.js', () => ({
  memoryLink: vi.fn(),
  memoryLinkSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-dead-end.js', () => ({
  memoryDeadEnd: vi.fn(),
  memoryDeadEndSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-explore.js', () => ({
  memoryExplore: vi.fn(),
  memoryExploreSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-forget.js', () => ({
  memoryForget: vi.fn(),
  memoryForgetSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-index.js', () => ({
  memoryIndex: vi.fn(),
  memoryIndexSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-recall.js', () => ({
  memoryRecall: vi.fn(),
  memoryRecallSchema: { shape: {} },
  memorySimilar: vi.fn(),
  memorySimilarSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-web-search.js', () => ({
  memoryQuickSearch: vi.fn(),
  memoryQuickSearchSchema: { shape: {} },
  memoryWebSearch: vi.fn(),
  memoryWebSearchSchema: { shape: {} },
  memoryDeepResearch: vi.fn(),
  memoryDeepResearchSchema: { shape: {} },
  memoryWebHistorySchema: { shape: {} },
}));
vi.mock('../src/tools/memory-status.js', () => ({
  memoryStatus: vi.fn(),
  memoryStatusSchema: { shape: {} },
  memoryStats: vi.fn(),
  memoryStatsSchema: { shape: {} },
  memoryScore: vi.fn(),
  memoryScoreSchema: { shape: {} },
  memoryConfig: vi.fn(),
  memoryConfigSchema: { shape: {} },
  memoryConfigSet: vi.fn(),
  memoryConfigSetSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-checkpoint.js', () => ({
  memoryCheckpoint: vi.fn(),
  memoryCheckpointSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-analyze.js', () => ({
  memoryAnalyze: vi.fn(),
  memoryAnalyzeSchema: { shape: {} },
  memoryIndexCode: vi.fn(),
  memoryIndexCodeSchema: { shape: {} },
  memoryReindex: vi.fn(),
  memoryReindexSchema: { shape: {} },
  memoryStale: vi.fn(),
  memoryStaleSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-prd.js', () => ({
  memoryPrdGenerate: vi.fn(),
  memoryPrdGenerateSchema: { shape: {} },
  memoryPrdList: vi.fn(),
  memoryPrdListSchema: { shape: {} },
  memoryPrdStatus: vi.fn(),
  memoryPrdStatusSchema: { shape: {} },
  memoryPrdRun: vi.fn(),
  memoryPrdRunSchema: { shape: {} },
  memoryPrdExport: vi.fn(),
  memoryPrdExportSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-batch.js', () => ({
  memoryBatchStore: vi.fn(),
  memoryBatchStoreSchema: { shape: {} },
  memoryBatchDelete: vi.fn(),
  memoryBatchDeleteSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-fetch.js', () => ({
  memoryFetch: vi.fn(),
  memoryFetchSchema: { shape: {} },
}));
vi.mock('../src/tools/memory-retention.js', () => ({
  memoryRetention: vi.fn(),
  memoryRetentionSchema: { shape: {} },
}));
vi.mock('../src/hooks/before-compact.js', () => ({
  onBeforeCompact: vi.fn(),
}));
vi.mock('../src/hooks/file-changed.js', () => ({
  onFileChanged: vi.fn(),
}));

import register from '../src/index.js';
import { initStorageDispatcher, setConfigOverride } from 'succ/api';
import { initializeSuccProject, isSuccInitialized } from '../src/init.js';
import type { OpenClawPluginAPI } from '../src/types.js';

const mockSetConfigOverride = vi.mocked(setConfigOverride);
const mockInitStorage = vi.mocked(initStorageDispatcher);
const mockIsInitialized = vi.mocked(isSuccInitialized);
const mockInitProject = vi.mocked(initializeSuccProject);

const originalEnv = process.env.SUCC_PROJECT_ROOT;

function createMockApi(configOverrides: Record<string, any> = {}, options?: { withPrompts?: boolean }): OpenClawPluginAPI {
  const replacedTools: Map<string, any> = new Map();
  const registeredTools: Map<string, any> = new Map();
  const hooks: Map<string, any[]> = new Map();
  const systemPrompts: string[] = [];

  const api: any = {
    workspace: {
      getRoot: () => '/workspace/test-project',
    },
    config: {
      get<T>(key: string, defaultValue: T): T {
        return key in configOverrides ? configOverrides[key] : defaultValue;
      },
    },
    tools: {
      replace(name: string, tool: any) {
        replacedTools.set(name, tool);
      },
      register(name: string, tool: any) {
        registeredTools.set(name, tool);
      },
    },
    hooks: {
      on(event: string, handler: any) {
        if (!hooks.has(event)) hooks.set(event, []);
        hooks.get(event)!.push(handler);
      },
    },
    // Expose internals for assertions
    _replacedTools: replacedTools,
    _registeredTools: registeredTools,
    _hooks: hooks,
    _systemPrompts: systemPrompts,
  };

  if (options?.withPrompts) {
    api.prompts = {
      appendSystem(content: string) {
        systemPrompts.push(content);
      },
    };
  }

  return api;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsInitialized.mockReturnValue(true);
});

afterEach(() => {
  process.env.SUCC_PROJECT_ROOT = originalEnv;
});

describe('register()', () => {
  it('calls setConfigOverride with default config before initStorageDispatcher', async () => {
    const api = createMockApi();
    await register(api);

    // setConfigOverride called before initStorageDispatcher
    const overrideOrder = mockSetConfigOverride.mock.invocationCallOrder[0];
    const initOrder = mockInitStorage.mock.invocationCallOrder[0];
    expect(overrideOrder).toBeLessThan(initOrder);

    // Check default overrides
    expect(mockSetConfigOverride).toHaveBeenCalledWith({
      embedding_mode: 'local',
      storage: { backend: 'sqlite' },
      analyze_mode: 'claude',
    });
  });

  it('passes custom config from openclaw.json to setConfigOverride', async () => {
    const api = createMockApi({
      embeddingMode: 'openrouter',
      storageBackend: 'postgresql',
      analyzeMode: 'local',
      openrouterApiKey: 'sk-or-test-key',
    });
    await register(api);

    expect(mockSetConfigOverride).toHaveBeenCalledWith({
      embedding_mode: 'openrouter',
      storage: { backend: 'postgresql' },
      analyze_mode: 'local',
      openrouter_api_key: 'sk-or-test-key',
    });
  });

  it('omits openrouter_api_key from overrides when not provided', async () => {
    const api = createMockApi();
    await register(api);

    const call = mockSetConfigOverride.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('openrouter_api_key');
  });

  it('registers 35 tools (2 replaced + 33 new)', async () => {
    const api = createMockApi();
    await register(api);

    const replaced = (api as any)._replacedTools as Map<string, any>;
    const registered = (api as any)._registeredTools as Map<string, any>;

    expect(replaced.size).toBe(2);
    expect(replaced.has('memory_search')).toBe(true);
    expect(replaced.has('memory_get')).toBe(true);

    expect(registered.size).toBe(33);
    // Spot-check a few
    expect(registered.has('memory_store')).toBe(true);
    expect(registered.has('memory_recall')).toBe(true);
    expect(registered.has('memory_link')).toBe(true);
    expect(registered.has('memory_dead_end')).toBe(true);
    expect(registered.has('memory_symbols')).toBe(true);
    expect(registered.has('memory_quick_search')).toBe(true);
    expect(registered.has('memory_prd_generate')).toBe(true);
    expect(registered.has('memory_checkpoint')).toBe(true);
    expect(registered.has('memory_debug')).toBe(true);
  });

  it('sets SUCC_PROJECT_ROOT env var', async () => {
    const api = createMockApi();
    await register(api);

    expect(process.env.SUCC_PROJECT_ROOT).toBe(path.resolve('/workspace/test-project'));
  });

  it('throws on non-absolute workspace root', async () => {
    const api = createMockApi();
    (api.workspace as any).getRoot = () => 'relative/path';

    await expect(register(api)).rejects.toThrow('must be an absolute path');
  });

  it('calls initializeSuccProject when autoInit=true and not initialized', async () => {
    mockIsInitialized.mockReturnValue(false);
    const api = createMockApi({ autoInit: true });
    await register(api);

    expect(mockInitProject).toHaveBeenCalledWith('/workspace/test-project');
  });

  it('skips initializeSuccProject when autoInit=false', async () => {
    mockIsInitialized.mockReturnValue(false);
    const api = createMockApi({ autoInit: false });
    await register(api);

    expect(mockInitProject).not.toHaveBeenCalled();
  });

  it('registers hooks (beforeCompact, fileChanged, shutdown)', async () => {
    const api = createMockApi();
    await register(api);

    const hooks = (api as any)._hooks as Map<string, any[]>;
    expect(hooks.has('beforeCompact')).toBe(true);
    expect(hooks.has('fileChanged')).toBe(true);
    expect(hooks.has('shutdown')).toBe(true);
  });

  it('injects system prompt when api.prompts is available', async () => {
    const api = createMockApi({}, { withPrompts: true });
    await register(api);

    const prompts = (api as any)._systemPrompts as string[];
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain('<succ-memory>');
    expect(prompts[0]).toContain('memory_search');
    expect(prompts[0]).toContain('memory_store');
  });

  it('skips system prompt injection when api.prompts is not available', async () => {
    const api = createMockApi();
    // Should not throw when prompts is undefined
    await register(api);

    const prompts = (api as any)._systemPrompts as string[];
    expect(prompts).toHaveLength(0);
  });
});
