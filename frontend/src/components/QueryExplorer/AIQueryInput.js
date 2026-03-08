import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useVoiceRecognition } from '../../hooks';

// CSS for animated gradient border
const animatedBorderStyles = `
  @keyframes shimmer {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  }
  
  .ai-input-wrapper {
    position: relative;
    border-radius: 10px;
    padding: 1px;
    background: linear-gradient(
      90deg,
      #3b82f6,
      #8b5cf6,
      #ec4899,
      #8b5cf6,
      #3b82f6
    );
    background-size: 200% 100%;
    animation: shimmer 4s ease-in-out infinite;
  }
  
  .ai-input-inner {
    border-radius: 9px;
    width: 100%;
    height: 100%;
  }
  
  .voice-btn-active {
    animation: pulse-glow 1.5s infinite;
  }
`;

const AIQueryInput = ({ onSubmit, loading = false }) => {
  const { isDark } = useTheme();
  const [query, setQuery] = useState('');
  const textAreaRef = useRef(null);

  // Voice recognition hook - dictation only, no TTS
  const {
    isListening,
    interimTranscript,
    isSupported: voiceSupported,
    startListening,
    stopListening,
  } = useVoiceRecognition({
    onResult: (transcript) => {
      if (transcript.trim()) {
        // Submit directly when voice input completes
        onSubmit(transcript.trim());
        setQuery('');
      }
    },
    autoSubmit: true,
  });

  // Update query field with interim transcript while listening
  useEffect(() => {
    if (isListening && interimTranscript) {
      setQuery(interimTranscript);
    }
  }, [isListening, interimTranscript]);

  // Auto-resize textarea
  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 200)}px`;
    }
  }, [query]);

  const handleSubmit = () => {
    if (query.trim() && !loading) {
      // Stop listening if active
      if (isListening) {
        stopListening();
      }
      
      // Submit the query
      onSubmit(query.trim());
      
      // Clear the input immediately
      setQuery('');
      
      // Reset textarea height
      if (textAreaRef.current) {
        textAreaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      setQuery(''); // Clear any existing text
      startListening();
    }
  };

  const SendIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );

  const LoadingSpinner = () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
  );

  const MicIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );

  return (
    <div className="w-full mx-auto">
      <style>{animatedBorderStyles}</style>
      
      {/* Animated Border Wrapper */}
      <div className="ai-input-wrapper">
        {/* Inner Container */}
        <div className={`ai-input-inner ${isDark ? 'bg-[#17181a]' : 'bg-white'}`}>
          <div className="px-4 py-3">
            {/* Input Row */}
            <div className="flex items-end gap-2">
              {/* Textarea */}
              <textarea
                ref={textAreaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening... speak now" : "Ask anything about your data... e.g., Show sales by region"}
                className={`
                  flex-1 resize-none border-none outline-none text-sm leading-relaxed
                  ${isDark ? 'bg-transparent text-white placeholder-gray-500' : 'bg-transparent text-gray-900 placeholder-gray-400'}
                  ${isListening ? 'placeholder-red-400' : ''}
                  min-h-[80px] max-h-[200px]
                `}
                rows={3}
                disabled={isListening}
              />
              
              {/* Voice Button */}
              {voiceSupported && (
                <button
                  onClick={handleVoiceToggle}
                  disabled={loading}
                  className={`
                    flex-shrink-0 w-8 h-8 mb-0.5 rounded-lg flex items-center justify-center
                    transition-all duration-200
                    ${isListening
                      ? 'bg-red-500 text-white voice-btn-active'
                      : isDark 
                        ? 'bg-[#2a2b2e] text-gray-400 hover:bg-[#3a3b3e] hover:text-gray-200' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                    }
                    ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  title={isListening ? "Stop listening" : "Voice input (click to speak)"}
                >
                  {isListening ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <MicIcon />
                  )}
                </button>
              )}
              
              {/* Send Button */}
              <button
                onClick={handleSubmit}
                disabled={!query.trim() || loading}
                className={`
                  flex-shrink-0 w-8 h-8 mb-0.5 rounded-lg flex items-center justify-center
                  transition-all duration-200
                  ${!query.trim() || loading
                    ? `${isDark ? 'bg-[#1c1d1f] text-gray-600' : 'bg-gray-100 text-gray-400'} cursor-not-allowed`
                    : 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white'
                  }
                `}
              >
                {loading ? <LoadingSpinner /> : <SendIcon />}
              </button>
            </div>
            
            {/* Listening indicator */}
            {isListening && (
              <div className="mt-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Listening... click the stop button or press Enter when done
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIQueryInput;
