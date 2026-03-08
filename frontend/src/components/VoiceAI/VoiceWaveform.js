import React, { useState, useEffect, useRef } from 'react';

/**
 * VoiceWaveform - Visual feedback for voice input
 * Shows animated bars when active (listening or speaking)
 */
const VoiceWaveform = ({ isActive = false, color = '#8B5CF6', barCount = 5, width = 40, height = 24 }) => {
  const [heights, setHeights] = useState(Array(barCount).fill(0.3));
  const animationRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      setHeights(Array(barCount).fill(0.3));
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
      return;
    }

    // Simulated waveform animation
    const animateSimulated = () => {
      if (!isActive) return;
      
      const newHeights = Array(barCount).fill(0).map(() => {
        return 0.3 + Math.random() * 0.7;
      });
      setHeights(newHeights);
      
      animationRef.current = setTimeout(animateSimulated, 100);
    };

    animateSimulated();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isActive, barCount]);

  const barWidth = width / (barCount * 2);
  const gap = barWidth;

  return (
    <div 
      className="flex items-center justify-center gap-0.5"
      style={{ width, height }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-100"
          style={{
            width: barWidth,
            height: `${h * 100}%`,
            backgroundColor: color,
            opacity: isActive ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
};

export default VoiceWaveform;
