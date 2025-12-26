/**
 * Performance Profiler Utility
 * 
 * Lightweight instrumentation for identifying performance hotspots in the
 * import pipeline. Designed to be:
 * - Zero-cost in production (noop when disabled)
 * - Non-invasive (wraps existing functions without changing behavior)
 * - Safe for correctness (timing only, no caching side-effects)
 * 
 * Usage:
 *   import { perfTimer, measureTime, slowParseWarning } from './performanceProfiler';
 *   
 *   // Option 1: Manual timing
 *   const timer = perfTimer('operationName');
 *   // ... do work ...
 *   timer.end();
 *   
 *   // Option 2: Measure a function
 *   const result = measureTime('operationName', () => expensiveOperation());
 *   
 *   // Option 3: Async function
 *   const result = await measureTimeAsync('operationName', async () => await asyncOp());
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Performance profiling is enabled when:
 * - NODE_ENV is not 'production', OR
 * - PERF_PROFILE env var is set to 'true'
 * - import.meta.env.DEV is true (Vite browser builds), OR
 * - VITE_PERF_PROFILE is set to 'true'
 * 
 * This ensures profiling logs don't appear in production builds.
 * In browser environments, we check import.meta.env directly so Vite can
 * statically replace env vars at build time.
 */
function checkIsDevMode(): boolean {
  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production' || process.env.PERF_PROFILE === 'true';
  }
  
  // Browser with Vite - use import.meta.env directly so Vite can statically replace it
  // Wrapped in try/catch for environments where import.meta is not available
  try {
    // @ts-expect-error import.meta.env is Vite-specific and may not exist in all environments
    if (import.meta.env) {
      // @ts-expect-error import.meta.env is Vite-specific
      return import.meta.env.DEV === true || import.meta.env.VITE_PERF_PROFILE === 'true';
    }
  } catch {
    // import.meta not available in this environment
  }
  
  // Browser fallback: default to DISABLED in unknown environments
  // This is safer than accidentally enabling profiling in production
  return false;
}

const isDevMode = checkIsDevMode();

/**
 * Threshold in milliseconds above which a "slow operation" warning is logged.
 * Different thresholds for different operation types.
 */
export const SLOW_THRESHOLDS = {
  parse: 500,      // 500ms - parsing should be fast
  validate: 100,   // 100ms - validation is simple checks
  transform: 200,  // 200ms - betToFinalRows transform
  render: 100,     // 100ms - UI render after import
  total: 1000,     // 1s - total import operation
} as const;

type ThresholdKey = keyof typeof SLOW_THRESHOLDS;

// ============================================================================
// TIMING STORAGE
// ============================================================================

interface TimingEntry {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  itemCount?: number;
}

/**
 * Stores timing data for the current session.
 * Limited to last 100 entries to prevent memory growth.
 */
const timingHistory: TimingEntry[] = [];
const MAX_HISTORY = 100;

function addToHistory(entry: TimingEntry): void {
  if (!isDevMode) return;
  
  timingHistory.push(entry);
  if (timingHistory.length > MAX_HISTORY) {
    timingHistory.shift();
  }
}

// ============================================================================
// TIMING FUNCTIONS
// ============================================================================

interface PerfTimer {
  /** End the timer and log the result */
  end: (itemCount?: number) => number;
  /** Get elapsed time without ending */
  elapsed: () => number;
}

/**
 * Creates a performance timer for an operation.
 * In production, returns a noop timer with zero overhead.
 * 
 * @param operation - Name of the operation being timed
 * @returns Timer object with end() method
 */
export function perfTimer(operation: string): PerfTimer {
  if (!isDevMode) {
    // Noop timer for production
    return {
      end: () => 0,
      elapsed: () => 0,
    };
  }

  const startTime = performance.now();
  
  return {
    elapsed: () => performance.now() - startTime,
    end: (itemCount?: number) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const entry: TimingEntry = {
        operation,
        startTime,
        endTime,
        duration,
        itemCount,
      };
      addToHistory(entry);
      
      // Log timing (debug level)
      if (typeof console !== 'undefined') {
        const countStr = itemCount !== undefined ? ` (${itemCount} items)` : '';
        console.debug(`[Perf] ${operation}: ${duration.toFixed(2)}ms${countStr}`);
      }
      
      return duration;
    },
  };
}

/**
 * Measures execution time of a synchronous function.
 * Returns the function's result unchanged.
 * 
 * @param operation - Name of the operation
 * @param fn - Function to measure
 * @returns Result of fn()
 */
