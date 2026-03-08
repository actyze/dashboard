import { useState, useCallback, useEffect, useRef } from 'react';
import VoiceService from '../services/VoiceService';

/**
 * Hook for voice recognition functionality
 * @param {Object} options - Configuration options
 * @returns {Object} Voice recognition state and controls
 */
const useVoiceRecognition = (options = {}) => {
  const {
    onResult,
    onInterim,
    onError,
    autoSubmit = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);

  // Keep refs up to date
  useEffect(() => {
    onResultRef.current = onResult;
    onInterimRef.current = onInterim;
    onErrorRef.current = onError;
  }, [onResult, onInterim, onError]);

  // Initialize and check support
  useEffect(() => {
    setIsSupported(VoiceService.isWebSpeechSupported());

    // Setup callbacks
    VoiceService.onResult((text, metadata) => {
      setTranscript(text);
      setInterimTranscript('');
      
      if (autoSubmit) {
        onResultRef.current?.(text, metadata);
      }
    });

    VoiceService.onInterim((text) => {
      setInterimTranscript(text);
      onInterimRef.current?.(text);
    });

    VoiceService.onStart(() => {
      setIsListening(true);
      setError(null);
    });

    VoiceService.onEnd(() => {
      setIsListening(false);
    });

    VoiceService.onError((err) => {
      setError(err);
      setIsListening(false);
      onErrorRef.current?.(err);
    });
  }, [autoSubmit]);

  /**
   * Start listening
   */
  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');
    setInterimTranscript('');
    VoiceService.startListening();
  }, []);

  /**
   * Stop listening
   */
  const stopListening = useCallback(() => {
    VoiceService.stopListening();
  }, []);

  /**
   * Abort listening (discard)
   */
  const abortListening = useCallback(() => {
    VoiceService.abortListening();
    setTranscript('');
    setInterimTranscript('');
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
   * Clear transcript
   */
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    // State
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    
    // Combined transcript for display
    displayTranscript: interimTranscript || transcript,
    
    // Actions
    startListening,
    stopListening,
    abortListening,
    toggleListening,
    clearTranscript,
  };
};

export default useVoiceRecognition;
