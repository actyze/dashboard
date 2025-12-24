import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const ShareModal = ({ open, onClose, onSave, dashboard }) => {
  const { isDark } = useTheme();
  const [accessLevel, setAccessLevel] = useState('private'); // 'private', 'company', 'public'
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    
    // Set initial access level based on dashboard settings
    if (dashboard?.is_anonymous_public) {
      setAccessLevel('public');
    } else if (dashboard?.is_public) {
      setAccessLevel('company');
    } else {
      setAccessLevel('private');
    }
  }, [open, dashboard]);

  const handleSave = () => {
    const shareData = {
      is_public: accessLevel === 'company' || accessLevel === 'public',
      is_anonymous_public: accessLevel === 'public'
    };
    onSave(shareData);
  };

  const handleCopyLink = () => {
    const link = accessLevel === 'public' 
      ? `${window.location.origin}/public/dashboard/${dashboard?.id}`
      : `${window.location.origin}/dashboard/${dashboard?.id}`;
    
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  const accessOptions = [
    {
      id: 'private',
      title: 'Only me',
      description: 'Only you can access this dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    {
      id: 'company',
      title: 'Anyone in the company',
      description: 'All authenticated users can view',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      id: 'public',
      title: 'Anyone with the link',
      description: 'No login required to view',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`
        relative w-full max-w-md mx-4 rounded-xl shadow-2xl
        ${isDark ? 'bg-[#17181a] border border-[#2a2b2e]' : 'bg-white border border-gray-200'}
      `}>
        {/* Header */}
        <div className={`
          flex items-center justify-between px-5 py-4 border-b
          ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}
        `}>
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-lg
              ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'}
            `}>
              <svg className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Share Dashboard
            </h2>
          </div>
          <button
            onClick={onClose}
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
        <div className="px-5 py-4">
          {/* Access Level Options */}
          <div className="space-y-2">
            <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Who can access this dashboard?
            </label>
            
            {accessOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setAccessLevel(option.id)}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                  ${accessLevel === option.id
                    ? isDark 
                      ? 'bg-blue-900/30 border-blue-600 ring-1 ring-blue-600' 
                      : 'bg-blue-50 border-blue-500 ring-1 ring-blue-500'
                    : isDark
                      ? 'bg-[#1c1d1f] border-[#2a2b2e] hover:border-gray-600'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <div className={`
                  p-2 rounded-lg flex-shrink-0
                  ${accessLevel === option.id
                    ? isDark ? 'bg-[#5d6ad3] text-white' : 'bg-[#5d6ad3] text-white'
                    : isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                  }
                `}>
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
                    {option.title}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {option.description}
                  </p>
                </div>
                {/* Radio indicator */}
                <div className={`
                  w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${accessLevel === option.id
                    ? 'border-blue-600 bg-[#5d6ad3]'
                    : isDark ? 'border-gray-600' : 'border-gray-300'
                  }
                `}>
                  {accessLevel === option.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Copy Link Section */}
          {accessLevel !== 'private' && (
            <div className={`
              mt-4 p-3 rounded-lg
              ${isDark ? 'bg-[#1c1d1f] border border-[#2a2b2e]' : 'bg-gray-50 border border-gray-200'}
            `}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {accessLevel === 'public' ? 'Public link' : 'Dashboard link'}
                  </p>
                  <p className={`text-sm truncate ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {accessLevel === 'public' 
                      ? `${window.location.origin}/public/dashboard/${dashboard?.id}`
                      : `${window.location.origin}/dashboard/${dashboard?.id}`
                    }
                  </p>
                </div>
                <button
                  onClick={handleCopyLink}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex-shrink-0
                    ${copied
                      ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
                      : isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200'
                    }
                  `}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Info message for public */}
          {accessLevel === 'public' && (
            <div className={`
              mt-3 flex items-start gap-2 p-3 rounded-lg
              ${isDark ? 'bg-amber-900/20 border border-amber-800/50' : 'bg-amber-50 border border-amber-200'}
            `}>
              <svg className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
                Anyone with this link can view your dashboard without signing in.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`
          flex items-center justify-end gap-3 px-5 py-4 border-t
          ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}
        `}>
          <button
            onClick={onClose}
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
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors shadow-sm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;

