import { z } from 'zod';
import { createCheckpoint, listCheckpoints } from '@vinaes/succ/api';

export const memoryCheckpointSchema = z.object({
  action: z.enum(['create', 'list']).describe('Create a backup or list available checkpoints'),
  compress: z.boolean().optional().default(false).describe('Compress with gzip'),
  include_brain: z.boolean().optional().default(true).describe('Include brain vault files'),
  include_documents: z.boolean().optional().default(true).describe('Include indexed documents'),
});

type MemoryCheckpointParams = z.infer<typeof memoryCheckpointSchema>;

/**
 * Backup/restore checkpoints — full backup of memories, documents, brain vault.
 */
export async function memoryCheckpoint(params: MemoryCheckpointParams): Promise<any> {
  const { action, compress, include_brain, include_documents } = params;

  if (action === 'create') {
    const result = await createCheckpoint({ compress, includeBrain: include_brain, includeDocuments: include_documents });
    return {
      message: `Checkpoint created: ${result.outputPath}`,
      path: result.outputPath,
      checkpoint: result.checkpoint,
    };
  }

  if (action === 'list') {
    const checkpoints = listCheckpoints();
    return {
      count: checkpoints.length,
      checkpoints: checkpoints.map((c: any) => ({
        name: c.name,
        path: c.path,
        size: c.size,
        compressed: c.compressed,
        created_at: c.created_at,
      })),
    };
  }

  throw new Error(`Unknown action: ${action}`);
}
