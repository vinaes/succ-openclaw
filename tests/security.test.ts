import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertPathWithinWorkspace, assertPathWithinBrainVault } from '../src/security.js';

describe('assertPathWithinWorkspace', () => {
  const originalEnv = process.env.SUCC_PROJECT_ROOT;

  beforeEach(() => {
    process.env.SUCC_PROJECT_ROOT = '/workspace/project';
  });

  afterEach(() => {
    process.env.SUCC_PROJECT_ROOT = originalEnv;
  });

  it('allows paths within workspace', () => {
    const result = assertPathWithinWorkspace('src/file.ts', 'test');
    expect(result).toContain('src');
    expect(result).toContain('file.ts');
  });

  it('allows nested paths', () => {
    const result = assertPathWithinWorkspace('src/deep/nested/file.ts', 'test');
    expect(result).toContain('nested');
  });

  it('blocks path traversal with ../', () => {
    expect(() => assertPathWithinWorkspace('../../etc/passwd', 'test')).toThrow('outside workspace boundary');
  });

  it('blocks absolute paths outside workspace', () => {
    expect(() => assertPathWithinWorkspace('/etc/passwd', 'test')).toThrow('outside workspace boundary');
  });

  it('blocks traversal disguised as relative path', () => {
    expect(() => assertPathWithinWorkspace('src/../../etc/passwd', 'test')).toThrow('outside workspace boundary');
  });

  it('throws when SUCC_PROJECT_ROOT not set', () => {
    delete process.env.SUCC_PROJECT_ROOT;
    expect(() => assertPathWithinWorkspace('file.ts', 'test')).toThrow('SUCC_PROJECT_ROOT not set');
  });
});

describe('assertPathWithinBrainVault', () => {
  const originalEnv = process.env.SUCC_PROJECT_ROOT;

  beforeEach(() => {
    process.env.SUCC_PROJECT_ROOT = '/workspace/project';
  });

  afterEach(() => {
    process.env.SUCC_PROJECT_ROOT = originalEnv;
  });

  it('allows paths within .succ/brain/', () => {
    const result = assertPathWithinBrainVault('/workspace/project/.succ/brain/doc.md');
    expect(result).toContain('.succ');
    expect(result).toContain('brain');
  });

  it('blocks paths outside brain vault', () => {
    expect(() => assertPathWithinBrainVault('/workspace/project/src/secret.ts')).toThrow('outside .succ/brain/');
  });

  it('blocks traversal from brain vault', () => {
    expect(() => assertPathWithinBrainVault('/workspace/project/.succ/brain/../../etc/passwd')).toThrow('outside .succ/brain/');
  });

  it('throws when SUCC_PROJECT_ROOT not set', () => {
    delete process.env.SUCC_PROJECT_ROOT;
    expect(() => assertPathWithinBrainVault('/some/path')).toThrow('SUCC_PROJECT_ROOT not set');
  });
});
