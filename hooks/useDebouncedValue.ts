import { useState, useEffect, useRef } from 'react';

/**
 * A hook that returns a debounced version of the value.
 * The value will only update after the delay has passed without the value changing.
 * 
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 200ms)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 200): T {
  // Validate delay
  let safeDelay = delay;
  if (!Number.isFinite(delay) || delay < 0) {
    console.warn(`useDebouncedValue: invalid delay "${delay}", defaulting to 200ms`);
    safeDelay = 200;
  }

  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const delayRef = useRef(safeDelay);

  // Update ref when delay changes, but don't trigger the main effect
  useEffect(() => {
    delayRef.current = safeDelay;
  }, [safeDelay]);

  useEffect(() => {
    // Set a timeout to update the debounced value after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayRef.current);

    // Clean up the timeout if the value changes (or component unmounts)
    // before the delay has passed
    return () => {
      clearTimeout(timer);
    };
  }, [value]);
  // Note: delay is intentionally NOT in dependencies. This means if delay changes
  // while a timer is pending, that timer completes with the old delay value.
  // The new delay only applies to subsequent timers (after value changes again).

  return debouncedValue;
}
