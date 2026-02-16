import { z } from 'zod';
import {
  getStats,
  getMemoryStats,
  isProjectInitialized,
  isGlobalOnlyMode,
  getConfig,
  getTokenStatsAggregated,
  getTokenStatsSummary,
  calculateAIReadinessScore,
  formatAIReadinessScore,
  getConfigDisplay,
  formatConfigDisplay,
} from '@vinaes/succ/api';

export const memoryStatusSchema = z.object({});
export const memoryStatsSchema = z.object({});
export const memoryScoreSchema = z.object({});
export const memoryConfigSchema = z.object({});

export const memoryConfigSetSchema = z.object({
  key: z.string().describe('Config key (e.g., "embedding_mode", "quality_scoring_enabled")'),
  value: z.string().describe('Value to set'),
  scope: z.enum(['global', 'project']).optional().default('global'),
});

/**
 * succ status — documents indexed, memories count, daemons.
 */
export async function memoryStatus(): Promise<any> {
  const initialized = isProjectInitialized();
  const globalOnly = isGlobalOnlyMode();

  let docStats: any = null;
  let memStats: any = null;

  try {
    docStats = await getStats();
    memStats = await getMemoryStats();
  } catch (e) {
    console.warn('[succ] Stats query failed (DB may not be ready):', (e as Error).message);
  }

  return {
    initialized,
    globalOnly,
    documents: docStats,
    memories: memStats,
  };
}

/**
 * Token savings statistics — how many tokens saved by RAG vs full file loading.
 */
export async function memoryStats(): Promise<any> {
  try {
    const aggregated = await getTokenStatsAggregated();
    const summary = await getTokenStatsSummary();
    return { aggregated, summary };
  } catch (e) {
    console.warn('[succ] Token stats query failed:', (e as Error).message);
    return { aggregated: [], summary: null };
  }
}

/**
 * AI-readiness score — how well-prepared is the project for AI collaboration.
 */
export async function memoryScore(): Promise<{ score: any; formatted: string }> {
  const score = await calculateAIReadinessScore();
  const formatted = formatAIReadinessScore(score);
  return { score, formatted };
}

/**
 * Show current succ configuration.
 */
export async function memoryConfig(): Promise<string> {
  const display = getConfigDisplay();
  return formatConfigDisplay(display);
}

/**
 * Update a succ config value.
 */
export async function memoryConfigSet(params: z.infer<typeof memoryConfigSetSchema>): Promise<{ message: string }> {
  const { key, value, scope } = params;

  // Read config file
  const fs = await import('node:fs');
  const path = await import('node:path');
  const os = await import('node:os');

  const projectRoot = process.env.SUCC_PROJECT_ROOT || process.cwd();
  const configPath =
    scope === 'project'
      ? path.join(projectRoot, '.succ', 'config.json')
      : path.join(os.homedir(), '.succ', 'config.json');

  let config: any = {};
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`[succ] Failed to parse config at ${configPath}, using defaults`);
    }
  }

  // Parse value
  let parsed: any = value;
  if (value === 'true') parsed = true;
  else if (value === 'false') parsed = false;
  else if (/^\d+$/.test(value)) parsed = parseInt(value, 10);
  else if (/^\d+\.\d+$/.test(value)) parsed = parseFloat(value);

  // Handle nested keys (e.g., "idle_reflection.enabled")
  const keys = key.split('.');
  let target = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!target[keys[i]] || typeof target[keys[i]] !== 'object') {
      target[keys[i]] = {};
    }
    target = target[keys[i]];
  }
  target[keys[keys.length - 1]] = parsed;

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  return { message: `Config updated (${scope}): ${key} = ${value}` };
}
