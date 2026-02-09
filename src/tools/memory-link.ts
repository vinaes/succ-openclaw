import { z } from 'zod';
import {
  createMemoryLink,
  deleteMemoryLink,
  getMemoryWithLinks,
  getGraphStats,
  autoLinkSimilarMemories,
  enrichExistingLinks,
  createProximityLinks,
  detectCommunities,
  updateCentralityCache,
} from 'succ/api';
import type { LinkRelation } from 'succ/api';
import { RELATION_TYPES } from '../types.js';

export const memoryLinkSchema = z.object({
  action: z
    .enum(['create', 'delete', 'show', 'stats', 'auto', 'enrich', 'proximity', 'communities', 'centrality'])
    .describe(
      'Action: create/delete/show/stats for basic ops; ' +
      'auto = auto-link similar memories; enrich = LLM-classify relations; ' +
      'proximity = co-occurrence links; communities = detect clusters; centrality = compute scores',
    ),
  sourceId: z.number().optional().describe('Source memory ID (for create/delete/show)'),
  targetId: z.number().optional().describe('Target memory ID (for create/delete)'),
  relation: z
    .enum(RELATION_TYPES as unknown as [string, ...string[]])
    .optional()
    .default('related')
    .describe('Relation type: related, caused_by, leads_to, similar_to, contradicts, implements, supersedes, references'),
  threshold: z.number().optional().describe('Similarity threshold for auto-linking (default: 0.75)'),
});

type MemoryLinkParams = z.infer<typeof memoryLinkSchema>;

/**
 * Knowledge graph — full 9-action tool matching succ_link.
 */
export async function memoryLink(params: MemoryLinkParams): Promise<any> {
  const { action, sourceId, targetId, relation, threshold } = params;

  switch (action) {
    case 'create': {
      if (!sourceId || !targetId) {
        throw new Error('sourceId and targetId required for create');
      }
      await createMemoryLink(sourceId, targetId, (relation || 'related') as LinkRelation);
      return { message: `Linked memory ${sourceId} → ${targetId} (${relation})` };
    }

    case 'delete': {
      if (!sourceId || !targetId) {
        throw new Error('sourceId and targetId required for delete');
      }
      await deleteMemoryLink(sourceId, targetId);
      return { message: `Unlinked memory ${sourceId} → ${targetId}` };
    }

    case 'show': {
      if (!sourceId) {
        throw new Error('sourceId required for show');
      }
      return await getMemoryWithLinks(sourceId);
    }

    case 'stats': {
      return await getGraphStats();
    }

    case 'auto': {
      const linksCreated = await autoLinkSimilarMemories(threshold);
      return { message: `Auto-linked memories`, linksCreated };
    }

    case 'enrich': {
      const result = await enrichExistingLinks();
      return { message: `Enriched links with LLM classification`, ...result };
    }

    case 'proximity': {
      const result = await createProximityLinks();
      return { message: `Created proximity links from co-occurrences`, ...result };
    }

    case 'communities': {
      const result = await detectCommunities();
      return { message: `Detected communities via Label Propagation`, ...result };
    }

    case 'centrality': {
      const result = await updateCentralityCache();
      return { message: `Updated centrality scores`, ...result };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
