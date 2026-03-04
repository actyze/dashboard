import React, { useState } from 'react';
import { useLocation } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAIAgent, AGENT_STATES } from '../../contexts/AIAgentContext';
import AssistantPanel from './AssistantPanel';

/**
 * FloatingAssistant - Fixed button on the right side that opens the AI assistant panel
 * Hidden on pages that have their own AI input (Query page)
 */
const FloatingAssistant = () => {
  const { isDark } = useTheme();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { agentState, isListening } = useAIAgent();

  // Hide on certain pages
  const isQueryPage = location.pathname.startsWith('/query/');
  const isLoginPage = location.pathname === '/login';
  const isSignupPage = location.pathname === '/signup';
  
  // Only show pulsing when ACTUALLY listening or processing
  const isProcessing = agentState === AGENT_STATES.PROCESSING;
  const showPulse = isListening || isProcessing;

  // Don't render on login, signup, or query pages
  if (isQueryPage || isLoginPage || isSignupPage) {
    return null;
  }

  return (
    <>
      {/* Floating Button - Fixed on the right side */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed right-6 bottom-6 z-50
          flex items-center gap-2 px-4 py-2.5 rounded-full
          font-medium text-sm
          shadow-lg transition-all duration-300
          ${isOpen 
            ? 'opacity-0 pointer-events-none scale-90' 
            : 'opacity-100 scale-100'
          }
          ${isDark 
            ? 'bg-[#1a1b1e] text-white border border-gray-700 hover:border-violet-500 hover:shadow-violet-500/10' 
            : 'bg-white text-gray-800 border border-gray-200 hover:border-violet-500 hover:shadow-violet-500/10'
          }
          ${isListening ? 'border-red-500 shadow-red-500/20' : ''}
          ${isProcessing ? 'border-violet-500 shadow-violet-500/20' : ''}
        `}
      >
        {/* Icon */}
        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        
        {/* Label */}
        <span>Actyze AI</span>
        
        {/* Pulse indicator - ONLY when listening or processing */}
        {showPulse && (
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isListening ? 'bg-red-500' : 'bg-violet-500'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isListening ? 'bg-red-500' : 'bg-violet-500'}`}></span>
          </span>
        )}
      </button>

      {/* Assistant Panel - Slides in from right */}
      <div className={`
        fixed right-6 bottom-6 z-50
        w-[380px] h-[500px]
        transition-all duration-300 ease-out
        ${isOpen 
          ? 'opacity-100 scale-100 translate-y-0' 
          : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }
      `}>
        <AssistantPanel onClose={() => setIsOpen(false)} />
      </div>
    </>
  );
};

export default FloatingAssistant;
