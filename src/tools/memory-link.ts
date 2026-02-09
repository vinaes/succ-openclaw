import { z } from 'zod';
import { createMemoryLink, deleteMemoryLink, getMemoryWithLinks, getGraphStats } from 'succ/api';
import type { LinkRelation } from 'succ/api';
import { RELATION_TYPES } from '../types.js';

export const memoryLinkSchema = z.object({
  action: z
    .enum(['create', 'delete', 'show', 'stats'])
    .describe('Action: create a link, delete a link, show links for a memory, or get graph stats'),
  sourceId: z.number().optional().describe('Source memory ID (for create/delete/show)'),
  targetId: z.number().optional().describe('Target memory ID (for create/delete)'),
  relation: z
    .enum(RELATION_TYPES as unknown as [string, ...string[]])
    .optional()
    .default('related')
    .describe('Relation type'),
});

type MemoryLinkParams = z.infer<typeof memoryLinkSchema>;

/**
 * Knowledge graph links — NEW tool for OpenClaw.
 *
 * Build relationships between memories: decisions → implementations,
 * errors → fixes, patterns → examples.
 */
export async function memoryLink(params: MemoryLinkParams): Promise<any> {
  const { action, sourceId, targetId, relation } = params;

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
      const result = await getMemoryWithLinks(sourceId);
      return result;
    }

    case 'stats': {
      const stats = await getGraphStats();
      return stats;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
