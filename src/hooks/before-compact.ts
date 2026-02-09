import { saveMemory, getEmbedding } from 'succ/api';

/**
 * Compaction hook — called before OpenClaw compacts conversation context.
 *
 * Extracts a summary from recent messages and saves to succ with
 * a 7-day expiry. This ensures context survives compaction.
 */
export async function onBeforeCompact(event: any): Promise<void> {
  try {
    const messages = event?.getMessages?.() ?? event?.messages ?? [];
    if (!messages.length) return;

    const summary = extractSummary(messages);
    if (!summary) return;

    const embedding = await getEmbedding(summary);

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    await saveMemory(summary, embedding, ['session', 'auto-compact', 'openclaw'], 'compaction-hook', {
      type: 'observation',
      validUntil,
    });
  } catch (err) {
    // Compaction hook should never block — fail silently
    console.error('[succ] compaction hook error:', err);
  }
}

function extractSummary(messages: any[]): string | null {
  const recent = messages.slice(-20);
  const userMessages = recent.filter((m: any) => m.role === 'user').map((m: any) => m.content);
  const assistantMessages = recent.filter((m: any) => m.role === 'assistant').map((m: any) => m.content);

  if (userMessages.length === 0) return null;

  const topics = userMessages
    .map((msg: string) => (typeof msg === 'string' ? msg.slice(0, 100) : ''))
    .filter(Boolean)
    .join('; ');

  const decisions = assistantMessages
    .filter(
      (msg: string) =>
        typeof msg === 'string' && (msg.includes('decided') || msg.includes('will use') || msg.includes('chose')),
    )
    .map((msg: string) => msg.slice(0, 150))
    .slice(0, 5);

  let summary = `Session context (auto-compacted):\nTopics: ${topics}`;
  if (decisions.length > 0) {
    summary += `\nKey decisions:\n${decisions.map((d: string) => `- ${d}`).join('\n')}`;
  }

  return summary;
}
