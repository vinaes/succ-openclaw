/**
 * Type definitions for @succ/openclaw-succ plugin.
 *
 * OpenClaw Plugin SDK types are hypothetical — actual types depend on
 * OpenClaw's published SDK. These serve as the integration contract.
 */

// --- OpenClaw expected result formats ---

export interface OpenClawSearchResult {
  snippet: string;
  filePath: string;
  lineRange: { start: number; end: number };
  score: number;
  vectorScore: number;
  textScore: number;
  provider: string;
  symbolType?: string;
  symbolName?: string;
  signature?: string;
}

export interface OpenClawGetResult {
  content: string;
  path: string;
  lineCount: number;
}

// --- Plugin config (from openclaw.plugin.json schema) ---

export interface SuccPluginConfig {
  autoInit: boolean;
  markdownBridge: boolean;
  storageBackend: 'sqlite' | 'postgresql';
  openrouterApiKey?: string;
  maxSearchResults: number;
  snippetMaxChars: number;
}

export const DEFAULT_CONFIG: SuccPluginConfig = {
  autoInit: true,
  markdownBridge: false,
  storageBackend: 'sqlite',
  maxSearchResults: 10,
  snippetMaxChars: 700,
};

// --- OpenClaw Plugin API (hypothetical, based on research) ---

export interface OpenClawPluginAPI {
  workspace: {
    getRoot(): string;
  };
  config: {
    get<T>(key: string, defaultValue: T): T;
  };
  tools: {
    replace(name: string, tool: OpenClawTool): void;
    register(name: string, tool: OpenClawTool): void;
  };
  hooks: {
    on(event: string, handler: (...args: any[]) => Promise<void> | void): void;
  };
  prompts?: {
    appendSystem(content: string): void;
  };
}

export interface OpenClawTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  execute(params: any): Promise<any>;
}

// --- succ search result (from hybridSearch* functions) ---

export interface SuccSearchResult {
  content: string;
  file_path: string;
  start_line: number;
  end_line: number;
  similarity: number;
  chunk_id?: number;
}

export interface SuccMemoryResult {
  id: number;
  content: string;
  type: string;
  tags: string;
  source: string;
  created_at: string;
  similarity: number;
  quality_score?: number;
}

// --- Memory types ---

export type MemoryType = 'observation' | 'decision' | 'learning' | 'error' | 'pattern' | 'dead_end';

export const MEMORY_TYPES: MemoryType[] = ['observation', 'decision', 'learning', 'error', 'pattern', 'dead_end'];

export const RELATION_TYPES = [
  'related',
  'caused_by',
  'leads_to',
  'similar_to',
  'contradicts',
  'implements',
  'supersedes',
  'references',
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];
