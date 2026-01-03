import {
  calculateRoi,
  computeOverallStats,
  computeProfitOverTime,
  addToMap,
  computeStatsByDimension,
  mapToStatsArray,
} from '../services/aggregationService';
import { Bet } from '../types';

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

describe('aggregationService', () => {
  const mockBets: Bet[] = [
    { id: '1', stake: 100, payout: 200, result: 'win', placedAt: '2023-01-01T10:00:00Z', sport: 'NBA' },
    { id: '2', stake: 100, payout: 0, result: 'loss', placedAt: '2023-01-02T10:00:00Z', sport: 'NFL' },
    { id: '3', stake: 50, payout: 50, result: 'push', placedAt: '2023-01-03T10:00:00Z', sport: 'NBA' },
  ];

  describe('calculateRoi', () => {
    it('calculates correctly', () => {
      expect(calculateRoi(50, 100)).toBe(50);
      expect(calculateRoi(-50, 100)).toBe(-50);
    });
    it('handles zero stake', () => {
      expect(calculateRoi(10, 0)).toBe(0);
    });
  });

  describe('computeOverallStats', () => {
    it('aggregates stats correctly', () => {
      const stats = computeOverallStats(mockBets);
      expect(stats.totalBets).toBe(3);
      expect(stats.totalWagered).toBe(250);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.pushes).toBe(1);
      
      // Net: (200-100) + (0-100) + (50-50) = 100 - 100 + 0 = 0
      expect(stats.netProfit).toBe(0);
      expect(stats.roi).toBe(0);
      expect(stats.winRate).toBe(50); // 1 win / 2 decided
    });
  });

  describe('computeProfitOverTime', () => {
    it('calculates cumulative profit', () => {
      // Order: Win (+100), Loss (-100), Push (0) -> 100, 0, 0
      const data = computeProfitOverTime(mockBets);
      expect(data).toHaveLength(3);
      expect(data[0].profit).toBe(100);
      expect(data[1].profit).toBe(0);
      expect(data[2].profit).toBe(0);
    });
  });
  
  describe('computeStatsByDimension', () => {
      it('groups by sport', () => {
          const map = computeStatsByDimension(mockBets, b => b.sport);
          expect(map.size).toBe(2);
          expect(map.get('NBA')?.count).toBe(2);
          expect(map.get('NFL')?.count).toBe(1);
      });
  });

  // ===========================================================================
  // PG-8: Win rate edge cases (Phase 2B enforcement)
  // ===========================================================================
  describe('PG-8: Win rate edge cases', () => {
    it('returns winRate = 0 for dataset with only pushes', () => {
      const onlyPushes: Bet[] = [
        createBet({ id: '1', stake: 10, payout: 10, result: 'push', placedAt: '2024-01-01T10:00:00Z' }),
        createBet({ id: '2', stake: 20, payout: 20, result: 'push', placedAt: '2024-01-02T10:00:00Z' }),
        createBet({ id: '3', stake: 15, payout: 15, result: 'push', placedAt: '2024-01-03T10:00:00Z' }),
      ];

      const stats = computeOverallStats(onlyPushes);

      // Win rate is 0 because there are no decided (win/loss) bets
      expect(stats.winRate).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.pushes).toBe(3);
    });

    it('returns winRate = 0 for dataset with only pending bets', () => {
      const onlyPending: Bet[] = [
        createBet({ id: '1', stake: 10, payout: 0, result: 'pending', placedAt: '2024-01-01T10:00:00Z' }),
        createBet({ id: '2', stake: 20, payout: 0, result: 'pending', placedAt: '2024-01-02T10:00:00Z' }),
      ];

      const stats = computeOverallStats(onlyPending);

      // Win rate is 0 because there are no decided bets
      expect(stats.winRate).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.pending).toBe(2);
    });

    it('returns winRate = 0 for dataset with pushes and pending only', () => {
      const pushesAndPending: Bet[] = [
        createBet({ id: '1', stake: 10, payout: 10, result: 'push', placedAt: '2024-01-01T10:00:00Z' }),
        createBet({ id: '2', stake: 20, payout: 0, result: 'pending', placedAt: '2024-01-02T10:00:00Z' }),
      ];

      const stats = computeOverallStats(pushesAndPending);

      // Win rate is 0 because no wins or losses to calculate from
      expect(stats.winRate).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
    });

    it('pushes and pending are excluded from win rate denominator', () => {
      const mixed: Bet[] = [
        createBet({ id: '1', stake: 10, payout: 20, result: 'win', placedAt: '2024-01-01T10:00:00Z' }),
        createBet({ id: '2', stake: 10, payout: 0, result: 'loss', placedAt: '2024-01-02T10:00:00Z' }),
        createBet({ id: '3', stake: 10, payout: 10, result: 'push', placedAt: '2024-01-03T10:00:00Z' }),
        createBet({ id: '4', stake: 10, payout: 0, result: 'pending', placedAt: '2024-01-04T10:00:00Z' }),
      ];

      const stats = computeOverallStats(mixed);

      // Win rate should be 50% (1 win / 2 decided)
      // Pushes and pending do NOT count in the denominator
      expect(stats.winRate).toBe(50);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.pushes).toBe(1);
      expect(stats.pending).toBe(1);
    });

    it('returns winRate = 100 for all wins', () => {
      const allWins: Bet[] = [
        createBet({ id: '1', stake: 10, payout: 20, result: 'win', placedAt: '2024-01-01T10:00:00Z' }),
        createBet({ id: '2', stake: 10, payout: 25, result: 'win', placedAt: '2024-01-02T10:00:00Z' }),
      ];

      const stats = computeOverallStats(allWins);

      expect(stats.winRate).toBe(100);
    });

    it('returns winRate = 0 for all losses', () => {
      const allLosses: Bet[] = [
        createBet({ id: '1', stake: 10, payout: 0, result: 'loss', placedAt: '2024-01-01T10:00:00Z' }),
        createBet({ id: '2', stake: 10, payout: 0, result: 'loss', placedAt: '2024-01-02T10:00:00Z' }),
      ];

      const stats = computeOverallStats(allLosses);

      expect(stats.winRate).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(2);
    });

    it('returns winRate = 0 for empty dataset', () => {
      const stats = computeOverallStats([]);

      expect(stats.winRate).toBe(0);
    });
  });
});
