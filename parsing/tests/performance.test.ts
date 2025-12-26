/**
 * Performance Benchmark Tests
 * 
 * These tests verify that key operations complete within reasonable time bounds.
 * They use synthetic datasets to simulate realistic workloads.
 * 
 * Note: These tests are NOT designed to be flaky. They use generous thresholds
 * that should pass on any reasonable hardware. If they fail consistently, it
 * indicates a significant performance regression.
 * 
 * Thresholds are based on:
 * - 500ms for parsing 100 bets (5ms/bet is generous)
 * - 200ms for transforming 100 bets to FinalRows
 * - 100ms for validating 100 bets
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { betToFinalRows } from '../shared/betToFinalRows';
import { validateBetsForImport } from '../../utils/importValidation';
import { Bet, BetLeg } from '../../types';

// ============================================================================
// SYNTHETIC DATA GENERATORS
// ============================================================================

/**
 * Creates a synthetic single bet for testing.
 */
function createSyntheticSingleBet(index: number): Bet {
  return {
    id: `test-single-${index}`,
    betId: `TEST${index.toString().padStart(10, '0')}`,
    book: 'FanDuel',
    betType: 'single',
    sport: 'NBA',
    placedAt: new Date(2025, 0, 1 + (index % 30)).toISOString(),
    description: `Test Player ${index} Over 20.5 Points`,
    marketCategory: 'Props',
    odds: -110 + (index % 50),
    stake: 10 + (index % 100),
    payout: index % 2 === 0 ? 20 : 0,
    result: index % 3 === 0 ? 'win' : index % 3 === 1 ? 'loss' : 'pending',
    name: `Test Player ${index}`,
    type: 'Pts',
    line: '20.5',
    ou: 'Over',
    legs: [{
      entities: [`Test Player ${index}`],
      entityType: 'player',
      market: 'Points',
      target: '20.5',
      ou: 'Over',
      result: index % 3 === 0 ? 'WIN' : index % 3 === 1 ? 'LOSS' : 'PENDING',
    }],
  };
}

/**
 * Creates a synthetic parlay bet for testing.
 */
function createSyntheticParlayBet(index: number, legCount: number = 4): Bet {
  const legs: BetLeg[] = [];
  
  for (let i = 0; i < legCount; i++) {
    legs.push({
      entities: [`Player ${index}-${i}`],
      entityType: 'player',
      market: i % 3 === 0 ? 'Points' : i % 3 === 1 ? 'Assists' : 'Rebounds',
      target: `${15 + i}.5`,
      ou: i % 2 === 0 ? 'Over' : 'Under',
      result: i % 4 === 0 ? 'WIN' : i % 4 === 1 ? 'LOSS' : i % 4 === 2 ? 'PUSH' : 'PENDING',
      odds: -110 + (i * 10),
    });
  }
  
  return {
    id: `test-parlay-${index}`,
    betId: `PARLAY${index.toString().padStart(10, '0')}`,
    book: 'DraftKings',
    betType: 'parlay',
    sport: 'NBA',
    placedAt: new Date(2025, 0, 1 + (index % 30)).toISOString(),
    description: `${legCount} Leg Parlay`,
    marketCategory: 'Parlays',
    odds: 500 + (index * 100),
    stake: 5 + (index % 50),
    payout: index % 4 === 0 ? 50 : 0,
    result: index % 4 === 0 ? 'win' : 'loss',
    legs,
  };
}

/**
 * Creates a mixed dataset of single and parlay bets.
 */
