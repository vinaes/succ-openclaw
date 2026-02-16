import { z } from 'zod';
import { analyzeRetention, getAllMemoriesForRetention } from '@vinaes/succ/api';

export const memoryRetentionSchema = z.object({});

/**
 * Analyze memory retention — shows which memories are decaying,
 * which are frequently accessed, and suggestions for cleanup.
 */
export async function memoryRetention(): Promise<any> {
  const memories = await getAllMemoriesForRetention();
  const result = analyzeRetention(memories);
  return result;
}
