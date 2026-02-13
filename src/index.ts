import path from 'node:path';
import { initStorageDispatcher, closeStorageDispatcher, setConfigOverride } from 'succ/api';
import { initializeSuccProject, isSuccInitialized } from './init.js';
import { memorySearch, memorySearchSchema } from './tools/memory-search.js';
import { memoryGet, memoryGetSchema } from './tools/memory-get.js';
import { memoryStore, memoryStoreSchema } from './tools/memory-store.js';
import { memoryLink, memoryLinkSchema } from './tools/memory-link.js';
import { memoryDeadEnd, memoryDeadEndSchema } from './tools/memory-dead-end.js';
import { memoryExplore, memoryExploreSchema } from './tools/memory-explore.js';
import { memoryForget, memoryForgetSchema } from './tools/memory-forget.js';
import { memoryIndex, memoryIndexSchema } from './tools/memory-index.js';
import { memoryRecall, memoryRecallSchema } from './tools/memory-recall.js';
import {
  memoryQuickSearch,
  memoryQuickSearchSchema,
  memoryWebSearch,
  memoryWebSearchSchema,
  memoryDeepResearch,
  memoryDeepResearchSchema,
  memoryWebHistorySchema,
} from './tools/memory-web-search.js';
import {
  memoryStatus,
  memoryStatusSchema,
  memoryStats,
  memoryStatsSchema,
  memoryScore,
  memoryScoreSchema,
  memoryConfig,
  memoryConfigSchema,
  memoryConfigSet,
  memoryConfigSetSchema,
} from './tools/memory-status.js';
import { memoryCheckpoint, memoryCheckpointSchema } from './tools/memory-checkpoint.js';
import {
  memoryAnalyze,
  memoryAnalyzeSchema,
  memoryIndexCode,
  memoryIndexCodeSchema,
  memoryReindex,
  memoryReindexSchema,
} from './tools/memory-analyze.js';
import { memoryDebug, memoryDebugSchema } from './tools/memory-debug.js';
import { memorySymbols, memorySymbolsSchema } from './tools/memory-symbols.js';
import {
  memoryPrdGenerate,
  memoryPrdGenerateSchema,
  memoryPrdList,
  memoryPrdListSchema,
  memoryPrdStatus,
  memoryPrdStatusSchema,
  memoryPrdRun,
  memoryPrdRunSchema,
  memoryPrdExport,
  memoryPrdExportSchema,
} from './tools/memory-prd.js';
import { onBeforeCompact } from './hooks/before-compact.js';
import { onFileChanged } from './hooks/file-changed.js';
import { generateSystemPrompt } from './hooks/system-prompt.js';
import { getWebSearchHistory } from 'succ/api';
import { DEFAULT_CONFIG, type OpenClawPluginAPI, type SuccPluginConfig } from './types.js';

/**
 * @succ/openclaw-succ — OpenClaw plugin entry point.
 *
 * Replaces native memory_search and memory_get with succ-powered versions.
 * Adds 25+ new tools: recall, web search, knowledge graph, PRD pipeline, etc.
 */
