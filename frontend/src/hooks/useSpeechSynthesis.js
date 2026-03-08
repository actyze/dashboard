import { useState, useCallback, useEffect } from 'react';
import TTSService from '../services/TTSService';

/**
 * Hook for text-to-speech functionality
 * TTS is DISABLED by default
 */
const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState([]);
  const [enabled, setEnabled] = useState(false); // Disabled by default

  // Initialize
  useEffect(() => {
    setIsSupported(TTSService.isSupported());
    setEnabled(TTSService.isEnabled());

    // Load voices
    const loadVoices = () => {
      const availableVoices = TTSService.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    
    // Voices may load asynchronously
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Setup callbacks
    TTSService.onStart(() => setIsSpeaking(true));
    TTSService.onEnd(() => setIsSpeaking(false));
    TTSService.onError(() => setIsSpeaking(false));
  }, []);

  /**
   * Enable or disable TTS
   */
  const setTTSEnabled = useCallback((value) => {
    TTSService.setEnabled(value);
    setEnabled(value);
  }, []);

  /**
   * Speak text (only if TTS is enabled)
   */
  const speak = useCallback((text) => {
    TTSService.speak(text);
  }, []);

  /**
   * Stop speaking
   */
  const stop = useCallback(() => {
    TTSService.stop();
  }, []);

  /**
   * Set voice
   */
  const setVoice = useCallback((voice) => {
    TTSService.setVoice(voice);
  }, []);

  return {
    // State
    isSpeaking,
    isSupported,
    voices,
    enabled,
    
    // Actions
    speak,
    stop,
    setVoice,
    setTTSEnabled,
  };
};

export default useSpeechSynthesis;
