import path from 'path';
import { z } from 'zod';
import {
  saveMemory,
  saveGlobalMemory,
  saveMemoriesBatch,
  getEmbedding,
  getConfig,
  getLLMConfig,
  extractFactsWithLLM,
  scoreMemory,
  passesQualityThreshold,
  scanSensitive,
  parseDuration,
} from '@vinaes/succ/api';
import { MEMORY_TYPES, type MemoryType } from '../types.js';

export const memoryStoreSchema = z.object({
  content: z.string().describe('Content to remember'),
  type: z
    .enum(MEMORY_TYPES as unknown as [string, ...string[]])
    .optional()
    .default('observation')
    .describe('Memory type: observation, decision, learning, error, pattern, dead_end'),
  tags: z.array(z.string()).optional().default([]).describe('Tags for categorization'),
  source: z.string().optional().default('openclaw').describe('Source context'),
  files: z
    .array(z.string())
    .optional()
    .describe('File paths this memory relates to. Adds file:{basename} tags for auto-recall on edit.'),
  extract: z
    .boolean()
    .optional()
    .describe('Use LLM to extract structured facts from content. Default: from config.'),
  global: z.boolean().optional().default(false).describe('Save to global (cross-project) memory.'),
  valid_from: z
    .string()
    .optional()
    .describe('When this fact becomes valid. ISO date (2025-03-01) or duration (7d, 2w, 1m).'),
  valid_until: z
    .string()
    .optional()
    .describe('When this fact expires. ISO date (2025-12-31) or duration (7d, 30d).'),
});

type MemoryStoreParams = z.infer<typeof memoryStoreSchema>;

/**
 * Explicit memory storage — wraps succ_remember for OpenClaw.
 *
 * Supports file-linked memories, LLM fact extraction, global/local save,
 * temporal validity, quality scoring, and sensitive content filtering.
 */
export async function memoryStore(
  params: MemoryStoreParams,
): Promise<{ id?: number; ids?: number[]; message: string }> {
  const { content, type, tags, source, files, extract, global: useGlobal, valid_from, valid_until } = params;

  // Build tags with openclaw marker + file:{basename} tags
  let allTags = [...new Set([...tags, 'openclaw'])];
  if (files && files.length > 0) {
    const fileTags = files.map((f) => `file:${path.basename(f)}`);
    allTags = [...new Set([...allTags, ...fileTags])];
  }

  // Parse temporal validity
  let validFromDate: Date | undefined;
  let validUntilDate: Date | undefined;
  if (valid_from) {
    try {
      validFromDate = parseDuration(valid_from);
    } catch {
      return { message: `Invalid valid_from format: ${valid_from}. Use ISO date or duration (7d, 2w, 1m).` };
    }
  }
  if (valid_until) {
    try {
      validUntilDate = parseDuration(valid_until);
    } catch {
      return { message: `Invalid valid_until format: ${valid_until}. Use ISO date or duration (7d, 30d).` };
    }
  }

  // Sensitive content check
  const filterResult = scanSensitive(content);
  if (filterResult.hasSensitive) {
    return { message: `Blocked: content contains sensitive data (${filterResult.matches.map((m) => m.type).join(', ')}). Remove secrets before saving.` };
  }

  // Determine extraction mode
  const config = getConfig();
  const configDefault = config.remember_extract_default !== false;
  const useExtract = extract ?? configDefault;

  if (useExtract) {
    return await storeWithExtraction(content, allTags, source, type as MemoryType, useGlobal, validFromDate, validUntilDate);
  }

  return await storeDirect(content, allTags, source, type as MemoryType, useGlobal, validFromDate, validUntilDate);
}

