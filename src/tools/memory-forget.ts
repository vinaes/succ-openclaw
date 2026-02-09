import { z } from 'zod';
import { deleteMemory, deleteMemoriesOlderThan, deleteMemoriesByTag } from 'succ/api';

export const memoryForgetSchema = z.object({
  id: z.number().optional().describe('Delete memory by ID'),
  tag: z.string().optional().describe('Delete all memories with this tag'),
  older_than: z.string().optional().describe('Delete memories older than (e.g., "30d", "1w", "3m")'),
});

type MemoryForgetParams = z.infer<typeof memoryForgetSchema>;

/**
 * Memory deletion — NEW tool for OpenClaw.
 *
 * Clean up stale context, GDPR compliance, prune irrelevant memories.
 */
export async function memoryForget(params: MemoryForgetParams): Promise<{ message: string; deleted: number }> {
  const { id, tag, older_than } = params;

  if (!id && !tag && !older_than) {
    throw new Error('Provide at least one of: id, tag, or older_than');
  }

  if (id) {
    const success = await deleteMemory(id);
    return { message: success ? `Deleted memory ${id}` : `Memory ${id} not found`, deleted: success ? 1 : 0 };
  }

  if (tag) {
    const count = await deleteMemoriesByTag(tag);
    return { message: `Deleted ${count} memories with tag "${tag}"`, deleted: count };
  }

  if (older_than) {
    const date = parseDuration(older_than);
    const count = await deleteMemoriesOlderThan(date);
    return { message: `Deleted ${count} memories older than ${older_than}`, deleted: count };
  }

  return { message: 'No action taken', deleted: 0 };
}

function parseDuration(duration: string): Date {
  const match = duration.match(/^(\d+)([dwmy])$/);
  if (!match) {
    throw new Error(`Invalid duration format: "${duration}". Use: 7d, 2w, 1m, 1y`);
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const now = new Date();

  switch (unit) {
    case 'd':
      now.setDate(now.getDate() - amount);
      break;
    case 'w':
      now.setDate(now.getDate() - amount * 7);
      break;
    case 'm':
      now.setMonth(now.getMonth() - amount);
      break;
    case 'y':
      now.setFullYear(now.getFullYear() - amount);
      break;
  }

  return now;
}
