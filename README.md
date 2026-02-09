# @succ/openclaw-succ

OpenClaw plugin that replaces native memory with [succ](https://github.com/Vinaes/succ) — hybrid search (BM25 + semantic), typed memories, knowledge graph, dead-end tracking, temporal queries, web search, PRD pipeline, and more.

## What it does

**Replaces** OpenClaw's native `memory_search` and `memory_get` with succ-powered versions that search across:
- Source code (AST-aware semantic search)
- Brain vault documentation
- Structured memories (observations, decisions, learnings, errors, patterns)

**Adds 25 new tools** that OpenClaw doesn't have:

### Core memory

| Tool | Description |
|------|-------------|
| `memory_store` | Save typed memories with tags and auto-classification |
| `memory_recall` | Semantic recall with tag/date filtering and temporal queries (`as_of_date`) |
| `memory_forget` | Delete memories by ID, tag, or age |
| `memory_dead_end` | Record failed approaches (auto-boosted 15% in search) |

### Knowledge graph

| Tool | Description |
|------|-------------|
| `memory_link` | 9 actions: create/delete/show links, auto-link similar, LLM-enrich, proximity, communities, centrality |
| `memory_explore` | BFS graph traversal from any memory |

### Indexing & analysis

| Tool | Description |
|------|-------------|
| `memory_index` | Index a documentation file for semantic search |
| `memory_index_code` | Index a source code file for semantic code search |
| `memory_analyze` | LLM-powered file analysis — generates docs in brain vault |
| `memory_reindex` | Detect stale/deleted files, re-index automatically |

### Web search

| Tool | Description |
|------|-------------|
| `memory_quick_search` | Perplexity Sonar (~$1/MTok) — quick facts, version numbers |
| `memory_web_search` | Perplexity Sonar Pro (~$3/$15 MTok) — complex queries, docs |
| `memory_deep_research` | Perplexity Deep Research — 30+ sources, 30-120s |
| `memory_web_history` | View past searches, costs, and usage stats |

### Status & config

| Tool | Description |
|------|-------------|
| `memory_status` | Indexed files, memories count, initialization state |
| `memory_stats` | Token savings statistics (RAG vs full file loading) |
| `memory_score` | AI-readiness score for the project |
| `memory_config` | Show current configuration |
| `memory_config_set` | Update config values (global or project scope) |

### Checkpoints

| Tool | Description |
|------|-------------|
| `memory_checkpoint` | Create/list backups of memories, documents, brain vault |

### PRD pipeline

| Tool | Description |
|------|-------------|
| `memory_prd_generate` | Generate PRD from feature description with quality gates |
| `memory_prd_list` | List all PRDs (ID, status, title) |
| `memory_prd_status` | Show PRD details and task status |
| `memory_prd_run` | Execute PRD with branch isolation and auto-commit |
| `memory_prd_export` | Export to Obsidian with Mermaid diagrams |

## Install

```bash
npm install @succ/openclaw-succ succ
```

## Configure

Add to your `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "@succ/openclaw-succ": {
        "autoInit": true,
        "embeddingMode": "local",
        "storageBackend": "sqlite",
        "analyzeMode": "claude"
      }
    }
  }
}
```

Restart OpenClaw. The plugin will:
1. Create `.succ/` directory in your workspace (if `autoInit: true`)
2. Initialize local embeddings (Transformers.js, ~384 dimensions)
3. Replace native memory tools with succ-powered versions
4. Register all 27 tools

## Config options

| Option | Default | Description |
|--------|---------|-------------|
| `autoInit` | `true` | Auto-create `.succ/` if missing |
| `markdownBridge` | `false` | Bidirectional sync: succ DB ↔ Markdown files |
| `embeddingMode` | `"local"` | `local` (Transformers.js), `openrouter` (cloud), `custom` (Ollama) |
| `storageBackend` | `"sqlite"` | `sqlite` (local, zero-config) or `postgresql` (requires connection via `.succ/config.json`) |
| `analyzeMode` | `"claude"` | LLM for `memory_analyze`: `claude` (CLI), `openrouter` (cloud), `local` (Ollama/LM Studio) |
| `openrouterApiKey` | — | OpenRouter API key (for `openrouter` embedding/analyze/web search modes) |
| `maxSearchResults` | `10` | Default max results for memory_search |
| `snippetMaxChars` | `700` | Max snippet length in search results |

These options are **convenience shortcuts** — they override the equivalent settings in `.succ/config.json`. For fine-grained control (batch sizes, GPU, quality scoring thresholds, etc.), edit `.succ/config.json` directly.

## How it works

### memory_search (replaces native)

Parallel search across three indexes, merged by similarity:

```
query → ┌─ hybridSearchCode()     (source files)
         ├─ hybridSearchDocs()     (brain vault)
         └─ hybridSearchMemories() (structured memories)

         → merge by score → truncate → return OpenClaw format
```

### memory_get (replaces native)

Tiered retrieval with workspace boundary validation:
1. **File path** → validate within workspace → literal file read
2. **`memory:123`** → retrieve memory by ID
3. **Anything else** → semantic search, return best match

### Compaction hook

Before OpenClaw compacts context, the plugin:
1. Extracts a summary from recent messages
2. Saves to succ with `valid_until: 7d` and tag `auto-compact`
3. Memory survives context window reset

### File change hook

When files change in the workspace:
1. Validates path is within workspace boundary
2. Checks file extension is indexable
3. Re-indexes with content hash comparison

### Markdown bridge (optional)

When `markdownBridge: true`:
- New memories → exported to `.succ/brain/` as dated Markdown
- File changes in `.succ/brain/` → imported back to succ DB
- Preserves human-readable file transparency

## Security

- All file reads are validated against the workspace boundary (path traversal prevention)
- `SUCC_PROJECT_ROOT` must be an absolute path
- Markdown bridge imports are restricted to `.succ/brain/` directory
- No shell command execution — all operations are in-process
- Partial search failures are logged (not silently swallowed)

## vs Native OpenClaw memory

| Feature | OpenClaw Native | @succ/openclaw-succ |
|---------|-----------------|---------------------|
| Storage | Markdown files | SQLite + vector index |
| Search | BM25 + vector (Markdown only) | BM25 + vector (code + docs + memories) |
| Memory types | Untyped | 6 types (observation, decision, learning, error, pattern, dead_end) |
| Knowledge graph | None | 8 relation types, BFS traversal, community detection |
| Dead-end tracking | Manual | Automatic with 15% boost |
| Temporal queries | File timestamps | valid_from, valid_until, as_of_date |
| Web search | None | 3 tiers (quick/quality/deep research) |
| PRD pipeline | None | Generate, track, execute with quality gates |
| AI readiness | None | Scoring and improvement recommendations |
| Cross-project | Per-workspace | Global memory mode |
| Code search | General semantic | AST-aware |
| Tools | 2 | 27 |

## vs Mem0 / Cognee

| | Mem0 | Cognee | succ |
|---|---|---|---|
| Persistence | Cloud or self-hosted | External graph DB | Local SQLite (zero infra) |
| Knowledge graph | No | Yes | Yes (9 operations) |
| Typed memories | No | No | Yes (6 types) |
| Dead-end tracking | No | No | Yes |
| Code-aware search | No | No | Yes |
| Temporal queries | No | No | Yes |
| Web search | No | No | Yes (3 tiers) |
| PRD pipeline | No | No | Yes |
| Local-first | Partial | No | Yes |

## Requirements

- Node.js >= 22
- OpenClaw >= 0.1.0
- succ >= 1.1.0

## License

FSL-1.1-Apache-2.0 (same as succ)
