import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const DashboardSettingsModal = ({ open, onClose, onSave, initialData }) => {
  const { isDark } = useTheme();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    is_public: false,
    is_anonymous_public: false,
  });
  const [error, setError] = useState(null);

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
    setError(null);
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
      setError('Please enter a dashboard title');
      return;
    }
    
    onSave(formData);
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className={`
        relative w-full max-w-md mx-4 rounded-xl shadow-2xl
        ${isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'}
      `}>
        {/* Header */}
        <div className={`
          flex items-center justify-between px-5 py-4 border-b
          ${isDark ? 'border-gray-700' : 'border-gray-200'}
        `}>
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-lg
              ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}
            `}>
              <svg className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {initialData ? 'Dashboard Settings' : 'Create New Dashboard'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className={`
              p-1.5 rounded-lg transition-colors
              ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className={`
              mb-4 px-4 py-3 rounded-lg text-sm
              ${isDark ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-red-50 text-red-600 border border-red-200'}
            `}>
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Title Input */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Dashboard Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g., Sales Analytics Dashboard"
                className={`
                  w-full px-3 py-2.5 rounded-lg text-sm
                  transition-all duration-200
                  ${isDark 
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }
                  border outline-none
                `}
              />
            </div>

            {/* Description Input */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Description <span className={`font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>(optional)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Brief description of this dashboard"
                rows={3}
                className={`
                  w-full px-3 py-2.5 rounded-lg text-sm resize-none
                  transition-all duration-200
                  ${isDark 
                    ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }
                  border outline-none
                `}
              />
            </div>

            {/* Access Control Section */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Access Control
              </label>
              <div className={`
                rounded-lg border overflow-hidden
                ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}
              `}>
                {/* Public Toggle */}
                <div className={`
                  flex items-center justify-between p-4
                  ${isDark ? 'border-gray-700' : 'border-gray-200'}
                  border-b
                `}>
                  <div className="flex items-center gap-3">
                    <div className={`
                      p-1.5 rounded-md
                      ${formData.is_public 
                        ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-600'
                        : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                      }
                    `}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        Public Dashboard
                      </p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        Visible to all authenticated users
                      </p>
                    </div>
                  </div>
                  {/* Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleChange('is_public', !formData.is_public)}
                    className={`
                      relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                      ${isDark ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
                      ${formData.is_public 
                        ? 'bg-blue-600' 
                        : isDark ? 'bg-gray-600' : 'bg-gray-300'
                      }
                    `}
                  >
                    <span className={`
                      absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                      ${formData.is_public ? 'translate-x-5' : 'translate-x-0'}
                    `} />
                  </button>
                </div>

                {/* Anonymous Public Toggle */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`
                      p-1.5 rounded-md
                      ${formData.is_anonymous_public 
                        ? isDark ? 'bg-purple-900/40 text-purple-400' : 'bg-purple-100 text-purple-600'
                        : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                      }
                      ${!formData.is_public ? 'opacity-50' : ''}
                    `}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className={!formData.is_public ? 'opacity-50' : ''}>
                      <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        Anonymous Public
                      </p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        Accessible without login
                      </p>
                    </div>
                  </div>
                  {/* Toggle Switch */}
                  <button
                    type="button"
                    disabled={!formData.is_public}
                    onClick={() => handleChange('is_anonymous_public', !formData.is_anonymous_public)}
                    className={`
                      relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                      ${isDark ? 'focus:ring-offset-gray-900' : 'focus:ring-offset-white'}
                      ${!formData.is_public ? 'opacity-50 cursor-not-allowed' : ''}
                      ${formData.is_anonymous_public 
                        ? 'bg-purple-600' 
                        : isDark ? 'bg-gray-600' : 'bg-gray-300'
                      }
                    `}
                  >
                    <span className={`
                      absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200
                      ${formData.is_anonymous_public ? 'translate-x-5' : 'translate-x-0'}
                    `} />
                  </button>
                </div>
              </div>
            </div>

            {/* Versioning Info */}
            {initialData && (
              <div className={`
                flex items-start gap-3 p-3 rounded-lg
                ${isDark ? 'bg-blue-900/20 border border-blue-800/50' : 'bg-blue-50 border border-blue-200'}
              `}>
                <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-blue-300' : 'text-blue-800'}`}>
                  Changing settings will create a new version. Previous versions are preserved in history.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`
          flex items-center justify-end gap-3 px-5 py-4 border-t
          ${isDark ? 'border-gray-700' : 'border-gray-200'}
        `}>
          <button
            onClick={handleClose}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${isDark 
                ? 'text-gray-300 hover:bg-gray-700' 
                : 'text-gray-700 hover:bg-gray-100'
              }
            `}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            {initialData ? 'Save Changes' : 'Create Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardSettingsModal;

