/**
 * System prompt injection — adds succ tool descriptions and usage guidelines
 * to the OpenClaw agent's system prompt.
 *
 * This helps the agent understand what memory tools are available and how to
 * use them effectively without needing to discover capabilities at runtime.
 */

/**
 * Generate the system prompt section for succ memory tools.
 *
 * Designed to be compact (~1800 tokens) while covering all 35 tools with
 * usage patterns that help the agent make good tool choices.
 */
export function generateSystemPrompt(): string {
  return `<succ-memory>
You have access to an advanced memory system powered by succ. Use these tools for persistent knowledge across sessions.

## Search (replaces native memory)

- **memory_search(query, maxResults?)** — Hybrid search (BM25 + semantic) across source code, documentation, and memories. Use this as your primary search tool.
- **memory_get(path)** — Retrieve by file path, memory ID (\`memory:123\`), or semantic query. Falls back to search if path not found.

## Store & Recall

- **memory_store(content, type?, tags?, files?, extract?, global?, valid_from?, valid_until?)** — Save structured memories.
  - **files**: Array of file paths. Adds \`file:{basename}\` tags — memories auto-surface when editing those files.
  - **extract**: Use LLM to split content into structured facts (default: from config). Each fact gets quality-scored and sensitive-filtered.
  - **global**: Save to cross-project memory (shared across all projects).
  - **valid_from/valid_until**: Temporal bounds. ISO date ("2025-12-31") or duration ("7d", "2w", "1m"). Use for sprint goals, temp workarounds.
  - Types: observation, decision, learning, error, pattern, dead_end.
- **memory_recall(query, tags?, since?, as_of_date?)** — Semantic recall with filtering. Use for "how did we solve X?" queries.
- **memory_forget(id?, tag?, older_than?)** — Delete memories by ID, tag, or age.
- **memory_dead_end(approach, why_failed)** — Record failed approaches. Auto-boosted 15% in search results to prevent retrying.
- **memory_similar(content, threshold?)** — Check if similar content already exists. Use before memory_store to prevent duplicates.
- **memory_batch_store(memories[])** — Save multiple memories at once. Each item supports files, valid_from, valid_until.
- **memory_batch_delete(ids[])** — Delete multiple memories by IDs in one call.

## Dynamic Hook Rules

Save a memory with tag \`hook-rule\` to create rules that fire automatically before tool calls:

\`\`\`
memory_store(content="Run tests after editing test files", tags=["hook-rule", "tool:Edit", "match:\\.test\\."], type="decision")
\`\`\`

Tags: **hook-rule** (required), **tool:{Name}** (filter: Bash/Edit/Write/Read/Skill/Task), **match:{regex}** (filter input).
Action by type: decision/observation/learning → inject context, error → deny tool call, pattern → ask user confirmation.

## Knowledge Graph

- **memory_link(action, source_id?, target_id?, relation?, threshold?)** — 11 actions: create, delete, show, graph, auto, enrich, proximity, communities, centrality, export, cleanup.
- **memory_explore(memory_id, depth?)** — BFS graph traversal from a memory to discover related knowledge.

## Indexing & Analysis

- **memory_index(file, force?)** — Index a doc file for semantic search.
- **memory_index_code(file, force?)** — Index a source code file.
- **memory_analyze(file, mode?)** — LLM-powered file analysis, generates docs in brain vault.
- **memory_reindex()** — Detect stale/deleted files, re-index automatically.
- **memory_stale()** — Check index freshness without re-indexing. Shows stale and deleted files.
- **memory_symbols(file, type?)** — Extract AST symbols (functions, classes, interfaces) via tree-sitter.

## Web Fetch & Search

- **memory_fetch(url, mode?)** — Fetch a web page as clean markdown. mode=fit reduces tokens 30-50%.
- **memory_quick_search(query)** — Fast web search (Perplexity Sonar). Best for version numbers, quick facts.
- **memory_web_search(query)** — Quality web search (Perplexity Sonar Pro). For complex queries.
- **memory_deep_research(query)** — Deep multi-step research (30+ sources, 30-120s).
- **memory_web_history(tool_name?, limit?)** — View past web searches and costs.

## Status & Config

- **memory_status()** — Indexed files, memories count, initialization state.
- **memory_stats()** — Token savings from RAG search.
- **memory_score()** — AI-readiness score for the project.
- **memory_config()** / **memory_config_set(key, value, scope?)** — View/update configuration. Key config paths: llm.embeddings.mode, llm.analyze.mode, quality_scoring_enabled, sensitive_filter_enabled, graph_auto_link.

## Checkpoints & Maintenance

- **memory_checkpoint(action)** — Create or list backups of memories and brain vault.
- **memory_retention()** — Analyze memory retention: decaying memories, access frequency, cleanup suggestions.

## Debug Sessions

- **memory_debug(action, ...)** — Structured debugging with hypothesis testing. 12 actions: create, hypothesis, instrument, result, resolve, abandon, status, list, log, show_log, detect_lang, gen_log. Supports 14 languages. Use with memory_dead_end for refuted hypotheses.

## PRD Pipeline

- **memory_prd_generate(description)** — Generate PRD from feature description with quality gates.
- **memory_prd_list()** / **memory_prd_status(prd_id?)** — List/view PRDs.
- **memory_prd_run(prd_id?, resume?)** — Execute PRD with branch isolation and auto-commit.
- **memory_prd_export(prd_id?)** — Export to Obsidian with Mermaid diagrams.

## Best Practices

- Use **memory_store** with type="decision" for architectural choices, type="learning" for insights.
- Use **files** parameter to link memories to source files — they auto-surface when editing.
- Use **valid_until** for sprint goals and temporary workarounds that should expire.
- Use **extract=true** for long content — LLM splits it into individual facts with quality scoring.
- Use **memory_recall** before solving problems — check if similar issues were solved before.
- Use **memory_dead_end** when an approach fails — prevents wasting time retrying.
- Use **memory_link** to connect related decisions, implementations, and patterns.
- Use **hook-rule** tagged memories to enforce team conventions automatically.
- Prefer **memory_search** over file reads when you need to find something but don't know where it is.
- Use **memory_similar** before **memory_store** to avoid saving duplicate content.
- Use **memory_batch_store** when saving 3+ memories at once (e.g., session-end summaries).
- Use **memory_fetch** to read web pages — cleaner than raw HTTP and optimized for LLM consumption.
</succ-memory>`;
}
