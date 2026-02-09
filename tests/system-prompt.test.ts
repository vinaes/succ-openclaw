import { describe, it, expect } from 'vitest';
import { generateSystemPrompt } from '../src/hooks/system-prompt.js';

describe('generateSystemPrompt', () => {
  const prompt = generateSystemPrompt();

  it('wraps content in succ-memory XML tags', () => {
    expect(prompt).toMatch(/^<succ-memory>/);
    expect(prompt).toMatch(/<\/succ-memory>$/);
  });

  it('documents all 27 tools', () => {
    const tools = [
      'memory_search',
      'memory_get',
      'memory_store',
      'memory_recall',
      'memory_forget',
      'memory_dead_end',
      'memory_link',
      'memory_explore',
      'memory_index',
      'memory_index_code',
      'memory_analyze',
      'memory_reindex',
      'memory_quick_search',
      'memory_web_search',
      'memory_deep_research',
      'memory_web_history',
      'memory_status',
      'memory_stats',
      'memory_score',
      'memory_config',
      'memory_config_set',
      'memory_checkpoint',
      'memory_prd_generate',
      'memory_prd_list',
      'memory_prd_status',
      'memory_prd_run',
      'memory_prd_export',
    ];
    for (const tool of tools) {
      expect(prompt).toContain(tool);
    }
  });

  it('includes all tool categories', () => {
    expect(prompt).toContain('Search');
    expect(prompt).toContain('Store & Recall');
    expect(prompt).toContain('Knowledge Graph');
    expect(prompt).toContain('Indexing & Analysis');
    expect(prompt).toContain('Web Search');
    expect(prompt).toContain('Status & Config');
    expect(prompt).toContain('Checkpoints');
    expect(prompt).toContain('PRD Pipeline');
  });

  it('includes best practices section', () => {
    expect(prompt).toContain('Best Practices');
    expect(prompt).toContain('memory_dead_end');
    expect(prompt).toContain('memory_recall');
  });

  it('mentions all 6 memory types', () => {
    expect(prompt).toContain('observation');
    expect(prompt).toContain('decision');
    expect(prompt).toContain('learning');
    expect(prompt).toContain('error');
    expect(prompt).toContain('pattern');
    expect(prompt).toContain('dead_end');
  });

  it('is compact (under 2000 tokens estimate)', () => {
    // Rough estimate: ~4 chars per token
    const estimatedTokens = prompt.length / 4;
    expect(estimatedTokens).toBeLessThan(2000);
  });
});
