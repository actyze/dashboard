// SPDX-License-Identifier: AGPL-3.0-only
// PageBuilderView — Puck-based page builder for "page" type dashboards.
// Renders the Puck editor in edit mode, or Puck's Render component in view mode.
// Fully self-contained — can be removed without affecting grid dashboards.

import React, { useState, useCallback, useRef } from 'react';
import { Puck, Render } from '@measured/puck';
import '@measured/puck/puck.css';
import { useTheme } from '../../contexts/ThemeContext';
import DashboardService from '../../services/DashboardService';
import puckConfig from './puckConfig';

const EMPTY_DATA = { content: [], root: {} };

const PageBuilderView = ({ dashboardId, initialPageData, isPublic = false }) => {
  const { isDark } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [savedData, setSavedData] = useState(initialPageData || EMPTY_DATA);

  const hasContent = savedData?.content?.length > 0;

  // Called when user clicks "Publish" in Puck editor
  const handlePublish = useCallback(async (data) => {
    setSavedData(data);
    setIsEditing(false);
    await DashboardService.updateDashboard(dashboardId, { page_data: data });
  }, [dashboardId]);

  // ─── View mode ─────────────────────────────────────────────────
  if (!isEditing) {
    // Empty state
    if (!hasContent && !isPublic) {
      return (
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setIsEditing(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Page
            </button>
          </div>
          <div className={`flex flex-col items-center justify-center py-20 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm mb-3">This page has no content yet</p>
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors"
            >
              Start Building
            </button>
          </div>
        </div>
      );
    }

    // Rendered page (view mode)
    return (
      <div className="max-w-5xl mx-auto">
        {!isPublic && (
          <div className="flex justify-end mb-3">
            <button
              onClick={() => setIsEditing(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Page
            </button>
          </div>
        )}
        <Render config={puckConfig} data={savedData} />
      </div>
    );
  }

  // ─── Editor mode ───────────────────────────────────────────────
  return (
    <div style={{ height: 'calc(100vh - 56px)', margin: '-16px' }}>
      <Puck
        config={puckConfig}
        data={savedData}
        onPublish={handlePublish}
      />
    </div>
  );
};

export default PageBuilderView;
