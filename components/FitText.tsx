import React, { useLayoutEffect, useRef, useState } from 'react';

export const FitText: React.FC<{
  children: React.ReactNode;
  maxFontSize?: number;
  minFontSize?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, maxFontSize = 30, minFontSize = 12, className, style }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const resize = () => {
      let currentSize = maxFontSize;
      text.style.fontSize = `${currentSize}px`;

      while (
        (text.scrollWidth > container.clientWidth ||
         text.scrollHeight > container.clientHeight) &&
        currentSize > minFontSize
      ) {
        currentSize--;
        text.style.fontSize = `${currentSize}px`;
      }
      setFontSize(currentSize);
    };

    resize();
    
    // Create observer to handle window resize or container resize
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [children, maxFontSize, minFontSize]);

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full flex items-center overflow-hidden ${className || ""}`}
      style={style}
    >
      <span 
        ref={textRef} 
        style={{ fontSize: `${fontSize}px`, whiteSpace: 'nowrap', lineHeight: 1.2 }}
        className="" 
      >
        {children}
      </span>
    </div>
  );
};
