import { z } from 'zod';
import {
  generateSessionId,
  ensureDebugsDir,
  saveSession,
  loadSession,
  deleteSession,
  listSessions,
  findActiveSession,
  appendSessionLog,
  loadSessionLog,
  detectLanguage,
  generateLogStatement,
} from '@vinaes/succ/api';
import type { DebugSession, Hypothesis, DebugLanguage } from '@vinaes/succ/api';

// ============================================================================
// Schema
// ============================================================================

export const memoryDebugSchema = z.object({
  action: z.enum([
    'create', 'hypothesis', 'instrument', 'result',
    'resolve', 'abandon', 'status', 'list',
    'log', 'show_log', 'detect_lang', 'gen_log',
  ]).describe('Action to perform'),
  // create
  bug_description: z.string().optional().describe('Bug description (for create)'),
  error_output: z.string().optional().describe('Error output or stack trace (for create)'),
  reproduction_command: z.string().optional().describe('Command to reproduce (for create)'),
  language: z.string().optional().describe('Override language detection (for create/gen_log)'),
  // hypothesis
  description: z.string().optional().describe('Hypothesis description'),
  confidence: z.enum(['high', 'medium', 'low']).optional().describe('Confidence level'),
  evidence: z.string().optional().describe('Evidence supporting hypothesis'),
  test: z.string().optional().describe('How to test this hypothesis'),
  // instrument
  file_path: z.string().optional().describe('File path (for instrument, detect_lang)'),
  lines: z.array(z.number()).optional().describe('Line numbers of instrumentation'),
  // result
  hypothesis_id: z.number().optional().describe('Hypothesis ID (1-based)'),
  confirmed: z.boolean().optional().describe('Whether hypothesis was confirmed'),
  logs: z.string().optional().describe('Log output from reproduction'),
  // resolve
  root_cause: z.string().optional().describe('Root cause description'),
  fix_description: z.string().optional().describe('Fix description'),
  files_modified: z.array(z.string()).optional().describe('Files modified to fix'),
  // session selector
  session_id: z.string().optional().describe('Session ID (defaults to active)'),
  // list
  include_resolved: z.boolean().optional().default(false).describe('Include resolved sessions'),
  // log
  entry: z.string().optional().describe('Log entry text'),
  // gen_log
  tag: z.string().optional().describe('Log tag'),
  value: z.string().optional().describe('Value to log'),
});

type MemoryDebugParams = z.infer<typeof memoryDebugSchema>;

// ============================================================================
// Helper
// ============================================================================

function getSession(sessionId?: string): DebugSession | null {
  if (sessionId) return loadSession(sessionId);
  const active = findActiveSession();
  return active ? loadSession(active.id) : null;
}

function noSession() {
  return { error: 'No active debug session. Use action="create" to start one.' };
}

// ============================================================================
// Main handler
// ============================================================================

