import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

vi.mock('@vinaes/succ/api', () => ({
  upsertDocument: vi.fn(),
  getEmbedding: vi.fn(),
  setFileHash: vi.fn(),
}));

vi.mock('../src/security.js', () => ({
  assertPathWithinWorkspace: vi.fn((p: string) => path.resolve(p)),
}));

import { onFileChanged } from '../src/hooks/file-changed.js';
import { upsertDocument, getEmbedding, setFileHash } from '@vinaes/succ/api';
import { assertPathWithinWorkspace } from '../src/security.js';

const mockUpsertDoc = vi.mocked(upsertDocument);
const mockGetEmbedding = vi.mocked(getEmbedding);
const mockSetHash = vi.mocked(setFileHash);
const mockAssertPath = vi.mocked(assertPathWithinWorkspace);

let tmpDir: string;

beforeEach(() => {
  vi.clearAllMocks();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'succ-filechg-'));
  mockGetEmbedding.mockResolvedValue([0.1, 0.2]);
  mockUpsertDoc.mockResolvedValue(undefined as any);
  mockSetHash.mockResolvedValue(undefined as any);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('onFileChanged', () => {
  it('indexes a changed .ts file', async () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, 'const x = 1;\nconst y = 2;\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ path: filePath });

    expect(mockGetEmbedding).toHaveBeenCalled();
    expect(mockUpsertDoc).toHaveBeenCalledWith(
      filePath,
      0,
      'const x = 1;\nconst y = 2;\n',
      1,
      3,
      [0.1, 0.2],
    );
    expect(mockSetHash).toHaveBeenCalledWith(filePath, expect.any(String));
  });

  it('indexes a changed .md file', async () => {
    const filePath = path.join(tmpDir, 'readme.md');
    fs.writeFileSync(filePath, '# Hello\nWorld\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ path: filePath });

    expect(mockUpsertDoc).toHaveBeenCalled();
  });

  it('reads filePath from event.filePath', async () => {
    const filePath = path.join(tmpDir, 'alt.ts');
    fs.writeFileSync(filePath, 'export {};\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ filePath });

    expect(mockUpsertDoc).toHaveBeenCalled();
  });

  it('skips non-indexable extensions', async () => {
    const filePath = path.join(tmpDir, 'image.png');
    fs.writeFileSync(filePath, 'binary data');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ path: filePath });

    expect(mockUpsertDoc).not.toHaveBeenCalled();
  });

  it('skips node_modules paths', async () => {
    const filePath = path.join(tmpDir, 'node_modules', 'pkg', 'index.ts');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'export {};\n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ path: filePath });

    expect(mockUpsertDoc).not.toHaveBeenCalled();
  });

  it('skips .git paths', async () => {
    const filePath = path.join(tmpDir, '.git', 'config.ts');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'config', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ path: filePath });

    expect(mockUpsertDoc).not.toHaveBeenCalled();
  });

  it('skips dist paths', async () => {
    const filePath = path.join(tmpDir, 'dist', 'index.js');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'built', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ path: filePath });

    expect(mockUpsertDoc).not.toHaveBeenCalled();
  });

  it('does nothing for missing path', async () => {
    await onFileChanged({});

    expect(mockUpsertDoc).not.toHaveBeenCalled();
  });

  it('does nothing for undefined event', async () => {
    await onFileChanged(undefined);

    expect(mockUpsertDoc).not.toHaveBeenCalled();
  });

  it('does nothing for non-existent file', async () => {
    const filePath = path.join(tmpDir, 'gone.ts');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ path: filePath });

    expect(mockUpsertDoc).not.toHaveBeenCalled();
  });

  it('skips empty files', async () => {
    const filePath = path.join(tmpDir, 'empty.ts');
    fs.writeFileSync(filePath, '   \n  \n', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ path: filePath });

    expect(mockUpsertDoc).not.toHaveBeenCalled();
  });

  it('silently skips files outside workspace', async () => {
    mockAssertPath.mockImplementation(() => {
      throw new Error('outside workspace');
    });

    // Should not throw
    await expect(onFileChanged({ path: '/etc/passwd' })).resolves.toBeUndefined();
    expect(mockUpsertDoc).not.toHaveBeenCalled();
  });

  it('does not throw on upsertDocument failure', async () => {
    const filePath = path.join(tmpDir, 'fail.ts');
    fs.writeFileSync(filePath, 'content', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);
    mockUpsertDoc.mockRejectedValue(new Error('DB error'));

    await expect(onFileChanged({ path: filePath })).resolves.toBeUndefined();
  });

  it('computes SHA-256 hash for setFileHash', async () => {
    const filePath = path.join(tmpDir, 'hash.ts');
    fs.writeFileSync(filePath, 'hello', 'utf-8');
    mockAssertPath.mockReturnValue(filePath);

    await onFileChanged({ path: filePath });

    const hash = mockSetHash.mock.calls[0][1] as string;
    // SHA-256 of "hello" is well-known
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('indexes all supported extensions', async () => {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.md', '.txt'];

    for (const ext of extensions) {
      vi.clearAllMocks();
      const filePath = path.join(tmpDir, `test${ext}`);
      fs.writeFileSync(filePath, 'content', 'utf-8');
      mockAssertPath.mockReturnValue(filePath);

      await onFileChanged({ path: filePath });

      expect(mockUpsertDoc).toHaveBeenCalled();
    }
  });
});
