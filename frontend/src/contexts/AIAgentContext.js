import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import VoiceService from '../services/VoiceService';
import TTSService from '../services/TTSService';
import DashboardAgentService from '../services/DashboardAgentService';

const AIAgentContext = createContext(null);

// Agent states
export const AGENT_STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  ERROR: 'error',
};

export const AIAgentProvider = ({ children }) => {
  // Agent state
  const [isAgentActive, setIsAgentActive] = useState(false);
  const [agentState, setAgentState] = useState(AGENT_STATES.IDLE);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  
  // Conversation
  const [messages, setMessages] = useState([]);
  
  // Preferences - TTS is DISABLED by default
  const [preferences, setPreferences] = useState({
    ttsEnabled: false, // AI will NOT speak responses by default
    voiceInputEnabled: true,
    autoSubmit: true,
  });

  // Ref to track if we should auto-process voice result
  const shouldAutoProcessRef = useRef(true);

  // Setup voice service callbacks - only once on mount
  useEffect(() => {
    VoiceService.onStart(() => {
      setIsListening(true);
      setAgentState(AGENT_STATES.LISTENING);
      setInterimTranscript('');
      setFinalTranscript('');
    });

    VoiceService.onEnd(() => {
      setIsListening(false);
      setInterimTranscript('');
    });

    VoiceService.onInterim((transcript) => {
      setInterimTranscript(transcript);
    });

    // IMPORTANT: Handle final voice result
    VoiceService.onResult((transcript) => {
      console.log('Voice result received:', transcript);
      setFinalTranscript(transcript);
      setInterimTranscript('');
      
      // Auto-process the voice result
      if (transcript && shouldAutoProcessRef.current) {
        // We'll handle this in a separate effect
      }
    });

    VoiceService.onError((error) => {
      console.error('Voice error:', error);
      setIsListening(false);
      setInterimTranscript('');
      setAgentState(AGENT_STATES.ERROR);
      setTimeout(() => setAgentState(AGENT_STATES.IDLE), 2000);
    });

    // TTS callbacks
    TTSService.onStart(() => {
      setIsSpeaking(true);
      setAgentState(AGENT_STATES.SPEAKING);
    });

    TTSService.onEnd(() => {
      setIsSpeaking(false);
      setAgentState(AGENT_STATES.IDLE);
    });

    // Ensure TTS is disabled by default
    TTSService.setEnabled(false);
    
    // Cleanup
    return () => {
      VoiceService.onResult(null);
      VoiceService.onStart(null);
      VoiceService.onEnd(null);
      VoiceService.onInterim(null);
      VoiceService.onError(null);
    };
  }, []); // Empty dependency - only run once

  /**
   * Toggle agent active state
   */
  const toggleAgent = useCallback(() => {
    setIsAgentActive(prev => {
      if (prev) {
        // Deactivating - stop everything
        VoiceService.abortListening();
        TTSService.stop();
        setAgentState(AGENT_STATES.IDLE);
      }
      return !prev;
    });
  }, []);

  /**
   * Start listening
   */
  const startListening = useCallback(() => {
    VoiceService.startListening();
  }, []);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    VoiceService.stopListening();
  }, []);

  /**
   * Toggle listening
   */
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  /**
   * Speak text (only if TTS is enabled in preferences)
   */
  const speak = useCallback((text) => {
    if (preferences.ttsEnabled) {
      TTSService.speak(text);
    }
  }, [preferences.ttsEnabled]);

  /**
   * Stop speaking
   */
  const stopSpeaking = useCallback(() => {
    TTSService.stop();
  }, []);

  /**
   * Add a message to the conversation
   */
  const addMessage = useCallback((content, role = 'user', metadata = {}) => {
    const message = {
      id: Date.now().toString(),
      content,
      role,
      timestamp: new Date().toISOString(),
      ...metadata,
    };
    setMessages(prev => [...prev, message]);
    return message;
  }, []);

  /**
   * Process user input
   */
  const processInput = useCallback(async (input, context = {}) => {
    // Add user message
    addMessage(input, 'user');
    
    setAgentState(AGENT_STATES.PROCESSING);
    
    try {
      console.log('AIAgentContext: Processing input:', input);
      const result = await DashboardAgentService.processMessage(input, context);
      console.log('AIAgentContext: Result from DashboardAgentService:', result);
      
      // Add assistant response with results
      if (result.response) {
        addMessage(result.response, 'assistant', {
          sql: result.sql,
          reasoning: result.reasoning,
          nlQuery: result.nlQuery || input,
          queryResults: result.queryResults,
          chartData: result.chartData,
          chartRecommendation: result.chartRecommendation,
          canOpenInQueryPage: result.canOpenInQueryPage,
        });
        
        // Speak response only if TTS is enabled
        if (preferences.ttsEnabled) {
          speak(result.response);
        }
      } else if (result.error) {
        // Handle error response from DashboardAgentService
        addMessage(result.error || 'An error occurred', 'assistant', { error: true });
      }
      
      setAgentState(AGENT_STATES.IDLE);
      return result;
    } catch (error) {
      console.error('AIAgentContext: Error processing input:', error);
      const errorMessage = `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`;
      addMessage(errorMessage, 'assistant', { error: true });
      setAgentState(AGENT_STATES.ERROR);
      setTimeout(() => setAgentState(AGENT_STATES.IDLE), 2000);
      return { success: false, error: error.message };
    }
  }, [addMessage, speak, preferences.ttsEnabled]);

  /**
   * Update preferences
   */
  const updatePreferences = useCallback((newPrefs) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPrefs };
      // Update TTS service
      TTSService.setEnabled(updated.ttsEnabled);
      return updated;
    });
  }, []);

  /**
   * Clear conversation
   */
  const clearConversation = useCallback(() => {
    setMessages([]);
    DashboardAgentService.clearHistory();
  }, []);

  // Auto-process voice result when finalTranscript changes
  useEffect(() => {
    if (finalTranscript && preferences.autoSubmit) {
      // Auto-submit the voice transcript
      processInput(finalTranscript);
      setFinalTranscript(''); // Clear after processing
    }
  }, [finalTranscript, preferences.autoSubmit, processInput]);

  const value = {
    // State
    isAgentActive,
    agentState,
    isListening,
    isSpeaking,
    interimTranscript,
    finalTranscript,
    messages,
    preferences,
    
    // Actions
    toggleAgent,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    addMessage,
    processInput,
    updatePreferences,
    clearConversation,
    
    // Constants
    AGENT_STATES,
  };

  return (
    <AIAgentContext.Provider value={value}>
      {children}
    </AIAgentContext.Provider>
  );
};

export const useAIAgent = () => {
  const context = useContext(AIAgentContext);
  if (!context) {
    throw new Error('useAIAgent must be used within an AIAgentProvider');
  }
  return context;
};

export default AIAgentContext;
