import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAIAgent, AGENT_STATES } from '../../contexts/AIAgentContext';
import VoiceWaveform from './VoiceWaveform';
import DashboardService from '../../services/DashboardService';

/**
 * AssistantPanel - Chat interface for the AI assistant
 */
const AssistantPanel = ({ onClose }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const {
    agentState,
    isListening,
    interimTranscript,
    finalTranscript,
    messages,
    preferences,
    toggleListening,
    processInput,
    updatePreferences,
    clearConversation,
  } = useAIAgent();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Show interim transcript in input while listening
  useEffect(() => {
    if (isListening && interimTranscript) {
      setInputValue(interimTranscript);
    }
  }, [interimTranscript, isListening]);

  // Clear input when voice is auto-processed (finalTranscript triggers auto-submit)
  useEffect(() => {
    if (!isListening && !interimTranscript) {
      // If we're not listening anymore and no interim, clear the input
      // (the finalTranscript was auto-processed by the context)
      if (inputValue && agentState === AGENT_STATES.PROCESSING) {
        setInputValue('');
      }
    }
  }, [isListening, interimTranscript, agentState, inputValue]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const text = inputValue.trim();
    if (!text || agentState === AGENT_STATES.PROCESSING) return;

    setInputValue('');
    await processInput(text);
  };

  // Handle opening query in Query page - pass SQL for execution
  const handleOpenInQueryPage = (msg) => {
    navigate('/query/new', {
      state: {
        query: {
          generated_sql: msg.sql,
          nl_query: msg.nlQuery,
          query_name: msg.nlQuery ? `AI: ${msg.nlQuery.substring(0, 40)}` : 'AI Query',
          chart_recommendation: msg.chartRecommendation,
        },
        fromAssistant: true,
        autoExecute: true, // Signal Query page to auto-execute
      }
    });
    onClose();
  };

  // Handle adding query result to a new dashboard
  const handleAddToDashboard = async (msg) => {
    try {
      // Generate title from the natural language query
      const dashboardTitle = msg.nlQuery 
        ? `AI: ${msg.nlQuery.substring(0, 50)}${msg.nlQuery.length > 50 ? '...' : ''}`
        : 'AI Dashboard';
      
      const tileTitle = msg.nlQuery
        ? msg.nlQuery.split(' ').slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : 'AI Query';

      // Step 1: Create a new dashboard
      const dashboardResponse = await DashboardService.createDashboard({
        title: dashboardTitle,
        description: msg.nlQuery || 'Dashboard created from Actyze AI',
      });

      if (!dashboardResponse.success) {
        console.error('Failed to create dashboard:', dashboardResponse.error);
        return;
      }

      const dashboardId = dashboardResponse.dashboard?.id;
      if (!dashboardId) {
        console.error('No dashboard ID returned');
        return;
      }

      // Step 2: Create a tile in the new dashboard
      const tileData = {
        title: tileTitle,
        description: msg.nlQuery || null,
        sql_query: msg.sql,
        nl_query: msg.nlQuery || null,
        chart_type: msg.chartRecommendation?.chart_type || 'bar',
        chart_config: msg.chartRecommendation || {},
        position: { x: 0, y: 0, width: 6, height: 2 },
      };

      const tileResponse = await DashboardService.createTile(dashboardId, tileData);

      if (!tileResponse.success) {
        console.error('Failed to create tile:', tileResponse.error);
      }

      // Step 3: Navigate to the new dashboard
      navigate(`/dashboard/${dashboardId}`);
      onClose();
    } catch (error) {
      console.error('Error adding to dashboard:', error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isProcessing = agentState === AGENT_STATES.PROCESSING;

  return (
    <div className={`
      flex flex-col h-full rounded-xl overflow-hidden
      ${isDark ? 'bg-[#1a1b1e]' : 'bg-white'}
      shadow-2xl border
      ${isDark ? 'border-gray-700' : 'border-gray-200'}
    `}>
      {/* Header */}
      <div className={`
        flex items-center justify-between px-4 py-3 border-b
        ${isDark ? 'border-gray-700 bg-[#17181a]' : 'border-gray-200 bg-gray-50'}
      `}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Actyze AI
            </h3>
            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {isListening ? 'Listening...' : isProcessing ? 'Thinking...' : 'Ready to help'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {/* TTS Toggle - Hidden by default since TTS is disabled */}
          {/* 
          <button
            onClick={() => updatePreferences({ ttsEnabled: !preferences.ttsEnabled })}
            className={`p-1.5 rounded-lg transition-colors ${
              preferences.ttsEnabled 
                ? 'bg-violet-500/20 text-violet-400' 
                : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
            }`}
            title={preferences.ttsEnabled ? 'Disable voice responses' : 'Enable voice responses'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>
          */}
          
          {/* Clear chat */}
          <button
            onClick={clearConversation}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
            title="Clear conversation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          
          {/* Close */}
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Ask me anything about your data
            </p>
            <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Try: "Show me sales by region" or "What were top products last month?"
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[90%] rounded-xl px-3 py-2 text-sm
                  ${msg.role === 'user'
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
                    : isDark 
                      ? 'bg-[#2a2b2e] text-gray-100' 
                      : 'bg-gray-100 text-gray-800'
                  }
                `}
              >
                {msg.content}
                
                {/* Generated SQL Preview */}
                {msg.sql && (
                  <div className={`mt-2 rounded overflow-hidden ${isDark ? 'bg-black/30' : 'bg-white/50'}`}>
                    <div className="p-2">
                      <div className={`text-[10px] uppercase tracking-wide mb-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Generated SQL
                      </div>
                      <pre className={`text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {msg.sql}
                      </pre>
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                {msg.sql && msg.canOpenInQueryPage && (
                  <div className="flex gap-1.5 mt-2">
                    {/* Open in Query Page Button */}
                    <button
                      onClick={() => handleOpenInQueryPage(msg)}
                      className={`
                        flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] font-medium
                        transition-colors
                        ${isDark 
                          ? 'bg-black/30 text-gray-300 hover:bg-black/50 border border-gray-600' 
                          : 'bg-white/50 text-gray-700 hover:bg-white/70 border border-gray-300'
                        }
                      `}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Query
                    </button>
                    
                    {/* Add to Dashboard Button */}
                    <button
                      onClick={() => handleAddToDashboard(msg)}
                      className={`
                        flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] font-medium
                        transition-colors
                        ${isDark 
                          ? 'bg-black/30 text-gray-300 hover:bg-black/50 border border-gray-600' 
                          : 'bg-white/50 text-gray-700 hover:bg-white/70 border border-gray-300'
                        }
                      `}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                      Dashboard
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        
        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex justify-start">
            <div className={`
              rounded-xl px-3 py-2 text-sm
              ${isDark ? 'bg-[#2a2b2e]' : 'bg-gray-100'}
            `}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`
        border-t p-3
        ${isDark ? 'border-gray-700 bg-[#17181a]' : 'border-gray-200 bg-gray-50'}
      `}>
        {/* Voice waveform when listening */}
        {isListening && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <VoiceWaveform isActive={true} color="#8B5CF6" barCount={7} width={60} height={24} />
            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Listening...
            </span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Type or speak..."}
            disabled={isProcessing}
            className={`
              flex-1 px-3 py-2 rounded-lg text-sm outline-none
              ${isDark 
                ? 'bg-[#2a2b2e] text-white placeholder-gray-500 focus:ring-1 focus:ring-violet-500' 
                : 'bg-white text-gray-900 placeholder-gray-400 border border-gray-200 focus:border-violet-500'
              }
              ${isListening ? 'border-red-500' : ''}
            `}
          />
          
          {/* Voice button */}
          <button
            type="button"
            onClick={toggleListening}
            disabled={isProcessing}
            className={`
              p-2 rounded-lg transition-all
              ${isListening
                ? 'bg-red-500 text-white animate-pulse'
                : isDark 
                  ? 'bg-[#2a2b2e] text-gray-400 hover:text-white hover:bg-[#3a3b3e]' 
                  : 'bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }
            `}
            title={isListening ? "Stop listening" : "Start voice input"}
          >
            {isListening ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>
          
          {/* Send button */}
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className={`
              p-2 rounded-lg transition-all
              ${!inputValue.trim() || isProcessing
                ? isDark ? 'bg-[#2a2b2e] text-gray-600' : 'bg-gray-100 text-gray-400'
                : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700'
              }
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default AssistantPanel;