export default async function register(api: OpenClawPluginAPI): Promise<void> {
  // 1. Read plugin config
  const config: SuccPluginConfig = {
    autoInit: api.config.get('autoInit', DEFAULT_CONFIG.autoInit),
    markdownBridge: api.config.get('markdownBridge', DEFAULT_CONFIG.markdownBridge),
    embeddingMode: api.config.get('embeddingMode', DEFAULT_CONFIG.embeddingMode),
    storageBackend: api.config.get('storageBackend', DEFAULT_CONFIG.storageBackend),
    analyzeMode: api.config.get('analyzeMode', DEFAULT_CONFIG.analyzeMode),
    openrouterApiKey: api.config.get('openrouterApiKey', DEFAULT_CONFIG.openrouterApiKey),
    maxSearchResults: api.config.get('maxSearchResults', DEFAULT_CONFIG.maxSearchResults),
    snippetMaxChars: api.config.get('snippetMaxChars', DEFAULT_CONFIG.snippetMaxChars),
  };

  // 2. Detect workspace root and validate it's absolute
  const workspaceRoot = api.workspace.getRoot();
  if (!path.isAbsolute(workspaceRoot)) {
    throw new Error(`[succ] Workspace root must be an absolute path, got: "${workspaceRoot}"`);
  }
  process.env.SUCC_PROJECT_ROOT = path.resolve(workspaceRoot);

  // 3. Auto-initialize .succ/ if needed
  if (config.autoInit && !isSuccInitialized(workspaceRoot)) {
    console.log('[succ] Initializing .succ/ directory...');
    await initializeSuccProject(workspaceRoot);
  }

  // 4. Apply plugin config overrides to succ core
  const succOverrides: Record<string, unknown> = {
    embedding_mode: config.embeddingMode,
    storage: { backend: config.storageBackend },
    analyze_mode: config.analyzeMode,
  };
  if (config.openrouterApiKey) {
    succOverrides.openrouter_api_key = config.openrouterApiKey;
  }
  setConfigOverride(succOverrides as any);

  // 5. Initialize storage (DB connection, embeddings)
  await initStorageDispatcher();

  // ========================================================================
  // 6. Replace native memory tools
  // ========================================================================

  api.tools.replace('memory_search', {
    name: 'memory_search',
    description:
      'Search across code, documentation, and memories using hybrid search (BM25 + semantic). ' +
      'Supports scope filtering (code/docs/memories), regex post-filter, symbol_type filter (function/method/class/interface/type_alias), ' +
      'and output modes: full (snippets), lean (file+lines), signatures (code symbols only).',
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

  // ========================================================================
  // 7. Register new tools — core memory
  // ========================================================================

  api.tools.register('memory_store', {
    name: 'memory_store',
    description:
      'Save structured memory with type classification (observation, decision, learning, error, pattern, dead_end) and tags.',
    schema: memoryStoreSchema.shape as Record<string, unknown>,
    execute: memoryStore,
  });

  api.tools.register('memory_recall', {
    name: 'memory_recall',
    description:
      'Recall relevant memories using semantic search with filtering. ' +
      'Supports tag filtering, temporal queries (since, as_of_date), and local+global memory search.',
    schema: memoryRecallSchema.shape as Record<string, unknown>,
    execute: memoryRecall,
  });

  api.tools.register('memory_forget', {
    name: 'memory_forget',
    description: 'Delete memories by ID, tag, or age. Use for cleanup, GDPR compliance, or pruning stale context.',
    schema: memoryForgetSchema.shape as Record<string, unknown>,
    execute: memoryForget,
  });

  api.tools.register('memory_dead_end', {
    name: 'memory_dead_end',
    description:
      'Record a failed approach to prevent retrying it. ' +
      'Dead-end memories are automatically boosted 15% in search results.',
    schema: memoryDeadEndSchema.shape as Record<string, unknown>,
    execute: memoryDeadEnd,
  });

  // ========================================================================
  // 8. Knowledge graph
  // ========================================================================

  api.tools.register('memory_link', {
    name: 'memory_link',
    description:
      'Knowledge graph operations: create/delete/show links, auto-link similar memories, ' +
      'LLM-classify relations (enrich), co-occurrence links (proximity), ' +
      'community detection, centrality scoring. ' +
      'Relations: related, caused_by, leads_to, similar_to, contradicts, implements, supersedes, references.',
    schema: memoryLinkSchema.shape as Record<string, unknown>,
    execute: memoryLink,
  });

  api.tools.register('memory_explore', {
    name: 'memory_explore',
    description:
      'Explore the knowledge graph starting from a memory. ' +
      'BFS traversal discovers related decisions, implementations, and patterns.',
    schema: memoryExploreSchema.shape as Record<string, unknown>,
    execute: memoryExplore,
  });

  // ========================================================================
  // 9. Indexing & analysis
  // ========================================================================

  api.tools.register('memory_index', {
    name: 'memory_index',
    description: 'Index a documentation file for semantic search. Skips unchanged files unless force=true.',
    schema: memoryIndexSchema.shape as Record<string, unknown>,
    execute: memoryIndex,
  });

  api.tools.register('memory_index_code', {
    name: 'memory_index_code',
    description: 'Index a source code file for semantic code search. Skips unchanged files unless force=true.',
    schema: memoryIndexCodeSchema.shape as Record<string, unknown>,
    execute: memoryIndexCode,
  });

  api.tools.register('memory_analyze', {
    name: 'memory_analyze',
    description:
      'Analyze a source file with LLM and generate documentation in brain vault. ' +
      'Modes: claude (CLI with Haiku), api (OpenRouter/Ollama/LM Studio).',
    schema: memoryAnalyzeSchema.shape as Record<string, unknown>,
    execute: memoryAnalyze,
  });

  api.tools.register('memory_reindex', {
    name: 'memory_reindex',
    description:
      'Detect stale (modified) and deleted files in the index, then re-index stale files and clean up deleted entries.',
    schema: memoryReindexSchema.shape as Record<string, unknown>,
    execute: memoryReindex,
  });

  api.tools.register('memory_symbols', {
    name: 'memory_symbols',
    description:
      'Extract functions, classes, interfaces, and type definitions from a source file using tree-sitter AST parsing. ' +
      'Returns symbol names, types, signatures, and line numbers. Supports 13 languages.',
    schema: memorySymbolsSchema.shape as Record<string, unknown>,
    execute: memorySymbols,
  });

  // ========================================================================
  // 10. Web search
  // ========================================================================

  api.tools.register('memory_quick_search', {
    name: 'memory_quick_search',
    description:
      'Quick web search using Perplexity Sonar (~$1/MTok). ' +
      'Best for simple factual queries: version numbers, release dates, quick lookups.',
    schema: memoryQuickSearchSchema.shape as Record<string, unknown>,
    execute: memoryQuickSearch,
  });

  api.tools.register('memory_web_search', {
    name: 'memory_web_search',
    description:
      'Quality web search using Perplexity Sonar Pro (~$3/$15 MTok). ' +
      'For complex queries, documentation lookups, multi-faceted questions.',
    schema: memoryWebSearchSchema.shape as Record<string, unknown>,
    execute: memoryWebSearch,
  });

  api.tools.register('memory_deep_research', {
    name: 'memory_deep_research',
    description:
      'Deep multi-step web research using Perplexity Sonar Deep Research. ' +
      'Autonomously searches, reads, and synthesizes 30+ sources. Slow (30-120s) and expensive.',
    schema: memoryDeepResearchSchema.shape as Record<string, unknown>,
    execute: memoryDeepResearch,
  });

  api.tools.register('memory_web_history', {
    name: 'memory_web_history',
    description: 'View web search history with filtering. Shows past searches, costs, and usage statistics.',
    schema: memoryWebHistorySchema.shape as Record<string, unknown>,
    execute: async (params: any) => {
      return getWebSearchHistory({
        tool_name: params.tool_name,
        model: params.model,
        query_text: params.query_text,
        date_from: params.date_from,
        date_to: params.date_to,
        limit: params.limit,
      });
    },
  });

  // ========================================================================
  // 11. Status & config
  // ========================================================================

  api.tools.register('memory_status', {
    name: 'memory_status',
    description: 'Get succ status: indexed files, memories count, initialization state.',
    schema: memoryStatusSchema.shape as Record<string, unknown>,
    execute: memoryStatus,
  });

  api.tools.register('memory_stats', {
    name: 'memory_stats',
    description: 'Token savings statistics — how many tokens saved by RAG search vs loading full files.',
    schema: memoryStatsSchema.shape as Record<string, unknown>,
    execute: memoryStats,
  });

  api.tools.register('memory_score', {
    name: 'memory_score',
    description: 'AI-readiness score — how well-prepared is the project for AI collaboration.',
    schema: memoryScoreSchema.shape as Record<string, unknown>,
    execute: memoryScore,
  });

  api.tools.register('memory_config', {
    name: 'memory_config',
    description: 'Show current succ configuration with all settings and their effective values.',
    schema: memoryConfigSchema.shape as Record<string, unknown>,
    execute: memoryConfig,
  });

  api.tools.register('memory_config_set', {
    name: 'memory_config_set',
    description: 'Update a succ config value. Saves to global (~/.succ/config.json) or project (.succ/config.json).',
    schema: memoryConfigSetSchema.shape as Record<string, unknown>,
    execute: memoryConfigSet,
  });

  // ========================================================================
  // 12. Checkpoints
  // ========================================================================

  api.tools.register('memory_checkpoint', {
    name: 'memory_checkpoint',
    description:
      'Create or list checkpoints (full backup of memories, documents, brain vault). ' +
      'Use "create" to make a backup, "list" to see available checkpoints.',
    schema: memoryCheckpointSchema.shape as Record<string, unknown>,
    execute: memoryCheckpoint,
  });

  // ========================================================================
  // 13. Debug sessions
  // ========================================================================

  api.tools.register('memory_debug', {
    name: 'memory_debug',
    description:
      'Structured debugging with hypothesis testing. 12 actions: create, hypothesis, instrument, result, ' +
      'resolve, abandon, status, list, log, show_log, detect_lang, gen_log. ' +
      'Supports 14 programming languages. Integrates with memory_dead_end for refuted hypotheses.',
    schema: memoryDebugSchema.shape as Record<string, unknown>,
    execute: memoryDebug,
  });

  // ========================================================================
  // 14. PRD pipeline
  // ========================================================================

  api.tools.register('memory_prd_generate', {
    name: 'memory_prd_generate',
    description:
      'Generate a PRD (Product Requirements Document) from a feature description. ' +
      'Auto-detects quality gates from project files. Returns PRD ID and parsed tasks.',
    schema: memoryPrdGenerateSchema.shape as Record<string, unknown>,
    execute: memoryPrdGenerate,
  });

  api.tools.register('memory_prd_list', {
    name: 'memory_prd_list',
    description: 'List all PRDs in the project. Shows ID, title, status, and task counts.',
    schema: memoryPrdListSchema.shape as Record<string, unknown>,
    execute: memoryPrdList,
  });

  api.tools.register('memory_prd_status', {
    name: 'memory_prd_status',
    description: 'Show detailed status of a PRD and its tasks. If no ID given, shows the latest PRD.',
    schema: memoryPrdStatusSchema.shape as Record<string, unknown>,
    execute: memoryPrdStatus,
  });

  api.tools.register('memory_prd_run', {
    name: 'memory_prd_run',
    description:
      'Execute or resume a PRD. Runs tasks in order with quality gates, branch isolation, and auto-commit.',
    schema: memoryPrdRunSchema.shape as Record<string, unknown>,
    execute: memoryPrdRun,
  });

  api.tools.register('memory_prd_export', {
    name: 'memory_prd_export',
    description: 'Export PRD workflow to Obsidian-compatible markdown with Mermaid diagrams.',
    schema: memoryPrdExportSchema.shape as Record<string, unknown>,
    execute: memoryPrdExport,
  });

  // ========================================================================
  // 15. System prompt injection
  // ========================================================================

  if (api.prompts?.appendSystem) {
    api.prompts.appendSystem(generateSystemPrompt());
  }

  // ========================================================================
  // 16. Hooks
  // ========================================================================

  api.hooks.on('beforeCompact', onBeforeCompact);
  api.hooks.on('fileChanged', onFileChanged);

  // 16. Cleanup on shutdown
  api.hooks.on('shutdown', async () => {
    await closeStorageDispatcher();
  });

  console.log(`[succ] Plugin loaded — 29 tools registered (${isSuccInitialized(workspaceRoot) ? 'project initialized' : 'global-only mode'})`);
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
export { memoryRecall } from './tools/memory-recall.js';
export { memoryQuickSearch, memoryWebSearch, memoryDeepResearch } from './tools/memory-web-search.js';
export { memoryStatus, memoryStats, memoryScore, memoryConfig, memoryConfigSet } from './tools/memory-status.js';
export { memoryCheckpoint } from './tools/memory-checkpoint.js';
export { memoryAnalyze, memoryIndexCode, memoryReindex } from './tools/memory-analyze.js';
export { memorySymbols } from './tools/memory-symbols.js';
export { memoryDebug } from './tools/memory-debug.js';
export { memoryPrdGenerate, memoryPrdList, memoryPrdStatus, memoryPrdRun, memoryPrdExport } from './tools/memory-prd.js';
export { exportMemoriesToMarkdown, importMarkdownToMemory } from './bridge/markdown-bridge.js';
export type { SuccPluginConfig, OpenClawPluginAPI, OpenClawSearchResult, OpenClawGetResult } from './types.js';
