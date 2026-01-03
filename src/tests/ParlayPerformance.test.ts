/**
 * Parlay Performance Tests
 *
 * Comprehensive tests for the Parlay Performance View functionality.
 * Ensures parlay isolation rules are enforced:
 * - "Tickets drive money. Legs never do."
 * - Only parlay bet types (parlay, sgp, sgp_plus) are included
 * - Correct leg count bucketing
 * - Correct parlay type naming
 */

import { describe, it, expect } from 'vitest';
import { Bet, BetLeg } from '../../types';
import { isParlayBetType, getNetNumeric } from '../../services/displaySemantics';
import {
  computeOverallStats,
  computeStatsByDimension,
  mapToStatsArray,
} from '../../services/aggregationService';
import {
  DEADLY_BETS,
  DEADLY_BETS_PARLAYS,
  DEADLY_BETS_NON_PARLAY,
  PARLAY_WIN,
  PARLAY_LOSS,
  SGP_WIN,
  SGP_PLUS_LOSS,
  SINGLE_WIN,
  SINGLE_LOSS,
} from './fixtures/deadly-fixtures';

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

// Helper to create bet legs
function createLegs(count: number): BetLeg[] {
  return Array.from({ length: count }, (_, i) => ({
    market: `Market ${i + 1}`,
    entities: [`Player ${i + 1}`],
    entityType: 'player' as const,
  }));
}

/**
 * getLegCountBucket implementation (mirrors ParlayPerformanceView)
 * Exported here for testing purposes
 */
function getLegCountBucket(bet: Bet): string {
  const legCount = bet.legs?.length || 0;
  if (legCount < 2) return '2-leg'; // Edge case: shouldn't happen for parlays
  if (legCount === 2) return '2-leg';
  if (legCount === 3) return '3-leg';
  if (legCount === 4) return '4-leg';
  return '5+ legs';
}

/**
 * getParlayTypeName implementation (mirrors ParlayPerformanceView)
 */
function getParlayTypeName(bet: Bet): string {
  if (bet.betType === 'sgp') return 'SGP';
  if (bet.betType === 'sgp_plus') return 'SGP+';
  if (bet.betType === 'parlay') {
    return 'Standard Parlay';
  }
  return 'Parlay';
}

