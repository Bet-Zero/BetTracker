/**
 * Over/Under Breakdown Tests - Phase 2B
 *
 * Enforces PG-3 / INV-8: Over/Under breakdown must EXCLUDE parlays.
 *
 * This test verifies the computation logic extracted from DashboardView.tsx
 * and BySportView.tsx OverUnderBreakdown components.
 */

import { describe, it, expect } from 'vitest';
import { Bet, BetLeg } from '../../types';
import { getNetNumeric, isParlayBetType } from '../../services/displaySemantics';
import {
  SINGLE_OVER,
  SINGLE_UNDER,
  PARLAY_OVER,
  DEADLY_BETS,
  DEADLY_BETS_PARLAYS,
  DEADLY_BETS_OU_SINGLES,
} from './fixtures/deadly-fixtures';

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

// Helper to create a BetLeg
function createLeg(overrides: Partial<BetLeg>): BetLeg {
  return {
    market: 'Pts',
    entities: [],
    ...overrides,
  };
}

/**
 * O/U breakdown stats structure
 */
interface OUStats {
  count: number;
  wins: number;
  losses: number;
  stake: number;
  net: number;
}

/**
 * Compute Over/Under breakdown stats.
 * This mirrors the logic in DashboardView.tsx OverUnderBreakdown.
 *
 * KEY REQUIREMENT (PG-3 / INV-8): Parlays must be EXCLUDED.
 */
export function computeOverUnderBreakdown(bets: Bet[]): { over: OUStats; under: OUStats } {
  const stats = {
    over: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 },
    under: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 },
  };

  for (const bet of bets) {
    // PG-3 / INV-8: MUST skip parlays
    if (isParlayBetType(bet.betType)) {
      continue;
    }

    // Process legs for O/U
    if (bet.legs && bet.legs.length > 0) {
      for (const leg of bet.legs) {
        if (leg.ou) {
          const ou = leg.ou.toLowerCase() as 'over' | 'under';
          const net = getNetNumeric(bet);

          stats[ou].count++;
          stats[ou].stake += bet.stake;
          stats[ou].net += net;

          if (bet.result === 'win') stats[ou].wins++;
          if (bet.result === 'loss') stats[ou].losses++;
        }
      }
    }
  }

  return stats;
}