export async function memoryDebug(params: MemoryDebugParams): Promise<any> {
  const { action } = params;

  switch (action) {
    case 'create': {
      if (!params.bug_description) {
        return { error: 'bug_description is required for create' };
      }
      ensureDebugsDir();
      const id = generateSessionId();
      const lang: DebugLanguage = (params.language as DebugLanguage) ?? 'unknown';
      const session: DebugSession = {
        id,
        status: 'active',
        bug_description: params.bug_description,
        error_output: params.error_output,
        reproduction_command: params.reproduction_command,
        language: lang,
        hypotheses: [],
        instrumented_files: [],
        iteration: 0,
        max_iterations: 5,
        files_modified: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      saveSession(session);
      appendSessionLog(id, `Session created: ${params.bug_description.substring(0, 100)}`);
      return {
        session_id: id,
        message: `Debug session created: ${id}`,
        bug: params.bug_description,
        language: lang,
      };
    }

    case 'hypothesis': {
      const session = getSession(params.session_id);
      if (!session) return noSession();
      if (!params.description) {
        return { error: 'description is required for hypothesis' };
      }
      const h: Hypothesis = {
        id: session.hypotheses.length + 1,
        description: params.description,
        confidence: params.confidence ?? 'medium',
        evidence: params.evidence ?? '',
        test: params.test ?? '',
        result: 'pending',
      };
      session.hypotheses.push(h);
      saveSession(session);
      appendSessionLog(session.id, `Hypothesis #${h.id} (${h.confidence}): ${h.description}`);
      return {
        hypothesis_id: h.id,
        confidence: h.confidence,
        description: h.description,
      };
    }

    case 'instrument': {
      const session = getSession(params.session_id);
      if (!session) return noSession();
      if (!params.file_path) {
        return { error: 'file_path is required for instrument' };
      }
      const existing = session.instrumented_files.find(f => f.path === params.file_path);
      if (existing) {
        existing.lines = [...new Set([...existing.lines, ...(params.lines ?? [])])];
      } else {
        session.instrumented_files.push({
          path: params.file_path,
          lines: params.lines ?? [],
        });
      }
      saveSession(session);
      appendSessionLog(session.id, `Instrumented: ${params.file_path} lines=${(params.lines ?? []).join(',')}`);
      return {
        file: params.file_path,
        lines: params.lines ?? [],
        total_instrumented: session.instrumented_files.length,
      };
    }

    case 'result': {
      const session = getSession(params.session_id);
      if (!session) return noSession();
      if (params.hypothesis_id == null) {
        return { error: 'hypothesis_id is required for result' };
      }
      const h = session.hypotheses.find(x => x.id === params.hypothesis_id);
      if (!h) {
        return { error: `Hypothesis #${params.hypothesis_id} not found` };
      }
      h.result = params.confirmed ? 'confirmed' : 'refuted';
      h.logs = params.logs;
      session.iteration++;
      saveSession(session);
      const status = params.confirmed ? 'confirmed' : 'refuted';
      appendSessionLog(session.id, `Hypothesis #${h.id} ${status.toUpperCase()}: ${h.description}`);
      return {
        hypothesis_id: h.id,
        result: status,
        description: h.description,
        iteration: session.iteration,
        suggest_dead_end: !params.confirmed,
      };
    }

    case 'resolve': {
      const session = getSession(params.session_id);
      if (!session) return noSession();
      session.status = 'resolved';
      session.root_cause = params.root_cause;
      session.fix_description = params.fix_description;
      session.files_modified = params.files_modified ?? [];
      session.resolved_at = new Date().toISOString();
      saveSession(session);
      appendSessionLog(session.id, `RESOLVED: ${params.root_cause ?? 'unknown'}`);
      return {
        session_id: session.id,
        status: 'resolved',
        root_cause: params.root_cause,
        fix: params.fix_description,
        files: params.files_modified ?? [],
        iterations: session.iteration,
      };
    }

    case 'abandon': {
      const session = getSession(params.session_id);
      if (!session) return noSession();
      session.status = 'abandoned';
      saveSession(session);
      appendSessionLog(session.id, 'Session abandoned');
      // Clean up session files from disk
      deleteSession(session.id);
      return { session_id: session.id, status: 'abandoned' };
    }

    case 'status': {
      const session = params.session_id
        ? loadSession(params.session_id)
        : (() => {
            const active = findActiveSession();
            return active ? loadSession(active.id) : null;
          })();
      if (!session) return noSession();
      return {
        id: session.id,
        status: session.status,
        bug: session.bug_description,
        language: session.language,
        iteration: session.iteration,
        max_iterations: session.max_iterations,
        hypotheses: session.hypotheses.map(h => ({
          id: h.id,
          description: h.description,
          confidence: h.confidence,
          result: h.result,
        })),
        instrumented_files: session.instrumented_files.length,
        root_cause: session.root_cause,
        fix: session.fix_description,
      };
    }

    case 'list': {
      const sessions = listSessions(params.include_resolved);
      return {
        count: sessions.length,
        sessions: sessions.map(s => ({
          id: s.id,
          status: s.status,
          bug: s.bug_description,
          language: s.language,
          iteration: s.iteration,
          hypotheses: s.hypothesis_count,
        })),
      };
    }

    case 'log': {
      const session = getSession(params.session_id);
      if (!session) return noSession();
      if (!params.entry) {
        return { error: 'entry is required for log' };
      }
      appendSessionLog(session.id, params.entry);
      return { session_id: session.id, message: 'Log entry appended' };
    }

    case 'show_log': {
      const session = getSession(params.session_id);
      if (!session) return noSession();
      const log = loadSessionLog(session.id);
      return { session_id: session.id, log: log || '(empty)' };
    }

    case 'detect_lang': {
      if (!params.file_path) {
        return { error: 'file_path is required for detect_lang' };
      }
      const lang = detectLanguage(params.file_path);
      return { file: params.file_path, language: lang };
    }

    case 'gen_log': {
      const lang: DebugLanguage = (params.language as DebugLanguage) ?? 'unknown';
      const stmt = generateLogStatement(lang, params.tag ?? 'debug', params.value ?? 'value');
      return { language: lang, statement: stmt };
    }

    default:
      return { error: `Unknown action: ${action}` };
  }
}
