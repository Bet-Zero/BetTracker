/**
 * Invariant Tests - Phase 2B
 *
 * Enforces critical invariants defined in the Master Doc:
 * - PG-1 / INV-1/2/3: Pending bet net semantics
 * - INV-13/INV-14: KPI calculations use canonical sources
 *
 * These tests ensure that:
 * 1. KPI net total equals sum of getNetNumeric for all bets
 * 2. Pending bet net for KPI is 0
 * 3. Display net for pending is blank
 * 4. Settled bet table-display net equals payout - stake
 */

import { describe, it, expect } from 'vitest';
import {
  DEADLY_BETS,
  DEADLY_EXPECTED_NETS,
  DEADLY_EXPECTED_TOTAL_NET,
  SINGLE_PENDING,
  SINGLE_WIN,
  SINGLE_LOSS,
  SINGLE_PUSH,
  DEADLY_BETS_SETTLED,
} from './fixtures/deadly-fixtures';
import { getNetNumeric, getNetDisplay } from '../../services/displaySemantics';
import { computeOverallStats } from '../../services/aggregationService';
import { betToFinalRows } from '../../parsing/shared/betToFinalRows';

describe('Invariant Tests - Phase 2B', () => {
  // ===========================================================================
  // PG-1 / INV-1: KPI net total MUST equal sum(getNetNumeric)
  // ===========================================================================
  describe('PG-1 / INV-1: KPI Net Total Reconciliation', () => {
    it('computeOverallStats.netProfit equals sum of getNetNumeric for all bets', () => {
      const stats = computeOverallStats(DEADLY_BETS);
      const expectedNet = DEADLY_BETS.reduce((sum, bet) => sum + getNetNumeric(bet), 0);

      expect(stats.netProfit).toBe(expectedNet);
      expect(stats.netProfit).toBe(DEADLY_EXPECTED_TOTAL_NET);
    });

    it('individual bet getNetNumeric values match expected', () => {
      for (const bet of DEADLY_BETS) {
        const actualNet = getNetNumeric(bet);
        const expectedNet = DEADLY_EXPECTED_NETS[bet.id];
        expect(actualNet).toBe(expectedNet);
      }
    });

    it('getNetNumeric for settled bets equals payout - stake', () => {
      for (const bet of DEADLY_BETS_SETTLED) {
        const actualNet = getNetNumeric(bet);
        const expectedNet = bet.payout - bet.stake;
        expect(actualNet).toBe(expectedNet);
      }
    });
  });

  // ===========================================================================
  // PG-1 / INV-2: Pending bet net for KPI MUST be 0
  // ===========================================================================
  describe('PG-1 / INV-2: Pending Bet KPI Net', () => {
    it('getNetNumeric returns 0 for pending bets', () => {
      expect(getNetNumeric(SINGLE_PENDING)).toBe(0);
    });

    it('pending bet does not affect KPI totals (contributes 0)', () => {
      // Compare stats with and without the pending bet
      const betsWithPending = [SINGLE_WIN, SINGLE_PENDING];
      const betsWithoutPending = [SINGLE_WIN];

      const statsWithPending = computeOverallStats(betsWithPending);
      const statsWithoutPending = computeOverallStats(betsWithoutPending);

      // Net should be the same because pending contributes 0
      expect(statsWithPending.netProfit).toBe(statsWithoutPending.netProfit);
    });

    it('pending bet stake is still counted in totalWagered', () => {
      const betsWithPending = [SINGLE_WIN, SINGLE_PENDING];
      const stats = computeOverallStats(betsWithPending);

      // Stake should include both bets
      expect(stats.totalWagered).toBe(SINGLE_WIN.stake + SINGLE_PENDING.stake);
    });
  });

  // ===========================================================================
  // PG-1 / INV-3: Display net for pending MUST be blank
  // ===========================================================================
  describe('PG-1 / INV-3: Pending Bet Display Net', () => {
    it('getNetDisplay returns empty string for pending bets', () => {
      expect(getNetDisplay(SINGLE_PENDING)).toBe('');
    });

    it('getNetDisplay returns formatted value for settled bets', () => {
      expect(getNetDisplay(SINGLE_WIN)).not.toBe('');
      expect(getNetDisplay(SINGLE_LOSS)).not.toBe('');
      expect(getNetDisplay(SINGLE_PUSH)).not.toBe('');
    });

    it('betToFinalRows pending net is blank (not "0", not "-stake")', () => {
      const rows = betToFinalRows(SINGLE_PENDING);
      expect(rows.length).toBeGreaterThan(0);

      const row = rows[0];
      // Net should be blank string, NOT "0" and NOT negative stake
      expect(row.Net).toBe('');
      expect(row._rawNet).toBeUndefined();
    });

    it('betToFinalRows settled bet net reflects payout - stake', () => {
      const winRows = betToFinalRows(SINGLE_WIN);
      expect(winRows[0].Net).not.toBe('');
      expect(winRows[0]._rawNet).toBe(SINGLE_WIN.payout - SINGLE_WIN.stake);

      const lossRows = betToFinalRows(SINGLE_LOSS);
      expect(lossRows[0].Net).not.toBe('');
      expect(lossRows[0]._rawNet).toBe(SINGLE_LOSS.payout - SINGLE_LOSS.stake);

      const pushRows = betToFinalRows(SINGLE_PUSH);
      expect(pushRows[0].Net).not.toBe('');
      expect(pushRows[0]._rawNet).toBe(SINGLE_PUSH.payout - SINGLE_PUSH.stake);
    });
  });

  // ===========================================================================
  // INV-13/INV-14: Reconciliation never uses FinalRows as source-of-truth
  // ===========================================================================
  describe('INV-13/INV-14: Canonical Source Verification', () => {
    it('getNetNumeric is the canonical net function (not derived from FinalRows)', () => {
      // This test verifies the architectural intent:
      // getNetNumeric operates on Bet objects, not FinalRow objects
      // We verify this by checking that getNetNumeric result matches
      // the expected formula directly: payout - stake (or 0 for pending)

      for (const bet of DEADLY_BETS) {
        const canonicalNet = getNetNumeric(bet);
        const expectedNet = bet.result === 'pending' ? 0 : bet.payout - bet.stake;
        expect(canonicalNet).toBe(expectedNet);
      }
    });

    it('computeOverallStats uses getNetNumeric internally (not FinalRows)', () => {
      // Verify that computeOverallStats produces the same result as
      // manually summing getNetNumeric for each bet
      const stats = computeOverallStats(DEADLY_BETS);
      const manualSum = DEADLY_BETS.reduce((sum, bet) => sum + getNetNumeric(bet), 0);

      expect(stats.netProfit).toBe(manualSum);
    });

    it('FinalRow Net is for display only, not KPI calculations', () => {
      // Generate FinalRows and verify they are NOT the source for KPI
      // by showing that pending bets have different Net representation

      const pendingRows = betToFinalRows(SINGLE_PENDING);
      const pendingFinalRowNet = pendingRows[0].Net; // Display: ''
      const pendingCanonicalNet = getNetNumeric(SINGLE_PENDING); // KPI: 0

      // These are semantically different:
      // - Empty string means "not yet decided" (display)
      // - 0 means "contributes nothing to totals" (KPI)
      expect(pendingFinalRowNet).toBe(''); // Display
      expect(pendingCanonicalNet).toBe(0); // KPI

      // The distinction is intentional and correct
    });
  });

  // ===========================================================================
  // Additional invariant: Win/Loss/Push count accuracy
  // ===========================================================================
  describe('Win/Loss/Push Count Accuracy', () => {
    it('computeOverallStats counts wins/losses/pushes/pending correctly', () => {
      const stats = computeOverallStats(DEADLY_BETS);

      // Count expected values from DEADLY_BETS
      let expectedWins = 0;
      let expectedLosses = 0;
      let expectedPushes = 0;
      let expectedPending = 0;

      for (const bet of DEADLY_BETS) {
        if (bet.result === 'win') expectedWins++;
        else if (bet.result === 'loss') expectedLosses++;
        else if (bet.result === 'push') expectedPushes++;
        else if (bet.result === 'pending') expectedPending++;
      }

      expect(stats.wins).toBe(expectedWins);
      expect(stats.losses).toBe(expectedLosses);
      expect(stats.pushes).toBe(expectedPushes);
      expect(stats.pending).toBe(expectedPending);
    });
  });
});
