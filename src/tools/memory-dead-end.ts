import { z } from 'zod';
import { saveMemory, getEmbedding } from 'succ/api';

export const memoryDeadEndSchema = z.object({
  approach: z.string().describe('What was tried (e.g., "Using Redis for session storage")'),
  why_failed: z.string().describe('Why it failed (e.g., "Memory usage too high for VPS")'),
  context: z.string().optional().describe('Additional context (file paths, error messages)'),
  tags: z.array(z.string()).optional().default([]).describe('Tags for categorization'),
});

type MemoryDeadEndParams = z.infer<typeof memoryDeadEndSchema>;

/**
 * Dead-end tracking — NEW tool for OpenClaw.
 *
 * Records failed approaches so agents don't retry them.
 * Dead-end memories are auto-boosted 15% in succ_recall results.
 */
export async function memoryDeadEnd(params: MemoryDeadEndParams): Promise<{ id: number; message: string }> {
  const { approach, why_failed, context, tags } = params;

  const content =
    `DEAD END: ${approach}\n\n` +
    `Why it failed: ${why_failed}` +
    (context ? `\n\nContext: ${context}` : '');

  const allTags = [...new Set(['dead-end', 'openclaw', ...tags])];
  const embedding = await getEmbedding(content);

  const result = await saveMemory(content, embedding, allTags, 'dead-end', {
    type: 'dead_end',
  });

  return {
    id: (result as any).id ?? 0,
    message: `Recorded dead-end: "${approach}". This will be boosted in future searches to prevent retrying.`,
  };
}
