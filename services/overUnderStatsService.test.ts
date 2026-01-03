/**
 * Over/Under Stats Service Tests
 *
 * Tests for the shared computeOverUnderStats function that consolidates
 * O/U breakdown logic across all views.
 */

import { describe, it, expect } from 'vitest';
import { Bet, BetLeg } from '../types';
import {
  computeOverUnderStats,
  filterBetsByMarketCategory,
} from './overUnderStatsService';

// Helper to create a minimal Bet
function createBet(overrides: Partial<Bet>): Bet {
  return {
    id: 'test',
    book: 'FanDuel',
    betId: 'test',
    placedAt: '2024-01-01T12:00:00Z',
    betType: 'single',
    marketCategory: 'Props',
    sport: 'NBA',
    description: 'Test bet',
    stake: 10,
    payout: 0,
    result: 'pending',
    ...overrides,
  };
}

// Helper to create a BetLeg
function createLeg(overrides: Partial<BetLeg>): BetLeg {
  return {
    market: 'Pts',
    entities: [],
    ...overrides,
  };
}

describe('computeOverUnderStats', () => {
  describe('parlay exclusion (default behavior)', () => {
    it('excludes parlays by default', () => {
      const bets: Bet[] = [
        createBet({
          id: 'parlay-over',
          betType: 'parlay',
          stake: 10,
          payout: 30,
          result: 'win',
          legs: [createLeg({ ou: 'Over', entities: ['Player A'] })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.over.count).toBe(0);
      expect(stats.over.stake).toBe(0);
      expect(stats.over.net).toBe(0);
    });

    it('excludes sgp bets by default', () => {
      const bets: Bet[] = [
        createBet({
          id: 'sgp-over',
          betType: 'sgp',
          stake: 15,
          payout: 45,
          result: 'win',
          legs: [createLeg({ ou: 'Over', entities: ['Player A'] })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.over.count).toBe(0);
    });

    it('excludes sgp_plus bets by default', () => {
      const bets: Bet[] = [
        createBet({
          id: 'sgp-plus-under',
          betType: 'sgp_plus',
          stake: 20,
          payout: 0,
          result: 'loss',
          legs: [createLeg({ ou: 'Under', entities: ['Player A'] })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.under.count).toBe(0);
    });

    it('includes single bets', () => {
      const bets: Bet[] = [
        createBet({
          id: 'single-over',
          betType: 'single',
          stake: 10,
          payout: 20,
          result: 'win',
          legs: [createLeg({ ou: 'Over', entities: ['Player A'] })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.over.count).toBe(1);
      expect(stats.over.stake).toBe(10);
      expect(stats.over.net).toBe(10); // 20 - 10
      expect(stats.over.wins).toBe(1);
    });

    it('can include parlays when excludeParlays is false', () => {
      const bets: Bet[] = [
        createBet({
          id: 'parlay-over',
          betType: 'parlay',
          stake: 10,
          payout: 30,
          result: 'win',
          legs: [createLeg({ ou: 'Over', entities: ['Player A'] })],
        }),
      ];

      const stats = computeOverUnderStats(bets, { excludeParlays: false });

      expect(stats.over.count).toBe(1);
      expect(stats.over.stake).toBe(10);
      expect(stats.over.net).toBe(20); // 30 - 10
    });
  });

  describe('basic stats computation', () => {
    it('computes over stats correctly', () => {
      const bets: Bet[] = [
        createBet({
          id: 'over-win',
          betType: 'single',
          stake: 10,
          payout: 20,
          result: 'win',
          legs: [createLeg({ ou: 'Over' })],
        }),
        createBet({
          id: 'over-loss',
          betType: 'single',
          stake: 15,
          payout: 0,
          result: 'loss',
          legs: [createLeg({ ou: 'Over' })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.over.count).toBe(2);
      expect(stats.over.wins).toBe(1);
      expect(stats.over.losses).toBe(1);
      expect(stats.over.stake).toBe(25); // 10 + 15
      expect(stats.over.net).toBe(-5); // (20-10) + (0-15) = 10 + (-15)
    });

    it('computes under stats correctly', () => {
      const bets: Bet[] = [
        createBet({
          id: 'under-win',
          betType: 'single',
          stake: 20,
          payout: 35,
          result: 'win',
          legs: [createLeg({ ou: 'Under' })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.under.count).toBe(1);
      expect(stats.under.wins).toBe(1);
      expect(stats.under.losses).toBe(0);
      expect(stats.under.stake).toBe(20);
      expect(stats.under.net).toBe(15); // 35 - 20
    });

    it('calculates ROI correctly', () => {
      const bets: Bet[] = [
        createBet({
          id: 'over',
          betType: 'single',
          stake: 100,
          payout: 150,
          result: 'win',
          legs: [createLeg({ ou: 'Over' })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      // ROI = (net / stake) * 100 = (50 / 100) * 100 = 50%
      expect(stats.over.roi).toBe(50);
    });

    it('handles pending bets (net = 0)', () => {
      const bets: Bet[] = [
        createBet({
          id: 'pending-over',
          betType: 'single',
          stake: 10,
          payout: 0,
          result: 'pending',
          legs: [createLeg({ ou: 'Over' })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.over.count).toBe(1);
      expect(stats.over.stake).toBe(10);
      expect(stats.over.net).toBe(0); // pending = 0
      expect(stats.over.wins).toBe(0);
      expect(stats.over.losses).toBe(0);
    });

    it('handles bets without O/U legs', () => {
      const bets: Bet[] = [
        createBet({
          id: 'no-ou',
          betType: 'single',
          stake: 10,
          payout: 20,
          result: 'win',
          legs: [createLeg({ entities: ['Player'] })], // No ou field
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.over.count).toBe(0);
      expect(stats.under.count).toBe(0);
    });

    it('handles bets without legs', () => {
      const bets: Bet[] = [
        createBet({
          id: 'no-legs',
          betType: 'single',
          stake: 10,
          payout: 20,
          result: 'win',
          ou: 'Over', // bet-level ou, but no legs
        }),
      ];

      const stats = computeOverUnderStats(bets);

      // bet.ou is ignored - only leg.ou is processed
      expect(stats.over.count).toBe(0);
    });
  });

  describe('entity filter', () => {
    it('filters by entity when entityFilter is provided', () => {
      const bets: Bet[] = [
        createBet({
          id: 'player-a-over',
          betType: 'single',
          stake: 10,
          payout: 20,
          result: 'win',
          legs: [createLeg({ ou: 'Over', entities: ['Player A'] })],
        }),
        createBet({
          id: 'player-b-over',
          betType: 'single',
          stake: 15,
          payout: 30,
          result: 'win',
          legs: [createLeg({ ou: 'Over', entities: ['Player B'] })],
        }),
      ];

      const stats = computeOverUnderStats(bets, {
        entityFilter: { entity: 'Player A' },
      });

      // Only Player A's bet should be counted
      expect(stats.over.count).toBe(1);
      expect(stats.over.stake).toBe(10);
    });

    it('uses custom matcher when provided', () => {
      const bets: Bet[] = [
        createBet({
          id: 'lebron-over',
          betType: 'single',
          stake: 10,
          payout: 20,
          result: 'win',
          legs: [createLeg({ ou: 'Over', entities: ['LeBron James'] })],
        }),
      ];

      // Custom matcher that does case-insensitive matching
      const customMatcher = (leg: BetLeg, bet: Bet, target: string) => {
        return leg.entities?.some(e => e.toLowerCase() === target.toLowerCase()) ?? false;
      };

      const stats = computeOverUnderStats(bets, {
        entityFilter: {
          entity: 'lebron james', // lowercase
          matcher: customMatcher,
        },
      });

      expect(stats.over.count).toBe(1);
    });
  });

  describe('useEntityMoneyContribution option', () => {
    it('uses full ticket stake/net by default', () => {
      const bets: Bet[] = [
        createBet({
          id: 'single-over',
          betType: 'single',
          stake: 10,
          payout: 20,
          result: 'win',
          legs: [createLeg({ ou: 'Over' })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.over.stake).toBe(10);
      expect(stats.over.net).toBe(10);
    });

    it('uses entity money contribution when enabled', () => {
      // For single bets, getEntityMoneyContribution returns full stake/net
      const singleBet = createBet({
        id: 'single-over',
        betType: 'single',
        stake: 10,
        payout: 20,
        result: 'win',
        legs: [createLeg({ ou: 'Over' })],
      });

      const stats = computeOverUnderStats([singleBet], {
        useEntityMoneyContribution: true,
      });

      // Single bet: should still get full stake/net
      expect(stats.over.stake).toBe(10);
      expect(stats.over.net).toBe(10);
    });

    it('returns 0 stake/net for parlays with useEntityMoneyContribution', () => {
      // Even with excludeParlays: false, useEntityMoneyContribution returns 0 for parlays
      const parlayBet = createBet({
        id: 'parlay-over',
        betType: 'parlay',
        stake: 10,
        payout: 30,
        result: 'win',
        legs: [createLeg({ ou: 'Over' })],
      });

      const stats = computeOverUnderStats([parlayBet], {
        excludeParlays: false,
        useEntityMoneyContribution: true,
      });

      // Parlay is counted (excludeParlays: false) but money contribution is 0
      expect(stats.over.count).toBe(1);
      expect(stats.over.stake).toBe(0); // getEntityMoneyContribution returns 0 for parlays
      expect(stats.over.net).toBe(0);
    });
  });

  describe('mixed dataset', () => {
    it('correctly separates over and under in mixed dataset', () => {
      const bets: Bet[] = [
        createBet({
          id: 'over-1',
          betType: 'single',
          stake: 10,
          payout: 20,
          result: 'win',
          legs: [createLeg({ ou: 'Over' })],
        }),
        createBet({
          id: 'under-1',
          betType: 'single',
          stake: 15,
          payout: 0,
          result: 'loss',
          legs: [createLeg({ ou: 'Under' })],
        }),
        createBet({
          id: 'parlay-over', // Should be excluded
          betType: 'parlay',
          stake: 100,
          payout: 500,
          result: 'win',
          legs: [createLeg({ ou: 'Over' })],
        }),
      ];

      const stats = computeOverUnderStats(bets);

      expect(stats.over.count).toBe(1);
      expect(stats.over.stake).toBe(10);
      expect(stats.under.count).toBe(1);
      expect(stats.under.stake).toBe(15);
    });
  });
});

describe('filterBetsByMarketCategory', () => {
  const bets: Bet[] = [
    createBet({ id: 'props', marketCategory: 'Props' }),
    createBet({ id: 'main', marketCategory: 'Main Markets' }),
    createBet({ id: 'parlays', marketCategory: 'Parlays' }),
    createBet({ id: 'futures', marketCategory: 'Futures' }),
  ];

  it('filters to props only', () => {
    const filtered = filterBetsByMarketCategory(bets, 'props');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('props');
  });

  it('filters to totals (Main Markets) only', () => {
    const filtered = filterBetsByMarketCategory(bets, 'totals');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('main');
  });

  it('filters to all (Props + Main Markets)', () => {
    const filtered = filterBetsByMarketCategory(bets, 'all');
    expect(filtered).toHaveLength(2);
    expect(filtered.map(b => b.id).sort()).toEqual(['main', 'props']);
  });
});
