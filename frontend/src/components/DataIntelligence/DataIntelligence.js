/**
 * Data Intelligence Component
 * Main container for data management features:
 * - Schema Preferences (User)
 * - File Imports
 * - Metadata Catalog (Org)
 */

import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import UserPreferences from '../Admin/UserPreferences';
import FileImports from './FileImports';
import MetadataCatalog from './MetadataCatalog';

function DataIntelligence() {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('schema-preferences');

  const tabs = [
    { id: 'schema-preferences', label: 'Schema Preferences', badge: 'User', component: UserPreferences },
    { id: 'file-imports', label: 'File Imports', badge: null, component: FileImports },
    { id: 'metadata-catalog', label: 'Metadata Catalog', badge: 'Org', component: MetadataCatalog }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className={`h-full flex flex-col ${isDark ? 'bg-[#101012]' : 'bg-white'}`}>
      {/* Header with Tabs */}
      <div className={`border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Data Intelligence
              </h1>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                Manage data sources, schemas, and metadata
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  pb-3 text-sm font-medium transition-colors relative flex items-center gap-2
                  ${activeTab === tab.id
                    ? isDark ? 'text-[#5d6ad3]' : 'text-[#5d6ad3]'
                    : isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-500 hover:text-gray-600'
                  }
                `}
              >
                {tab.label}
                {tab.badge && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    isDark ? 'bg-[#2a2b2e] text-gray-400' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5d6ad3]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
}

export default DataIntelligence;

