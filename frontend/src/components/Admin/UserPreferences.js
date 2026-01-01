/**
 * User Preferences Component
 * Allows users to set preferred schemas/tables for recommendation boosting
 * Clean, minimal UI matching Admin panel styling
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import PreferencesService from '../../services/PreferencesService';
import SchemaBrowserDialog from '../Common/SchemaBrowserDialog';

function UserPreferences() {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openBrowserDialog, setOpenBrowserDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, path } of preference to delete

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await PreferencesService.getUserPreferences();
      setPreferences(prefs || []);
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPreference = async (resources) => {
    const resourcesArray = Array.isArray(resources) ? resources : [resources];
    
    try {
      const promises = resourcesArray.map(resource => 
        PreferencesService.addUserPreference(resource)
      );
      await Promise.all(promises);
      showSuccess(`${resourcesArray.length} preference${resourcesArray.length > 1 ? 's' : ''} added`);
      loadPreferences();
    } catch (err) {
      showError(err.response?.data?.detail || err.message || 'Failed to add preference');
    }
  };

  const handleDeletePreference = async () => {
    if (!deleteConfirm) return;

    try {
      await PreferencesService.deleteUserPreference(deleteConfirm.id);
      showSuccess('Preference removed');
      setDeleteConfirm(null);
      loadPreferences();
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to remove preference');
      setDeleteConfirm(null);
    }
  };

  const formatResourcePath = (pref) => {
    const parts = [];
    if (pref.catalog) parts.push(pref.catalog);
    if (pref.database_name) parts.push(pref.database_name);
    if (pref.schema_name) parts.push(pref.schema_name);
    if (pref.table_name) parts.push(pref.table_name);
    return parts.length > 0 ? parts.join('.') : 'All';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#5d6ad3] mx-auto"></div>
          <p className={`mt-3 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Loading preferences...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Schema Preferences
          </h2>
          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
            Boost preferred schemas in AI recommendations
          </p>
        </div>
        <button
          onClick={() => setOpenBrowserDialog(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            isDark 
              ? 'text-gray-300 hover:bg-[#1c1d1f]' 
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Preference
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6">
        {/* Table Header */}
        <div className={`grid grid-cols-12 gap-4 py-2 text-xs font-medium border-b sticky top-0 ${
          isDark 
            ? 'text-gray-500 border-[#2a2b2e] bg-[#101012]' 
            : 'text-gray-500 border-gray-200 bg-gray-50'
        }`}>
          <div className="col-span-5">Resource</div>
          <div className="col-span-2">Database</div>
          <div className="col-span-2">Schema</div>
          <div className="col-span-2">Boost</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>

        {/* Table Body */}
        {preferences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg className={`w-8 h-8 mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
              No preferences set
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
              Add schemas to boost in AI recommendations
            </p>
          </div>
        ) : (
          <div>
            {preferences.map((pref) => (
              <div 
                key={pref.id}
                className={`grid grid-cols-12 gap-4 py-3 border-b ${
                  isDark ? 'border-[#1c1d1f]' : 'border-gray-100'
                }`}
              >
                {/* Resource Path */}
                <div className="col-span-5 flex items-center">
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {formatResourcePath(pref)}
                  </span>
                  {pref.preferred_columns && pref.preferred_columns.length > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded ${
                      isDark ? 'bg-[#2a2b2e] text-gray-400' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {pref.preferred_columns.length} cols
                    </span>
                  )}
                </div>
                
                {/* Database */}
                <div className="col-span-2 flex items-center">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {pref.database_name || '-'}
                  </span>
                </div>
                
                {/* Schema */}
                <div className="col-span-2 flex items-center">
                  <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {pref.schema_name || '-'}
                  </span>
                </div>
                
                {/* Boost Weight */}
                <div className="col-span-2 flex items-center">
                  <span className={`px-2 py-0.5 text-xs rounded ${
                    pref.boost_weight >= 2.5
                      ? isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'
                      : pref.boost_weight >= 2.0
                        ? isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                        : isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                  }`}>
                    {pref.boost_weight?.toFixed(1) || '1.5'}x
                  </span>
                </div>
                
                {/* Actions */}
                <div className="col-span-1 flex items-center justify-end">
                  <button
                    onClick={() => setDeleteConfirm({ id: pref.id, path: formatResourcePath(pref) })}
                    className={`p-1 rounded transition-colors ${
                      isDark 
                        ? 'text-gray-600 hover:text-red-400 hover:bg-[#2a2b2e]' 
                        : 'text-gray-400 hover:text-red-500 hover:bg-gray-100'
                    }`}
                    title="Remove preference"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schema Browser Dialog */}
      <SchemaBrowserDialog
        isOpen={openBrowserDialog}
        onClose={() => setOpenBrowserDialog(false)}
        onConfirm={handleAddPreference}
        title="Add Schema Preference"
        description="Select schemas or tables to boost in recommendations"
        confirmButtonText="Add Preference"
        showBoostWeight={true}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
        >
          <div 
            className={`w-full max-w-sm mx-4 rounded-xl shadow-2xl ${
              isDark ? 'bg-[#17181a] border border-[#2a2b2e]' : 'bg-white border border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center gap-3 px-5 py-4 border-b ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              <div className={`p-2 rounded-full ${isDark ? 'bg-red-900/20' : 'bg-red-50'}`}>
                <svg className={`w-5 h-5 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Remove Preference
                </h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  This action cannot be undone
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-4">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Are you sure you want to remove the preference for{' '}
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {deleteConfirm.path}
                </span>?
              </p>
            </div>

            {/* Footer */}
            <div className={`flex items-center justify-end gap-3 px-5 py-4 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
              <button
                onClick={() => setDeleteConfirm(null)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDark ? 'text-gray-300 hover:bg-[#2a2b2e]' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePreference}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserPreferences;
