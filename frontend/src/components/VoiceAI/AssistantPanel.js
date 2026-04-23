// SPDX-License-Identifier: AGPL-3.0-only
import React, { useReducer, useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAIAgent, AGENT_STATES } from '../../contexts/AIAgentContext';
import ChatService from '../../services/ChatService';
import DashboardService from '../../services/DashboardService';
import MessageBlock from './MessageBlock';
import VoiceWaveform from './VoiceWaveform';

// ── Reducer ────────────────────────────────────────────────────────────

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const initialState = {
  messages: [],   // { id, role, content, status, sql?, reasoning?, chartRecommendation?, queryResults?, isLimited?, errorMessage? }
  pendingUserInput: null,  // for regenerate
};

function reducer(state, action) {
  switch (action.type) {
    case 'USER_SEND': {
      const userMsg = { id: uid(), role: 'user', content: action.text, status: 'complete' };
      const asstMsg = { id: uid(), role: 'assistant', content: '', status: 'generating' };
      return {
        ...state,
        messages: [...state.messages, userMsg, asstMsg],
        pendingUserInput: action.text,
      };
    }
    case 'RESPAWN_ASSISTANT': {
      // Drop trailing assistant (if any) and append a fresh one; user message is preserved
      const msgs = [...state.messages];
      if (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
      msgs.push({ id: uid(), role: 'assistant', content: '', status: 'generating' });
      return { ...state, messages: msgs };
    }
    case 'STAGE': {
      return {
        ...state,
        messages: state.messages.map((m, i) =>
          i === state.messages.length - 1 && m.role === 'assistant'
            ? { ...m, status: action.stage }
            : m
        ),
      };
    }
    case 'SQL_READY': {
      return {
        ...state,
        messages: state.messages.map((m, i) =>
          i === state.messages.length - 1 && m.role === 'assistant'
            ? { ...m,
                sql: action.sql,
                reasoning: action.reasoning,
                chartRecommendation: action.chartRecommendation,
                content: action.reasoning || m.content,
              }
            : m
        ),
      };
    }
    case 'RESULT_READY': {
      return {
        ...state,
        messages: state.messages.map((m, i) =>
          i === state.messages.length - 1 && m.role === 'assistant'
            ? { ...m,
                sql: action.sql,
                reasoning: action.reasoning,
                chartRecommendation: action.chartRecommendation,
                content: action.reasoning || m.content,
                queryResults: action.queryResults,
                isLimited: action.isLimited,
                status: 'complete',
              }
            : m
        ),
      };
    }
    case 'ERROR': {
      return {
        ...state,
        messages: state.messages.map((m, i) =>
          i === state.messages.length - 1 && m.role === 'assistant'
            ? { ...m, status: 'error', errorMessage: action.message, content: action.reasoning || m.content }
            : m
        ),
      };
    }
    case 'EXEC_ERROR': {
      return {
        ...state,
        messages: state.messages.map((m, i) =>
          i === state.messages.length - 1 && m.role === 'assistant'
            ? { ...m,
                sql: action.sql,
                reasoning: action.reasoning,
                chartRecommendation: action.chartRecommendation,
                content: action.reasoning || m.content,
                status: 'exec_error',
                errorMessage: action.message,
              }
            : m
        ),
      };
    }
    case 'STOPPED': {
      return {
        ...state,
        messages: state.messages.map((m, i) =>
          i === state.messages.length - 1 && m.role === 'assistant'
            ? { ...m, status: 'complete', errorMessage: m.errorMessage || 'Stopped.' }
            : m
        ),
      };
    }
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
}

// ── Panel ──────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  'Show me the top 10 rows from any table',
  'What tables do we have?',
  'How many rows are in each table?',
];

const AssistantPanel = ({ onClose }) => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const {
    agentState, isListening, interimTranscript, toggleListening,
  } = useAIAgent();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── Effects ──────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (isListening && interimTranscript) setInputValue(interimTranscript);
  }, [interimTranscript, isListening]);

  // ── Actions ──────────────────────────────────────────────────

  const lastMsg = state.messages[state.messages.length - 1];
  const isGenerating = lastMsg?.role === 'assistant' && (lastMsg.status === 'generating' || lastMsg.status === 'executing');

  const runChat = useCallback(async (text) => {
    // Build compact history of prior completed turns (strings, as backend expects)
    const history = state.messages
      .filter(m => m.status === 'complete' && (m.content || m.sql))
      .map(m => m.role === 'user' ? m.content : (m.reasoning || m.content || ''));

    await ChatService.sendMessage({
      text,
      conversationHistory: [text, ...history],
      onEvent: (event) => {
        switch (event.type) {
          case 'stage':       dispatch({ type: 'STAGE', stage: event.stage }); break;
          case 'sql_ready':   dispatch({ type: 'SQL_READY', ...event }); break;
          case 'result_ready':dispatch({ type: 'RESULT_READY', ...event }); break;
          case 'error':       dispatch({ type: 'ERROR', message: event.message, reasoning: event.reasoning }); break;
          case 'exec_error':  dispatch({ type: 'EXEC_ERROR', ...event }); break;
          case 'stopped':     dispatch({ type: 'STOPPED' }); break;
          default: /* 'done' is implicit */ break;
        }
      },
    });
  }, [state.messages]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    dispatch({ type: 'USER_SEND', text });
    runChat(text);
  }, [runChat]);

  const handleStop = useCallback(() => {
    ChatService.cancel();
  }, []);

  const handleRegenerate = useCallback(() => {
    const userInput = state.pendingUserInput;
    if (!userInput) return;
    dispatch({ type: 'RESPAWN_ASSISTANT' });
    runChat(userInput);
  }, [state.pendingUserInput, runChat]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const text = inputValue.trim();
    if (!text || isGenerating) return;
    setInputValue('');
    sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClear = () => {
    ChatService.cancel();
    dispatch({ type: 'CLEAR' });
  };

  // ── Result-action handlers (same flow as the old panel) ─────

  const handleOpenInQueryPage = (msg) => {
    navigate('/query/new', {
      state: {
        query: {
          generated_sql: msg.sql,
          nl_query: state.pendingUserInput,
          query_name: state.pendingUserInput ? `AI: ${state.pendingUserInput.substring(0, 40)}` : 'AI Query',
          chart_recommendation: msg.chartRecommendation,
        },
        fromAssistant: true,
        autoExecute: true,
      },
    });
    onClose?.();
  };

  const handleAddToDashboard = async (msg) => {
    const nl = state.pendingUserInput;
    const title = nl ? `AI: ${nl.substring(0, 50)}${nl.length > 50 ? '...' : ''}` : 'AI Dashboard';
    const tileTitle = nl
      ? nl.split(' ').slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'AI Query';

    const dashResp = await DashboardService.createDashboard({ title, description: nl || 'Dashboard created from Actyze AI' });
    if (!dashResp.success || !dashResp.dashboard?.id) return;

    await DashboardService.createTile(dashResp.dashboard.id, {
      title: tileTitle,
      description: nl || null,
      sql_query: msg.sql,
      nl_query: nl || null,
      chart_type: msg.chartRecommendation?.chart_type || 'bar',
      chart_config: msg.chartRecommendation || {},
      position: { x: 0, y: 0, width: 6, height: 2 },
    });
    navigate(`/dashboard/${dashResp.dashboard.id}`);
    onClose?.();
  };

  // ── Render ───────────────────────────────────────────────────

  const statusText = isListening ? 'Listening'
                    : isGenerating ? 'Working'
                    : agentState === AGENT_STATES.ERROR ? 'Error'
                    : 'Ready';

  return (
    <div className={`flex flex-col h-full rounded-xl overflow-hidden border ${
      isDark ? 'bg-[#0a0a0b] border-white/10' : 'bg-white border-gray-200'
    }`}>

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#5d6ad3]" />
          <div>
            <h3 className={`text-[13px] font-semibold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>Actyze AI</h3>
            <p className={`text-[10px] mt-1 leading-none ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{statusText}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={handleClear}
            title="Clear conversation"
            className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button onClick={onClose}
            title="Close"
            className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {state.messages.length === 0 ? (
          <div className="h-full flex flex-col justify-center">
            <p className={`text-[13px] font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Ask anything about your data.</p>
            <p className={`text-[11px] mt-1 mb-3 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>I can generate SQL, run it, and explain the result.</p>
            <div className="flex flex-col gap-1.5">
              {STARTER_PROMPTS.map(p => (
                <button key={p} onClick={() => sendMessage(p)}
                  className={`text-left text-[12px] px-2.5 py-1.5 rounded-md border transition-colors ${
                    isDark
                      ? 'border-white/10 text-gray-400 hover:text-white hover:border-white/20 hover:bg-white/5'
                      : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          state.messages.map(msg => (
            <MessageBlock
              key={msg.id}
              msg={msg}
              onStop={handleStop}
              onRegenerate={handleRegenerate}
              onOpenInQueryPage={handleOpenInQueryPage}
              onAddToDashboard={handleAddToDashboard}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className={`border-t px-3 py-2.5 ${isDark ? 'border-white/10 bg-[#0a0a0b]' : 'border-gray-200 bg-white'}`}>
        {isListening && (
          <div className="flex items-center justify-center gap-2 mb-2">
            <VoiceWaveform isActive color="#5d6ad3" barCount={7} width={60} height={20} />
            <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Listening…</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening…' : 'Message Actyze AI'}
            disabled={isGenerating}
            className={`flex-1 resize-none px-2.5 py-1.5 text-[13px] rounded-md outline-none transition-colors max-h-28 ${
              isDark
                ? 'bg-white/5 text-white placeholder-gray-500 focus:bg-white/[0.07]'
                : 'bg-gray-100 text-gray-900 placeholder-gray-400 focus:bg-gray-50'
            } disabled:opacity-60`}
            style={{ fontFamily: 'inherit' }}
          />

          <button type="button" onClick={toggleListening} disabled={isGenerating}
            title={isListening ? 'Stop listening' : 'Voice input'}
            className={`p-1.5 rounded-md transition-colors ${
              isListening ? 'bg-[#5d6ad3] text-white'
              : isDark ? 'text-gray-500 hover:text-white hover:bg-white/5'
                       : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
            } disabled:opacity-40`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          {isGenerating ? (
            <button type="button" onClick={handleStop}
              title="Stop generating"
              className="p-1.5 rounded-md bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>
          ) : (
            <button type="submit" disabled={!inputValue.trim()}
              title="Send"
              className={`p-1.5 rounded-md transition-colors ${
                inputValue.trim()
                  ? 'bg-[#5d6ad3] text-white hover:bg-[#4f5bc4]'
                  : isDark ? 'bg-white/5 text-gray-600' : 'bg-gray-100 text-gray-400'
              }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default AssistantPanel;
