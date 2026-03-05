/**
 * TTSService - Text-to-Speech Service
 * TTS is DISABLED by default - set enabled to true to have the AI speak responses
 */

class TTSServiceClass {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
    this.utterance = null;
    this.isSpeaking = false;
    this.onStartCallback = null;
    this.onEndCallback = null;
    this.onErrorCallback = null;
    this.voice = null;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.volume = 1.0;
    
    // TTS is DISABLED by default - user must explicitly enable it
    this.enabled = false;
  }

  /**
   * Check if TTS is supported
   */
  isSupported() {
    return !!this.synth;
  }

  /**
   * Enable or disable TTS
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Check if TTS is enabled
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Register callbacks
   */
  onStart(callback) {
    this.onStartCallback = callback;
  }

  onEnd(callback) {
    this.onEndCallback = callback;
  }

  onError(callback) {
    this.onErrorCallback = callback;
  }

  /**
   * Get available voices
   */
  getVoices() {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  /**
   * Set voice
   */
  setVoice(voice) {
    this.voice = voice;
  }

  /**
   * Set speech rate (0.1 to 10)
   */
  setRate(rate) {
    this.rate = Math.max(0.1, Math.min(10, rate));
  }

  /**
   * Set pitch (0 to 2)
   */
  setPitch(pitch) {
    this.pitch = Math.max(0, Math.min(2, pitch));
  }

  /**
   * Set volume (0 to 1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Speak text - ONLY if TTS is enabled
   */
  speak(text) {
    // If TTS is disabled, don't speak - just return silently
    if (!this.enabled) {
      console.log('TTS disabled - not speaking:', text.substring(0, 50) + '...');
      return;
    }

    if (!this.synth) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    this.stop();

    this.utterance = new SpeechSynthesisUtterance(text);
    
    if (this.voice) {
      this.utterance.voice = this.voice;
    }
    
    this.utterance.rate = this.rate;
    this.utterance.pitch = this.pitch;
    this.utterance.volume = this.volume;

    this.utterance.onstart = () => {
      this.isSpeaking = true;
      this.onStartCallback?.();
    };

    this.utterance.onend = () => {
      this.isSpeaking = false;
      this.onEndCallback?.();
    };

    this.utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      this.isSpeaking = false;
      this.onErrorCallback?.(event.error);
    };

    this.synth.speak(this.utterance);
  }

  /**
   * Stop speaking
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }

  /**
   * Pause speaking
   */
  pause() {
    if (this.synth && this.isSpeaking) {
      this.synth.pause();
    }
  }

  /**
   * Resume speaking
   */
  resume() {
    if (this.synth) {
      this.synth.resume();
    }
  }

  /**
   * Get speaking state
   */
  getIsSpeaking() {
    return this.isSpeaking;
  }
}

// Singleton instance
const TTSService = new TTSServiceClass();

export default TTSService;
