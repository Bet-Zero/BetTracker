import {
  isParlayType,
  createBetTypePredicate,
  createDateRangePredicate,
  createBookPredicate,
  createSportPredicate,
  createMarketCategoryPredicate,
  createEntityPredicate,
  getDateRangeStart,
} from './filterPredicates';
import { Bet } from '../types';

describe('filterPredicates', () => {
  // Create a helper function to build properly typed mock bets
  const createMockBet = (overrides: Partial<Bet> & Pick<Bet, 'id' | 'betType'>): Bet => ({
    id: overrides.id,
    betType: overrides.betType,
    placedAt: overrides.placedAt ?? new Date().toISOString(),
    book: overrides.book ?? 'DK',
    sport: overrides.sport ?? 'NBA',
    marketCategory: overrides.marketCategory ?? 'prop',
    legs: overrides.legs ?? [],
    // Add other required Bet fields with sensible defaults
    ...overrides,
  });

  const mockBets: Bet[] = [
    createMockBet({ id: '1', betType: 'single', book: 'DK', sport: 'NBA', marketCategory: 'prop' }),
    createMockBet({ id: '2', betType: 'parlay', placedAt: new Date(Date.now() - 100000).toISOString(), book: 'FD', sport: 'NFL', marketCategory: 'moneyline' }),
    createMockBet({ id: '3', betType: 'sgp', placedAt: new Date('2023-01-01').toISOString(), book: 'MGM', sport: 'NBA', marketCategory: 'prop' }),
  ];

  describe('isParlayType', () => {
    it('returns true for parlay, sgp, sgp_plus', () => {
      expect(isParlayType('parlay')).toBe(true);
      expect(isParlayType('sgp')).toBe(true);
      expect(isParlayType('sgp_plus')).toBe(true);
    });
    it('returns false for single', () => {
      expect(isParlayType('single')).toBe(false);
    });
  });

  describe('createBetTypePredicate', () => {
    it('filters singles', () => {
      const predicate = createBetTypePredicate('singles');
      expect(mockBets.filter(predicate).map(b => b.id)).toEqual(['1']);
    });
    it('filters parlays', () => {
      const predicate = createBetTypePredicate('parlays');
      expect(mockBets.filter(predicate).map(b => b.id)).toEqual(['2', '3']);
    });
    it('returns all', () => {
      const predicate = createBetTypePredicate('all');
      expect(mockBets.filter(predicate)).toHaveLength(3);
    });
  });

  describe('createDateRangePredicate', () => {
    it('filters by preset range', () => {
      // Mock Date relies on system time, but getDateRangeStart uses standard logic.
      // 1d range should include recent bets.
      const predicate = createDateRangePredicate('1d');
      const recentBet = mockBets[0]; // Just created
      const oldBet = mockBets[2]; // 2023
      expect(predicate(recentBet)).toBe(true);
      expect(predicate(oldBet)).toBe(false);
    });
    
    it('filters by custom range', () => {
        const predicate = createDateRangePredicate('custom', { start: '2022-12-31', end: '2023-01-02' });
        expect(predicate(mockBets[2])).toBe(true); // 2023-01-01
        expect(predicate(mockBets[0])).toBe(false); // Today
    });
  });
  
  describe('createBookPredicate', () => {
      it('filters by book', () => {
          const predicate = createBookPredicate('DK');
          expect(mockBets.filter(predicate).map(b => b.id)).toEqual(['1']);
      });
  });
});
