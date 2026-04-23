// SPDX-License-Identifier: AGPL-3.0-only
/**
 * OnboardingChecklist — three-step setup guide shown on Home until a user has
 * optimized their schema, built relationships, and run a query. Self-serve:
 * each row has a CTA that deep-links into the right surface.
 */

import React from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import useOnboarding from '../../hooks/useOnboarding';

const STEP_TARGETS = {
  schema:        { path: '/data-intelligence', state: { tab: 'schema-metadata' } },
  relationships: { path: '/data-intelligence', state: { tab: 'relationships' } },
  first_query:   { path: '/query/new', state: {} },
};

// ── Check / index marker ────────────────────────────────────────────────

const StepMarker = ({ index, done, isDark }) => {
  if (done) {
    return (
      <div className="w-6 h-6 rounded-full bg-[#5d6ad3] flex items-center justify-center flex-shrink-0">
        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  return (
    <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 text-[11px] font-medium ${
      isDark ? 'border-white/15 text-gray-400' : 'border-gray-300 text-gray-500'
    }`}>
      {index}
    </div>
  );
};

// ── Checklist card ──────────────────────────────────────────────────────

const OnboardingChecklist = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { loading, steps, completeCount, allDone, dismissed, dismiss } = useOnboarding();

  if (loading || dismissed) return null;

  const progressPct = (completeCount / steps.length) * 100;

  const handleCta = (stepId) => {
    const target = STEP_TARGETS[stepId];
    if (!target) return;
    navigate(target.path, { state: target.state });
  };

  return (
    <div className={`mb-8 max-w-2xl rounded-xl border ${isDark ? 'bg-[#101012] border-white/10' : 'bg-white border-gray-200'}`}>
      {/* Header */}
      <div className={`px-5 pt-4 pb-3 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={`text-[14px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {allDone ? "You're ready to go" : 'Get set up with Actyze AI'}
            </h2>
            <p className={`text-[12px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              {allDone
                ? 'All setup steps are complete — the AI has everything it needs.'
                : 'Three quick steps unlock the best answers from the AI.'}
            </p>
          </div>
          <button onClick={dismiss} title="Dismiss"
            className={`p-1 rounded-md transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress */}
        <div className="mt-3 flex items-center gap-2.5">
          <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
            <div className="h-full bg-[#5d6ad3] rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <span className={`text-[10px] font-medium tabular-nums ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            {completeCount} of {steps.length}
          </span>
        </div>
      </div>

      {/* Steps */}
      <ol className="divide-y divide-transparent">
        {steps.map((step, i) => (
          <li key={step.id}
            className={`flex items-start gap-3 px-5 py-3 ${
              i !== 0 ? (isDark ? 'border-t border-white/5' : 'border-t border-gray-100') : ''
            }`}>
            <StepMarker index={i + 1} done={step.done} isDark={isDark} />
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-medium ${step.done
                ? (isDark ? 'text-gray-500 line-through' : 'text-gray-400 line-through')
                : (isDark ? 'text-gray-200' : 'text-gray-900')}`}>
                {step.title}
              </div>
              <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {step.description}
              </p>
            </div>
            {!step.done && (
              <button onClick={() => handleCta(step.id)}
                className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  isDark
                    ? 'text-[#5d6ad3] hover:bg-[#5d6ad3]/10'
                    : 'text-[#5d6ad3] hover:bg-[#5d6ad3]/10'
                }`}>
                {step.cta}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ol>

      {/* Success footer */}
      {allDone && (
        <div className={`px-5 py-3 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
          <button onClick={dismiss}
            className="w-full py-1.5 text-[12px] font-medium rounded-md bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors">
            Dismiss checklist
          </button>
        </div>
      )}
    </div>
  );
};

export default OnboardingChecklist;
