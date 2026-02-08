import React, { useState, useCallback, useRef } from 'react';
import { SqlEditor } from '../Common';
import { useTheme } from '../../contexts/ThemeContext';

const SqlQuery = ({ sqlQuery, setSqlQuery }) => {
  const { isDark } = useTheme();
  const [height, setHeight] = useState(180);
  const containerRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [height]);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    
    const deltaY = e.clientY - startYRef.current;
    const newHeight = Math.max(100, Math.min(600, startHeightRef.current + deltaY));
    setHeight(newHeight);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, []);

  // Attach global listeners for drag
  React.useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className="w-full">
      <SqlEditor
        value={sqlQuery}
        onChange={setSqlQuery}
        height={`${height}px`}
        placeholder="Enter your SQL query here..."
      />
      
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`
          w-full h-2 cursor-ns-resize flex items-center justify-center
          group transition-colors rounded-b-lg -mt-1
          ${isDark ? 'hover:bg-[#2a2b2e]' : 'hover:bg-gray-100'}
        `}
        title="Drag to resize"
      >
        <div className={`
          w-10 h-1 rounded-full transition-colors
          ${isDark 
            ? 'bg-gray-700 group-hover:bg-gray-500' 
            : 'bg-gray-300 group-hover:bg-gray-400'
          }
        `} />
      </div>
    </div>
  );
};

export default SqlQuery;
