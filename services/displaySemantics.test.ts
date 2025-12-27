import { describe, it, expect } from 'vitest';
import {
  getNetNumeric,
  getNetDisplay,
  getAttributedStakeAndNet,
  STAKE_ATTRIBUTION_POLICY,
  isDecidedResult,
  isPendingResult,
  isParlayBetType,
  getEntityMoneyContribution,
} from './displaySemantics';
import { Bet, BetResult } from '../types';

// Helper to create a minimal Bet object for testing
function createTestBet(overrides: Partial<Bet>): Bet {
  return {
    id: 'test-1',
    book: 'FanDuel',
    betId: 'test-1',
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

describe('displaySemantics', () => {
  describe('getNetNumeric', () => {
    it('calculates net correctly for a win', () => {
      const bet = createTestBet({ stake: 10, payout: 25, result: 'win' });
      expect(getNetNumeric(bet)).toBe(15);
    });

    it('calculates net correctly for a loss', () => {
      const bet = createTestBet({ stake: 10, payout: 0, result: 'loss' });
      expect(getNetNumeric(bet)).toBe(-10);
    });

    it('calculates net correctly for a push', () => {
      const bet = createTestBet({ stake: 10, payout: 10, result: 'push' });
      expect(getNetNumeric(bet)).toBe(0);
    });

    it('returns 0 for pending bets (not -stake)', () => {
      // This is the key behavioral fix: pending should NOT count as -stake
      const bet = createTestBet({ stake: 10, payout: 0, result: 'pending' });
      expect(getNetNumeric(bet)).toBe(0);
    });

    it('handles edge cases with zero stake', () => {
      const bet = createTestBet({ stake: 0, payout: 0, result: 'pending' });
      expect(getNetNumeric(bet)).toBe(0);
    });

    it('handles large values correctly', () => {
      const bet = createTestBet({ stake: 1000, payout: 2500, result: 'win' });
      expect(getNetNumeric(bet)).toBe(1500);
    });
  });

  describe('getNetDisplay', () => {
    it('returns formatted net for a win', () => {
      const bet = createTestBet({ stake: 10, payout: 25, result: 'win' });
      expect(getNetDisplay(bet)).toBe('15.00');
    });

    it('returns formatted negative net for a loss', () => {
      const bet = createTestBet({ stake: 10, payout: 0, result: 'loss' });
      expect(getNetDisplay(bet)).toBe('-10.00');
    });

    it('returns formatted zero net for a push', () => {
      const bet = createTestBet({ stake: 10, payout: 10, result: 'push' });
      expect(getNetDisplay(bet)).toBe('0.00');
    });

    it('returns empty string for pending bets', () => {
      // This matches finalRowValidators behavior
      const bet = createTestBet({ stake: 10, payout: 0, result: 'pending' });
      expect(getNetDisplay(bet)).toBe('');
    });
  });

  describe('STAKE_ATTRIBUTION_POLICY', () => {
    it('is defined as ticket-level', () => {
      expect(STAKE_ATTRIBUTION_POLICY).toBe('ticket-level');
    });
  });

  describe('getAttributedStakeAndNet', () => {
    it('returns full stake and net with default (ticket-level) policy', () => {
      const bet = createTestBet({ stake: 100, payout: 200, result: 'win' });
      const result = getAttributedStakeAndNet({ bet, legCount: 3 });
      
      expect(result.stake).toBe(100); // Full stake, not divided
      expect(result.net).toBe(100);   // Full net (200 - 100), not divided
    });

    it('returns full stake and net for single-leg bet', () => {
      const bet = createTestBet({ stake: 50, payout: 0, result: 'loss' });
      const result = getAttributedStakeAndNet({ bet, legCount: 1 });
      
      expect(result.stake).toBe(50);
      expect(result.net).toBe(-50);
    });

    it('returns 0 net for pending bets regardless of policy', () => {
      const bet = createTestBet({ stake: 100, payout: 0, result: 'pending' });
      const result = getAttributedStakeAndNet({ bet, legCount: 3 });
      
      expect(result.stake).toBe(100);
      expect(result.net).toBe(0); // Pending = 0 net
    });

    it('divides stake and net with split policy', () => {
      const bet = createTestBet({ stake: 90, payout: 180, result: 'win' });
      const result = getAttributedStakeAndNet({ bet, legCount: 3, policy: 'split' });
      
      expect(result.stake).toBe(30);  // 90 / 3
      expect(result.net).toBe(30);    // (180 - 90) / 3 = 90 / 3
    });

    it('does not divide with split policy when legCount is 1', () => {
      const bet = createTestBet({ stake: 100, payout: 200, result: 'win' });
      const result = getAttributedStakeAndNet({ bet, legCount: 1, policy: 'split' });
      
      expect(result.stake).toBe(100);
      expect(result.net).toBe(100);
    });
  });

  describe('isDecidedResult', () => {
    it('returns true for win', () => {
      expect(isDecidedResult('win')).toBe(true);
    });

    it('returns true for loss', () => {
      expect(isDecidedResult('loss')).toBe(true);
    });

    it('returns true for push', () => {
      expect(isDecidedResult('push')).toBe(true);
    });

    it('returns false for pending', () => {
      expect(isDecidedResult('pending')).toBe(false);
    });
  });

  describe('isPendingResult', () => {
    it('returns true for pending', () => {
      expect(isPendingResult('pending')).toBe(true);
    });

    it('returns false for win', () => {
      expect(isPendingResult('win')).toBe(false);
    });

    it('returns false for loss', () => {
      expect(isPendingResult('loss')).toBe(false);
    });

    it('returns false for push', () => {
      expect(isPendingResult('push')).toBe(false);
    });
  });

  // ============================================
  // LOCK PASS: P4 Parlay Semantics Tests
  // ============================================

  describe('isParlayBetType', () => {
    it('returns true for parlay', () => {
      expect(isParlayBetType('parlay')).toBe(true);
    });

    it('returns true for sgp', () => {
      expect(isParlayBetType('sgp')).toBe(true);
    });

    it('returns true for sgp_plus', () => {
      expect(isParlayBetType('sgp_plus')).toBe(true);
    });

    it('returns false for single', () => {
      expect(isParlayBetType('single')).toBe(false);
    });

    it('returns false for live', () => {
      expect(isParlayBetType('live')).toBe(false);
    });

    it('returns false for other', () => {
      expect(isParlayBetType('other')).toBe(false);
    });
  });

  describe('getEntityMoneyContribution', () => {
    it('returns {stake: 0, net: 0} for parlay bet type', () => {
      const bet = createTestBet({ betType: 'parlay', stake: 100, payout: 500, result: 'win' });
      const result = getEntityMoneyContribution(bet);
      expect(result.stake).toBe(0);
      expect(result.net).toBe(0);
    });

    it('returns {stake: 0, net: 0} for sgp bet type', () => {
      const bet = createTestBet({ betType: 'sgp', stake: 50, payout: 200, result: 'win' });
      const result = getEntityMoneyContribution(bet);
      expect(result.stake).toBe(0);
      expect(result.net).toBe(0);
    });

    it('returns {stake: 0, net: 0} for sgp_plus bet type', () => {
      const bet = createTestBet({ betType: 'sgp_plus', stake: 75, payout: 0, result: 'loss' });
      const result = getEntityMoneyContribution(bet);
      expect(result.stake).toBe(0);
      expect(result.net).toBe(0);
    });

    it('returns full stake and net for single bet type', () => {
      const bet = createTestBet({ betType: 'single', stake: 100, payout: 250, result: 'win' });
      const result = getEntityMoneyContribution(bet);
      expect(result.stake).toBe(100);
      expect(result.net).toBe(150); // 250 - 100
    });

    it('returns full stake and negative net for single loss', () => {
      const bet = createTestBet({ betType: 'single', stake: 100, payout: 0, result: 'loss' });
      const result = getEntityMoneyContribution(bet);
      expect(result.stake).toBe(100);
      expect(result.net).toBe(-100); // 0 - 100
    });

    it('returns full stake and zero net for pending single', () => {
      const bet = createTestBet({ betType: 'single', stake: 100, payout: 0, result: 'pending' });
      const result = getEntityMoneyContribution(bet);
      expect(result.stake).toBe(100);
      expect(result.net).toBe(0); // pending = 0 net
    });
  });
});