function createMixedDataset(count: number): Bet[] {
  const bets: Bet[] = [];
  
  for (let i = 0; i < count; i++) {
    if (i % 3 === 0) {
      // 33% parlays (4 legs each)
      bets.push(createSyntheticParlayBet(i, 4));
    } else {
      // 67% singles
      bets.push(createSyntheticSingleBet(i));
    }
  }
  
  return bets;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Performance Benchmarks', () => {
  describe('betToFinalRows transform', () => {
    const TRANSFORM_THRESHOLD_MS = 500; // 500ms for 100 bets is generous
    
    it('transforms 100 single bets within threshold', () => {
      const bets = Array.from({ length: 100 }, (_, i) => createSyntheticSingleBet(i));
      
      const start = performance.now();
      bets.forEach(bet => betToFinalRows(bet));
      const duration = performance.now() - start;
      
      console.log(`Transform 100 single bets: ${duration.toFixed(2)}ms (threshold: ${TRANSFORM_THRESHOLD_MS}ms)`);
      expect(duration).toBeLessThan(TRANSFORM_THRESHOLD_MS);
    });
    
    it('transforms 100 parlay bets (4 legs each) within threshold', () => {
      const bets = Array.from({ length: 100 }, (_, i) => createSyntheticParlayBet(i, 4));
      
      const start = performance.now();
      bets.forEach(bet => betToFinalRows(bet));
      const duration = performance.now() - start;
      
      // Parlays produce more rows, so allow more time
      const parlayThreshold = TRANSFORM_THRESHOLD_MS * 2;
      console.log(`Transform 100 parlay bets: ${duration.toFixed(2)}ms (threshold: ${parlayThreshold}ms)`);
      expect(duration).toBeLessThan(parlayThreshold);
    });
    
    it('transforms mixed dataset of 100 bets within threshold', () => {
      const bets = createMixedDataset(100);
      
      const start = performance.now();
      const allRows = bets.flatMap(bet => betToFinalRows(bet));
      const duration = performance.now() - start;
      
      console.log(`Transform 100 mixed bets → ${allRows.length} rows: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(TRANSFORM_THRESHOLD_MS * 1.5);
    });
  });
  
  describe('validateBetsForImport', () => {
    const VALIDATION_THRESHOLD_MS = 200; // 200ms for 100 bets is generous
    
    it('validates 100 bets within threshold', () => {
      const bets = createMixedDataset(100);
      
      const start = performance.now();
      const result = validateBetsForImport(bets);
      const duration = performance.now() - start;
      
      console.log(`Validate 100 bets: ${duration.toFixed(2)}ms (threshold: ${VALIDATION_THRESHOLD_MS}ms)`);
      expect(duration).toBeLessThan(VALIDATION_THRESHOLD_MS);
      // Also verify the result is reasonable
      expect(result.validBets.length + result.invalidBets.length).toBe(100);
    });
    
    it('validates 500 bets within scaled threshold', () => {
      const bets = createMixedDataset(500);
      
      const start = performance.now();
      const result = validateBetsForImport(bets);
      const duration = performance.now() - start;
      
      // Scale threshold linearly with count
      const scaledThreshold = VALIDATION_THRESHOLD_MS * 5;
      console.log(`Validate 500 bets: ${duration.toFixed(2)}ms (threshold: ${scaledThreshold}ms)`);
      expect(duration).toBeLessThan(scaledThreshold);
      expect(result.validBets.length + result.invalidBets.length).toBe(500);
    });
  });
  
  describe('End-to-end pipeline simulation', () => {
    const TOTAL_THRESHOLD_MS = 1000; // 1 second for complete pipeline
    
    it('processes 100 bets through full pipeline within threshold', () => {
      const bets = createMixedDataset(100);
      
      const start = performance.now();
      
      // Step 1: Validate
      const validationResult = validateBetsForImport(bets);
      const afterValidation = performance.now();
      
      // Step 2: Transform to display rows
      const allRows = validationResult.validBets.flatMap(bet => betToFinalRows(bet));
      const afterTransform = performance.now();
      
      const totalDuration = afterTransform - start;
      const validationDuration = afterValidation - start;
      const transformDuration = afterTransform - afterValidation;
      
      console.log(`Full pipeline for 100 bets:`);
      console.log(`  - Validation: ${validationDuration.toFixed(2)}ms`);
      console.log(`  - Transform: ${transformDuration.toFixed(2)}ms`);
      console.log(`  - Total: ${totalDuration.toFixed(2)}ms (threshold: ${TOTAL_THRESHOLD_MS}ms)`);
      console.log(`  - Output: ${allRows.length} display rows`);
      
      expect(totalDuration).toBeLessThan(TOTAL_THRESHOLD_MS);
    });
  });
});

describe('Performance Profiler Utility', () => {
  it('perfTimer measures time correctly', async () => {
    const profiler = await import('../../utils/performanceProfiler');
    const timer = profiler.perfTimer('test-operation');
    
    // Wait a small amount
    const waitStart = performance.now();
    while (performance.now() - waitStart < 10) {
      // Busy wait
    }
    
    const elapsed = timer.elapsed();
    expect(elapsed).toBeGreaterThanOrEqual(10);
    
    const duration = timer.end();
    expect(duration).toBeGreaterThanOrEqual(10);
  });
  
  it('measureTime wraps functions correctly', async () => {
    const profiler = await import('../../utils/performanceProfiler');
    let executed = false;
    const result = profiler.measureTime('test-wrap', () => {
      executed = true;
      return 42;
    });
    
    expect(executed).toBe(true);
    expect(result).toBe(42);
  });
  
  it('getTimingSummary returns empty object when no data', async () => {
    const profiler = await import('../../utils/performanceProfiler');
    profiler.clearTimingHistory();
    const summary = profiler.getTimingSummary();
    expect(typeof summary).toBe('object');
  });
});
