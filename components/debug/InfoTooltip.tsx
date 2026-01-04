/**
 * InfoTooltip - Simple hover tooltip for displaying explanatory text
 * 
 * Used for micro-explainers throughout the Dashboard UI.
 */

import React, { useState } from 'react';

interface InfoTooltipProps {
  text: string;
  /** Position of tooltip relative to icon */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Additional classes for the container */
  className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  text,
  position = 'top',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  // Position classes for the tooltip popup
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  // Use position:absolute within a zero-dimension inline container to avoid
  // affecting document flow or flex gaps. The icon floats visibly via overflow.
  return (
    <span
      className={`${className}`}
      style={{
        display: 'inline',
        position: 'relative',
        width: 0,
        height: 0,
        overflow: 'visible',
        verticalAlign: 'middle',
        marginLeft: '0.5rem',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {/* Info icon */}
        <span
          className="w-4 h-4 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 inline-flex items-center justify-center text-[10px] font-bold cursor-help hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
          aria-label="More information"
        >
          i
        </span>

        {/* Tooltip popup */}
        {isVisible && (
          <span
            className={`absolute ${positionClasses[position]} z-50 px-2 py-1.5 text-xs text-white bg-neutral-800 dark:bg-neutral-950 rounded shadow-lg whitespace-nowrap max-w-xs`}
            style={{ whiteSpace: 'normal', width: 'max-content', maxWidth: '200px' }}
            role="tooltip"
          >
            {text}
          </span>
        )}
      </span>
    </span>
  );
};

export default InfoTooltip;
