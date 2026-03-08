/**
 * VoiceService - Voice Recognition Service
 * Supports Web Speech API (default) and OpenAI Whisper API (premium)
 */

class VoiceServiceClass {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onStartCallback = null;
    this.onEndCallback = null;
    this.onInterimCallback = null;
    this.provider = 'webSpeech'; // 'webSpeech' or 'whisper'
    this.whisperApiKey = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.wakeWordEnabled = false;
    this.wakeWord = 'hey actyze';
    this.continuousMode = false;
    this.inputMode = 'tap'; // 'tap', 'push', 'wake', 'continuous'
    this.userInitiated = false; // Track if listening was user-initiated
  }

  /**
   * Initialize Web Speech API
   */
  _initWebSpeech() {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.onStartCallback?.();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.userInitiated = false;
      this.onEndCallback?.();
    };

    this.recognition.onresult = (event) => {
      if (!this.userInitiated) {
        return;
      }
      
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        this.onInterimCallback?.(interimTranscript);
      }

      if (finalTranscript) {
        this.onResultCallback?.(finalTranscript.trim(), { confidence: event.results[0]?.[0]?.confidence || 1 });
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      this.userInitiated = false;
      
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.onErrorCallback?.(event.error);
      }
    };
  }

  /**
   * Check if Web Speech API is supported
   */
  isWebSpeechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  /**
   * Register callbacks
   */
  onResult(callback) {
    this.onResultCallback = callback;
  }

  onError(callback) {
    this.onErrorCallback = callback;
  }

  onStart(callback) {
    this.onStartCallback = callback;
  }

  onEnd(callback) {
    this.onEndCallback = callback;
  }

  onInterim(callback) {
    this.onInterimCallback = callback;
  }

  /**
   * Start listening - only call this from user-initiated events (click handlers)
   */
  async startListening() {
    this.userInitiated = true;
    return this._startWebSpeech();
  }

  /**
   * Start Web Speech API listening
   */
  _startWebSpeech() {
    if (!this.recognition) {
      this._initWebSpeech();
    }

    if (!this.recognition) {
      this.onErrorCallback?.('Speech recognition not supported');
      return;
    }

    if (this.isListening) {
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
    }
  }

  /**
   * Stop listening
   */
  stopListening() {
    this.userInitiated = false;
    
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Abort listening (no result)
   */
  abortListening() {
    this.userInitiated = false;
    
    if (this.recognition) {
      this.recognition.abort();
    }
    
    this.isListening = false;
  }

  /**
   * Get current listening state
   */
  getIsListening() {
    return this.isListening;
  }

  /**
   * Set language
   */
  setLanguage(langCode) {
    if (this.recognition) {
      this.recognition.lang = langCode;
    }
  }
}

// Singleton instance
const VoiceService = new VoiceServiceClass();

export default VoiceService;
