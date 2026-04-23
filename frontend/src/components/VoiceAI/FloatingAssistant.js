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
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed right-6 bottom-6 z-50
          inline-flex items-center gap-2 pl-2.5 pr-3.5 py-2 rounded-full
          text-[13px] font-medium transition-all duration-200
          ${isOpen ? 'opacity-0 pointer-events-none scale-95' : 'opacity-100 scale-100'}
          ${isDark
            ? 'bg-[#0f1012] text-white border border-white/10 hover:border-[#5d6ad3]/50'
            : 'bg-white text-gray-900 border border-gray-200 hover:border-[#5d6ad3]/50'}
          ${isListening ? 'border-red-500' : ''}
          ${isProcessing ? 'border-[#5d6ad3]' : ''}
        `}
      >
        <span className="relative flex h-2 w-2">
          {showPulse && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isListening ? 'bg-red-500' : 'bg-[#5d6ad3]'}`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isListening ? 'bg-red-500' : 'bg-[#5d6ad3]'}`} />
        </span>
        <span>Actyze AI</span>
      </button>

      {/* Assistant Panel */}
      <div className={`
        fixed right-6 bottom-6 z-50
        w-[420px] h-[640px] max-h-[calc(100vh-3rem)]
        transition-all duration-200 ease-out
        ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'}
      `}>
        <AssistantPanel onClose={() => setIsOpen(false)} />
      </div>
    </>
  );
};

export default FloatingAssistant;