/** Direct save path — no LLM extraction */
async function storeDirect(
  content: string,
  tags: string[],
  source: string,
  type: MemoryType,
  useGlobal: boolean,
  validFrom?: Date,
  validUntil?: Date,
): Promise<{ id: number; message: string }> {
  const embedding = await getEmbedding(content);

  if (useGlobal) {
    const result = await saveGlobalMemory(content, embedding, tags, source, { type });
    return {
      id: result.id,
      message: `Saved global ${type} memory (tags: ${tags.join(', ')})`,
    };
  }

  const result = await saveMemory(content, embedding, tags, source, {
    type,
    validFrom,
    validUntil,
  });

  return {
    id: result.id,
    message: `Saved ${type} memory (tags: ${tags.join(', ')})${validUntil ? ` [expires: ${validUntil.toISOString().slice(0, 10)}]` : ''}`,
  };
}

/** Extraction path — LLM splits content into structured facts */
async function storeWithExtraction(
  content: string,
  tags: string[],
  source: string,
  type: MemoryType,
  useGlobal: boolean,
  validFrom?: Date,
  validUntil?: Date,
): Promise<{ ids?: number[]; message: string }> {
  const llmConfig = getLLMConfig();

  let facts;
  try {
    facts = await extractFactsWithLLM(content, {
      mode: llmConfig.backend,
      model: llmConfig.model,
      apiUrl: llmConfig.endpoint,
      apiKey: llmConfig.apiKey,
    });
  } catch (e) {
    console.warn('[succ] LLM extraction failed, falling back to direct save:', (e as Error).message);
    const directResult = await storeDirect(content, tags, source, type, useGlobal, validFrom, validUntil);
    return { ids: [directResult.id], message: `${directResult.message} (extraction fallback)` };
  }

  if (facts.length === 0) {
    const directResult = await storeDirect(content, tags, source, type, useGlobal, validFrom, validUntil);
    return { ids: [directResult.id], message: `${directResult.message} (no facts extracted)` };
  }

  // Score and filter facts, then save
  const config = getConfig();
  const qualityEnabled = config.quality_scoring_enabled !== false;
  const prepared: Array<{ content: string; embedding: number[]; tags: string[]; type: MemoryType; qualityScore?: { score: number; factors: Record<string, number> } }> = [];

  for (const fact of facts) {
    // Sensitive check per fact
    const factFilter = scanSensitive(fact.content);
    if (factFilter.hasSensitive) continue;

    const factTags = [
      ...new Set([
        ...tags,
        ...fact.tags,
        ...(fact.files?.map((f: string) => `file:${path.basename(f)}`) ?? []),
        fact.type,
        'extracted',
      ]),
    ];

    const embedding = await getEmbedding(fact.content);

    if (qualityEnabled) {
      try {
        const qs = await scoreMemory(fact.content);
        if (!passesQualityThreshold(qs)) continue;
        prepared.push({
          content: fact.content,
          embedding,
          tags: factTags,
          type: fact.type as MemoryType,
          qualityScore: { score: qs.score, factors: qs.factors as unknown as Record<string, number> },
        });
      } catch (e) {
        console.warn('[succ] Quality scoring failed, saving without score:', (e as Error).message);
        prepared.push({ content: fact.content, embedding, tags: factTags, type: fact.type as MemoryType });
      }
    } else {
      prepared.push({ content: fact.content, embedding, tags: factTags, type: fact.type as MemoryType });
    }
  }

  if (prepared.length === 0) {
    return { message: 'All extracted facts were filtered (sensitive content or low quality).' };
  }

  if (useGlobal) {
    // No batch API for global — save one by one
    const ids: number[] = [];
    for (const item of prepared) {
      const result = await saveGlobalMemory(item.content, item.embedding, item.tags, source, { type: item.type });
      ids.push(result.id);
    }
    return { ids, message: `Extracted ${ids.length} facts, saved to global memory.` };
  }

  const batchInputs = prepared.map((item) => ({
    content: item.content,
    embedding: item.embedding,
    tags: item.tags,
    type: item.type,
    source: source || 'extraction',
    qualityScore: item.qualityScore,
    validFrom: validFrom?.toISOString(),
    validUntil: validUntil?.toISOString(),
  }));

  const batchResult = await saveMemoriesBatch(batchInputs);
  return {
    ids: batchResult.ids,
    message: `Extracted ${batchResult.ids.length} facts from content (${batchResult.duplicatesSkipped ?? 0} duplicates skipped).`,
  };
}
