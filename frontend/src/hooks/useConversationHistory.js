import { useState, useCallback, useEffect } from 'react';

/**
 * Hook to manage conversation history per query ID.
 * NO PERSISTENCE - conversation history is cleared when navigating away.
 * Each query page starts fresh with empty conversation history.
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
  // State to hold conversation history - always starts empty
  const [conversationHistory, setConversationHistory] = useState([]);
  
  // Clear history when queryId changes (navigating to different query)
  useEffect(() => {
    setConversationHistory([]);
  }, [queryId]);
  
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
      return updatedHistory.slice(0, 40);
    });
  }, []);
  
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
      return updatedHistory.slice(0, 40);
    });
  }, []);
  
  // Clear all conversation history for this query ID
  const clearHistory = useCallback(() => {
    setConversationHistory([]);
  }, []);
  
  return {
    conversationHistory,
    addUserMessage,
    addBotMessage,
    clearHistory
  };
};

export default useConversationHistory;
