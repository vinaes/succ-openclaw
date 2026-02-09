import { z } from 'zod';
import { callOpenRouterSearch, saveMemory, getEmbedding } from 'succ/api';

export const memoryQuickSearchSchema = z.object({
  query: z.string().describe('Simple factual query'),
  system_prompt: z.string().optional().describe('Guide response format'),
  max_tokens: z.number().optional().default(2000),
  save_to_memory: z.boolean().optional().default(false).describe('Save result to succ memory'),
});

export const memoryWebSearchSchema = z.object({
  query: z.string().describe('Complex query for quality search'),
  model: z.string().optional().describe('Override search model (default: perplexity/sonar-pro)'),
  system_prompt: z.string().optional(),
  max_tokens: z.number().optional().default(4000),
  save_to_memory: z.boolean().optional().default(false),
});

export const memoryDeepResearchSchema = z.object({
  query: z.string().describe('Research question (30-120s, 30+ searches)'),
  system_prompt: z.string().optional(),
  max_tokens: z.number().optional().default(8000),
  include_reasoning: z.boolean().optional().default(false),
  save_to_memory: z.boolean().optional().default(false),
});

export const memoryWebHistorySchema = z.object({
  tool_name: z.enum(['memory_quick_search', 'memory_web_search', 'memory_deep_research']).optional(),
  model: z.string().optional(),
  query_text: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.number().optional().default(20),
});

type QuickSearchParams = z.infer<typeof memoryQuickSearchSchema>;
type WebSearchParams = z.infer<typeof memoryWebSearchSchema>;
type DeepResearchParams = z.infer<typeof memoryDeepResearchSchema>;

async function doSearch(
  query: string,
  model: string,
  systemPrompt: string | undefined,
  maxTokens: number,
  saveToMemory: boolean,
): Promise<{ answer: string; model: string }> {
  const messages: any[] = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: query });

  const response = await callOpenRouterSearch(messages, model, 120000, maxTokens, 0.1);
  const answer = response.content || 'No response';

  if (saveToMemory) {
    try {
      const embedding = await getEmbedding(answer);
      await saveMemory(answer, embedding, ['web-search', 'openclaw'], `web-search:${model}`, {
        type: 'observation' as any,
      });
    } catch {
      // Non-fatal: search result still returned
    }
  }

  return { answer, model };
}

export async function memoryQuickSearch(params: QuickSearchParams): Promise<{ answer: string; model: string }> {
  return doSearch(params.query, 'perplexity/sonar', params.system_prompt, params.max_tokens, params.save_to_memory);
}

export async function memoryWebSearch(params: WebSearchParams): Promise<{ answer: string; model: string }> {
  return doSearch(
    params.query,
    params.model || 'perplexity/sonar-pro',
    params.system_prompt,
    params.max_tokens,
    params.save_to_memory,
  );
}

export async function memoryDeepResearch(params: DeepResearchParams): Promise<{ answer: string; model: string }> {
  const model = 'perplexity/sonar-deep-research';
  const messages: any[] = [];
  if (params.system_prompt) {
    messages.push({ role: 'system', content: params.system_prompt });
  }
  messages.push({ role: 'user', content: params.query });

  const response = await callOpenRouterSearch(messages, model, 300000, params.max_tokens, 0.1);
  const answer = response.content || 'No response';
  const reasoning = params.include_reasoning ? response.reasoning : undefined;

  if (params.save_to_memory) {
    try {
      const embedding = await getEmbedding(answer);
      await saveMemory(answer, embedding, ['deep-research', 'openclaw'], `deep-research`, {
        type: 'observation' as any,
      });
    } catch {
      // Non-fatal
    }
  }

  return { answer: reasoning ? `**Reasoning:**\n${reasoning}\n\n**Answer:**\n${answer}` : answer, model };
}
