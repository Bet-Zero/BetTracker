/**
 * Live vs Pre-Match Tests - Phase 2B
 *
 * Enforces PG-9: LiveVsPreMatch breakdown must use canonical net (getNetNumeric).
 *
 * This test verifies the computation logic extracted from DashboardView.tsx
 * and BySportView.tsx LiveVsPreMatchBreakdown components.
 */

import { describe, it, expect } from 'vitest';
import { Bet } from '../../types';
import { getNetNumeric } from '../../services/displaySemantics';

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

/**
 * Compute Live vs Pre-Match stats using canonical net.
 * This mirrors the logic in DashboardView.tsx LiveVsPreMatchBreakdown.
 */
export function computeLiveVsPreMatchStats(bets: Bet[]) {
  const stats = {
    live: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 },
    preMatch: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 },
  };

  for (const bet of bets) {
    // PG-9: Must use canonical net source (getNetNumeric)
    const net = getNetNumeric(bet);
    const target = bet.isLive ? stats.live : stats.preMatch;

    target.count++;
    target.stake += bet.stake;
    target.net += net;

    if (bet.result === 'win') target.wins++;
    if (bet.result === 'loss') target.losses++;
  }

  return stats;
}

describe('PG-9: Live vs Pre-Match Canonical Net', () => {
  describe('computeLiveVsPreMatchStats', () => {
    it('uses getNetNumeric for net calculation (canonical source)', () => {
      const bets: Bet[] = [
        createBet({ id: '1', isLive: true, stake: 10, payout: 25, result: 'win' }),
        createBet({ id: '2', isLive: false, stake: 10, payout: 0, result: 'loss' }),
        createBet({ id: '3', isLive: true, stake: 10, payout: 0, result: 'pending' }),
      ];

      const stats = computeLiveVsPreMatchStats(bets);

      // Live bet 1: net = 25 - 10 = 15
      // Live bet 3: net = 0 (pending)
      // Live total: 15 + 0 = 15
      expect(stats.live.net).toBe(15);
      expect(stats.live.count).toBe(2);
      expect(stats.live.wins).toBe(1);

      // Pre-match bet 2: net = 0 - 10 = -10
      expect(stats.preMatch.net).toBe(-10);
      expect(stats.preMatch.count).toBe(1);
      expect(stats.preMatch.losses).toBe(1);
    });

    it('pending bets contribute 0 to net (not -stake)', () => {
      const pendingLive = createBet({ id: '1', isLive: true, stake: 100, payout: 0, result: 'pending' });
      const pendingPre = createBet({ id: '2', isLive: false, stake: 100, payout: 0, result: 'pending' });

      const stats = computeLiveVsPreMatchStats([pendingLive, pendingPre]);

      // Pending should NOT count as -stake
      expect(stats.live.net).toBe(0);
      expect(stats.preMatch.net).toBe(0);

      // But stake should still be counted
      expect(stats.live.stake).toBe(100);
      expect(stats.preMatch.stake).toBe(100);
    });

    it('correctly separates live and pre-match bets', () => {
      const bets: Bet[] = [
        createBet({ id: '1', isLive: true, stake: 10, payout: 20, result: 'win' }),
        createBet({ id: '2', isLive: true, stake: 10, payout: 0, result: 'loss' }),
        createBet({ id: '3', isLive: false, stake: 20, payout: 40, result: 'win' }),
      ];

      const stats = computeLiveVsPreMatchStats(bets);

      expect(stats.live.count).toBe(2);
      expect(stats.preMatch.count).toBe(1);
      expect(stats.live.stake).toBe(20);
      expect(stats.preMatch.stake).toBe(20);
    });

    it('treats undefined isLive as pre-match (falsy)', () => {
      const betWithoutIsLive = createBet({ id: '1', stake: 10, payout: 20, result: 'win' });
      // isLive is undefined by default in createBet

      const stats = computeLiveVsPreMatchStats([betWithoutIsLive]);

      expect(stats.preMatch.count).toBe(1);
      expect(stats.live.count).toBe(0);
    });

    it('win/loss counts are independent of net calculation', () => {
      const bets: Bet[] = [
        createBet({ id: '1', isLive: true, stake: 10, payout: 20, result: 'win' }),
        createBet({ id: '2', isLive: true, stake: 10, payout: 10, result: 'push' }),
        createBet({ id: '3', isLive: true, stake: 10, payout: 0, result: 'pending' }),
      ];

      const stats = computeLiveVsPreMatchStats(bets);

      // Push and pending don't count as win or loss
      expect(stats.live.wins).toBe(1);
      expect(stats.live.losses).toBe(0);
      expect(stats.live.count).toBe(3); // All 3 bets are counted
    });

    it('reconciles with manual getNetNumeric sum', () => {
      const bets: Bet[] = [
        createBet({ id: '1', isLive: true, stake: 10, payout: 25, result: 'win' }),
        createBet({ id: '2', isLive: true, stake: 10, payout: 0, result: 'loss' }),
        createBet({ id: '3', isLive: false, stake: 10, payout: 18, result: 'win' }),
      ];

      const stats = computeLiveVsPreMatchStats(bets);

      // Manual calculation
      const liveBets = bets.filter(b => b.isLive);
      const preMatchBets = bets.filter(b => !b.isLive);
      const expectedLiveNet = liveBets.reduce((sum, bet) => sum + getNetNumeric(bet), 0);
      const expectedPreMatchNet = preMatchBets.reduce((sum, bet) => sum + getNetNumeric(bet), 0);

      expect(stats.live.net).toBe(expectedLiveNet);
      expect(stats.preMatch.net).toBe(expectedPreMatchNet);
    });
  });
});
