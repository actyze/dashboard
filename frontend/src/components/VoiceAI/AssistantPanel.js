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
  messages: [],        // { id, role, content, status, sql?, reasoning?, chartRecommendation?, errorMessage?, dashboardPlan? }
  generating: false,   // true => show typing indicator
};

function reducer(state, action) {
  switch (action.type) {
    case 'USER_SEND': {
      const userMsg = { id: uid(), role: 'user', content: action.text, status: 'complete' };
      return {
        ...state,
        messages: [...state.messages, userMsg],
        generating: true,
      };
    }
    case 'SQL_READY': {
      const asstMsg = {
        id: uid(),
        role: 'assistant',
        content: action.reasoning || '',
        sql: action.sql,
        reasoning: action.reasoning,
        chartRecommendation: action.chartRecommendation,
        status: 'complete',
      };
      return { ...state, messages: [...state.messages, asstMsg], generating: false };
    }
    case 'DASHBOARD_READY': {
      const asstMsg = {
        id: uid(),
        role: 'assistant',
        content: action.reasoning || '',
        dashboardPlan: { title: action.title, tiles: action.tiles },
        status: 'complete',
      };
      return { ...state, messages: [...state.messages, asstMsg], generating: false };
    }
    case 'ERROR': {
      const asstMsg = {
        id: uid(),
        role: 'assistant',
        content: action.reasoning || '',
        status: 'error',
        errorMessage: action.message,
      };
      return { ...state, messages: [...state.messages, asstMsg], generating: false };
    }
    case 'STOPPED':
      return { ...state, generating: false };
    case 'REGEN_START': {
      // Drop trailing assistant message; keep user msg for re-run
      const msgs = [...state.messages];
      if (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
      return { ...state, messages: msgs, generating: true };
    }
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
}

// ── Typing indicator ───────────────────────────────────────────────────

const TypingIndicator = () => {
  const { isDark } = useTheme();
  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md ${isDark ? 'bg-white/[0.03]' : 'bg-gray-100'}`}>
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#5d6ad3] animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#5d6ad3] animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#5d6ad3] animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Thinking…</span>
    </div>
  );
};

// ── Panel ──────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  {
    text: 'Show me the top 10 rows from any table',
    hint: 'Quick query',
    icon: 'M3 10h18M3 14h18M3 6h18M3 18h18', // four horizontal rows
  },
  {
    text: 'Create a dashboard for sales',
    hint: 'Multi-tile dashboard',
    icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 12a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z',
  },
  {
    text: 'What tables do we have?',
    hint: 'Explore the schema',
    icon: 'M4 7h16M4 12h16M4 17h10', // stacked lines
  },
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, state.generating]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (isListening && interimTranscript) setInputValue(interimTranscript);
  }, [interimTranscript, isListening]);

  // ── Chat actions ───────────────────────────────────────────

  // History passed explicitly so regenerate can compute the correct prior
  // context (after dropping the stale assistant message) without racing
  // with dispatch.
  const buildHistory = (msgs) => msgs
    .filter(m => m.status === 'complete' && (m.content || m.sql))
    .map(m => m.role === 'user' ? m.content : (m.reasoning || m.content || ''));

  const runChat = useCallback(async (text, history) => {
    await ChatService.sendMessage({
      text,
      conversationHistory: history,
      onEvent: (event) => {
        switch (event.type) {
          case 'sql_ready':
            dispatch({
              type: 'SQL_READY',
              sql: event.sql,
              reasoning: event.reasoning,
              chartRecommendation: event.chartRecommendation,
            });
            break;
          case 'dashboard_ready':
            dispatch({
              type: 'DASHBOARD_READY',
              title: event.title,
              tiles: event.tiles,
              reasoning: event.reasoning,
            });
            break;
          case 'error':
            dispatch({ type: 'ERROR', message: event.message, reasoning: event.reasoning });
            break;
          case 'stopped':
            dispatch({ type: 'STOPPED' });
            break;
          default: /* 'done' implicit */ break;
        }
      },
    });
  }, []);

  const sendMessage = useCallback((text) => {
    if (!text.trim() || state.generating) return;
    const history = buildHistory(state.messages); // prior messages only
    dispatch({ type: 'USER_SEND', text });
    runChat(text, history);
  }, [runChat, state.generating, state.messages]);

  const handleStop = useCallback(() => {
    ChatService.cancel();
  }, []);

  const handleRegenerate = useCallback(() => {
    // Drop the stale assistant from our local copy, then find the triggering
    // user message — that's what we re-send, regardless of how many turns
    // have happened. Avoids relying on pendingUserInput (which was frozen
    // to the first send of the session).
    const msgs = [...state.messages];
    if (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
    const lastUserIdx = [...msgs].reverse().findIndex(m => m.role === 'user');
    if (lastUserIdx === -1) return;
    const userMsg = msgs[msgs.length - 1 - lastUserIdx];
    const priorMsgs = msgs.slice(0, msgs.length - 1 - lastUserIdx);
    const history = buildHistory(priorMsgs);
    dispatch({ type: 'REGEN_START' });
    runChat(userMsg.content, history);
  }, [state.messages, runChat]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    const text = inputValue.trim();
    if (!text || state.generating) return;
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

  // ── Single-query post-actions ──────────────────────────────

  // Find the user message that preceded this assistant message in the transcript.
  const precedingUserText = (assistantMsg) => {
    const idx = state.messages.findIndex(m => m.id === assistantMsg.id);
    for (let i = idx - 1; i >= 0; i--) {
      if (state.messages[i].role === 'user') return state.messages[i].content;
    }
    return null;
  };

  const handleOpenInQueryPage = (msg) => {
    const nl = precedingUserText(msg);
    navigate('/query/new', {
      state: {
        query: {
          generated_sql: msg.sql,
          nl_query: nl,
          query_name: nl ? `AI: ${nl.substring(0, 40)}` : 'AI Query',
          chart_recommendation: msg.chartRecommendation,
        },
        fromAssistant: true,
        autoExecute: true,
      },
    });
    onClose?.();
  };

  const handleAddToDashboard = async (msg) => {
    const nl = precedingUserText(msg);
    const title = nl ? `AI: ${nl.substring(0, 50)}${nl.length > 50 ? '...' : ''}` : 'AI Dashboard';
    const tileTitle = nl
      ? nl.split(' ').slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : 'AI Query';

    const dashResp = await DashboardService.createDashboard({ title, description: nl || 'Dashboard created from Actyze AI' });
    if (!dashResp.success || !dashResp.dashboard?.id) {
      console.error('Failed to create dashboard:', dashResp.error);
      return;
    }

    const tileResp = await DashboardService.createTile(dashResp.dashboard.id, {
      title: tileTitle,
      description: nl || null,
      sql_query: msg.sql,
      nl_query: nl || null,
      chart_type: msg.chartRecommendation?.chart_type || 'bar',
      chart_config: msg.chartRecommendation || {},
      position: { x: 0, y: 0, width: 6, height: 2 },
    });
    if (!tileResp?.success) {
      console.error('Failed to create tile:', tileResp?.error);
      // Dashboard was created; still navigate so the user lands somewhere coherent.
    }
    navigate(`/dashboard/${dashResp.dashboard.id}`);
    onClose?.();
  };

  const handleDashboardCreated = (dashboardId) => {
    navigate(`/dashboard/${dashboardId}`);
    onClose?.();
  };

  // ── Render ─────────────────────────────────────────────────

  const statusText = isListening ? 'Listening'
                    : state.generating ? 'Thinking'
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
          <button onClick={handleClear} title="Clear conversation"
            className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          <button onClick={onClose} title="Close"
            className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {state.messages.length === 0 && !state.generating ? (
          <div className="h-full flex flex-col justify-center">
            <p className={`text-[15px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Ask anything about your data.</p>
            <p className={`text-[12px] mt-1 mb-4 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Generate a SQL query — or build an entire dashboard.</p>
            <div className={`text-[10px] font-medium uppercase tracking-wider mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Try asking</div>
            <div className="flex flex-col gap-1">
              {STARTER_PROMPTS.map(p => (
                <button key={p.text} onClick={() => sendMessage(p.text)}
                  className={`group relative flex items-center gap-3 w-full pl-3 pr-2.5 py-2.5 rounded-lg text-left transition-all ${
                    isDark
                      ? 'hover:bg-white/[0.04]'
                      : 'hover:bg-gray-50'
                  }`}>
                  <span aria-hidden className={`absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full transition-all ${
                    isDark ? 'bg-[#5d6ad3]/0 group-hover:bg-[#5d6ad3]' : 'bg-[#5d6ad3]/0 group-hover:bg-[#5d6ad3]'
                  }`} />
                  <span className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                    isDark
                      ? 'bg-white/[0.04] text-gray-400 group-hover:text-[#5d6ad3]'
                      : 'bg-gray-100 text-gray-500 group-hover:text-[#5d6ad3] group-hover:bg-[#5d6ad3]/10'
                  }`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={p.icon} />
                    </svg>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[13px] leading-snug ${isDark ? 'text-gray-200 group-hover:text-white' : 'text-gray-800 group-hover:text-gray-900'}`}>
                      {p.text}
                    </span>
                    <span className={`block text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      {p.hint}
                    </span>
                  </span>
                  <svg className={`flex-shrink-0 w-3 h-3 transition-all translate-x-0 group-hover:translate-x-0.5 ${
                    isDark ? 'text-gray-600 group-hover:text-[#5d6ad3]' : 'text-gray-400 group-hover:text-[#5d6ad3]'
                  }`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {state.messages.map(msg => (
              <MessageBlock
                key={msg.id}
                msg={msg}
                onRegenerate={handleRegenerate}
                onOpenInQueryPage={handleOpenInQueryPage}
                onAddToDashboard={handleAddToDashboard}
                onDashboardCreated={handleDashboardCreated}
              />
            ))}
            {state.generating && (
              <div className="flex justify-start"><TypingIndicator /></div>
            )}
          </>
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
            disabled={state.generating}
            className={`flex-1 resize-none px-2.5 py-1.5 text-[13px] rounded-md outline-none transition-colors max-h-28 ${
              isDark
                ? 'bg-white/5 text-white placeholder-gray-500 focus:bg-white/[0.07]'
                : 'bg-gray-100 text-gray-900 placeholder-gray-400 focus:bg-gray-50'
            } disabled:opacity-60`}
            style={{ fontFamily: 'inherit' }}
          />

          <button type="button" onClick={toggleListening} disabled={state.generating}
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

          {state.generating ? (
            <button type="button" onClick={handleStop} title="Stop generating"
              className="p-1.5 rounded-md bg-[#5d6ad3] text-white hover:bg-[#4f5bc4] transition-colors">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
            </button>
          ) : (
            <button type="submit" disabled={!inputValue.trim()} title="Send"
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
