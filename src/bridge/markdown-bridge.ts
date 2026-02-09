import fs from 'node:fs';
import path from 'node:path';
import { getRecentMemories, saveMemory, getEmbedding } from 'succ/api';
import type { MemoryType } from 'succ/api';
import { assertPathWithinBrainVault } from '../security.js';

/**
 * Markdown bridge — optional bidirectional sync between succ DB and Markdown files.
 *
 * When enabled via config.markdownBridge:
 * - After memory saves → exports to .succ/brain/ as dated Markdown
 * - On file change in .succ/brain/ → imports back to succ DB
 */

/**
 * Export recent memories to Markdown files in .succ/brain/.
 */
export async function exportMemoriesToMarkdown(workspaceRoot: string, limit: number = 10): Promise<number> {
  const memories = await getRecentMemories(limit);
  let exported = 0;

  for (const mem of memories) {
    const date = new Date(mem.created_at).toISOString().split('T')[0];
    const type = mem.type || 'observation';
    const tags = typeof mem.tags === 'string' ? mem.tags.split(',').map((t: string) => t.trim()) : mem.tags || [];

    const dir = type === 'dead_end'
      ? path.join(workspaceRoot, '.succ', 'brain', '04_Dead_Ends')
      : path.join(workspaceRoot, '.succ', 'brain', '02_Knowledge');

    fs.mkdirSync(dir, { recursive: true });

    const slug = (mem.content || '')
      .substring(0, 40)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled';

    const filename = `${date}-${type}-${mem.id}-${slug}.md`;
    const filepath = path.join(dir, filename);

    // Don't overwrite existing exports
    if (fs.existsSync(filepath)) continue;

    const markdown =
      `# ${type}: ${slug}\n\n` +
      `**Created:** ${new Date(mem.created_at).toLocaleString()}\n` +
      `**Tags:** ${tags.map((t: string) => `#${t}`).join(' ')}\n` +
      `**Source:** ${mem.source || 'unknown'}\n\n` +
      `---\n\n` +
      `${mem.content}\n\n` +
      `---\n` +
      `*Memory ID: ${mem.id}*\n`;

    fs.writeFileSync(filepath, markdown, 'utf-8');
    exported++;
  }

  return exported;
}

/**
 * Import a Markdown file back into succ DB.
 * Detects Memory ID in footer to avoid duplicates.
 */
export async function importMarkdownToMemory(filePath: string): Promise<boolean> {
  const safePath = assertPathWithinBrainVault(filePath);
  if (!fs.existsSync(safePath)) return false;

  const content = fs.readFileSync(safePath, 'utf-8');

  // If it already has a Memory ID, it was exported from succ — skip
  const idMatch = content.match(/\*Memory ID: (\d+)\*/);
  if (idMatch) return false;

  // Extract tags from #hashtags
  const tags = Array.from(content.matchAll(/#(\w+)/g)).map((m) => m[1]);

  // Determine type from filename
  let type = 'observation';
  const basename = path.basename(filePath);
  if (basename.includes('decision')) type = 'decision';
  else if (basename.includes('learning')) type = 'learning';
  else if (basename.includes('dead')) type = 'dead_end';
  else if (basename.includes('error')) type = 'error';
  else if (basename.includes('pattern')) type = 'pattern';

  const embedding = await getEmbedding(content);
  await saveMemory(content, embedding, [...tags, 'openclaw', 'imported'], `markdown:${filePath}`, {
    type: type as MemoryType,
  });

  return true;
}
