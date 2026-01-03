/**
 * Over/Under Stats Service
 *
 * Shared computation logic for Over/Under breakdowns used across:
 * - DashboardView
 * - BySportView
 * - PlayerProfileView
 *
 * This consolidates the O/U parlay-exclusion logic into a single source of truth,
 * preventing drift between implementations and ensuring consistent behavior.
 *
 * @see docs/BET_TRACKER_BACKEND_DATA_WIRING_AUDIT_PHASE_1.md - Dashboard Tables Truth Audit
 */

import { Bet, BetLeg } from '../types';
import { getNetNumeric, isParlayBetType, getEntityMoneyContribution } from './displaySemantics';
import { calculateRoi } from './aggregationService';

/**
 * Over/Under statistics for a single category (Over or Under)
 */
export interface OverUnderStats {
  count: number;
  wins: number;
  losses: number;
  stake: number;
  net: number;
  roi: number;
}

/**
 * Combined Over and Under statistics
 */
export interface OverUnderBreakdownStats {
  over: OverUnderStats;
  under: OverUnderStats;
}

/**
 * Options for computing Over/Under stats
 */
export interface ComputeOverUnderOptions {
  /**
   * Whether to exclude parlay bets from the breakdown.
   * @default true
   *
   * When true (default): Parlay bets (parlay, sgp, sgp_plus) are excluded entirely.
   * Their O/U legs do NOT contribute to counts, stake, or net.
   *
   * When false: All bets including parlays are processed. Use with caution as this
   * can lead to confusing money attribution when parlay legs are counted.
   */
  excludeParlays?: boolean;

  /**
   * Optional entity filter. When provided, only counts O/U legs where the entity
   * appears in leg.entities (using exact match or custom matcher).
   *
   * This is used by PlayerProfileView to show O/U stats for a specific player.
   */
  entityFilter?: {
    entity: string;
    /** Custom matcher function. If not provided, uses exact string match on leg.entities */
    matcher?: (leg: BetLeg, bet: Bet, targetEntity: string) => boolean;
  };

  /**
   * Whether to use entity-aware money contribution (P4 policy).
   * When true, uses getEntityMoneyContribution() which returns 0 for parlays.
   * When false, uses full ticket stake/net.
   *
   * @default false (uses ticket-level attribution for global O/U breakdown)
   *
   * Set to true for entity-specific breakdowns (e.g., PlayerProfileView O/U)
   * where parlay money should not be attributed.
   */
  useEntityMoneyContribution?: boolean;
}

/**
 * Default entity matcher: checks if entity appears in leg.entities
 */
const defaultEntityMatcher = (leg: BetLeg, bet: Bet, targetEntity: string): boolean => {
  return leg.entities?.includes(targetEntity) ?? false;
};

/**
 * Creates empty Over/Under stats
 */
function createEmptyStats(): OverUnderStats {
  return { count: 0, wins: 0, losses: 0, stake: 0, net: 0, roi: 0 };
}

/**
 * Compute Over/Under breakdown statistics from a set of bets.
 *
 * POLICY (PG-3 / INV-8): Parlays are EXCLUDED by default.
 * This prevents parlay legs from inflating O/U counts and money attribution.
 *
 * The function processes each bet's legs, looking for legs with an `ou` field
 * ('Over' or 'Under'). Each matching leg contributes to the respective stats.
 *
 * @param bets - Array of bets to process
 * @param options - Configuration options (see ComputeOverUnderOptions)
 * @returns Over and Under statistics with ROI calculated
 *
 * @example
 * // Basic usage - excludes parlays by default
 * const stats = computeOverUnderStats(filteredBets);
 *
 * @example
 * // With entity filter for player-specific O/U
 * const playerStats = computeOverUnderStats(playerBets, {
 *   entityFilter: { entity: 'LeBron James' },
 *   useEntityMoneyContribution: true,
 * });
 *
 * @example
 * // Include parlays (not recommended for most use cases)
 * const allStats = computeOverUnderStats(bets, { excludeParlays: false });
 */
export function computeOverUnderStats(
  bets: Bet[],
  options: ComputeOverUnderOptions = {}
): OverUnderBreakdownStats {
  const {
    excludeParlays = true,
    entityFilter,
    useEntityMoneyContribution = false,
  } = options;

  const stats = {
    over: createEmptyStats(),
    under: createEmptyStats(),
  };

  for (const bet of bets) {
    // PG-3 / INV-8: Skip parlays when excludeParlays is true
    if (excludeParlays && isParlayBetType(bet.betType)) {
      continue;
    }

    // Skip bets without legs
    if (!bet.legs || bet.legs.length === 0) {
      continue;
    }

    // Determine money contribution
    const moneyContribution = useEntityMoneyContribution
      ? getEntityMoneyContribution(bet)
      : { stake: bet.stake, net: getNetNumeric(bet) };

    // Process each leg
    for (const leg of bet.legs) {
      // Skip legs without O/U designation
      if (!leg.ou) {
        continue;
      }

      // Apply entity filter if provided
      if (entityFilter) {
        const matcher = entityFilter.matcher ?? defaultEntityMatcher;
        if (!matcher(leg, bet, entityFilter.entity)) {
          continue;
        }
      }

      // Determine Over vs Under
      const ou = leg.ou.toLowerCase() as 'over' | 'under';
      const target = stats[ou];

      // Accumulate stats
      target.count++;
      target.stake += moneyContribution.stake;
      target.net += moneyContribution.net;

      if (bet.result === 'win') target.wins++;
      if (bet.result === 'loss') target.losses++;
    }
  }

  // Calculate ROI for both categories
  stats.over.roi = calculateRoi(stats.over.net, stats.over.stake);
  stats.under.roi = calculateRoi(stats.under.net, stats.under.stake);

  return stats;
}

/**
 * Market category type for filtering O/U bets
 */
export type OverUnderMarketFilter = 'props' | 'totals' | 'all';

/**
 * Pre-filter bets by market category before computing O/U stats.
 * This matches the filtering logic used in the UI components.
 *
 * @param bets - Array of bets to filter
 * @param marketFilter - Which market categories to include
 * @returns Filtered bets ready for O/U computation
 */
export function filterBetsByMarketCategory(
  bets: Bet[],
  marketFilter: OverUnderMarketFilter
): Bet[] {
  return bets.filter((bet) => {
    switch (marketFilter) {
      case 'props':
        return bet.marketCategory === 'Props';
      case 'totals':
        return bet.marketCategory === 'Main Markets';
      case 'all':
        // O/U breakdown only shows Props and Main Markets (not Parlays or Futures)
        return bet.marketCategory === 'Props' || bet.marketCategory === 'Main Markets';
    }
  });
}
