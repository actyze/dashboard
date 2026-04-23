// SPDX-License-Identifier: AGPL-3.0-only
/**
 * ChatService — unified generate+execute pipeline for the AI assistant widget.
 *
 * Emits staged events so the UI can render progress without waiting for the
 * full round-trip:
 *   { type: 'stage', stage: 'generating' | 'executing' }
 *   { type: 'sql_ready', sql, reasoning, chartRecommendation }
 *   { type: 'result_ready', sql, reasoning, chartRecommendation, queryResults, isLimited }
 *   { type: 'error',      message, reasoning? }
 *   { type: 'exec_error', message, sql, reasoning, chartRecommendation }
 *   { type: 'stopped' }
 *   { type: 'done' }
 *
 * One in-flight request at a time — cancel() aborts any active run.
 */

import { RestService } from './RestService';

class ChatService {
  constructor() {
    this.activeAbort = null;
  }

  cancel() {
    if (this.activeAbort) {
      this.activeAbort.abort();
      this.activeAbort = null;
    }
  }

  isActive() {
    return this.activeAbort !== null;
  }

  async sendMessage({ text, conversationHistory = [], onEvent }) {
    const abort = new AbortController();
    this.activeAbort = abort;
    const emit = (event) => {
      if (!abort.signal.aborted) onEvent(event);
    };

    try {
      // ── Stage 1: generate SQL ───────────────────────────────────
      emit({ type: 'stage', stage: 'generating' });
      const genResponse = await RestService.generateSql(text, conversationHistory);
      if (abort.signal.aborted) { emit({ type: 'stopped' }); return; }

      if (!genResponse?.success || !genResponse?.generated_sql) {
        emit({
          type: 'error',
          message: genResponse?.error || genResponse?.model_reasoning
            || "I couldn't generate a query for that. Try rephrasing?",
          reasoning: genResponse?.model_reasoning,
        });
        return;
      }

      const sql = genResponse.generated_sql;
      const reasoning = genResponse.model_reasoning;
      const chartRecommendation = genResponse.chart_recommendation;

      emit({ type: 'sql_ready', sql, reasoning, chartRecommendation });

      // ── Stage 2: execute ────────────────────────────────────────
      emit({ type: 'stage', stage: 'executing' });
      const execResponse = await RestService.executeSql(
        sql, 500, undefined, text, conversationHistory,
        { chart_recommendation: chartRecommendation, model_reasoning: reasoning }
      );
      if (abort.signal.aborted) { emit({ type: 'stopped' }); return; }

      if (!execResponse?.success) {
        emit({
          type: 'exec_error',
          message: execResponse?.error || 'The query could not be executed.',
          sql, reasoning, chartRecommendation,
        });
        return;
      }

      emit({
        type: 'result_ready',
        sql, reasoning, chartRecommendation,
        queryResults: execResponse.query_results || null,
        isLimited: execResponse.is_limited || false,
      });
      emit({ type: 'done' });
    } catch (error) {
      if (abort.signal.aborted) { emit({ type: 'stopped' }); return; }
      emit({
        type: 'error',
        message: error?.response?.data?.detail || error?.message || 'Unexpected error.',
      });
    } finally {
      if (this.activeAbort === abort) this.activeAbort = null;
    }
  }
}

const chatService = new ChatService();
export default chatService;
