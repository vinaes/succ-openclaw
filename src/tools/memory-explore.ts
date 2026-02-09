import { z } from 'zod';
import { findConnectedMemories, getMemoryById } from 'succ/api';

export const memoryExploreSchema = z.object({
  memoryId: z.number().describe('Starting memory ID'),
  depth: z.number().optional().default(2).describe('Max traversal depth (default: 2)'),
});

type MemoryExploreParams = z.infer<typeof memoryExploreSchema>;

/**
 * Knowledge graph traversal — NEW tool for OpenClaw.
 *
 * BFS from a starting memory, discovering connected knowledge.
 * Useful for: "what else is related to this decision?"
 */
export async function memoryExplore(params: MemoryExploreParams): Promise<any> {
  const { memoryId, depth } = params;

  const startMemory = await getMemoryById(memoryId);
  if (!startMemory) {
    throw new Error(`Memory ${memoryId} not found`);
  }

  const connected = await findConnectedMemories(memoryId, depth);

  return {
    start: {
      id: startMemory.id,
      content: startMemory.content,
      type: startMemory.type,
      tags: startMemory.tags,
    },
    connected: connected.map((m: any) => ({
      id: m.id,
      content: m.content,
      type: m.type,
      relation: m.relation,
      depth: m.depth,
    })),
    totalConnected: connected.length,
  };
}