export function measureTime<T>(operation: string, fn: () => T): T {
  if (!isDevMode) {
    return fn();
  }
  
  const timer = perfTimer(operation);
  const result = fn();
  timer.end(Array.isArray(result) ? result.length : undefined);
  return result;
}

/**
 * Measures execution time of an async function.
 * Returns the function's result unchanged.
 * 
 * @param operation - Name of the operation
 * @param fn - Async function to measure
 * @returns Promise resolving to result of fn()
 */
export async function measureTimeAsync<T>(
  operation: string, 
  fn: () => Promise<T>
): Promise<T> {
  if (!isDevMode) {
    return fn();
  }
  
  const timer = perfTimer(operation);
  const result = await fn();
  timer.end(Array.isArray(result) ? result.length : undefined);
  return result;
}

// ============================================================================
// SLOW OPERATION WARNINGS
// ============================================================================

/**
 * Checks if an operation was slow and logs a warning if so.
 * Only logs in dev mode.
 * 
 * @param operation - Name of the operation
 * @param durationMs - Duration in milliseconds
 * @param thresholdKey - Which threshold to use (defaults to 'total')
 */
export function checkSlowOperation(
  operation: string,
  durationMs: number,
  thresholdKey: ThresholdKey = 'total'
): void {
  if (!isDevMode) return;
  
  const threshold = SLOW_THRESHOLDS[thresholdKey];
  if (durationMs > threshold) {
    console.warn(
      `[Perf Warning] ${operation} took ${durationMs.toFixed(2)}ms ` +
      `(threshold: ${threshold}ms). Consider optimization.`
    );
  }
}

/**
 * Convenience function specifically for slow parse warnings.
 * Uses the 'parse' threshold.
 * 
 * @param durationMs - Parse duration in milliseconds
 * @param betCount - Number of bets parsed
 */
export function slowParseWarning(durationMs: number, betCount: number): void {
  if (!isDevMode) return;
  
  if (durationMs > SLOW_THRESHOLDS.parse) {
    console.warn(
      `[Perf Warning] Parsing ${betCount} bets took ${durationMs.toFixed(2)}ms ` +
      `(threshold: ${SLOW_THRESHOLDS.parse}ms). ` +
      `Average: ${(durationMs / betCount).toFixed(2)}ms/bet.`
    );
  }
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Returns timing history for diagnostics.
 * Only available in dev mode.
 */
export function getTimingHistory(): readonly TimingEntry[] {
  if (!isDevMode) return [];
  return [...timingHistory];
}

/**
 * Clears timing history.
 * Useful for testing or starting fresh measurements.
 */
export function clearTimingHistory(): void {
  timingHistory.length = 0;
}

/**
 * Returns a summary of recent timings by operation type.
 * Useful for identifying patterns.
 */
export function getTimingSummary(): Record<string, {
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  minMs: number;
}> {
  if (!isDevMode) return {};
  
  const summary: Record<string, {
    count: number;
    totalMs: number;
    maxMs: number;
    minMs: number;
    avgMs: number;
  }> = {};
  
  for (const entry of timingHistory) {
    if (entry.duration === undefined) continue;
    
    if (!summary[entry.operation]) {
      summary[entry.operation] = {
        count: 0,
        totalMs: 0,
        maxMs: 0,
        minMs: Infinity,
        avgMs: 0,
      };
    }
    
    const s = summary[entry.operation];
    s.count++;
    s.totalMs += entry.duration;
    s.maxMs = Math.max(s.maxMs, entry.duration);
    s.minMs = Math.min(s.minMs, entry.duration);
  }
  
  // Calculate averages
  for (const op of Object.keys(summary)) {
    const s = summary[op];
    s.avgMs = s.count > 0 ? s.totalMs / s.count : 0;
    if (s.minMs === Infinity) s.minMs = 0;
  }
  
  return summary;
}

/**
 * Logs a formatted summary of timing data.
 * Useful for debugging performance issues.
 */
export function logTimingSummary(): void {
  if (!isDevMode) return;
  
  const summary = getTimingSummary();
  const operations = Object.keys(summary).sort();
  
  if (operations.length === 0) {
    console.log('[Perf Summary] No timing data collected');
    return;
  }
  
  console.group('[Perf Summary]');
  for (const op of operations) {
    const s = summary[op];
    console.log(
      `${op}: ${s.count} calls, avg ${s.avgMs.toFixed(2)}ms, ` +
      `total ${s.totalMs.toFixed(2)}ms, max ${s.maxMs.toFixed(2)}ms`
    );
  }
  console.groupEnd();
}
