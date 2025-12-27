/**
 * Aggregation Service Test Suite
 * 
 * Tests for services/aggregationService.ts to lock in behavior:
 * - calculateRoi including zero-stake handling
 * - computeOverallStats with wins/losses/pushes/pending
 * - computeProfitOverTime chronological ordering + cumulative math
 * - addToMap and mapToStatsArray for dimension grouping
 */

import { describe, it, expect } from 'vitest';
import { Bet } from '../types';
import {
  calculateRoi,
  computeOverallStats,
  computeProfitOverTime,
  addToMap,
  mapToStatsArray,
  DimensionStats,
} from './aggregationService';

// --- Test Data Factory ---

function createMockBet(overrides: Partial<Bet> = {}): Bet {
  return {
    id: 'test-id',
    book: 'FanDuel',
    betId: 'bet-123',
    placedAt: new Date().toISOString(),
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

// --- calculateRoi Tests ---

describe('calculateRoi', () => {
  it('returns correct percentage for positive ROI', () => {
    // Net profit of 10 on stake of 100 = 10% ROI
    expect(calculateRoi(10, 100)).toBe(10);
  });

  it('returns correct percentage for negative ROI', () => {
    // Net loss of -20 on stake of 100 = -20% ROI
    expect(calculateRoi(-20, 100)).toBe(-20);
  });

  it('returns 0 for zero stake', () => {
    expect(calculateRoi(10, 0)).toBe(0);
  });

  it('returns 0 for zero net and zero stake', () => {
    expect(calculateRoi(0, 0)).toBe(0);
  });

  it('handles large positive ROI', () => {
    // Net profit of 200 on stake of 100 = 200% ROI
    expect(calculateRoi(200, 100)).toBe(200);
  });

  it('handles fractional ROI', () => {
    // Net profit of 5 on stake of 100 = 5% ROI
    expect(calculateRoi(5, 100)).toBeCloseTo(5);
  });
});

// --- computeOverallStats Tests ---

describe('computeOverallStats', () => {
  it('returns zeroes for empty array', () => {
    const result = computeOverallStats([]);
    expect(result).toEqual({
      totalBets: 0,
      totalWagered: 0,
      netProfit: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      pending: 0,
      winRate: 0,
      roi: 0,
    });
  });

  it('computes correct totals for wins', () => {
    const bets: Bet[] = [
      createMockBet({ stake: 10, payout: 20, result: 'win' }), // net +10
      createMockBet({ stake: 20, payout: 40, result: 'win' }), // net +20
    ];
    const result = computeOverallStats(bets);
    
    expect(result.totalBets).toBe(2);
    expect(result.totalWagered).toBe(30);
    expect(result.netProfit).toBe(30);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBe(100);
    expect(result.roi).toBeCloseTo(100); // 30/30 * 100
  });

  it('computes correct totals for losses', () => {
    const bets: Bet[] = [
      createMockBet({ stake: 10, payout: 0, result: 'loss' }), // net -10
      createMockBet({ stake: 20, payout: 0, result: 'loss' }), // net -20
    ];
    const result = computeOverallStats(bets);
    
    expect(result.totalBets).toBe(2);
    expect(result.totalWagered).toBe(30);
    expect(result.netProfit).toBe(-30);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(2);
    expect(result.winRate).toBe(0);
    expect(result.roi).toBeCloseTo(-100); // -30/30 * 100
  });

  it('computes correct win rate excluding pushes and pending', () => {
    const bets: Bet[] = [
      createMockBet({ stake: 10, payout: 20, result: 'win' }),   // win
      createMockBet({ stake: 10, payout: 0, result: 'loss' }),   // loss
      createMockBet({ stake: 10, payout: 10, result: 'push' }),  // push (stake returned)
      createMockBet({ stake: 10, payout: 0, result: 'pending' }), // pending
    ];
    const result = computeOverallStats(bets);
    
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
    expect(result.pushes).toBe(1);
    expect(result.pending).toBe(1);
    // Win rate is wins/(wins+losses) = 1/2 = 50%
    expect(result.winRate).toBe(50);
  });

  it('handles pending bets contributing net = 0', () => {
    const bets: Bet[] = [
      createMockBet({ stake: 100, payout: 0, result: 'pending' }),
    ];
    const result = computeOverallStats(bets);
    
    expect(result.totalWagered).toBe(100);
    expect(result.netProfit).toBe(-100); // payout(0) - stake(100)
    expect(result.pending).toBe(1);
  });

  it('handles mixed results correctly', () => {
    const bets: Bet[] = [
      createMockBet({ stake: 10, payout: 19, result: 'win' }),   // net +9
      createMockBet({ stake: 10, payout: 0, result: 'loss' }),   // net -10
      createMockBet({ stake: 10, payout: 19, result: 'win' }),   // net +9
    ];
    const result = computeOverallStats(bets);
    
    expect(result.totalBets).toBe(3);
    expect(result.totalWagered).toBe(30);
    expect(result.netProfit).toBe(8); // +9 - 10 + 9
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.winRate).toBeCloseTo(66.67, 1); // 2/3
    expect(result.roi).toBeCloseTo(26.67, 1); // 8/30 * 100
  });
});

// --- computeProfitOverTime Tests ---

describe('computeProfitOverTime', () => {
  it('returns empty array for empty input', () => {
    const result = computeProfitOverTime([]);
    expect(result).toEqual([]);
  });

  it('returns cumulative profit series', () => {
    const bets: Bet[] = [
      createMockBet({ placedAt: '2024-06-01T10:00:00.000Z', stake: 10, payout: 20 }), // net +10
      createMockBet({ placedAt: '2024-06-02T10:00:00.000Z', stake: 10, payout: 0 }),  // net -10
      createMockBet({ placedAt: '2024-06-03T10:00:00.000Z', stake: 10, payout: 25 }), // net +15
    ];
    const result = computeProfitOverTime(bets);
    
    expect(result).toHaveLength(3);
    expect(result[0].profit).toBe(10);  // cumulative: +10
    expect(result[1].profit).toBe(0);   // cumulative: +10 - 10 = 0
    expect(result[2].profit).toBe(15);  // cumulative: 0 + 15 = 15
  });

  it('sorts bets chronologically', () => {
    // Provide bets out of order
    const bets: Bet[] = [
      createMockBet({ id: '2', placedAt: '2024-06-02T10:00:00.000Z', stake: 10, payout: 20 }),
      createMockBet({ id: '1', placedAt: '2024-06-01T10:00:00.000Z', stake: 10, payout: 15 }),
      createMockBet({ id: '3', placedAt: '2024-06-03T10:00:00.000Z', stake: 10, payout: 30 }),
    ];
    const result = computeProfitOverTime(bets);
    
    // Should be ordered by date
    expect(result[0].date).toBe('2024-06-01');
    expect(result[1].date).toBe('2024-06-02');
    expect(result[2].date).toBe('2024-06-03');
    
    // Cumulative should be in sorted order
    expect(result[0].profit).toBe(5);  // First: +5
    expect(result[1].profit).toBe(15); // +5 + 10 = 15
    expect(result[2].profit).toBe(35); // +15 + 20 = 35
  });

  it('uses en-CA locale for date formatting (YYYY-MM-DD)', () => {
    const bets: Bet[] = [
      createMockBet({ placedAt: '2024-12-25T10:00:00.000Z', stake: 10, payout: 20 }),
    ];
    const result = computeProfitOverTime(bets);
    
    expect(result[0].date).toBe('2024-12-25');
  });

  it('handles single bet', () => {
    const bets: Bet[] = [
      createMockBet({ placedAt: '2024-06-01T10:00:00.000Z', stake: 10, payout: 15 }),
    ];
    const result = computeProfitOverTime(bets);
    
    expect(result).toHaveLength(1);
    expect(result[0].profit).toBe(5);
    expect(result[0].date).toBe('2024-06-01');
  });
});

// --- addToMap Tests ---

describe('addToMap', () => {
  it('creates new entry if key does not exist', () => {
    const map = new Map<string, DimensionStats>();
    addToMap(map, 'NBA', 10, 5, 'win');
    
    expect(map.get('NBA')).toEqual({
      count: 1,
      stake: 10,
      net: 5,
      wins: 1,
      losses: 0,
    });
  });

  it('accumulates to existing entry', () => {
    const map = new Map<string, DimensionStats>();
    addToMap(map, 'NBA', 10, 5, 'win');
    addToMap(map, 'NBA', 20, -15, 'loss');
    
    expect(map.get('NBA')).toEqual({
      count: 2,
      stake: 30,
      net: -10,
      wins: 1,
      losses: 1,
    });
  });

  it('ignores empty key', () => {
    const map = new Map<string, DimensionStats>();
    addToMap(map, '', 10, 5, 'win');
    
    expect(map.size).toBe(0);
  });

  it('counts only wins and losses (not push or pending)', () => {
    const map = new Map<string, DimensionStats>();
    addToMap(map, 'NBA', 10, 0, 'push');
    addToMap(map, 'NBA', 10, 0, 'pending');
    
    expect(map.get('NBA')).toEqual({
      count: 2,
      stake: 20,
      net: 0,
      wins: 0,
      losses: 0,
    });
  });

  it('handles multiple different keys', () => {
    const map = new Map<string, DimensionStats>();
    addToMap(map, 'NBA', 10, 5, 'win');
    addToMap(map, 'NFL', 20, -10, 'loss');
    
    expect(map.size).toBe(2);
    expect(map.get('NBA')?.wins).toBe(1);
    expect(map.get('NFL')?.losses).toBe(1);
  });
});

// --- mapToStatsArray Tests ---

describe('mapToStatsArray', () => {
  it('converts map to array with ROI calculated', () => {
    const map = new Map<string, DimensionStats>();
    map.set('NBA', { count: 2, stake: 100, net: 20, wins: 2, losses: 0 });
    map.set('NFL', { count: 1, stake: 50, net: -50, wins: 0, losses: 1 });
    
    const result = mapToStatsArray(map);
    
    expect(result).toHaveLength(2);
    
    const nba = result.find(r => r.name === 'NBA')!;
    expect(nba.roi).toBe(20); // 20/100 * 100
    expect(nba.count).toBe(2);
    
    const nfl = result.find(r => r.name === 'NFL')!;
    expect(nfl.roi).toBe(-100); // -50/50 * 100
    expect(nfl.count).toBe(1);
  });

  it('returns empty array for empty map', () => {
    const map = new Map<string, DimensionStats>();
    const result = mapToStatsArray(map);
    
    expect(result).toEqual([]);
  });

  it('handles zero stake correctly', () => {
    const map = new Map<string, DimensionStats>();
    map.set('Test', { count: 0, stake: 0, net: 0, wins: 0, losses: 0 });
    
    const result = mapToStatsArray(map);
    
    expect(result[0].roi).toBe(0);
  });
});
