// SPDX-License-Identifier: AGPL-3.0-only
/**
 * OnboardingChecklist — three-step setup guide shown on Home until all
 * three milestones are detected as complete (at which point it hides
 * itself). Users can collapse/expand the step list in the meantime,
 * but there is no manual dismiss.
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

const OnboardingChecklist = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { loading, steps, completeCount, allDone, collapsed, toggleCollapsed } = useOnboarding();

  // Don't show while loading (avoids flash) or once everything is done.
  if (loading || allDone) return null;

  const progressPct = (completeCount / steps.length) * 100;

  const handleCta = (stepId) => {
    const target = STEP_TARGETS[stepId];
    if (!target) return;
    navigate(target.path, { state: target.state });
  };

  return (
    <div className={`mb-8 max-w-2xl rounded-xl border ${isDark ? 'bg-[#101012] border-white/10' : 'bg-white border-gray-200'}`}>
      {/* Header — clickable when collapsed */}
      <button
        type="button"
        onClick={toggleCollapsed}
        className={`w-full text-left px-5 pt-4 pb-3 ${!collapsed ? (isDark ? 'border-b border-white/5' : 'border-b border-gray-100') : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={`text-[14px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Get set up with Actyze AI
            </h2>
            <p className={`text-[12px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              Three quick steps unlock the best answers from the AI.
            </p>
          </div>
          <span
            className={`p-1 rounded-md transition-colors flex-shrink-0 ${isDark ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <svg className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
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
      </button>

      {/* Steps */}
      {!collapsed && (
        <ol>
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
                  className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md text-[#5d6ad3] hover:bg-[#5d6ad3]/10 transition-colors">
                  {step.cta}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};

export default OnboardingChecklist;
