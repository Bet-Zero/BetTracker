import {
  calculateRoi,
  computeOverallStats,
  computeProfitOverTime,
  addToMap,
  computeStatsByDimension,
  mapToStatsArray,
} from '../services/aggregationService';
import { Bet } from '../types';

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
});
