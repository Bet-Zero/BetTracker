/**
 * Reconciliation Tests - Phase 2B
 *
 * Enforces INV-5 and PG-6: KPI values must reconcile across different
 * calculation paths.
 *
 * Tests verify that:
 * 1. computeOverallStats.net equals sum of getNetNumeric
 * 2. Profit-over-time final cumulative value equals total net
 * 3. ROI matches calculateRoi(net, stake)
 * 4. Reconciliation holds for different filter contexts
 */

import { describe, it, expect } from 'vitest';
import {
  DEADLY_BETS,
  DEADLY_BETS_SETTLED,
  DEADLY_EXPECTED_TOTAL_NET,
  DEADLY_EXPECTED_TOTAL_STAKE,
} from './fixtures/deadly-fixtures';
import { getNetNumeric } from '../../services/displaySemantics';
import {
  computeOverallStats,
  computeProfitOverTime,
  calculateRoi,
} from '../../services/aggregationService';

describe('Reconciliation Tests - Phase 2B', () => {
  // ===========================================================================
  // INV-5: computeOverallStats.net equals sum(getNetNumeric)
  // ===========================================================================
  describe('INV-5: Overall Stats Net Reconciliation', () => {
    it('computeOverallStats.netProfit reconciles with sum of getNetNumeric (all bets)', () => {
      const stats = computeOverallStats(DEADLY_BETS);
      const manualSum = DEADLY_BETS.reduce((sum, bet) => sum + getNetNumeric(bet), 0);

      expect(stats.netProfit).toBe(manualSum);
      expect(stats.netProfit).toBe(DEADLY_EXPECTED_TOTAL_NET);
    });

    it('computeOverallStats.netProfit reconciles with sum of getNetNumeric (settled only)', () => {
      const stats = computeOverallStats(DEADLY_BETS_SETTLED);
      const manualSum = DEADLY_BETS_SETTLED.reduce((sum, bet) => sum + getNetNumeric(bet), 0);

      expect(stats.netProfit).toBe(manualSum);
    });

    it('totalWagered equals sum of stakes', () => {
      const stats = computeOverallStats(DEADLY_BETS);
      const manualStakeSum = DEADLY_BETS.reduce((sum, bet) => sum + bet.stake, 0);

      expect(stats.totalWagered).toBe(manualStakeSum);
      expect(stats.totalWagered).toBe(DEADLY_EXPECTED_TOTAL_STAKE);
    });
  });

  // ===========================================================================
  // PG-6: Profit-over-time final cumulative equals total net
  // ===========================================================================
  describe('PG-6: Profit Over Time Reconciliation', () => {
    it('final cumulative profit equals total net (all bets)', () => {
      const profitOverTime = computeProfitOverTime(DEADLY_BETS);
      const stats = computeOverallStats(DEADLY_BETS);

      // The last data point should have the cumulative total
      if (profitOverTime.length > 0) {
        const finalCumulativeProfit = profitOverTime[profitOverTime.length - 1].profit;
        expect(finalCumulativeProfit).toBe(stats.netProfit);
        expect(finalCumulativeProfit).toBe(DEADLY_EXPECTED_TOTAL_NET);
      }
    });

    it('final cumulative profit equals total net (settled only)', () => {
      const profitOverTime = computeProfitOverTime(DEADLY_BETS_SETTLED);
      const stats = computeOverallStats(DEADLY_BETS_SETTLED);

      if (profitOverTime.length > 0) {
        const finalCumulativeProfit = profitOverTime[profitOverTime.length - 1].profit;
        expect(finalCumulativeProfit).toBe(stats.netProfit);
      }
    });

    it('cumulative profit grows correctly with each bet', () => {
      // Sort bets by placedAt (same as computeProfitOverTime does internally)
      const sortedBets = [...DEADLY_BETS].sort(
        (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()
      );

      const profitOverTime = computeProfitOverTime(DEADLY_BETS);

      // Verify cumulative profit at each step
      let expectedCumulative = 0;
      for (let i = 0; i < profitOverTime.length; i++) {
        expectedCumulative += getNetNumeric(sortedBets[i]);
        expect(profitOverTime[i].profit).toBe(expectedCumulative);
      }
    });
  });

  // ===========================================================================
  // ROI Reconciliation
  // ===========================================================================
  describe('ROI Reconciliation', () => {
    it('computeOverallStats.roi matches calculateRoi(net, stake)', () => {
      const stats = computeOverallStats(DEADLY_BETS);
      const expectedRoi = calculateRoi(stats.netProfit, stats.totalWagered);

      expect(stats.roi).toBe(expectedRoi);
    });

    it('ROI is 0 when totalWagered is 0', () => {
      const emptyStats = computeOverallStats([]);
      expect(emptyStats.roi).toBe(0);
    });

    it('ROI formula is (net / stake) * 100', () => {
      const stats = computeOverallStats(DEADLY_BETS);

      if (stats.totalWagered > 0) {
        const manualRoi = (stats.netProfit / stats.totalWagered) * 100;
        expect(stats.roi).toBe(manualRoi);
      }
    });
  });

  // ===========================================================================
  // Filter Context: Normal set (wins/losses/push/pending)
  // ===========================================================================
  describe('Filter Context 1: Normal Mixed Set', () => {
    it('reconciliation holds for mixed results set', () => {
      const mixedBets = DEADLY_BETS; // Contains wins, losses, pushes, pending

      const stats = computeOverallStats(mixedBets);
      const manualNet = mixedBets.reduce((sum, bet) => sum + getNetNumeric(bet), 0);
      const manualStake = mixedBets.reduce((sum, bet) => sum + bet.stake, 0);
      const profitOverTime = computeProfitOverTime(mixedBets);

      // Net reconciliation
      expect(stats.netProfit).toBe(manualNet);

      // Stake reconciliation
      expect(stats.totalWagered).toBe(manualStake);

      // Profit-over-time reconciliation
      if (profitOverTime.length > 0) {
        expect(profitOverTime[profitOverTime.length - 1].profit).toBe(manualNet);
      }

      // ROI reconciliation
      expect(stats.roi).toBe(calculateRoi(manualNet, manualStake));
    });
  });

  // ===========================================================================
  // Filter Context: Settled only (excludes pending)
  // ===========================================================================
  describe('Filter Context 2: Settled Only Set', () => {
    it('reconciliation holds for settled-only set', () => {
      const settledBets = DEADLY_BETS_SETTLED;

      const stats = computeOverallStats(settledBets);
      const manualNet = settledBets.reduce((sum, bet) => sum + getNetNumeric(bet), 0);
      const manualStake = settledBets.reduce((sum, bet) => sum + bet.stake, 0);
      const profitOverTime = computeProfitOverTime(settledBets);

      // Net reconciliation
      expect(stats.netProfit).toBe(manualNet);

      // Stake reconciliation
      expect(stats.totalWagered).toBe(manualStake);

      // Profit-over-time reconciliation
      if (profitOverTime.length > 0) {
        expect(profitOverTime[profitOverTime.length - 1].profit).toBe(manualNet);
      }

      // ROI reconciliation
      expect(stats.roi).toBe(calculateRoi(manualNet, manualStake));
    });

    it('settled set has no pending bets', () => {
      const stats = computeOverallStats(DEADLY_BETS_SETTLED);
      expect(stats.pending).toBe(0);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================
  describe('Edge Cases', () => {
    it('empty bet array produces zeroed stats', () => {
      const stats = computeOverallStats([]);

      expect(stats.totalBets).toBe(0);
      expect(stats.totalWagered).toBe(0);
      expect(stats.netProfit).toBe(0);
      expect(stats.wins).toBe(0);
      expect(stats.losses).toBe(0);
      expect(stats.pushes).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.roi).toBe(0);
    });

    it('single bet array reconciles correctly', () => {
      const singleBetArray = [DEADLY_BETS[0]]; // SINGLE_WIN
      const stats = computeOverallStats(singleBetArray);
      const profitOverTime = computeProfitOverTime(singleBetArray);

      expect(stats.netProfit).toBe(getNetNumeric(singleBetArray[0]));
      expect(stats.totalWagered).toBe(singleBetArray[0].stake);

      if (profitOverTime.length > 0) {
        expect(profitOverTime[0].profit).toBe(stats.netProfit);
      }
    });
  });
});
