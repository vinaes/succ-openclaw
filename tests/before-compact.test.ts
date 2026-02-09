import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('succ/api', () => ({
  saveMemory: vi.fn(),
  getEmbedding: vi.fn(),
}));

import { onBeforeCompact } from '../src/hooks/before-compact.js';
import { saveMemory, getEmbedding } from 'succ/api';

const mockSaveMemory = vi.mocked(saveMemory);
const mockGetEmbedding = vi.mocked(getEmbedding);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetEmbedding.mockResolvedValue([0.1, 0.2]);
  mockSaveMemory.mockResolvedValue({ id: 1 } as any);
});

describe('onBeforeCompact', () => {
  it('extracts summary and saves memory from messages array', async () => {
    const event = {
      messages: [
        { role: 'user', content: 'How do I add authentication?' },
        { role: 'assistant', content: 'I will use JWT for authentication.' },
        { role: 'user', content: 'Sounds good, lets go with that.' },
      ],
    };

    await onBeforeCompact(event);

    expect(mockGetEmbedding).toHaveBeenCalled();
    expect(mockSaveMemory).toHaveBeenCalledWith(
      expect.stringContaining('How do I add authentication'),
      [0.1, 0.2],
      ['session', 'auto-compact', 'openclaw'],
      'compaction-hook',
      expect.objectContaining({
        type: 'observation',
        validUntil: expect.any(Date),
      }),
    );
  });

  it('extracts summary from getMessages() if present', async () => {
    const event = {
      getMessages: () => [
        { role: 'user', content: 'Refactor the auth module' },
        { role: 'assistant', content: 'I decided to extract the middleware.' },
      ],
    };

    await onBeforeCompact(event);

    expect(mockSaveMemory).toHaveBeenCalled();
    const content = mockSaveMemory.mock.calls[0][0] as string;
    expect(content).toContain('Refactor the auth module');
  });

  it('does nothing for empty messages', async () => {
    await onBeforeCompact({ messages: [] });

    expect(mockSaveMemory).not.toHaveBeenCalled();
  });

  it('does nothing for undefined event', async () => {
    await onBeforeCompact(undefined);

    expect(mockSaveMemory).not.toHaveBeenCalled();
  });

  it('does nothing for null event', async () => {
    await onBeforeCompact(null);

    expect(mockSaveMemory).not.toHaveBeenCalled();
  });

  it('does nothing when no user messages', async () => {
    const event = {
      messages: [
        { role: 'assistant', content: 'System initialized.' },
      ],
    };

    await onBeforeCompact(event);

    expect(mockSaveMemory).not.toHaveBeenCalled();
  });

  it('includes key decisions in summary', async () => {
    const event = {
      messages: [
        { role: 'user', content: 'What database should we use?' },
        { role: 'assistant', content: 'I decided to use PostgreSQL for this.' },
        { role: 'assistant', content: 'We chose to add connection pooling.' },
        { role: 'assistant', content: 'I will use pg-pool for this.' },
      ],
    };

    await onBeforeCompact(event);

    const content = mockSaveMemory.mock.calls[0][0] as string;
    expect(content).toContain('Key decisions');
  });

  it('sets validUntil to 7 days from now', async () => {
    const event = {
      messages: [{ role: 'user', content: 'test' }],
    };
    const before = new Date();

    await onBeforeCompact(event);

    const opts = mockSaveMemory.mock.calls[0][4] as any;
    const validUntil = opts.validUntil as Date;
    const diff = (validUntil.getTime() - before.getTime()) / (1000 * 60 * 60 * 24);
    expect(diff).toBeGreaterThanOrEqual(6.9);
    expect(diff).toBeLessThanOrEqual(7.1);
  });

  it('does not throw on saveMemory failure', async () => {
    mockSaveMemory.mockRejectedValue(new Error('DB down'));

    const event = {
      messages: [{ role: 'user', content: 'test' }],
    };

    // Should not throw
    await expect(onBeforeCompact(event)).resolves.toBeUndefined();
  });

  it('does not throw on getEmbedding failure', async () => {
    mockGetEmbedding.mockRejectedValue(new Error('Embedding failed'));

    const event = {
      messages: [{ role: 'user', content: 'test' }],
    };

    await expect(onBeforeCompact(event)).resolves.toBeUndefined();
  });

  it('truncates long user messages in topics', async () => {
    const longMsg = 'A'.repeat(200);
    const event = {
      messages: [{ role: 'user', content: longMsg }],
    };

    await onBeforeCompact(event);

    const content = mockSaveMemory.mock.calls[0][0] as string;
    // extractSummary slices to 100 chars
    expect(content.length).toBeLessThan(longMsg.length);
  });

  it('takes last 20 messages for summary', async () => {
    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));

    const event = { messages };

    await onBeforeCompact(event);

    const content = mockSaveMemory.mock.calls[0][0] as string;
    // Should contain message 10+ (last 20 of 30), not message 0
    expect(content).not.toContain('Message 0;');
    expect(content).toContain('Message 10');
  });
});
