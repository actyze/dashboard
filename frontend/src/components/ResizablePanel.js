import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ResizablePanel = ({ children, isFullScreen, onToggleFullScreen }) => {
  const { isDark } = useTheme();

  return (
    <div className={`${isFullScreen ? 'fixed inset-0 z-50' : 'relative'} transition-all duration-300`}>
      {isFullScreen && (
        <div className={`absolute inset-0 ${isDark ? 'bg-gray-900' : 'bg-white'}`} />
      )}
      
      <div className={`${isFullScreen ? 'absolute inset-4' : 'relative h-full'} flex flex-col`}>
        {/* Fullscreen Toggle Button */}
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={onToggleFullScreen}
            className={`
              p-1.5 rounded-md transition-all duration-200
              ${isDark 
                ? 'bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-600/50' 
                : 'bg-white/80 hover:bg-gray-50 text-gray-600 border border-gray-200/50 shadow-sm'
              }
              hover:shadow-md backdrop-blur-sm
            `}
            title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
          >
            {isFullScreen ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l4 4m8-4V4m0 0h-4m4 0l-4 4v8m0 0v4m0-4h4m-4 0l4-4" />
              </svg>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          {children}
        </div>
      </div>

      {/* Escape key handler for fullscreen */}
      {isFullScreen && (
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onToggleFullScreen();
            }
          }}
        />
      )}
    </div>
  );
};

export default ResizablePanel;