describe('Parlay Performance View', () => {
  // ===========================================================================
  // isParlayBetType Filtering Tests
  // ===========================================================================
  describe('isParlayBetType filtering', () => {
    it('includes Standard Parlay bets', () => {
      expect(isParlayBetType('parlay')).toBe(true);
    });

    it('includes SGP bets', () => {
      expect(isParlayBetType('sgp')).toBe(true);
    });

    it('includes SGP+ bets', () => {
      expect(isParlayBetType('sgp_plus')).toBe(true);
    });

    it('excludes Straight/Single bets', () => {
      expect(isParlayBetType('single')).toBe(false);
    });

    it('excludes Live bets (non-parlay)', () => {
      expect(isParlayBetType('live')).toBe(false);
    });

    it('excludes Other bet types', () => {
      expect(isParlayBetType('other')).toBe(false);
    });

    it('handles empty bets array - filtering returns empty', () => {
      const emptyBets: Bet[] = [];
      const parlayBets = emptyBets.filter(bet => isParlayBetType(bet.betType));
      expect(parlayBets).toHaveLength(0);
    });

    it('correctly filters mixed dataset', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      // Should include: PARLAY_WIN, PARLAY_LOSS, SGP_WIN, SGP_PLUS_LOSS, PARLAY_OVER = 5
      expect(parlayBets.length).toBe(DEADLY_BETS_PARLAYS.length);
    });

    it('excludes all non-parlay bets from mixed dataset', () => {
      const nonParlayBets = DEADLY_BETS.filter(bet => !isParlayBetType(bet.betType));
      expect(nonParlayBets.length).toBe(DEADLY_BETS_NON_PARLAY.length);
    });
  });

  // ===========================================================================
  // getLegCountBucket Tests
  // ===========================================================================
  describe('getLegCountBucket', () => {
    it('returns "2-leg" for 2-leg parlays', () => {
      const bet = createTestBet({
        id: 'test-2-leg',
        result: 'win',
        betType: 'parlay',
        legs: createLegs(2),
      });
      expect(getLegCountBucket(bet)).toBe('2-leg');
    });

    it('returns "3-leg" for 3-leg parlays', () => {
      const bet = createTestBet({
        id: 'test-3-leg',
        result: 'win',
        betType: 'parlay',
        legs: createLegs(3),
      });
      expect(getLegCountBucket(bet)).toBe('3-leg');
    });

    it('returns "4-leg" for 4-leg parlays', () => {
      const bet = createTestBet({
        id: 'test-4-leg',
        result: 'win',
        betType: 'parlay',
        legs: createLegs(4),
      });
      expect(getLegCountBucket(bet)).toBe('4-leg');
    });

    it('returns "5+ legs" for 5-leg parlays', () => {
      const bet = createTestBet({
        id: 'test-5-leg',
        result: 'win',
        betType: 'parlay',
        legs: createLegs(5),
      });
      expect(getLegCountBucket(bet)).toBe('5+ legs');
    });

    it('returns "5+ legs" for 6+ leg parlays', () => {
      const bet = createTestBet({
        id: 'test-6-leg',
        result: 'win',
        betType: 'parlay',
        legs: createLegs(6),
      });
      expect(getLegCountBucket(bet)).toBe('5+ legs');
    });

    it('returns "5+ legs" for 10-leg parlays', () => {
      const bet = createTestBet({
        id: 'test-10-leg',
        result: 'win',
        betType: 'parlay',
        legs: createLegs(10),
      });
      expect(getLegCountBucket(bet)).toBe('5+ legs');
    });

    it('handles edge case: parlay with undefined legs', () => {
      const bet = createTestBet({
        id: 'test-no-legs',
        result: 'win',
        betType: 'parlay',
      });
      delete bet.legs;
      expect(getLegCountBucket(bet)).toBe('2-leg');
    });

    it('handles edge case: parlay with empty legs array', () => {
      const bet = createTestBet({
        id: 'test-empty-legs',
        result: 'win',
        betType: 'parlay',
        legs: [],
      });
      expect(getLegCountBucket(bet)).toBe('2-leg');
    });

    it('handles edge case: parlay with 1 leg (defensive)', () => {
      const bet = createTestBet({
        id: 'test-1-leg',
        result: 'win',
        betType: 'parlay',
        legs: createLegs(1),
      });
      // Should default to 2-leg as parlays shouldn't have <2 legs
      expect(getLegCountBucket(bet)).toBe('2-leg');
    });
  });

  // ===========================================================================
  // getParlayTypeName Tests
  // ===========================================================================
  describe('getParlayTypeName', () => {
    it('returns "Standard Parlay" for parlay betType', () => {
      const bet = createTestBet({
        id: 'test-parlay',
        result: 'win',
        betType: 'parlay',
      });
      expect(getParlayTypeName(bet)).toBe('Standard Parlay');
    });

    it('returns "SGP" for sgp betType', () => {
      const bet = createTestBet({
        id: 'test-sgp',
        result: 'win',
        betType: 'sgp',
      });
      expect(getParlayTypeName(bet)).toBe('SGP');
    });

    it('returns "SGP+" for sgp_plus betType', () => {
      const bet = createTestBet({
        id: 'test-sgp-plus',
        result: 'win',
        betType: 'sgp_plus',
      });
      expect(getParlayTypeName(bet)).toBe('SGP+');
    });

    it('returns "Parlay" for unknown parlay-like types', () => {
      const bet = createTestBet({
        id: 'test-other',
        result: 'win',
        betType: 'other',
      });
      expect(getParlayTypeName(bet)).toBe('Parlay');
    });
  });

  // ===========================================================================
  // Parlay Statistics Calculation Tests
  // ===========================================================================
  describe('Parlay Statistics Calculations', () => {
    it('computes correct overall stats for parlay-only dataset', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      const stats = computeOverallStats(parlayBets);

      // Calculate expected values manually
      const expectedStake = parlayBets.reduce((sum, bet) => sum + bet.stake, 0);
      const expectedNet = parlayBets.reduce((sum, bet) => sum + getNetNumeric(bet), 0);

      expect(stats.totalBets).toBe(parlayBets.length);
      expect(stats.totalWagered).toBe(expectedStake);
      expect(stats.netProfit).toBe(expectedNet);
    });

    it('computes correct win/loss counts for parlays', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      const stats = computeOverallStats(parlayBets);

      const wins = parlayBets.filter(bet => bet.result === 'win').length;
      const losses = parlayBets.filter(bet => bet.result === 'loss').length;

      expect(stats.wins).toBe(wins);
      expect(stats.losses).toBe(losses);
    });

    it('computes correct ROI for parlay dataset', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      const stats = computeOverallStats(parlayBets);

      const expectedStake = parlayBets.reduce((sum, bet) => sum + bet.stake, 0);
      const expectedNet = parlayBets.reduce((sum, bet) => sum + getNetNumeric(bet), 0);
      const expectedRoi = expectedStake > 0 ? (expectedNet / expectedStake) * 100 : 0;

      expect(stats.roi).toBeCloseTo(expectedRoi, 2);
    });

    it('computes correct average legs per parlay', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      const totalLegs = parlayBets.reduce((sum, bet) => sum + (bet.legs?.length || 0), 0);
      const avgLegs = parlayBets.length > 0 ? totalLegs / parlayBets.length : 0;

      expect(avgLegs).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Parlay Breakdown Tests
  // ===========================================================================
  describe('Parlay Breakdown by Dimension', () => {
    it('breaks down parlays by leg count correctly', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      const legCountMap = computeStatsByDimension(parlayBets, (bet) => getLegCountBucket(bet));
      const legCountStats = mapToStatsArray(legCountMap);

      // All DEADLY parlays have 2 legs
      expect(legCountStats.length).toBeGreaterThan(0);
      const twoLegBucket = legCountStats.find(s => s.name === '2-leg');
      expect(twoLegBucket).toBeDefined();
    });

    it('breaks down parlays by type correctly', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      const typeMap = computeStatsByDimension(parlayBets, (bet) => getParlayTypeName(bet));
      const typeStats = mapToStatsArray(typeMap);

      expect(typeStats.length).toBeGreaterThan(0);
      
      // Should have Standard Parlay, SGP, and SGP+ categories
      const standardParlay = typeStats.find(s => s.name === 'Standard Parlay');
      const sgp = typeStats.find(s => s.name === 'SGP');
      const sgpPlus = typeStats.find(s => s.name === 'SGP+');

      // Based on DEADLY_BETS_PARLAYS: PARLAY_WIN, PARLAY_LOSS, PARLAY_OVER are Standard Parlay
      // SGP_WIN is SGP, SGP_PLUS_LOSS is SGP+
      expect(standardParlay).toBeDefined();
      expect(sgp).toBeDefined();
      expect(sgpPlus).toBeDefined();
    });

    it('breaks down parlays by sport correctly', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      const sportMap = computeStatsByDimension(parlayBets, (bet) => bet.sport);
      const sportStats = mapToStatsArray(sportMap);

      expect(sportStats.length).toBeGreaterThan(0);
      // All DEADLY bets are NBA
      expect(sportStats[0].name).toBe('NBA');
    });

    it('breaks down parlays by sportsbook correctly', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      const bookMap = computeStatsByDimension(parlayBets, (bet) => bet.book);
      const bookStats = mapToStatsArray(bookMap);

      expect(bookStats.length).toBeGreaterThan(0);
      // All DEADLY bets are FanDuel
      expect(bookStats[0].name).toBe('FanDuel');
    });
  });

  // ===========================================================================
  // Parlay Isolation Tests
  // ===========================================================================
  describe('Parlay Isolation Enforcement', () => {
    it('parlay view MUST NOT include single bets', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      
      // None of the parlay bets should have betType === 'single'
      const singleBetsInParlayView = parlayBets.filter(bet => bet.betType === 'single');
      expect(singleBetsInParlayView).toHaveLength(0);
    });

    it('parlay view excludes specific non-parlay bets', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      
      // SINGLE_WIN and SINGLE_LOSS should NOT be in parlay view
      const hasSingleWin = parlayBets.some(bet => bet.id === SINGLE_WIN.id);
      const hasSingleLoss = parlayBets.some(bet => bet.id === SINGLE_LOSS.id);
      
      expect(hasSingleWin).toBe(false);
      expect(hasSingleLoss).toBe(false);
    });

    it('parlay view includes specific parlay bets', () => {
      const parlayBets = DEADLY_BETS.filter(bet => isParlayBetType(bet.betType));
      
      // PARLAY_WIN, SGP_WIN, SGP_PLUS_LOSS should be in parlay view
      const hasParlayWin = parlayBets.some(bet => bet.id === PARLAY_WIN.id);
      const hasSgpWin = parlayBets.some(bet => bet.id === SGP_WIN.id);
      const hasSgpPlusLoss = parlayBets.some(bet => bet.id === SGP_PLUS_LOSS.id);
      
      expect(hasParlayWin).toBe(true);
      expect(hasSgpWin).toBe(true);
      expect(hasSgpPlusLoss).toBe(true);
    });
  });
});
