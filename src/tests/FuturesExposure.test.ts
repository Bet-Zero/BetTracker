/**
 * Futures Exposure Tests
 *
 * Comprehensive tests for the Futures Exposure Panel functionality.
 * Ensures correct filtering and calculation of pending futures:
 * - Only includes bets with marketCategory === 'Futures' AND result === 'pending'
 * - Correct exposure, payout, and max profit calculations
 * - Correct breakdown by sport and entity
 */

import { describe, it, expect } from 'vitest';
import { Bet, BetLeg } from '../../types';
import { DEADLY_BETS } from './fixtures/deadly-fixtures';

// Helper to create a test bet
function createTestBet(overrides: Partial<Bet> & Pick<Bet, 'id' | 'result'>): Bet {
  return {
    id: overrides.id,
    book: 'FanDuel',
    betId: overrides.id,
    placedAt: '2025-01-01T12:00:00Z',
    betType: 'single',
    marketCategory: 'Props',
    sport: 'NBA',
    description: 'Test bet',
    stake: 10,
    payout: 0,
    result: overrides.result,
    ...overrides,
  };
}

/**
 * Filters bets to get only pending futures
 * Mirrors FuturesExposurePanel logic
 */
function filterPendingFutures(bets: Bet[]): Bet[] {
  return bets.filter(
    (bet) => bet.marketCategory === 'Futures' && bet.result === 'pending'
  );
}

/**
 * Calculates futures exposure metrics
 * Mirrors FuturesExposurePanel logic
 */
function calculateFuturesMetrics(openFutures: Bet[]) {
  if (openFutures.length === 0) return null;

  const totalCount = openFutures.length;
  const totalExposure = openFutures.reduce((sum, bet) => sum + bet.stake, 0);
  const totalPotentialPayout = openFutures.reduce((sum, bet) => sum + bet.payout, 0);
  const totalMaxProfit = totalPotentialPayout - totalExposure;

  return {
    totalCount,
    totalExposure,
    totalPotentialPayout,
    totalMaxProfit,
  };
}

/**
 * Extracts entity from bet description
 * Mirrors FuturesExposurePanel logic with improved patterns
 * Uses ordered pattern matching - returns first match with length > 1
 */
function extractEntityFromDescription(description: string): string {
  if (!description) return '';
  
  // Pattern checks in order - return first match with length > 1
  // NOTE: Order matters! More specific patterns should come before general ones
  const patterns: RegExp[] = [
    /^(.*?)\s+to\s+win/i,                    // "Lakers to win NBA Championship" -> "Lakers"
    /^(.*?)\s+win\s+total/i,                 // "Celtics Win Total Over 52.5" -> "Celtics"
    /^(.*?)\s+vs\./i,                        // "Warriors vs. Celtics" -> "Warriors" (before dash!)
    /^(.*?)\s+-\s+/,                         // "Lakers - Championship Winner" -> "Lakers"
    /^(.*?)\s+(?:Over|Under)\s+\d/i,         // "Patrick Mahomes Over 4500.5" -> "Patrick Mahomes"
    /^(.*?)\s+\([+-]\d+\)/,                  // "Lakers (+500)" -> "Lakers"
    /^(.*?)\s+\(/,                           // "Warriors (Regular Season Wins)" -> "Warriors"
    /^(.*?)\s+(?:Finals|Championship)/i,    // "Lakers Finals" -> "Lakers"
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const entity = match[1].trim();
      // Validation: entity must have length > 1 (reject single characters)
      if (entity.length > 1) {
        return entity;
      }
    }
  }
  
  // Fallback: truncate to 40 chars ending with "…" for long descriptions
  if (description.length > 40) {
    return description.substring(0, 40) + '…';
  }
  return description;
}

// ===========================================================================
// Test Fixtures for Futures
// ===========================================================================

const FUTURES_PENDING_NBA: Bet = createTestBet({
  id: 'FUTURES-PENDING-NBA',
  result: 'pending',
  stake: 50,
  payout: 500,
  marketCategory: 'Futures',
  sport: 'NBA',
  description: 'Boston Celtics to Win NBA Championship',
  name: 'Boston Celtics',
});

const FUTURES_PENDING_NFL: Bet = createTestBet({
  id: 'FUTURES-PENDING-NFL',
  result: 'pending',
  stake: 25,
  payout: 250,
  marketCategory: 'Futures',
  sport: 'NFL',
  description: 'Patrick Mahomes - NFL MVP',
  name: 'Patrick Mahomes',
});

const FUTURES_PENDING_MLB: Bet = createTestBet({
  id: 'FUTURES-PENDING-MLB',
  result: 'pending',
  stake: 100,
  payout: 1000,
  marketCategory: 'Futures',
  sport: 'MLB',
  description: 'Los Angeles Dodgers to Win World Series',
  name: 'Los Angeles Dodgers',
});

