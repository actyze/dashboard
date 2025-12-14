import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Button, Input } from '../ui';
import { useTheme } from '../../contexts/ThemeContext';

const DashboardSettingsModal = ({ open, onClose, onSave, initialData }) => {
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    is_public: false,
    is_anonymous_public: false,
  });

  useEffect(() => {
    // Only update formData when modal opens
    if (!open) return;
    
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        is_public: initialData.is_public === true,
        is_anonymous_public: initialData.is_anonymous_public === true,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        is_public: false,
        is_anonymous_public: false,
      });
    }
  }, [open, initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // If anonymous_public is set to true, also set is_public to true
      if (field === 'is_anonymous_public' && value === true) {
        updated.is_public = true;
      }
      
      // If is_public is set to false, also set is_anonymous_public to false
      if (field === 'is_public' && value === false) {
        updated.is_anonymous_public = false;
      }
      
      return updated;
    });
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('Please enter a dashboard title');
      return;
    }
    
    onSave(formData);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        style: {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#e5e7eb' : '#111827',
        }
      }}
    >
      <DialogTitle className={isDark ? 'text-gray-100' : 'text-gray-900'}>
        {initialData ? 'Dashboard Settings' : 'Create New Dashboard'}
      </DialogTitle>
      
      <DialogContent>
        <div className="space-y-4 mt-2">
          {/* Title */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Dashboard Title *
            </label>
            <Input
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter dashboard title"
              className="w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter dashboard description"
              rows={3}
              className={`
                w-full px-3 py-2 rounded-md border text-sm
                ${isDark 
                  ? 'bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500
              `}
            />
          </div>

          {/* Public Access Settings */}
          <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className={`text-sm font-medium mb-3 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
              Access Control
            </h3>
            
            {/* Public Checkbox */}
            <div className="flex items-start space-x-3 mb-3">
              <input
                type="checkbox"
                id="is_public"
                checked={formData.is_public}
                onChange={(e) => handleChange('is_public', e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex-1">
                <label 
                  htmlFor="is_public" 
                  className={`text-sm font-medium cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  Public Dashboard
                </label>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Accessible to all authenticated users
                </p>
              </div>
            </div>

            {/* Anonymous Public Checkbox */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="is_anonymous_public"
                checked={formData.is_anonymous_public}
                onChange={(e) => handleChange('is_anonymous_public', e.target.checked)}
                disabled={!formData.is_public}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div className="flex-1">
                <label 
                  htmlFor="is_anonymous_public" 
                  className={`text-sm font-medium cursor-pointer ${
                    !formData.is_public 
                      ? isDark ? 'text-gray-600' : 'text-gray-400' 
                      : isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  🌐 Anonymous Public
                </label>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  Accessible without authentication (requires Public to be enabled)
                </p>
              </div>
            </div>
          </div>

          {/* Versioning Info */}
          {initialData && (
            <div className={`p-3 rounded-lg ${isDark ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-start space-x-2">
                <svg className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`text-xs ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                  Changing access settings will create a new version of this dashboard. The current version will be preserved in the version history.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      
      <DialogActions className="px-6 pb-4">
        <Button onClick={onClose} variant="outline">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="primary">
          {initialData ? 'Save Changes' : 'Create Dashboard'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DashboardSettingsModal;

