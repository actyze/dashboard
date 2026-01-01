/**
 * User Preferences Component
 * Allows users to set preferred schemas/tables/columns for recommendation boosting
 * Follows the same structure as Data Access Management
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import PreferencesService from '../../services/PreferencesService';
import SchemaBrowserDialog from '../Common/SchemaBrowserDialog';

function UserPreferences() {
  const { isDark } = useTheme();
  const [preferences, setPreferences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [openBrowserDialog, setOpenBrowserDialog] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  // Auto-dismiss alerts
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const preferences = await PreferencesService.getUserPreferences();
      setPreferences(preferences || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPreference = async (resources) => {
    console.log('handleAddPreference called with:', resources);
    
    // Handle batch addition of preferences (all with same boost weight)
    const resourcesArray = Array.isArray(resources) ? resources : [resources];
    
    console.log('Resources array:', resourcesArray);
    
    try {
      // Add all preferences
      const promises = resourcesArray.map(resource => {
        console.log('Adding preference:', resource);
        return PreferencesService.addUserPreference(resource);
      });
      
      const results = await Promise.all(promises);
      console.log('All preferences added:', results);
      
      setSuccess(`${resourcesArray.length} preference${resourcesArray.length > 1 ? 's' : ''} added successfully`);
      loadPreferences();
    } catch (err) {
      console.error('Error adding preferences:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to add preference(s)');
    }
  };

  const handleDeletePreference = async (preferenceId) => {
    if (!window.confirm('Remove this preference?')) return;

    try {
      await PreferencesService.deleteUserPreference(preferenceId);
      setSuccess('Preference removed successfully');
      loadPreferences();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to remove preference');
    }
  };

  const formatResourcePath = (pref) => {
    let path = [];
    if (pref.catalog) path.push(pref.catalog);
    if (pref.database_name) path.push(pref.database_name);
    if (pref.schema_name) path.push(pref.schema_name);
    if (pref.table_name) path.push(pref.table_name);
    return path.join('.');
  };

  const getBoostColor = (weight) => {
    if (weight >= 2.5) return 'bg-purple-500/20 text-purple-400';
    if (weight >= 2.0) return 'bg-blue-500/20 text-blue-400';
    if (weight >= 1.5) return 'bg-green-500/20 text-green-400';
    return 'bg-gray-500/20 text-gray-400';
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${
        isDark ? 'text-gray-400' : 'text-gray-600'
      }`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3">Loading preferences...</span>
      </div>
    );
  }

  return (
    <div className={`h-full ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">Schema Preferences</h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Mark your preferred schemas, tables, and columns to boost their relevance in AI recommendations
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className={`mb-4 p-4 rounded-lg border ${
            isDark 
              ? 'bg-red-900/20 border-red-800 text-red-400' 
              : 'bg-red-100 border-red-400 text-red-700'
          }`}>
            {error}
          </div>
        )}
        
        {success && (
          <div className={`mb-4 p-4 rounded-lg border ${
            isDark 
              ? 'bg-green-900/20 border-green-800 text-green-400' 
              : 'bg-green-100 border-green-400 text-green-700'
          }`}>
            {success}
          </div>
        )}

        {/* Action Button */}
        <div className="mb-6">
          <button
            onClick={() => setOpenBrowserDialog(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            + Add Preference
          </button>
        </div>

        {/* Preferences List */}
        <div className={`rounded-lg border ${
          isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
        }`}>
          <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h2 className="text-lg font-semibold">Your Preferred Schemas & Tables</h2>
          </div>
          
          {preferences.length === 0 ? (
            <div className={`p-8 text-center ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
              <p>No preferences set yet.</p>
              <p className="text-sm mt-2">Add preferences to boost schema recommendations for your queries.</p>
            </div>
          ) : (
            <div className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {preferences.map((pref) => (
                <div 
                  key={pref.id} 
                  className={`p-4 ${
                    isDark ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50'
                  } transition-colors`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm font-semibold text-blue-400">
                          {formatResourcePath(pref)}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                          getBoostColor(pref.boost_weight)
                        }`}>
                          {pref.boost_weight.toFixed(1)}x boost
                        </span>
                      </div>
                      
                      {pref.preferred_columns && pref.preferred_columns.length > 0 && (
                        <div className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          <span className="font-medium">Columns:</span>{' '}
                          {pref.preferred_columns.join(', ')}
                        </div>
                      )}
                      
                      <div className={`mt-1 text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        Added {new Date(pref.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleDeletePreference(pref.id)}
                      className={`ml-4 px-3 py-1 text-sm rounded transition-colors ${
                        isDark 
                          ? 'text-red-400 hover:text-red-300 hover:bg-red-900/20' 
                          : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                      }`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className={`mt-6 p-4 rounded-lg ${
          isDark ? 'bg-blue-900/10 border border-blue-800/30' : 'bg-blue-50 border border-blue-200'
        }`}>
          <h3 className="font-semibold mb-2 text-blue-400">How Preferences Work</h3>
          <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
            <li>• <strong>Schema-level</strong>: Boost all tables in that schema</li>
            <li>• <strong>Table-level</strong>: Boost a specific table</li>
            <li>• <strong>Boost weight</strong>: 1.5x (default), 2.0x (medium), 2.5x+ (high priority)</li>
            <li>• Preferences help the AI recommend more relevant schemas for your queries</li>
          </ul>
        </div>
      </div>

      {/* Schema Browser Dialog */}
      <SchemaBrowserDialog
        isOpen={openBrowserDialog}
        onClose={() => setOpenBrowserDialog(false)}
        onConfirm={handleAddPreference}
        title="Select Schema or Table to Prefer"
        description="Choose a schema (entire schema) or specific table to boost in recommendations"
        confirmButtonText="Add Preference"
        showBoostWeight={true}
      />
    </div>
  );
}

export default UserPreferences;

