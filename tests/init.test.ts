import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initializeSuccProject, isSuccInitialized } from '../src/init.js';

describe('initializeSuccProject', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'succ-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .succ/ directory with correct structure', async () => {
    await initializeSuccProject(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, '.succ'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.succ', 'brain'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.succ', '.tmp'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.succ', 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.succ', '.gitignore'))).toBe(true);
  });

  it('creates valid config.json', async () => {
    await initializeSuccProject(tmpDir);

    const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.succ', 'config.json'), 'utf-8'));
    expect(config.embedding_mode).toBe('local');
    expect(config.quality_scoring_enabled).toBe(true);
    expect(config.sensitive_filter_enabled).toBe(true);
  });

  it('does not overwrite existing .succ/', async () => {
    const succDir = path.join(tmpDir, '.succ');
    fs.mkdirSync(succDir, { recursive: true });
    fs.writeFileSync(path.join(succDir, 'config.json'), '{"custom": true}');

    await initializeSuccProject(tmpDir);

    const config = JSON.parse(fs.readFileSync(path.join(succDir, 'config.json'), 'utf-8'));
    expect(config.custom).toBe(true); // not overwritten
  });

  it('isSuccInitialized returns false for empty dir', () => {
    expect(isSuccInitialized(tmpDir)).toBe(false);
  });

  it('isSuccInitialized returns true after init', async () => {
    await initializeSuccProject(tmpDir);
    expect(isSuccInitialized(tmpDir)).toBe(true);
  });
});
