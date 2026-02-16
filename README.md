<p align="center">
  <img src="https://img.shields.io/badge/●%20succ-openclaw%20plugin-3fb950?style=for-the-badge&labelColor=0d1117" alt="succ openclaw plugin">
  <br/><br/>
  <em>succ-powered memory for OpenClaw agents</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@succ/openclaw-succ"><img src="https://img.shields.io/npm/v/@succ/openclaw-succ?style=flat-square&color=3fb950" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-FSL--1.1-blue?style=flat-square" alt="license"></a>
  <a href="https://github.com/Vinaes/succ"><img src="https://img.shields.io/badge/powered%20by-succ-3fb950?style=flat-square" alt="powered by succ"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#tools">Tools</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#comparison">Comparison</a>
</p>

---

> OpenClaw plugin that replaces native memory with [succ](https://github.com/Vinaes/succ) — hybrid search (BM25 + semantic), typed memories, knowledge graph, dead-end tracking, web search, PRD pipeline, and more.

## Quick Start

```bash
npm install @succ/openclaw-succ succ
```

Add to `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "@succ/openclaw-succ": {
        "autoInit": true
      }
    }
  }
}
```

Restart OpenClaw. The plugin will:
1. Create `.succ/` directory in your workspace
2. Initialize local embeddings (Transformers.js)
3. Replace native memory tools with succ-powered versions
4. Register all 35 tools
5. Inject system prompt with tool usage guide

## Tools

**Replaces** OpenClaw's native `memory_search` and `memory_get` with succ-powered versions that search across source code, brain vault documentation, and structured memories.

**Adds 33 new tools:**

### Core memory

| Tool | Description |
|------|-------------|
| `memory_store` | Save typed memories with tags and auto-classification |
| `memory_recall` | Semantic recall with tag/date filtering and temporal queries |
| `memory_forget` | Delete memories by ID, tag, or age |
| `memory_dead_end` | Record failed approaches (auto-boosted 15% in search) |
| `memory_similar` | Check for duplicates before storing |
| `memory_batch_store` | Save multiple memories in one call |
| `memory_batch_delete` | Delete multiple memories by IDs |

### Knowledge graph

| Tool | Description |
|------|-------------|
| `memory_link` | 9 actions: create/delete/show links, auto-link, LLM-enrich, proximity, communities, centrality |
| `memory_explore` | BFS graph traversal from any memory |

### Indexing & analysis

| Tool | Description |
|------|-------------|
| `memory_index` | Index a documentation file for semantic search |
| `memory_index_code` | Index a source code file (AST-aware) |
| `memory_analyze` | LLM-powered file analysis — generates docs in brain vault |
| `memory_reindex` | Detect stale/deleted files, re-index automatically |
| `memory_stale` | Check index freshness without re-indexing |
| `memory_symbols` | Extract AST symbols (functions, classes, interfaces) via tree-sitter |

### Web fetch & search

| Tool | Description |
|------|-------------|
| `memory_fetch` | Fetch web page as clean markdown (Readability + Playwright fallback) |
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

### Checkpoints & maintenance

| Tool | Description |
|------|-------------|
| `memory_checkpoint` | Create/list backups of memories, documents, brain vault |
| `memory_retention` | Analyze memory retention — decaying, access frequency, cleanup suggestions |

### Debug sessions

| Tool | Description |
|------|-------------|
| `memory_debug` | Structured debugging with hypothesis testing — 12 actions, 14 languages |

### PRD pipeline

| Tool | Description |
|------|-------------|
| `memory_prd_generate` | Generate PRD from feature description with quality gates |
| `memory_prd_list` | List all PRDs (ID, status, title) |
| `memory_prd_status` | Show PRD details and task status |
| `memory_prd_run` | Execute PRD with branch isolation and auto-commit |
| `memory_prd_export` | Export to Obsidian with Mermaid diagrams |

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `autoInit` | `true` | Auto-create `.succ/` if missing |
| `markdownBridge` | `false` | Bidirectional sync: succ DB ↔ Markdown files |
| `storageBackend` | `"sqlite"` | `sqlite` (local) or `postgresql` |
| `openrouterApiKey` | — | OpenRouter API key |
| `maxSearchResults` | `10` | Default max results for memory_search |
| `snippetMaxChars` | `700` | Max snippet length in search results |

These are **convenience shortcuts** — they override the equivalent settings in `.succ/config.json`. For fine-grained control (embedding mode, analyze mode, quality scoring, etc.), use `memory_config_set` or edit `.succ/config.json` directly.

<details>
<summary>Full config example</summary>

```json
{
  "plugins": {
    "entries": {
      "@succ/openclaw-succ": {
        "autoInit": true,
        "storageBackend": "sqlite",
        "maxSearchResults": 10,
        "snippetMaxChars": 700
      }
    }
  }
}
```

</details>

## How It Works

### memory_search (replaces native)

Parallel search across three indexes, merged by similarity:

```
query → ┌─ hybridSearchCode()     (source files, AST-aware)
         ├─ hybridSearchDocs()     (brain vault)
         └─ hybridSearchMemories() (structured memories)

         → merge by score → truncate → return OpenClaw format
```

### memory_get (replaces native)

Tiered retrieval with workspace boundary validation:
1. **File path** → validate within workspace → literal file read
2. **`memory:123`** → retrieve memory by ID
3. **Anything else** → semantic search, return best match

### Hooks

| Hook | What it does |
|------|-------------|
| **beforeCompact** | Extracts summary from recent messages, saves to succ with `valid_until: 7d` |
| **fileChanged** | Validates path, checks extension, re-indexes with content hash comparison |
| **shutdown** | Closes storage connections |

### System prompt injection

If the host supports `api.prompts.appendSystem()`, injects a compact (~1200 token) reference covering all 35 tools with usage patterns. Gracefully skipped if not supported.

### Markdown bridge (optional)

When `markdownBridge: true`:
- New memories → exported to `.succ/brain/` as dated Markdown
- File changes in `.succ/brain/` → imported back to succ DB
- Type detection from filename (`decision`, `learning`, `dead_end`, etc.)
- Duplicate prevention via Memory ID footer

## Comparison

### vs Native OpenClaw memory

| Feature | OpenClaw Native | @succ/openclaw-succ |
|---------|-----------------|---------------------|
| Storage | Markdown files | SQLite + vector index |
| Search | BM25 + vector (Markdown only) | BM25 + vector (code + docs + memories) |
| Memory types | Untyped | 6 types (observation, decision, learning, error, pattern, dead_end) |
| Knowledge graph | None | 8 relation types, BFS traversal, community detection |
| Dead-end tracking | Manual | Automatic with 15% boost |
| Temporal queries | File timestamps | valid_from, valid_until, as_of_date |
| Web search | None | 3 tiers + web fetch |
| PRD pipeline | None | Generate, track, execute with quality gates |
| Code search | General semantic | AST-aware (tree-sitter, 13 languages) |
| Tools | 2 | 35 |

### vs Mem0 / Cognee

| | Mem0 | Cognee | succ |
|---|---|---|---|
| Persistence | Cloud or self-hosted | External graph DB | Local SQLite (zero infra) |
| Knowledge graph | No | Yes | Yes (9 operations) |
| Typed memories | No | No | Yes (6 types) |
| Dead-end tracking | No | No | Yes |
| Code-aware search | No | No | Yes (AST) |
| Temporal queries | No | No | Yes |
| Web search | No | No | Yes (3 tiers) |
| PRD pipeline | No | No | Yes |
| Local-first | Partial | No | Yes |

## Security

- All file reads validated against workspace boundary (path traversal prevention)
- `SUCC_PROJECT_ROOT` must be an absolute path
- Markdown bridge imports restricted to `.succ/brain/` directory
- No shell command execution — all operations are in-process

## Testing

```bash
npm test
```

160 tests across 22 test files covering all 35 tools, registration flow, system prompt, markdown bridge, hooks, security, and initialization.

## Requirements

- Node.js >= 22
- OpenClaw >= 0.1.0
- succ >= 1.3.0

## License

[FSL-1.1-Apache-2.0](LICENSE) — same as succ.
