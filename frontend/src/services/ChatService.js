// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ChatService — generates SQL for a single user turn, or a multi-tile dashboard
 * plan when the message expresses dashboard intent. Does not execute SQL.
 *
 * Events emitted via onEvent():
 *   { type: 'sql_ready',        sql, reasoning, chartRecommendation }
 *   { type: 'dashboard_ready',  title, tiles: [{ id, nl, sql, reasoning, chartRecommendation }], reasoning }
 *   { type: 'error',            message, reasoning? }
 *   { type: 'stopped' }
 *   { type: 'done' }
 *
 * One in-flight request at a time — cancel() aborts the current run.
 */

import { RestService } from './RestService';

// Matches "create/build/make/design/generate/show me (a|an|me) (new|full|entire|complete)? <any qualifier>? dashboard"
const DASHBOARD_INTENT = /\b(?:create|build|make|design|generate|show\s+me)\s+(?:a|an|me)?\s*(?:new\s+|full\s+|entire\s+|complete\s+)?(?:[a-z][a-z-]*\s+)?dashboard\b/i;

const DASHBOARD_VARIANTS = [
  (topic) => `Overall summary of ${topic}`,
  (topic) => `${topic} trend over time`,
  (topic) => `${topic} breakdown by category`,
];

class ChatService {
  constructor() { this.activeAbort = null; }

  cancel() {
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
  }

  isActive() { return this.activeAbort !== null; }

  // ── Intent routing ───────────────────────────────────────────

  async sendMessage({ text, conversationHistory = [], onEvent }) {
    const abort = new AbortController();
    this.activeAbort = abort;
    const emit = (event) => { if (!abort.signal.aborted) onEvent(event); };

    try {
      if (DASHBOARD_INTENT.test(text)) {
        await this._runDashboard({ text, conversationHistory, emit, signal: abort.signal });
      } else {
        await this._runSingleQuery({ text, conversationHistory, emit, signal: abort.signal });
      }
    } catch (error) {
      if (abort.signal.aborted) { emit({ type: 'stopped' }); return; }
      emit({ type: 'error', message: error?.response?.data?.detail || error?.message || 'Unexpected error.' });
    } finally {
      if (this.activeAbort === abort) this.activeAbort = null;
    }
  }

  // ── Single-query flow (default) ──────────────────────────────

  async _runSingleQuery({ text, conversationHistory, emit, signal }) {
    const res = await RestService.generateSql(text, conversationHistory);
    if (signal.aborted) { emit({ type: 'stopped' }); return; }

    if (!res?.success || !res?.generated_sql) {
      emit({
        type: 'error',
        message: res?.error || res?.model_reasoning || "I couldn't generate a query for that. Try rephrasing?",
        reasoning: res?.model_reasoning,
      });
      return;
    }

    emit({
      type: 'sql_ready',
      sql: res.generated_sql,
      reasoning: res.model_reasoning,
      chartRecommendation: res.chart_recommendation,
    });
    emit({ type: 'done' });
  }

  // ── Dashboard-plan flow ──────────────────────────────────────

  async _runDashboard({ text, conversationHistory, emit, signal }) {
    const topic = this._extractTopic(text);
    const prompts = DASHBOARD_VARIANTS.map(f => f(topic));

    // Fire variants in parallel. Individual failures are filtered out.
    const results = await Promise.allSettled(
      prompts.map(p => RestService.generateSql(p, conversationHistory))
    );
    if (signal.aborted) { emit({ type: 'stopped' }); return; }

    const tiles = results
      .map((r, i) => {
        const value = r.status === 'fulfilled' ? r.value : null;
        if (!value?.success || !value?.generated_sql) return null;
        return {
          id: `tile-${i}`,
          nl: prompts[i],
          sql: value.generated_sql,
          reasoning: value.model_reasoning,
          chartRecommendation: value.chart_recommendation,
        };
      })
      .filter(Boolean);

    if (tiles.length === 0) {
      emit({
        type: 'error',
        message: "I couldn't generate any queries for that dashboard. Try describing the topic more concretely.",
      });
      return;
    }

    emit({
      type: 'dashboard_ready',
      title: this._guessTitle(topic),
      tiles,
      reasoning: `Here's a ${tiles.length}-tile plan for **${topic}**. Toggle tiles you want, then Create dashboard.`,
    });
    emit({ type: 'done' });
  }

  // ── Helpers ──────────────────────────────────────────────────

  _extractTopic(text) {
    const stripped = text
      .replace(/^(please\s+|can\s+you\s+)?/i, '')
      .replace(/^(create|build|make|design|show\s+me)\s+(a|an|me)?\s*(new\s+|full\s+|entire\s+|complete\s+)?(analytics?\s+)?dashboard\s*(for|of|on|about|showing)?\s*/i, '')
      .trim();
    return stripped || text.trim();
  }

  _guessTitle(topic) {
    const words = topic.split(/\s+/).slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1));
    return words.length ? `${words.join(' ')} Dashboard` : 'New Dashboard';
  }
}

const chatService = new ChatService();
export default chatService;
