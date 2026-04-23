// SPDX-License-Identifier: AGPL-3.0-only
/**
 * useOnboarding — detects the three onboarding milestones by hitting the
 * corresponding list endpoints. The checklist auto-hides once all three
 * are complete; until then the user can collapse it (chevron) but not
 * dismiss it. Collapsed state persists in localStorage across sessions.
 *
 * Steps:
 *   1. Optimize the schema    — ≥ 1 metadata description exists
 *   2. Build relationships    — ≥ 1 relationship exists
 *   3. Run your first query   — ≥ 1 query in history
 */

import { useCallback, useEffect, useState } from 'react';
import MetadataService from '../services/MetadataService';
import RelationshipService from '../services/RelationshipService';
import QueryManagementService from '../services/QueryManagementService';

const COLLAPSED_KEY = 'actyze_onboarding_collapsed';

const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; }
  catch { return false; }
};

const writeCollapsed = (value) => {
  try {
    if (value) localStorage.setItem(COLLAPSED_KEY, '1');
    else localStorage.removeItem(COLLAPSED_KEY);
  } catch { /* noop */ }
};

export const ONBOARDING_STEPS = [
  {
    id: 'schema',
    title: 'Optimize your schema',
    description: 'Add descriptions to key tables and columns so the AI understands your data.',
    cta: 'Open Schema & Metadata',
  },
  {
    id: 'relationships',
    title: 'Build relationships',
    description: 'Run auto-detect to map how your tables connect. The AI uses this to write better JOINs.',
    cta: 'Open Relationships',
  },
  {
    id: 'first_query',
    title: 'Run your first query',
    description: 'Ask a question in natural language or write SQL — results stay in your history.',
    cta: 'Open Query editor',
  },
];

export const useOnboarding = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ schema: false, relationships: false, first_query: false });
  const [collapsed, setCollapsed] = useState(readCollapsed());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [descRes, relRes, qRes] = await Promise.allSettled([
        MetadataService.getDescriptions(),
        RelationshipService.getRelationships({ includeDisabled: true }),
        QueryManagementService.getQueryHistory({ limit: 1 }),
      ]);

      const descList = descRes.status === 'fulfilled' ? (descRes.value?.descriptions || descRes.value || []) : [];
      const relList  = relRes.status === 'fulfilled' ? (relRes.value?.relationships || []) : [];
      const queries  = qRes.status === 'fulfilled' ? (qRes.value?.queries || []) : [];

      setStatus({
        schema: Array.isArray(descList) ? descList.length > 0 : !!descList?.length,
        relationships: relList.length > 0,
        first_query: queries.length > 0,
      });
    } catch {
      // If detection fails, leave state as-is rather than flipping the UI.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setCollapsedPersisted = useCallback((value) => {
    writeCollapsed(value);
    setCollapsed(value);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  const steps = ONBOARDING_STEPS.map(s => ({ ...s, done: !!status[s.id] }));
  const completeCount = steps.filter(s => s.done).length;
  const allDone = completeCount === steps.length;

  return {
    loading, steps, completeCount, allDone,
    collapsed, toggleCollapsed, setCollapsed: setCollapsedPersisted,
    refresh,
  };
};

export default useOnboarding;
