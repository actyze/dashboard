import { useState, useCallback, useEffect } from 'react';

// Storage key prefix for localStorage
const STORAGE_PREFIX = 'conversationHistory_';

/**
 * Get the localStorage key for a query ID
 */
const getStorageKey = (queryId) => `${STORAGE_PREFIX}${queryId || 'new'}`;

/**
 * Load conversation history from localStorage
 */
const loadFromStorage = (queryId) => {
  try {
    const key = getStorageKey(queryId);
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : [];
    return parsed;
  } catch (e) {
    console.error('Failed to load conversation history from storage:', e);
    return [];
  }
};

/**
 * Save conversation history to localStorage
 */
const saveToStorage = (queryId, history) => {
  try {
    const key = getStorageKey(queryId);
    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save conversation history to storage:', e);
  }
};

/**
 * Hook to manage conversation history per query ID.
 * Uses localStorage for persistence, scoped by query ID.
 * Each query page has its own isolated conversation history.
 * 
 * Each message contains:
 * - content: The message content
 * - timestamp: When the message was sent
 * - role: 'user' or 'assistant'
 * 
 * @param {string} queryId - The unique query ID (from URL params)
 * @returns {object} - { conversationHistory, addUserMessage, addBotMessage, clearHistory }
 */
export const useConversationHistory = (queryId) => {
  const safeQueryId = queryId || 'new';
  
  // State to hold conversation history - initialized from localStorage
  const [conversationHistory, setConversationHistory] = useState(() => loadFromStorage(safeQueryId));
  
  // Reload from localStorage when queryId changes
  useEffect(() => {
    const history = loadFromStorage(safeQueryId);
    setConversationHistory(history);
  }, [safeQueryId]);
  
  // Add a user message to the conversation history
  const addUserMessage = useCallback((message) => {
    if (!message || typeof message !== 'string' || !message.trim()) return;
    
    const trimmedMessage = message.trim();
    
    setConversationHistory(currentHistory => {
      // Don't add duplicate user messages (check if the same message already exists)
      const existingIndex = currentHistory.findIndex(
        m => m.content === trimmedMessage && m.role === 'user'
      );
      
      let updatedHistory;
      if (existingIndex !== -1) {
        // Move existing message to the front (most recent)
        const existing = currentHistory[existingIndex];
        updatedHistory = [
          { ...existing, timestamp: Date.now() },
          ...currentHistory.slice(0, existingIndex),
          ...currentHistory.slice(existingIndex + 1)
        ];
      } else {
        // Add new message at the front
        updatedHistory = [
          { content: trimmedMessage, timestamp: Date.now(), role: 'user' },
          ...currentHistory
        ];
      }
      
      // Limit to 40 messages (20 user + 20 bot approximately)
      updatedHistory = updatedHistory.slice(0, 40);
      
      // Persist to storage
      saveToStorage(safeQueryId, updatedHistory);
      
      return updatedHistory;
    });
  }, [safeQueryId]);
  
  // Add a bot/assistant message to the conversation history
  const addBotMessage = useCallback((message) => {
    if (!message || typeof message !== 'string' || !message.trim()) return;
    
    const trimmedMessage = message.trim();
    
    setConversationHistory(currentHistory => {
      // Add bot message at the front (no duplicate check for bot messages)
      const updatedHistory = [
        { content: trimmedMessage, timestamp: Date.now(), role: 'assistant' },
        ...currentHistory
      ];
      
      // Limit to 40 messages
      const limitedHistory = updatedHistory.slice(0, 40);
      
      // Persist to storage
      saveToStorage(safeQueryId, limitedHistory);
      
      return limitedHistory;
    });
  }, [safeQueryId]);
  
  // Clear all conversation history for this query ID
  const clearHistory = useCallback(() => {
    setConversationHistory([]);
    saveToStorage(safeQueryId, []);
  }, [safeQueryId]);
  
  return {
    conversationHistory,
    addUserMessage,
    addBotMessage,
    clearHistory
  };
};

export default useConversationHistory;

