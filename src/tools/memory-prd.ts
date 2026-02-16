import { z } from 'zod';
import {
  generatePrd,
  listPrds,
  findLatestPrd,
  loadPrd,
  loadTasks,
  runPrd,
  exportPrdToObsidian,
  exportAllPrds,
} from '@vinaes/succ/api';

export const memoryPrdGenerateSchema = z.object({
  description: z.string().describe('Feature description (e.g., "Add user auth with JWT")'),
  mode: z.enum(['loop', 'team']).optional().default('loop'),
  gates: z.string().optional().describe('Quality gates as comma-separated specs (e.g., "test:npm test,lint:eslint .")'),
  auto_parse: z.boolean().optional().default(true).describe('Auto-parse PRD into tasks'),
  model: z.string().optional().describe('LLM model override'),
});

export const memoryPrdListSchema = z.object({
  all: z.boolean().optional().default(false).describe('Include archived PRDs'),
});

export const memoryPrdStatusSchema = z.object({
  prd_id: z.string().optional().describe('PRD ID (defaults to latest)'),
});

export const memoryPrdRunSchema = z.object({
  prd_id: z.string().optional(),
  resume: z.boolean().optional().default(false),
  task_id: z.string().optional().describe('Run a specific task only'),
  dry_run: z.boolean().optional().default(false),
  max_iterations: z.number().optional(),
  no_branch: z.boolean().optional().default(false),
  model: z.string().optional(),
  force: z.boolean().optional().default(false),
  mode: z.enum(['loop', 'team']).optional().default('loop'),
  concurrency: z.number().optional(),
});

export const memoryPrdExportSchema = z.object({
  prd_id: z.string().optional(),
  all: z.boolean().optional().default(false),
  output: z.string().optional().describe('Output directory'),
});

export async function memoryPrdGenerate(params: z.infer<typeof memoryPrdGenerateSchema>): Promise<any> {
  const result = await generatePrd(params.description, {
    mode: params.mode as any,
    gates: params.gates,
    autoParse: params.auto_parse,
    model: params.model,
  });
  return result;
}

export async function memoryPrdList(params: z.infer<typeof memoryPrdListSchema>): Promise<any> {
  return listPrds(params.all);
}

export async function memoryPrdStatus(params: z.infer<typeof memoryPrdStatusSchema>): Promise<any> {
  const prdId = params.prd_id || findLatestPrd()?.id;
  if (!prdId) return { message: 'No PRDs found' };

  const prd = loadPrd(prdId);
  const tasks = loadTasks(prdId);
  return { prd, tasks };
}

export async function memoryPrdRun(params: z.infer<typeof memoryPrdRunSchema>): Promise<any> {
  const prdId = params.prd_id || findLatestPrd()?.id;
  if (!prdId) throw new Error('No PRD found');

  return runPrd(prdId, {
    resume: params.resume,
    taskId: params.task_id,
    dryRun: params.dry_run,
    maxIterations: params.max_iterations,
    noBranch: params.no_branch,
    model: params.model,
    force: params.force,
    mode: params.mode as any,
    concurrency: params.concurrency,
  });
}

export async function memoryPrdExport(params: z.infer<typeof memoryPrdExportSchema>): Promise<any> {
  if (params.all) {
    return exportAllPrds(params.output, false);
  }
  const prdId = params.prd_id || findLatestPrd()?.id;
  if (!prdId) throw new Error('No PRD found');
  return exportPrdToObsidian(prdId, params.output);
}
