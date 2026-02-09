import path from 'node:path';
import { initStorageDispatcher, closeStorageDispatcher } from 'succ/api';
import { initializeSuccProject, isSuccInitialized } from './init.js';
import { memorySearch, memorySearchSchema } from './tools/memory-search.js';
import { memoryGet, memoryGetSchema } from './tools/memory-get.js';
import { memoryStore, memoryStoreSchema } from './tools/memory-store.js';
import { memoryLink, memoryLinkSchema } from './tools/memory-link.js';
import { memoryDeadEnd, memoryDeadEndSchema } from './tools/memory-dead-end.js';
import { memoryExplore, memoryExploreSchema } from './tools/memory-explore.js';
import { memoryForget, memoryForgetSchema } from './tools/memory-forget.js';
import { memoryIndex, memoryIndexSchema } from './tools/memory-index.js';
import { onBeforeCompact } from './hooks/before-compact.js';
import { onFileChanged } from './hooks/file-changed.js';
import { DEFAULT_CONFIG, type OpenClawPluginAPI, type SuccPluginConfig } from './types.js';

/**
 * @succ/openclaw-succ — OpenClaw plugin entry point.
 *
 * Replaces native memory_search and memory_get with succ-powered versions.
 * Adds new tools: memory_store, memory_link, memory_dead_end, memory_explore,
 * memory_forget, memory_index.
 */
export default async function register(api: OpenClawPluginAPI): Promise<void> {
  // 1. Read plugin config
  const config: SuccPluginConfig = {
    autoInit: api.config.get('autoInit', DEFAULT_CONFIG.autoInit),
    markdownBridge: api.config.get('markdownBridge', DEFAULT_CONFIG.markdownBridge),
    embeddingMode: api.config.get('embeddingMode', DEFAULT_CONFIG.embeddingMode),
    maxSearchResults: api.config.get('maxSearchResults', DEFAULT_CONFIG.maxSearchResults),
    snippetMaxChars: api.config.get('snippetMaxChars', DEFAULT_CONFIG.snippetMaxChars),
  };

  // 2. Detect workspace root
  const workspaceRoot = api.workspace.getRoot();
  process.env.SUCC_PROJECT_ROOT = workspaceRoot;

  // 3. Auto-initialize .succ/ if needed
  if (config.autoInit && !isSuccInitialized(workspaceRoot)) {
    console.log('[succ] Initializing .succ/ directory...');
    await initializeSuccProject(workspaceRoot);
  }

  // 4. Initialize storage (DB connection, embeddings)
  await initStorageDispatcher();

  // 5. Replace native memory tools
  api.tools.replace('memory_search', {
    name: 'memory_search',
    description:
      'Search across code, documentation, and memories using hybrid search (BM25 + semantic). ' +
      'Powered by succ — returns results from source code, brain vault docs, and structured memories.',
    schema: memorySearchSchema.shape as Record<string, unknown>,
    execute: (params: any) => memorySearch(params, config.snippetMaxChars),
  });

  api.tools.replace('memory_get', {
    name: 'memory_get',
    description:
      'Retrieve content by file path, memory ID (memory:123), or semantic query. ' +
      'Falls back to semantic search if literal path not found.',
    schema: memoryGetSchema.shape as Record<string, unknown>,
    execute: memoryGet,
  });

  // 6. Register new tools
  api.tools.register('memory_store', {
    name: 'memory_store',
    description:
      'Save structured memory with type classification (observation, decision, learning, error, pattern, dead_end) and tags.',
    schema: memoryStoreSchema.shape as Record<string, unknown>,
    execute: memoryStore,
  });

  api.tools.register('memory_link', {
    name: 'memory_link',
    description:
      'Build knowledge graph links between memories. ' +
      'Relations: related, caused_by, leads_to, similar_to, contradicts, implements, supersedes, references.',
    schema: memoryLinkSchema.shape as Record<string, unknown>,
    execute: memoryLink,
  });

  api.tools.register('memory_dead_end', {
    name: 'memory_dead_end',
    description:
      'Record a failed approach to prevent retrying it. ' +
      'Dead-end memories are automatically boosted 15% in search results.',
    schema: memoryDeadEndSchema.shape as Record<string, unknown>,
    execute: memoryDeadEnd,
  });

  api.tools.register('memory_explore', {
    name: 'memory_explore',
    description:
      'Explore the knowledge graph starting from a memory. ' +
      'BFS traversal discovers related decisions, implementations, and patterns.',
    schema: memoryExploreSchema.shape as Record<string, unknown>,
    execute: memoryExplore,
  });

  api.tools.register('memory_forget', {
    name: 'memory_forget',
    description: 'Delete memories by ID, tag, or age. Use for cleanup, GDPR compliance, or pruning stale context.',
    schema: memoryForgetSchema.shape as Record<string, unknown>,
    execute: memoryForget,
  });

  api.tools.register('memory_index', {
    name: 'memory_index',
    description: 'Index a file for semantic search. Skips unchanged files unless force=true.',
    schema: memoryIndexSchema.shape as Record<string, unknown>,
    execute: memoryIndex,
  });

  // 7. Register hooks
  api.hooks.on('beforeCompact', onBeforeCompact);
  api.hooks.on('fileChanged', onFileChanged);

  // 8. Cleanup on shutdown
  api.hooks.on('shutdown', async () => {
    await closeStorageDispatcher();
  });

  console.log(`[succ] Plugin loaded — ${isSuccInitialized(workspaceRoot) ? 'project initialized' : 'global-only mode'}`);
}

// Re-export for programmatic use
export { memorySearch } from './tools/memory-search.js';
export { memoryGet } from './tools/memory-get.js';
export { memoryStore } from './tools/memory-store.js';
export { memoryLink } from './tools/memory-link.js';
export { memoryDeadEnd } from './tools/memory-dead-end.js';
export { memoryExplore } from './tools/memory-explore.js';
export { memoryForget } from './tools/memory-forget.js';
export { memoryIndex } from './tools/memory-index.js';
export { exportMemoriesToMarkdown, importMarkdownToMemory } from './bridge/markdown-bridge.js';
export type { SuccPluginConfig, OpenClawPluginAPI, OpenClawSearchResult, OpenClawGetResult } from './types.js';
