/**
 * Time Bucketing Enforcement Tests - Phase 2B
 *
 * Enforces PG-10, INV-9, INV-10:
 * - Date range filtering MUST use placedAt, NOT settledAt
 * - Comparisons must be epoch-based and timezone-safe
 *
 * These tests construct scenarios where:
 * - placedAt is inside window but settledAt is outside
 * - placedAt is outside window but settledAt is inside
 *
 * The predicate must filter based SOLELY on placedAt.
 */

import { describe, it, expect } from 'vitest';
import {
  TIME_BUCKET_BET_PLACED_IN_SETTLED_OUT,
  TIME_BUCKET_BET_PLACED_OUT_SETTLED_IN,
  DEADLY_TIME_WINDOW,
  DEADLY_BETS,
} from './fixtures/deadly-fixtures';
import {
  createDateRangePredicate,
  CustomDateRange,
} from '../../utils/filterPredicates';
import { Bet } from '../../types';

describe('Time Bucketing Enforcement Tests - Phase 2B', () => {
  // ===========================================================================
  // PG-10 / INV-9: Filter based on placedAt, NOT settledAt
  // ===========================================================================
  describe('PG-10 / INV-9: placedAt-Based Filtering', () => {
    it('includes bet where placedAt is inside window (regardless of settledAt)', () => {
      // TIME_BUCKET_BET_PLACED_IN_SETTLED_OUT:
      // - placedAt: '2025-01-15T12:00:00Z' (IN window)
      // - settledAt: '2025-01-20T12:00:00Z' (OUT of window)
      // Window: 2025-01-14 to 2025-01-16

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);
      const result = predicate(TIME_BUCKET_BET_PLACED_IN_SETTLED_OUT);

      expect(result).toBe(true);
    });

    it('excludes bet where placedAt is outside window (even if settledAt is inside)', () => {
      // TIME_BUCKET_BET_PLACED_OUT_SETTLED_IN:
      // - placedAt: '2025-01-10T12:00:00Z' (OUT of window)
      // - settledAt: '2025-01-15T12:00:00Z' (IN window)
      // Window: 2025-01-14 to 2025-01-16

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);
      const result = predicate(TIME_BUCKET_BET_PLACED_OUT_SETTLED_IN);

      expect(result).toBe(false);
    });

    it('settledAt field is completely ignored by date filter', () => {
      // Create a bet with placedAt inside window and settledAt = undefined
      const betWithNoSettledAt: Bet = {
        ...TIME_BUCKET_BET_PLACED_IN_SETTLED_OUT,
        id: 'test-no-settled',
        settledAt: undefined,
      };

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);

      // Should still be included based on placedAt
      expect(predicate(betWithNoSettledAt)).toBe(true);
    });
  });

  // ===========================================================================
  // INV-10: Timezone-Safe Comparisons
  // ===========================================================================
  describe('INV-10: Timezone-Safe Comparisons', () => {
    it('handles UTC timestamps (Z suffix)', () => {
      const bet: Bet = {
        id: 'tz-test-utc',
        book: 'FanDuel',
        betId: 'tz-test-utc',
        placedAt: '2025-01-15T12:00:00Z', // UTC
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);
      expect(predicate(bet)).toBe(true);
    });

    it('handles positive timezone offset (+HH:MM)', () => {
      // 2025-01-15T20:00:00+08:00 = 2025-01-15T12:00:00Z (in UTC)
      // This is within the window (2025-01-14 to 2025-01-16)
      const bet: Bet = {
        id: 'tz-test-positive',
        book: 'FanDuel',
        betId: 'tz-test-positive',
        placedAt: '2025-01-15T20:00:00+08:00', // Beijing time
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);
      expect(predicate(bet)).toBe(true);
    });

    it('handles negative timezone offset (-HH:MM)', () => {
      // 2025-01-15T07:00:00-05:00 = 2025-01-15T12:00:00Z (in UTC)
      // This is within the window (2025-01-14 to 2025-01-16)
      const bet: Bet = {
        id: 'tz-test-negative',
        book: 'FanDuel',
        betId: 'tz-test-negative',
        placedAt: '2025-01-15T07:00:00-05:00', // Eastern time
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);
      expect(predicate(bet)).toBe(true);
    });

    it('correctly handles edge case at start of window', () => {
      // Window starts at 2025-01-14T00:00:00.000Z
      // Bet placed at exactly the start of window
      const betAtStart: Bet = {
        id: 'tz-test-start',
        book: 'FanDuel',
        betId: 'tz-test-start',
        placedAt: '2025-01-14T00:00:00.000Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);
      expect(predicate(betAtStart)).toBe(true);
    });

    it('correctly handles edge case at end of window', () => {
      // Window ends at 2025-01-16T23:59:59.999Z
      // Bet placed at exactly the end of window
      const betAtEnd: Bet = {
        id: 'tz-test-end',
        book: 'FanDuel',
        betId: 'tz-test-end',
        placedAt: '2025-01-16T23:59:59.999Z',
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);
      expect(predicate(betAtEnd)).toBe(true);
    });

    it('correctly excludes bet just before window start', () => {
      const betBeforeStart: Bet = {
        id: 'tz-test-before',
        book: 'FanDuel',
        betId: 'tz-test-before',
        placedAt: '2025-01-13T23:59:59.999Z', // Just before window
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);
      expect(predicate(betBeforeStart)).toBe(false);
    });

    it('correctly excludes bet just after window end', () => {
      const betAfterEnd: Bet = {
        id: 'tz-test-after',
        book: 'FanDuel',
        betId: 'tz-test-after',
        placedAt: '2025-01-17T00:00:00.000Z', // Just after window
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);
      expect(predicate(betAfterEnd)).toBe(false);
    });
  });

  // ===========================================================================
  // Preset Range Tests
  // ===========================================================================
  describe('Preset Range Uses placedAt', () => {
    it('preset "all" range includes all bets', () => {
      const predicate = createDateRangePredicate('all');

      for (const bet of DEADLY_BETS) {
        expect(predicate(bet)).toBe(true);
      }
    });

    it('preset range filters based on placedAt relative to now', () => {
      // Create a bet placed "now" and one placed long ago
      const now = new Date();
      const recentBet: Bet = {
        id: 'recent-bet',
        book: 'FanDuel',
        betId: 'recent-bet',
        placedAt: now.toISOString(),
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const oldBet: Bet = {
        id: 'old-bet',
        book: 'FanDuel',
        betId: 'old-bet',
        placedAt: '2020-01-01T00:00:00Z', // Very old
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const predicate1d = createDateRangePredicate('1d');

      expect(predicate1d(recentBet)).toBe(true);
      expect(predicate1d(oldBet)).toBe(false);
    });
  });

  // ===========================================================================
  // Epoch-Based Comparison Verification
  // ===========================================================================
  describe('Epoch-Based Comparison', () => {
    it('comparison is done via Date parsing (epoch-based)', () => {
      // These two timestamps represent the exact same moment in time
      const utcTimestamp = '2025-01-15T12:00:00.000Z';
      const estTimestamp = '2025-01-15T07:00:00.000-05:00';

      const utcDate = new Date(utcTimestamp);
      const estDate = new Date(estTimestamp);

      // Verify they're the same epoch time
      expect(utcDate.getTime()).toBe(estDate.getTime());

      // Create bets with these timestamps
      const utcBet: Bet = {
        id: 'utc-bet',
        book: 'FanDuel',
        betId: 'utc-bet',
        placedAt: utcTimestamp,
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      const estBet: Bet = {
        id: 'est-bet',
        book: 'FanDuel',
        betId: 'est-bet',
        placedAt: estTimestamp,
        betType: 'single',
        marketCategory: 'Props',
        sport: 'NBA',
        description: 'Test',
        stake: 10,
        payout: 20,
        result: 'win',
      };

      // Both should be treated identically by the predicate
      const predicate = createDateRangePredicate('custom', DEADLY_TIME_WINDOW as CustomDateRange);

      expect(predicate(utcBet)).toBe(predicate(estBet));
    });
  });
});
