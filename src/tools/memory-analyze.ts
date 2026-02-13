import { z } from 'zod';
import { analyzeFile, indexCodeFile, reindexFiles, getProjectRoot } from 'succ/api';

export const memoryAnalyzeSchema = z.object({
  file: z.string().describe('File path to analyze with LLM'),
  mode: z.enum(['claude', 'api']).optional().describe('LLM mode: claude (CLI with Haiku) or api (OpenRouter/Ollama/LM Studio)'),
});

export const memoryIndexCodeSchema = z.object({
  file: z.string().describe('Source code file to index'),
  force: z.boolean().optional().default(false).describe('Force re-index even if unchanged'),
});

export const memoryReindexSchema = z.object({});

type MemoryAnalyzeParams = z.infer<typeof memoryAnalyzeSchema>;
type MemoryIndexCodeParams = z.infer<typeof memoryIndexCodeSchema>;

/**
 * LLM-powered file analysis — generates documentation in brain vault.
 */
export async function memoryAnalyze(params: MemoryAnalyzeParams): Promise<{ message: string; outputPath?: string }> {
  const result = await analyzeFile(params.file, params.mode ? { mode: params.mode } : undefined);
  return {
    message: `Analyzed: ${params.file}`,
    outputPath: (result as any).outputPath,
  };
}

/**
 * Index a source code file for semantic code search.
 */
export async function memoryIndexCode(params: MemoryIndexCodeParams): Promise<{ message: string; indexed: boolean }> {
  const result = await indexCodeFile(params.file, { force: params.force });
  return {
    message: `Indexed code: ${params.file}`,
    indexed: true,
  };
}

/**
 * Detect stale/deleted files and re-index them.
 */
export async function memoryReindex(): Promise<any> {
  const projectRoot = getProjectRoot();
  const result = await reindexFiles(projectRoot);
  return result;
}
