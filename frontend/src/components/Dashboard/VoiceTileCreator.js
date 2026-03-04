import React, { useState, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useVoiceRecognition } from '../../hooks';
import { VoiceWaveform } from '../VoiceAI';
import DashboardAgentService from '../../services/DashboardAgentService';

/**
 * VoiceTileCreator - Button to create dashboard tiles via voice
 */
const VoiceTileCreator = ({ dashboardId, existingTilesCount = 0, onTileCreated }) => {
  const { isDark } = useTheme();
  const [status, setStatus] = useState('idle'); // idle, listening, processing, success, error
  const [error, setError] = useState(null);

  const handleVoiceResult = useCallback(async (transcript) => {
    if (!transcript.trim()) return;
    
    setStatus('processing');
    setError(null);

    try {
      const result = await DashboardAgentService.createTileFromNL(
        transcript, 
        dashboardId, 
        existingTilesCount
      );

      if (result.success) {
        setStatus('success');
        onTileCreated?.(result.tile);
        
        // Reset after success
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setError(result.error || 'Failed to create tile');
        setStatus('error');
        setTimeout(() => {
          setStatus('idle');
          setError(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Voice tile creation error:', err);
      setError(err.message || 'An error occurred');
      setStatus('error');
      setTimeout(() => {
        setStatus('idle');
        setError(null);
      }, 3000);
    }
  }, [dashboardId, existingTilesCount, onTileCreated]);

  const {
    isListening,
    isSupported,
    startListening,
    stopListening,
  } = useVoiceRecognition({
    onResult: handleVoiceResult,
    autoSubmit: true,
  });

  const handleClick = () => {
    if (isListening) {
      stopListening();
      setStatus('idle');
    } else {
      setStatus('listening');
      startListening();
    }
  };

  if (!isSupported) {
    return null;
  }

  const getButtonContent = () => {
    switch (status) {
      case 'listening':
        return (
          <>
            <VoiceWaveform isActive={true} color="#fff" barCount={5} width={24} height={16} />
            <span>Listening...</span>
          </>
        );
      case 'processing':
        return (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <span>Creating...</span>
          </>
        );
      case 'success':
        return (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Created!</span>
          </>
        );
      case 'error':
        return (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Try again</span>
          </>
        );
      default:
        return (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span>Voice Tile</span>
          </>
        );
    }
  };

  const getButtonColor = () => {
    switch (status) {
      case 'listening':
        return 'bg-red-500 hover:bg-red-600';
      case 'processing':
        return 'bg-amber-500';
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-violet-500 hover:bg-violet-600';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={status === 'processing'}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg
          text-white transition-colors
          ${getButtonColor()}
          ${status === 'processing' ? 'cursor-wait' : ''}
        `}
        title={status === 'idle' ? 'Click to speak and create a tile' : ''}
      >
        {getButtonContent()}
      </button>
      
      {/* Error tooltip */}
      {error && (
        <div className={`
          absolute bottom-full right-0 mb-2 px-3 py-2 rounded-lg text-xs max-w-[200px]
          ${isDark ? 'bg-red-900/90 text-red-100' : 'bg-red-100 text-red-800'}
        `}>
          {error}
        </div>
      )}
    </div>
  );
};

export default VoiceTileCreator;