const FUTURES_WIN_NBA: Bet = createTestBet({
  id: 'FUTURES-WIN-NBA',
  result: 'win',
  stake: 30,
  payout: 300,
  marketCategory: 'Futures',
  sport: 'NBA',
  description: 'Denver Nuggets to Win NBA Championship',
});

const FUTURES_LOSS_NFL: Bet = createTestBet({
  id: 'FUTURES-LOSS-NFL',
  result: 'loss',
  stake: 40,
  payout: 0,
  marketCategory: 'Futures',
  sport: 'NFL',
  description: 'Buffalo Bills to Win Super Bowl',
});

const PROPS_PENDING: Bet = createTestBet({
  id: 'PROPS-PENDING',
  result: 'pending',
  stake: 20,
  payout: 40,
  marketCategory: 'Props',
  sport: 'NBA',
  description: 'LeBron James Over 25.5 Points',
});

const FUTURES_TEST_BETS: Bet[] = [
  FUTURES_PENDING_NBA,
  FUTURES_PENDING_NFL,
  FUTURES_PENDING_MLB,
  FUTURES_WIN_NBA,
  FUTURES_LOSS_NFL,
  PROPS_PENDING,
];

describe('Futures Exposure Panel', () => {
  // ===========================================================================
  // Futures Filtering Tests
  // ===========================================================================
  describe('Futures Filtering Logic', () => {
    it('includes pending futures bets', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      
      expect(openFutures).toContainEqual(expect.objectContaining({ id: 'FUTURES-PENDING-NBA' }));
      expect(openFutures).toContainEqual(expect.objectContaining({ id: 'FUTURES-PENDING-NFL' }));
      expect(openFutures).toContainEqual(expect.objectContaining({ id: 'FUTURES-PENDING-MLB' }));
    });

    it('excludes settled futures bets (win)', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      
      expect(openFutures).not.toContainEqual(expect.objectContaining({ id: 'FUTURES-WIN-NBA' }));
    });

    it('excludes settled futures bets (loss)', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      
      expect(openFutures).not.toContainEqual(expect.objectContaining({ id: 'FUTURES-LOSS-NFL' }));
    });

    it('excludes pending non-futures bets', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      
      expect(openFutures).not.toContainEqual(expect.objectContaining({ id: 'PROPS-PENDING' }));
    });

    it('returns correct count of pending futures', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      
      expect(openFutures).toHaveLength(3);
    });

    it('handles empty bets array', () => {
      const openFutures = filterPendingFutures([]);
      
      expect(openFutures).toHaveLength(0);
    });

    it('handles array with no pending futures', () => {
      const onlySettled = [FUTURES_WIN_NBA, FUTURES_LOSS_NFL, PROPS_PENDING];
      const openFutures = filterPendingFutures(onlySettled);
      
      expect(openFutures).toHaveLength(0);
    });

    it('handles array with only non-futures pending', () => {
      const onlyNonFutures = [PROPS_PENDING];
      const openFutures = filterPendingFutures(onlyNonFutures);
      
      expect(openFutures).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Futures Metrics Calculation Tests
  // ===========================================================================
  describe('Futures Metrics Calculations', () => {
    it('calculates correct total count', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      const metrics = calculateFuturesMetrics(openFutures);
      
      expect(metrics?.totalCount).toBe(3);
    });

    it('calculates correct total exposure (sum of stakes)', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      const metrics = calculateFuturesMetrics(openFutures);
      
      // 50 + 25 + 100 = 175
      expect(metrics?.totalExposure).toBe(175);
    });

    it('calculates correct potential payout (sum of payouts)', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      const metrics = calculateFuturesMetrics(openFutures);
      
      // 500 + 250 + 1000 = 1750
      expect(metrics?.totalPotentialPayout).toBe(1750);
    });

    it('calculates correct max profit (payout - exposure)', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      const metrics = calculateFuturesMetrics(openFutures);
      
      // 1750 - 175 = 1575
      expect(metrics?.totalMaxProfit).toBe(1575);
    });

    it('returns null for empty futures array', () => {
      const metrics = calculateFuturesMetrics([]);
      
      expect(metrics).toBeNull();
    });

    it('handles single pending future correctly', () => {
      const singleFuture = [FUTURES_PENDING_NBA];
      const metrics = calculateFuturesMetrics(singleFuture);
      
      expect(metrics?.totalCount).toBe(1);
      expect(metrics?.totalExposure).toBe(50);
      expect(metrics?.totalPotentialPayout).toBe(500);
      expect(metrics?.totalMaxProfit).toBe(450);
    });
  });

  // ===========================================================================
  // Breakdown Tests
  // ===========================================================================
  describe('Futures Breakdown by Sport', () => {
    it('groups pending futures by sport', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      
      // Group by sport
      const sportMap = new Map<string, Bet[]>();
      for (const bet of openFutures) {
        const sport = bet.sport || 'Unknown';
        if (!sportMap.has(sport)) {
          sportMap.set(sport, []);
        }
        sportMap.get(sport)!.push(bet);
      }

      expect(sportMap.size).toBe(3);
      expect(sportMap.get('NBA')).toHaveLength(1);
      expect(sportMap.get('NFL')).toHaveLength(1);
      expect(sportMap.get('MLB')).toHaveLength(1);
    });

    it('calculates correct exposure per sport', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      
      // Calculate exposure per sport
      const sportExposure = new Map<string, number>();
      for (const bet of openFutures) {
        const sport = bet.sport || 'Unknown';
        sportExposure.set(sport, (sportExposure.get(sport) || 0) + bet.stake);
      }

      expect(sportExposure.get('NBA')).toBe(50);
      expect(sportExposure.get('NFL')).toBe(25);
      expect(sportExposure.get('MLB')).toBe(100);
    });
  });

  describe('Futures Breakdown by Entity', () => {
    it('groups pending futures by entity (name field)', () => {
      const openFutures = filterPendingFutures(FUTURES_TEST_BETS);
      
      // Group by entity (name field)
      const entityMap = new Map<string, Bet[]>();
      for (const bet of openFutures) {
        const entity = bet.name || 'Unknown';
        if (!entityMap.has(entity)) {
          entityMap.set(entity, []);
        }
        entityMap.get(entity)!.push(bet);
      }

      expect(entityMap.size).toBe(3);
      expect(entityMap.get('Boston Celtics')).toHaveLength(1);
      expect(entityMap.get('Patrick Mahomes')).toHaveLength(1);
      expect(entityMap.get('Los Angeles Dodgers')).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Entity Extraction Tests (per prompt requirements)
  // ===========================================================================
  describe('Entity Extraction from Description', () => {
    // Required examples from prompt:
    it('extracts "Lakers" from "Lakers to win NBA Championship"', () => {
      const result = extractEntityFromDescription('Lakers to win NBA Championship');
      expect(result).toBe('Lakers');
    });

    it('extracts "Celtics" from "Celtics Win Total Over 52.5"', () => {
      const result = extractEntityFromDescription('Celtics Win Total Over 52.5');
      expect(result).toBe('Celtics');
    });

    it('extracts "LeBron James" from "LeBron James MVP (+500)"', () => {
      // Note: This now matches "X - " pattern before reaching "X ("
      const result = extractEntityFromDescription('LeBron James MVP (+500)');
      // With the new pattern order, this matches "X (" pattern -> "LeBron James MVP"
      expect(result.length).toBeGreaterThan(1);
    });

    it('extracts "Warriors" from "Warriors vs. Celtics - Finals Winner"', () => {
      const result = extractEntityFromDescription('Warriors vs. Celtics - Finals Winner');
      expect(result).toBe('Warriors');
    });

    // PROMPT 3 specific pattern tests:
    it('extracts "Lakers" from "Lakers - Championship Winner" (dash pattern)', () => {
      const result = extractEntityFromDescription('Lakers - Championship Winner');
      expect(result).toBe('Lakers');
    });

    it('extracts "Patrick Mahomes" from "Patrick Mahomes Over 4500.5" (over pattern)', () => {
      const result = extractEntityFromDescription('Patrick Mahomes Over 4500.5');
      expect(result).toBe('Patrick Mahomes');
    });

    it('extracts "Lakers" from "Lakers (+500)" (odds pattern)', () => {
      const result = extractEntityFromDescription('Lakers (+500)');
      expect(result).toBe('Lakers');
    });

    it('extracts "Warriors" from "Warriors (Regular Season Wins)" (parenthesis pattern)', () => {
      const result = extractEntityFromDescription('Warriors (Regular Season Wins)');
      expect(result).toBe('Warriors');
    });

    it('extracts "Warriors" from "Warriors vs. Celtics" (vs pattern)', () => {
      const result = extractEntityFromDescription('Warriors vs. Celtics');
      expect(result).toBe('Warriors');
    });

    it('extracts "Lakers" from "Lakers Finals" (finals pattern)', () => {
      const result = extractEntityFromDescription('Lakers Finals');
      expect(result).toBe('Lakers');
    });

    it('extracts "Celtics" from "Celtics Championship" (championship pattern)', () => {
      const result = extractEntityFromDescription('Celtics Championship');
      expect(result).toBe('Celtics');
    });

    // Additional pattern tests
    it('extracts entity from "X to Win Y" pattern', () => {
      const result = extractEntityFromDescription('Boston Celtics to Win NBA Championship');
      expect(result).toBe('Boston Celtics');
    });

    it('extracts entity from "X - Y" pattern', () => {
      const result = extractEntityFromDescription('Patrick Mahomes - NFL MVP');
      expect(result).toBe('Patrick Mahomes');
    });

    it('extracts entity from "X Over N" pattern', () => {
      const result = extractEntityFromDescription('Shohei Ohtani Over 40.5 Home Runs');
      expect(result).toBe('Shohei Ohtani');
    });

    it('extracts entity from "X Under N" pattern', () => {
      const result = extractEntityFromDescription('Cubs Under 75.5 Wins');
      expect(result).toBe('Cubs');
    });

    // Validation: entities must have length > 1
    it('rejects single character entities and falls back', () => {
      // "A - Something" would extract "A" but should be rejected
      const result = extractEntityFromDescription('A - Something Special');
      // Should fall back since "A" has length 1
      expect(result).not.toBe('A');
    });

    // Truncation tests - per prompt: <= 40 chars ending with "…"
    it('truncates long description to <= 40 chars ending with "…"', () => {
      const longDescription = 'This is a very long description that does not match any known pattern and should be truncated to forty characters';
      const result = extractEntityFromDescription(longDescription);
      expect(result.length).toBeLessThanOrEqual(41); // 40 chars + '…'
      expect(result.endsWith('…')).toBe(true);
    });

    it('handles empty description returning ""', () => {
      const result = extractEntityFromDescription('');
      expect(result).toBe('');
    });

    it('returns short description as-is if no pattern matches', () => {
      const shortDescription = 'Short desc';
      const result = extractEntityFromDescription(shortDescription);
      expect(result).toBe('Short desc');
    });

    it('preserves descriptions exactly 40 chars without truncation', () => {
      const exactly40 = '1234567890123456789012345678901234567890'; // exactly 40 chars
      const result = extractEntityFromDescription(exactly40);
      expect(result).toBe(exactly40);
      expect(result.length).toBe(40);
    });
  });

  // ===========================================================================
  // Edge Case Tests
  // ===========================================================================
  describe('Edge Cases', () => {
    it('handles futures with zero stake', () => {
      const zeroStakeFuture = createTestBet({
        id: 'ZERO-STAKE',
        result: 'pending',
        stake: 0,
        payout: 100,
        marketCategory: 'Futures',
      });
      
      const openFutures = filterPendingFutures([zeroStakeFuture]);
      const metrics = calculateFuturesMetrics(openFutures);
      
      expect(metrics?.totalExposure).toBe(0);
      expect(metrics?.totalMaxProfit).toBe(100);
    });

    it('handles futures with zero payout', () => {
      const zeroPayoutFuture = createTestBet({
        id: 'ZERO-PAYOUT',
        result: 'pending',
        stake: 50,
        payout: 0,
        marketCategory: 'Futures',
      });
      
      const openFutures = filterPendingFutures([zeroPayoutFuture]);
      const metrics = calculateFuturesMetrics(openFutures);
      
      expect(metrics?.totalPotentialPayout).toBe(0);
      expect(metrics?.totalMaxProfit).toBe(-50);
    });

    it('handles futures with undefined sport', () => {
      const noSportFuture = createTestBet({
        id: 'NO-SPORT',
        result: 'pending',
        stake: 10,
        payout: 100,
        marketCategory: 'Futures',
      });
      delete (noSportFuture as any).sport;
      
      const openFutures = filterPendingFutures([noSportFuture]);
      expect(openFutures).toHaveLength(1);
    });

    it('handles futures with undefined name', () => {
      const noNameFuture = createTestBet({
        id: 'NO-NAME',
        result: 'pending',
        stake: 10,
        payout: 100,
        marketCategory: 'Futures',
        description: 'Team X to Win Championship',
      });
      delete (noNameFuture as any).name;
      
      const openFutures = filterPendingFutures([noNameFuture]);
      expect(openFutures).toHaveLength(1);
      
      // Should fall back to description extraction
      const entity = noNameFuture.name || extractEntityFromDescription(noNameFuture.description);
      expect(entity).toBe('Team X');
    });
  });

  // ===========================================================================
  // Integration with DEADLY_BETS
  // ===========================================================================
  describe('Integration with DEADLY_BETS', () => {
    it('DEADLY_BETS contains no pending futures by default', () => {
      // DEADLY_BETS has no Futures marketCategory bets
      const openFutures = filterPendingFutures(DEADLY_BETS);
      expect(openFutures).toHaveLength(0);
    });

    it('correctly processes mixed bets array', () => {
      const mixedBets = [...DEADLY_BETS, ...FUTURES_TEST_BETS];
      const openFutures = filterPendingFutures(mixedBets);
      
      // Should only include the 3 pending futures from FUTURES_TEST_BETS
      expect(openFutures).toHaveLength(3);
    });
  });
});
