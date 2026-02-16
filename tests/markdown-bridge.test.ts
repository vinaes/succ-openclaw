import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('@vinaes/succ/api', () => ({
  getRecentMemories: vi.fn(),
  saveMemory: vi.fn(),
  getEmbedding: vi.fn(),
}));

vi.mock('../src/security.js', () => ({
  assertPathWithinBrainVault: vi.fn((p: string) => path.resolve(p)),
}));

import { exportMemoriesToMarkdown, importMarkdownToMemory } from '../src/bridge/markdown-bridge.js';
import { getRecentMemories, saveMemory, getEmbedding } from '@vinaes/succ/api';
import { assertPathWithinBrainVault } from '../src/security.js';

const mockGetRecent = vi.mocked(getRecentMemories);
const mockSaveMemory = vi.mocked(saveMemory);
const mockGetEmbedding = vi.mocked(getEmbedding);
const mockAssertPath = vi.mocked(assertPathWithinBrainVault);

let tmpDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'succ-bridge-'));
  mockGetEmbedding.mockResolvedValue([0.1, 0.2]);
  mockSaveMemory.mockResolvedValue({ id: 1, isDuplicate: false } as any);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('exportMemoriesToMarkdown', () => {
  it('exports memories to .succ/brain/02_Knowledge/', async () => {
    mockGetRecent.mockResolvedValue([
      {
        id: 42,
        content: 'SQLite is better for local-first',
        type: 'decision',
        tags: 'architecture,storage',
        source: 'user',
        created_at: '2025-06-01T12:00:00Z',
      },
    ] as any);

    const count = await exportMemoriesToMarkdown(tmpDir);

    expect(count).toBe(1);
    expect(mockGetRecent).toHaveBeenCalledWith(10);

    const knowledgeDir = path.join(tmpDir, '.succ', 'brain', '02_Knowledge');
    expect(fs.existsSync(knowledgeDir)).toBe(true);

    const files = fs.readdirSync(knowledgeDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain('decision');
    expect(files[0]).toContain('42');

    const content = fs.readFileSync(path.join(knowledgeDir, files[0]), 'utf-8');
    expect(content).toContain('SQLite is better for local-first');
    expect(content).toContain('#architecture');
    expect(content).toContain('Memory ID: 42');
  });

  it('exports dead_end memories to 04_Dead_Ends/', async () => {
    mockGetRecent.mockResolvedValue([
      {
        id: 7,
        content: 'Redis session storage failed',
        type: 'dead_end',
        tags: '',
        source: 'test',
        created_at: '2025-06-02T10:00:00Z',
      },
    ] as any);

    const count = await exportMemoriesToMarkdown(tmpDir);

    expect(count).toBe(1);
    const deadEndDir = path.join(tmpDir, '.succ', 'brain', '04_Dead_Ends');
    expect(fs.existsSync(deadEndDir)).toBe(true);

    const files = fs.readdirSync(deadEndDir);
    expect(files[0]).toContain('dead_end');
  });

  it('skips already-exported files', async () => {
    mockGetRecent.mockResolvedValue([
      {
        id: 1,
        content: 'existing memory',
        type: 'observation',
        tags: '',
        source: 'test',
        created_at: '2025-06-01T12:00:00Z',
      },
    ] as any);

    // Export once
    await exportMemoriesToMarkdown(tmpDir);
    // Export again — should skip
    const count = await exportMemoriesToMarkdown(tmpDir);

    expect(count).toBe(0);
  });

  it('returns 0 for empty memories', async () => {
    mockGetRecent.mockResolvedValue([]);

    const count = await exportMemoriesToMarkdown(tmpDir);

    expect(count).toBe(0);
  });

  it('passes custom limit', async () => {
    mockGetRecent.mockResolvedValue([]);

    await exportMemoriesToMarkdown(tmpDir, 50);

    expect(mockGetRecent).toHaveBeenCalledWith(50);
  });

  it('handles tags as string with commas', async () => {
    mockGetRecent.mockResolvedValue([
      {
        id: 3,
        content: 'tagged memory',
        type: 'learning',
        tags: 'foo, bar, baz',
        source: 'test',
        created_at: '2025-06-01T12:00:00Z',
      },
    ] as any);

    await exportMemoriesToMarkdown(tmpDir);

    const dir = path.join(tmpDir, '.succ', 'brain', '02_Knowledge');
    const files = fs.readdirSync(dir);
    const content = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
    expect(content).toContain('#foo');
    expect(content).toContain('#bar');
    expect(content).toContain('#baz');
  });

  it('generates valid slug from content', async () => {
    mockGetRecent.mockResolvedValue([
      {
        id: 5,
        content: 'Hello World! This is a test @#$%',
        type: 'observation',
        tags: '',
        source: 'test',
        created_at: '2025-06-01T12:00:00Z',
      },
    ] as any);

    await exportMemoriesToMarkdown(tmpDir);

    const dir = path.join(tmpDir, '.succ', 'brain', '02_Knowledge');
    const files = fs.readdirSync(dir);
    expect(files[0]).toMatch(/hello-world-this-is-a-test/);
  });
});

describe('importMarkdownToMemory', () => {
  it('imports a markdown file without Memory ID', async () => {
    const filePath = path.join(tmpDir, 'new-note.md');
    fs.writeFileSync(filePath, '# Decision\nWe chose #auth with #jwt for API.\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    const result = await importMarkdownToMemory(filePath);

    expect(result).toBe(true);
    expect(mockGetEmbedding).toHaveBeenCalled();
    expect(mockSaveMemory).toHaveBeenCalledWith(
      expect.stringContaining('chose'),
      [0.1, 0.2],
      expect.arrayContaining(['auth', 'jwt', 'openclaw', 'imported']),
      expect.stringContaining('markdown:'),
      { type: 'observation' },
    );
  });

  it('skips files that have Memory ID (already exported)', async () => {
    const filePath = path.join(tmpDir, 'exported.md');
    fs.writeFileSync(filePath, '# Test\nContent\n*Memory ID: 42*\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    const result = await importMarkdownToMemory(filePath);

    expect(result).toBe(false);
    expect(mockSaveMemory).not.toHaveBeenCalled();
  });

  it('returns false for non-existent files', async () => {
    const filePath = path.join(tmpDir, 'nonexistent.md');
    mockAssertPath.mockReturnValue(filePath);

    const result = await importMarkdownToMemory(filePath);

    expect(result).toBe(false);
  });

  it('detects decision type from filename', async () => {
    const filePath = path.join(tmpDir, '2025-06-01-decision-auth.md');
    fs.writeFileSync(filePath, '# Chose JWT\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await importMarkdownToMemory(filePath);

    expect(mockSaveMemory).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(Array),
      expect.any(String),
      { type: 'decision' },
    );
  });

  it('detects learning type from filename', async () => {
    const filePath = path.join(tmpDir, 'learning-esm-imports.md');
    fs.writeFileSync(filePath, '# ESM requires .js extensions\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await importMarkdownToMemory(filePath);

    expect(mockSaveMemory).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(Array),
      expect.any(String),
      { type: 'learning' },
    );
  });

  it('detects dead_end type from filename', async () => {
    const filePath = path.join(tmpDir, 'dead-end-redis.md');
    fs.writeFileSync(filePath, '# Redis failed\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await importMarkdownToMemory(filePath);

    expect(mockSaveMemory).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(Array),
      expect.any(String),
      { type: 'dead_end' },
    );
  });

  it('validates path via assertPathWithinBrainVault', async () => {
    const filePath = path.join(tmpDir, 'note.md');
    fs.writeFileSync(filePath, '# Note\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await importMarkdownToMemory(filePath);

    expect(mockAssertPath).toHaveBeenCalledWith(filePath);
  });

  it('throws when path is outside brain vault', async () => {
    mockAssertPath.mockImplementation(() => {
      throw new Error('outside .succ/brain/');
    });

    await expect(importMarkdownToMemory('/etc/passwd')).rejects.toThrow('outside .succ/brain/');
  });
});
