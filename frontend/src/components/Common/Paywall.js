/**
 * Paywall Component
 * Wrapper component that blocks access based on resource limits from the license
 * 
 * Usage:
 * <Paywall type="dashboard" currentCount={dashboards.length}>
 *   <CreateDashboardButton />
 * </Paywall>
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { usePaywall } from '../../contexts/PaywallContext';
import { useTheme } from '../../contexts/ThemeContext';
import LicenseService from '../../services/LicenseService';

const Paywall = ({ 
  type, // 'user' | 'dashboard' | 'data_source'
  currentCount = 0,
  children,
  // Optional: Custom message to display
  message,
  // Optional: Show a subtle badge instead of full overlay
  mode = 'overlay', // 'overlay' | 'badge' | 'disable'
  // Optional: Custom class for the container
  className = '',
  // Optional: Blur intensity for overlay mode
  blurIntensity = 'md', // 'sm' | 'md' | 'lg'
}) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { 
    checkLimit,
    getTypeName,
    loading,
    currentPlan
  } = usePaywall();

  // State for showing the upgrade modal in disable mode
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const modalRef = useRef(null);
  const containerRef = useRef(null);

  // Check if within limit
  const limitResult = checkLimit(type, currentCount);
  const allowed = limitResult.allowed;
  const typeName = getTypeName(type);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target) && 
          containerRef.current && !containerRef.current.contains(event.target)) {
        setShowUpgradeModal(false);
      }
    };

    if (showUpgradeModal) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUpgradeModal]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowUpgradeModal(false);
      }
    };

    if (showUpgradeModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showUpgradeModal]);

  // Navigate to license page
  const goToLicense = () => {
    setShowUpgradeModal(false);
    navigate('/admin/license');
  };

  // Show loading state
  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <div className="animate-pulse">
          {children}
        </div>
      </div>
    );
  }

  // Within limit, render children normally
  if (allowed) {
    return <>{children}</>;
  }

  // Get blur class based on intensity
  const getBlurClass = () => {
    switch (blurIntensity) {
      case 'sm': return 'blur-[2px]';
      case 'lg': return 'blur-[8px]';
      case 'md':
      default: return 'blur-[4px]';
    }
  };

  // Format the limit message
  const getLimitMessage = () => {
    if (message) return message;
    if (limitResult.limit === null) {
      return `${typeName} limit reached. Upgrade to create more.`;
    }
    return `${typeName} limit reached (${limitResult.current}/${limitResult.limit}). Upgrade to create more.`;
  };

  // Overlay mode - full blocking overlay with upgrade prompt
  if (mode === 'overlay') {
    return (
      <div className={`relative ${className}`}>
        {/* Blurred content behind */}
        <div 
          className={`${getBlurClass()} pointer-events-none select-none`}
          aria-hidden="true"
        >
          {children}
        </div>
        
        {/* Overlay */}
        <div 
          className={`absolute inset-0 flex items-center justify-center z-10 rounded-lg backdrop-blur-[1px] ${
            isDark 
              ? 'bg-[#0f1011]/80' 
              : 'bg-white/80'
          }`}
        >
          <div className={`text-center p-6 max-w-sm mx-4`}>
            {/* Lock Icon */}
            <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
              isDark 
                ? 'bg-gradient-to-br from-[#5d6ad3]/20 to-purple-500/20 border border-[#5d6ad3]/30' 
                : 'bg-gradient-to-br from-[#5d6ad3]/10 to-purple-500/10 border border-[#5d6ad3]/20'
            }`}>
              <svg 
                className={`w-6 h-6 ${isDark ? 'text-[#5d6ad3]' : 'text-[#5d6ad3]'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                />
              </svg>
            </div>

            {/* Title */}
            <h3 className={`text-lg font-semibold mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              {typeName} Limit Reached
            </h3>

            {/* Message */}
            <p className={`text-sm mb-5 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {getLimitMessage()}
            </p>

            {/* Usage Badge */}
            {limitResult.limit !== null && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-4 ${
                isDark 
                  ? 'bg-gray-800 text-gray-400' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {limitResult.current}/{limitResult.limit} {typeName}s used
              </div>
            )}

            {/* Current Plan Badge */}
            {currentPlan && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium mb-4 ml-2 ${
                isDark 
                  ? 'bg-gray-800 text-gray-400' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></span>
                Plan: {LicenseService.formatPlanName(currentPlan.plan_type)}
              </div>
            )}

            {/* Upgrade Button */}
            <button
              onClick={goToLicense}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors duration-200"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Upgrade Plan
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Badge mode - show content with an upgrade badge
  if (mode === 'badge') {
    return (
      <div className={`relative ${className}`}>
        {/* Content with reduced opacity */}
        <div className="opacity-60 pointer-events-none select-none">
          {children}
        </div>
        
        {/* Upgrade badge */}
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={goToLicense}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 shadow-lg ${
              isDark 
                ? 'bg-[#5d6ad3] text-white hover:bg-[#4f5bc4]' 
                : 'bg-[#5d6ad3] text-white hover:bg-[#4f5bc4]'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Upgrade
          </button>
        </div>
      </div>
    );
  }

  // Disable mode - show content but disabled, clickable to show upgrade modal
  if (mode === 'disable') {
    return (
      <div className={`relative ${className}`} ref={containerRef}>
        {/* Clickable wrapper that shows modal */}
        <div 
          className="cursor-pointer"
          onClick={() => setShowUpgradeModal(true)}
        >
          {/* Disabled content appearance */}
          <div className="opacity-50 pointer-events-none select-none">
            {children}
          </div>
        </div>
        
        {/* Upgrade Modal/Popover */}
        {showUpgradeModal && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setShowUpgradeModal(false)}
            />
            
            {/* Modal */}
            <div 
              ref={modalRef}
              className={`absolute z-50 mt-2 right-0 w-72 rounded-xl shadow-2xl border overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
                isDark 
                  ? 'bg-[#1c1d1f] border-[#2a2b2e] shadow-black/50' 
                  : 'bg-white border-gray-200 shadow-gray-200/50'
              }`}
              style={{ 
                animation: 'fadeSlideIn 0.2s ease-out'
              }}
            >
              {/* Header with gradient */}
              <div className={`px-4 py-3 border-b ${
                isDark ? 'border-[#2a2b2e]' : 'border-gray-100'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    isDark 
                      ? 'bg-gradient-to-br from-[#5d6ad3]/20 to-purple-500/20' 
                      : 'bg-gradient-to-br from-[#5d6ad3]/10 to-purple-500/10'
                  }`}>
                    <svg 
                      className="w-5 h-5 text-[#5d6ad3]" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={1.5} 
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {typeName} Limit Reached
                    </h4>
                    {limitResult.limit !== null && (
                      <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                        {limitResult.current}/{limitResult.limit} used
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="px-4 py-3">
                <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  {getLimitMessage()}
                </p>

                {/* Upgrade Button */}
                <button
                  onClick={goToLicense}
                  className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors duration-200"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Upgrade Plan
                  </span>
                </button>

                {/* Dismiss link */}
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className={`w-full mt-2 text-xs py-1.5 transition-colors ${
                    isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Maybe later
                </button>
              </div>
            </div>
          </>
        )}

        <style>{`
          @keyframes fadeSlideIn {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    );
  }

  // Fallback
  return <>{children}</>;
};

export default Paywall;
