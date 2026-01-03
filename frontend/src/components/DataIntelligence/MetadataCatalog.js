/**
 * Metadata Catalog Component
 * Organization-level metadata management and data catalog
 */

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

function MetadataCatalog() {
  const { isDark } = useTheme();

  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className={`text-center max-w-md ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        <svg className={`w-16 h-16 mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Metadata Catalog
        </h3>
        <p className="text-sm">
          Browse and manage organization-wide metadata, data lineage, and documentation.
        </p>
        <p className={`text-xs mt-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
          Coming soon...
        </p>
      </div>
    </div>
  );
}

export default MetadataCatalog;

