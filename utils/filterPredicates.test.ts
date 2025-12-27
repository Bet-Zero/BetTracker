/**
 * Filter Predicates Test Suite
 * 
 * Tests for utils/filterPredicates.ts to lock in behavior:
 * - filterByBetType (includes sgp_plus in parlays)
 * - date range filtering boundaries
 * - category, sport, book, and search filtering
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Bet, BetType } from '../types';
import {
  isParlayType,
  filterByBetType,
  getDateRangeStart,
  filterByDateRange,
  filterByCategory,
  filterBySport,
  filterByBook,
  filterBySearchTerm,
  DateRange,
  CustomDateRange,
} from './filterPredicates';

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

// --- isParlayType Tests ---

describe('isParlayType', () => {
  it('returns true for sgp', () => {
    expect(isParlayType('sgp')).toBe(true);
  });

  it('returns true for sgp_plus', () => {
    expect(isParlayType('sgp_plus')).toBe(true);
  });

  it('returns true for parlay', () => {
    expect(isParlayType('parlay')).toBe(true);
  });

  it('returns false for single', () => {
    expect(isParlayType('single')).toBe(false);
  });

  it('returns false for live', () => {
    expect(isParlayType('live')).toBe(false);
  });

  it('returns false for other', () => {
    expect(isParlayType('other')).toBe(false);
  });
});

// --- filterByBetType Tests ---

describe('filterByBetType', () => {
  const bets: Bet[] = [
    createMockBet({ id: '1', betType: 'single' }),
    createMockBet({ id: '2', betType: 'parlay' }),
    createMockBet({ id: '3', betType: 'sgp' }),
    createMockBet({ id: '4', betType: 'sgp_plus' }),
    createMockBet({ id: '5', betType: 'live' }),
    createMockBet({ id: '6', betType: 'other' }),
  ];

  it('returns only single bets when filter is singles', () => {
    const result = filterByBetType(bets, 'singles');
    expect(result).toHaveLength(1);
    expect(result[0].betType).toBe('single');
  });

  it('returns sgp, sgp_plus, and parlay when filter is parlays', () => {
    const result = filterByBetType(bets, 'parlays');
    expect(result).toHaveLength(3);
    expect(result.map(b => b.betType)).toEqual(['parlay', 'sgp', 'sgp_plus']);
  });

  it('returns all bets when filter is all', () => {
    const result = filterByBetType(bets, 'all');
    expect(result).toHaveLength(6);
  });

  it('returns empty array when no matching bets', () => {
    const singlesOnly = [createMockBet({ betType: 'single' })];
    const result = filterByBetType(singlesOnly, 'parlays');
    expect(result).toHaveLength(0);
  });
});

// --- getDateRangeStart Tests ---

describe('getDateRangeStart', () => {
  beforeEach(() => {
    // Mock Date to a known time: 2024-06-15T12:00:00.000Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 24 hours ago for 1d', () => {
    const result = getDateRangeStart('1d');
    expect(result.getTime()).toBe(new Date('2024-06-14T12:00:00.000Z').getTime());
  });

  it('returns 3 days ago for 3d', () => {
    const result = getDateRangeStart('3d');
    expect(result.getTime()).toBe(new Date('2024-06-12T12:00:00.000Z').getTime());
  });

  it('returns 7 days ago for 1w', () => {
    const result = getDateRangeStart('1w');
    expect(result.getTime()).toBe(new Date('2024-06-08T12:00:00.000Z').getTime());
  });

  it('returns 1 month ago for 1m', () => {
    const result = getDateRangeStart('1m');
    // May 15 at same time
    expect(result.getMonth()).toBe(4); // May (0-indexed)
    expect(result.getDate()).toBe(15);
  });

  it('returns 1 year ago for 1y', () => {
    const result = getDateRangeStart('1y');
    expect(result.getFullYear()).toBe(2023);
    expect(result.getMonth()).toBe(5); // June (0-indexed)
  });
});

// --- filterByDateRange Tests ---

describe('filterByDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const bets: Bet[] = [
    createMockBet({ id: '1', placedAt: '2024-06-15T10:00:00.000Z' }), // Today
    createMockBet({ id: '2', placedAt: '2024-06-14T10:00:00.000Z' }), // Yesterday
    createMockBet({ id: '3', placedAt: '2024-06-10T10:00:00.000Z' }), // 5 days ago
    createMockBet({ id: '4', placedAt: '2024-05-15T10:00:00.000Z' }), // 1 month ago
    createMockBet({ id: '5', placedAt: '2023-06-01T10:00:00.000Z' }), // Over 1 year ago
  ];

  it('returns all bets when range is all', () => {
    const result = filterByDateRange(bets, 'all');
    expect(result).toHaveLength(5);
  });

  it('returns bets within last 24 hours for 1d', () => {
    const result = filterByDateRange(bets, '1d');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns bets within last 3 days for 3d', () => {
    const result = filterByDateRange(bets, '3d');
    expect(result).toHaveLength(2);
    expect(result.map(b => b.id)).toEqual(['1', '2']);
  });

  it('returns bets within last week for 1w', () => {
    const result = filterByDateRange(bets, '1w');
    expect(result).toHaveLength(3);
    expect(result.map(b => b.id)).toEqual(['1', '2', '3']);
  });

  it('returns bets within last month for 1m', () => {
    const result = filterByDateRange(bets, '1m');
    // May 15 10:00 is before June 15 12:00 minus 1 month (May 15 12:00), so 3 bets
    expect(result).toHaveLength(3);
    expect(result.map(b => b.id)).toEqual(['1', '2', '3']);
  });

  it('returns bets within last year for 1y', () => {
    const result = filterByDateRange(bets, '1y');
    expect(result).toHaveLength(4); // Excludes bet from June 2023
    expect(result.map(b => b.id)).toEqual(['1', '2', '3', '4']);
  });

  describe('custom date range', () => {
    it('filters within custom date range boundaries', () => {
      const customRange: CustomDateRange = {
        start: '2024-06-10',
        end: '2024-06-14',
      };
      const result = filterByDateRange(bets, 'custom', customRange);
      expect(result).toHaveLength(2);
      expect(result.map(b => b.id)).toEqual(['2', '3']);
    });

    it('handles start date only', () => {
      const customRange: CustomDateRange = {
        start: '2024-06-14',
        end: '',
      };
      const result = filterByDateRange(bets, 'custom', customRange);
      expect(result).toHaveLength(2);
      expect(result.map(b => b.id)).toEqual(['1', '2']);
    });

    it('handles end date only', () => {
      const customRange: CustomDateRange = {
        start: '',
        end: '2024-06-10',
      };
      const result = filterByDateRange(bets, 'custom', customRange);
      expect(result).toHaveLength(3);
      expect(result.map(b => b.id)).toEqual(['3', '4', '5']);
    });

    it('returns all bets when no custom range provided', () => {
      const result = filterByDateRange(bets, 'custom');
      expect(result).toHaveLength(5);
    });
  });
});

// --- filterByCategory Tests ---

describe('filterByCategory', () => {
  const bets: Bet[] = [
    createMockBet({ id: '1', marketCategory: 'Props' }),
    createMockBet({ id: '2', marketCategory: 'Main Markets' }),
    createMockBet({ id: '3', marketCategory: 'Futures' }),
    createMockBet({ id: '4', marketCategory: 'Props' }),
  ];

  it('returns all bets when category is all', () => {
    const result = filterByCategory(bets, 'all');
    expect(result).toHaveLength(4);
  });

  it('returns only Props bets', () => {
    const result = filterByCategory(bets, 'Props');
    expect(result).toHaveLength(2);
    expect(result.every(b => b.marketCategory === 'Props')).toBe(true);
  });

  it('returns only Main Markets bets', () => {
    const result = filterByCategory(bets, 'Main Markets');
    expect(result).toHaveLength(1);
    expect(result[0].marketCategory).toBe('Main Markets');
  });
});

// --- filterBySport Tests ---

describe('filterBySport', () => {
  const bets: Bet[] = [
    createMockBet({ id: '1', sport: 'NBA' }),
    createMockBet({ id: '2', sport: 'NFL' }),
    createMockBet({ id: '3', sport: 'NBA' }),
    createMockBet({ id: '4', sport: 'MLB' }),
  ];

  it('returns only bets for specified sport', () => {
    const result = filterBySport(bets, 'NBA');
    expect(result).toHaveLength(2);
    expect(result.every(b => b.sport === 'NBA')).toBe(true);
  });

  it('returns empty array when no matching sport', () => {
    const result = filterBySport(bets, 'NHL');
    expect(result).toHaveLength(0);
  });
});

// --- filterByBook Tests ---

describe('filterByBook', () => {
  const bets: Bet[] = [
    createMockBet({ id: '1', book: 'FanDuel' }),
    createMockBet({ id: '2', book: 'DraftKings' }),
    createMockBet({ id: '3', book: 'FanDuel' }),
  ];

  it('returns all bets when book is all', () => {
    const result = filterByBook(bets, 'all');
    expect(result).toHaveLength(3);
  });

  it('returns only bets for specified book', () => {
    const result = filterByBook(bets, 'FanDuel');
    expect(result).toHaveLength(2);
    expect(result.every(b => b.book === 'FanDuel')).toBe(true);
  });
});

// --- filterBySearchTerm Tests ---

describe('filterBySearchTerm', () => {
  const bets: Bet[] = [
    createMockBet({ id: '1', name: 'LeBron James', type: 'Points', category: 'Props', tail: 'Sharp' }),
    createMockBet({ id: '2', name: 'Stephen Curry', type: 'Threes', category: 'Props' }),
    createMockBet({ id: '3', name: 'Lakers', type: 'Spread', category: 'Main Markets' }),
  ];

  it('returns all bets when search term is empty', () => {
    const result = filterBySearchTerm(bets, '');
    expect(result).toHaveLength(3);
  });

  it('matches on name field (case insensitive)', () => {
    const result = filterBySearchTerm(bets, 'lebron');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('LeBron James');
  });

  it('matches on type field', () => {
    const result = filterBySearchTerm(bets, 'points');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Points');
  });

  it('matches on category field', () => {
    const result = filterBySearchTerm(bets, 'main');
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('Main Markets');
  });

  it('matches on tail field', () => {
    const result = filterBySearchTerm(bets, 'sharp');
    expect(result).toHaveLength(1);
    expect(result[0].tail).toBe('Sharp');
  });

  it('matches partial strings', () => {
    const result = filterBySearchTerm(bets, 'cur');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Stephen Curry');
  });

  it('can limit search to specific fields', () => {
    const result = filterBySearchTerm(bets, 'props', ['name']);
    expect(result).toHaveLength(0); // 'props' is in category, not name
  });

  it('handles bets with undefined fields', () => {
    const betsWithUndefined = [
      createMockBet({ id: '1', name: undefined, type: 'Points' }),
    ];
    const result = filterBySearchTerm(betsWithUndefined, 'test');
    expect(result).toHaveLength(0);
  });
});
