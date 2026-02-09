# @succ/openclaw-succ

OpenClaw plugin that replaces native memory with [succ](https://github.com/Vinaes/succ) — hybrid search (BM25 + semantic), typed memories, knowledge graph, dead-end tracking, and temporal queries.

## What it does

**Replaces** OpenClaw's native `memory_search` and `memory_get` with succ-powered versions that search across:
- Source code (AST-aware semantic search)
- Brain vault documentation
- Structured memories (observations, decisions, learnings, errors, patterns)

**Adds** new tools that OpenClaw doesn't have:

| Tool | Description |
|------|-------------|
| `memory_store` | Save typed memories with tags and auto-classification |
| `memory_link` | Build knowledge graph links between memories |
| `memory_dead_end` | Record failed approaches (auto-boosted 15% in search) |
| `memory_explore` | BFS graph traversal from any memory |
| `memory_forget` | Delete memories by ID, tag, or age |
| `memory_index` | Incremental file indexing |

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
        "markdownBridge": false,
        "embeddingMode": "local"
      }
    }
  }
}
```

Restart OpenClaw. The plugin will:
1. Create `.succ/` directory in your workspace (if `autoInit: true`)
2. Initialize local embeddings (Transformers.js, ~384 dimensions)
3. Replace native memory tools with succ-powered versions
4. Register new tools (link, dead_end, explore, etc.)

## Config options

| Option | Default | Description |
|--------|---------|-------------|
| `autoInit` | `true` | Auto-create `.succ/` if missing |
| `markdownBridge` | `false` | Bidirectional sync: succ DB ↔ Markdown files |
| `embeddingMode` | `"local"` | `local` (Transformers.js), `openrouter` (cloud), `custom` (Ollama) |
| `maxSearchResults` | `10` | Default max results for memory_search |
| `snippetMaxChars` | `700` | Max snippet length in search results |

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

Tiered retrieval:
1. **File path** → literal file read
2. **`memory:123`** → retrieve memory by ID
3. **Anything else** → semantic search, return best match

### Compaction hook

Before OpenClaw compacts context, the plugin:
1. Extracts a summary from recent messages
2. Saves to succ with `valid_until: 7d` and tag `auto-compact`
3. Memory survives context window reset

### Markdown bridge (optional)

When `markdownBridge: true`:
- New memories → exported to `.succ/brain/` as dated Markdown
- File changes in `.succ/brain/` → imported back to succ DB
- Preserves human-readable file transparency

## vs Native OpenClaw memory

| Feature | OpenClaw Native | @succ/openclaw-succ |
|---------|-----------------|---------------------|
| Storage | Markdown files | SQLite + vector index |
| Search | BM25 + vector (Markdown only) | BM25 + vector (code + docs + memories) |
| Memory types | Untyped | 6 types (observation, decision, learning, error, pattern, dead_end) |
| Knowledge graph | None | 8 relation types, BFS traversal |
| Dead-end tracking | Manual | Automatic with 15% boost |
| Temporal queries | File timestamps | valid_from, valid_until, as_of_date |
| Cross-project | Per-workspace | Global memory mode |
| Code search | General semantic | AST-aware |

## vs Mem0 / Cognee

| | Mem0 | Cognee | succ |
|---|---|---|---|
| Persistence | Cloud or self-hosted | External graph DB | Local SQLite (zero infra) |
| Knowledge graph | No | Yes | Yes |
| Typed memories | No | No | Yes (6 types) |
| Dead-end tracking | No | No | Yes |
| Code-aware search | No | No | Yes |
| Temporal queries | No | No | Yes |
| Local-first | Partial | No | Yes |

## Requirements

- Node.js >= 22
- OpenClaw >= 0.1.0
- succ >= 1.1.0

## License

FSL-1.1-Apache-2.0 (same as succ)