describe('PG-3 / INV-8: Over/Under Breakdown Parlay Exclusion', () => {
  describe('computeOverUnderBreakdown', () => {
    it('excludes parlay bets from O/U breakdown', () => {
      // PARLAY_OVER has an O/U leg but should be excluded
      const stats = computeOverUnderBreakdown([PARLAY_OVER]);

      // Parlay should NOT contribute to O/U counts
      expect(stats.over.count).toBe(0);
      expect(stats.under.count).toBe(0);
      expect(stats.over.net).toBe(0);
      expect(stats.under.net).toBe(0);
    });

    it('includes single O/U bets in breakdown', () => {
      const stats = computeOverUnderBreakdown(DEADLY_BETS_OU_SINGLES);

      // SINGLE_OVER: win, stake=10, net=10
      // SINGLE_UNDER: loss, stake=10, net=-10
      expect(stats.over.count).toBe(1);
      expect(stats.under.count).toBe(1);
      expect(stats.over.net).toBe(10);
      expect(stats.under.net).toBe(-10);
    });

    it('excludes sgp and sgp_plus bet types', () => {
      const sgpWithOU = createBet({
        id: 'sgp-ou',
        betType: 'sgp',
        stake: 10,
        payout: 30,
        result: 'win',
        legs: [createLeg({ ou: 'Over', entities: ['Player'] })],
      });

      const sgpPlusWithOU = createBet({
        id: 'sgp-plus-ou',
        betType: 'sgp_plus',
        stake: 10,
        payout: 0,
        result: 'loss',
        legs: [createLeg({ ou: 'Under', entities: ['Player'] })],
      });

      const stats = computeOverUnderBreakdown([sgpWithOU, sgpPlusWithOU]);

      // Both should be excluded
      expect(stats.over.count).toBe(0);
      expect(stats.under.count).toBe(0);
    });

    it('mixed dataset: only non-parlay O/U bets counted', () => {
      // Use DEADLY_BETS which includes both parlays and singles
      const stats = computeOverUnderBreakdown(DEADLY_BETS);

      // From DEADLY_BETS, only SINGLE_OVER and SINGLE_UNDER should be counted
      // PARLAY_OVER should be excluded
      expect(stats.over.count).toBe(1); // SINGLE_OVER only
      expect(stats.under.count).toBe(1); // SINGLE_UNDER only
    });

    it('parlay O/U leg does NOT contribute to breakdown', () => {
      const parlayWithOverLeg = createBet({
        id: 'parlay-over-leg',
        betType: 'parlay',
        stake: 20,
        payout: 60,
        result: 'win',
        legs: [
          createLeg({ ou: 'Over', entities: ['Player A'] }),
          createLeg({ entities: ['Player B'] }), // No O/U
        ],
      });

      const stats = computeOverUnderBreakdown([parlayWithOverLeg]);

      // Even though there's an Over leg, parlay is excluded
      expect(stats.over.count).toBe(0);
      expect(stats.over.net).toBe(0);
    });

    it('bet without legs is not counted in O/U (leg.ou required, not bet.ou)', () => {
      // NOTE: The O/U breakdown processes leg.ou, NOT bet.ou
      // This is intentional because the actual O/U selection lives on the leg,
      // while bet.ou is just a convenience field. This test verifies that
      // bet-level ou is NOT used for O/U breakdown calculations.
      const betWithoutLegs = createBet({
        id: 'no-legs',
        betType: 'single',
        stake: 10,
        payout: 20,
        result: 'win',
        ou: 'Over', // Bet-level ou - should be IGNORED (no legs to process)
      });

      const stats = computeOverUnderBreakdown([betWithoutLegs]);

      // No legs means no O/U data to process (bet.ou is ignored)
      expect(stats.over.count).toBe(0);
      expect(stats.under.count).toBe(0);
    });

    it('single bet with O/U leg is counted correctly', () => {
      const singleOver = createBet({
        id: 'single-over',
        betType: 'single',
        stake: 15,
        payout: 30,
        result: 'win',
        legs: [createLeg({ ou: 'Over', entities: ['Player'] })],
      });

      const stats = computeOverUnderBreakdown([singleOver]);

      expect(stats.over.count).toBe(1);
      expect(stats.over.stake).toBe(15);
      expect(stats.over.net).toBe(15); // 30 - 15
      expect(stats.over.wins).toBe(1);
    });

    it('pending bets contribute 0 to net (consistent with getNetNumeric)', () => {
      const pendingOver = createBet({
        id: 'pending-over',
        betType: 'single',
        stake: 10,
        payout: 0,
        result: 'pending',
        legs: [createLeg({ ou: 'Over', entities: ['Player'] })],
      });

      const stats = computeOverUnderBreakdown([pendingOver]);

      expect(stats.over.count).toBe(1);
      expect(stats.over.stake).toBe(10);
      expect(stats.over.net).toBe(0); // Pending = 0 net
      expect(stats.over.wins).toBe(0);
      expect(stats.over.losses).toBe(0);
    });

    it('multiple O/U legs on single bet counted once per leg (ticket-level attribution)', () => {
      // EDGE CASE DOCUMENTATION:
      // A single bet with multiple O/U legs is unusual but can occur in specific
      // market types (e.g., alternate totals, combined prop markets). This test
      // verifies the ticket-level attribution semantics: each O/U leg receives
      // the full ticket stake/net attributed to it.
      //
      // This matches the documented behavior in displaySemantics.ts STAKE_ATTRIBUTION_POLICY
      // where "ticket-level" attribution is used for leg rollups.
      const multiLegSingle = createBet({
        id: 'multi-ou-single',
        betType: 'single',
        stake: 10,
        payout: 25,
        result: 'win',
        legs: [
          createLeg({ ou: 'Over', entities: ['Player A'] }),
          createLeg({ ou: 'Under', entities: ['Player B'] }),
        ],
      });

      const stats = computeOverUnderBreakdown([multiLegSingle]);

      // Each leg is counted separately with ticket-level attribution
      expect(stats.over.count).toBe(1);
      expect(stats.under.count).toBe(1);
      // Both get full ticket attribution (intentional double-count for analysis)
      // This is consistent with STAKE_ATTRIBUTION_POLICY: 'ticket-level'
      expect(stats.over.net).toBe(15);
      expect(stats.under.net).toBe(15);
    });
  });

  describe('isParlayBetType verification', () => {
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
});
