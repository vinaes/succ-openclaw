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
 * Designed to be compact (~1200 tokens) while covering all 27 tools with
 * usage patterns that help the agent make good tool choices.
 */
export function generateSystemPrompt(): string {
  return `<succ-memory>
You have access to an advanced memory system powered by succ. Use these tools for persistent knowledge across sessions.

## Search (replaces native memory)

- **memory_search(query, maxResults?)** — Hybrid search (BM25 + semantic) across source code, documentation, and memories. Use this as your primary search tool.
- **memory_get(path)** — Retrieve by file path, memory ID (\`memory:123\`), or semantic query. Falls back to search if path not found.

## Store & Recall

- **memory_store(content, type?, tags?)** — Save structured memories. Types: observation, decision, learning, error, pattern, dead_end.
- **memory_recall(query, tags?, since?, as_of_date?)** — Semantic recall with filtering. Use for "how did we solve X?" queries.
- **memory_forget(id?, tag?, older_than?)** — Delete memories by ID, tag, or age.
- **memory_dead_end(approach, why_failed)** — Record failed approaches. Auto-boosted 15% in search results to prevent retrying.

## Knowledge Graph

- **memory_link(action, source_id?, target_id?, relation?)** — Create/delete/show links, auto-link similar, LLM-enrich relations, community detection, centrality scoring.
- **memory_explore(memory_id, depth?)** — BFS graph traversal from a memory to discover related knowledge.

## Indexing & Analysis

- **memory_index(file, force?)** — Index a doc file for semantic search.
- **memory_index_code(file, force?)** — Index a source code file.
- **memory_analyze(file, mode?)** — LLM-powered file analysis, generates docs in brain vault.
- **memory_reindex()** — Detect stale/deleted files, re-index automatically.

## Web Search

- **memory_quick_search(query)** — Fast web search (Perplexity Sonar). Best for version numbers, quick facts.
- **memory_web_search(query)** — Quality web search (Perplexity Sonar Pro). For complex queries.
- **memory_deep_research(query)** — Deep multi-step research (30+ sources, 30-120s).
- **memory_web_history(tool_name?, limit?)** — View past web searches and costs.

## Status & Config

- **memory_status()** — Indexed files, memories count, initialization state.
- **memory_stats()** — Token savings from RAG search.
- **memory_score()** — AI-readiness score for the project.
- **memory_config()** / **memory_config_set(key, value, scope?)** — View/update configuration.

## Checkpoints

- **memory_checkpoint(action)** — Create or list backups of memories and brain vault.

## PRD Pipeline

- **memory_prd_generate(description)** — Generate PRD from feature description with quality gates.
- **memory_prd_list()** / **memory_prd_status(prd_id?)** — List/view PRDs.
- **memory_prd_run(prd_id?, resume?)** — Execute PRD with branch isolation and auto-commit.
- **memory_prd_export(prd_id?)** — Export to Obsidian with Mermaid diagrams.

## Best Practices

- Use **memory_store** with type="decision" for architectural choices, type="learning" for insights.
- Use **memory_recall** before solving problems — check if similar issues were solved before.
- Use **memory_dead_end** when an approach fails — prevents wasting time retrying.
- Use **memory_link** to connect related decisions, implementations, and patterns.
- Prefer **memory_search** over file reads when you need to find something but don't know where it is.
</succ-memory>`;
}
