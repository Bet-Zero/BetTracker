/**
 * Display Semantics Service
 *
 * Single source of truth for semantic rules governing how bet data is
 * interpreted for display and KPI calculations.
 *
 * This module codifies the following policies:
 *
 * 1. PENDING NET SEMANTICS:
 *    - Numeric KPIs treat pending bets as contributing 0 to net profit.
 *    - Display strings show blank ("") for pending bets.
 *    - Rationale: Pending bets are undecided; counting them as -stake would
 *      incorrectly treat them as losses.
 *
 * 2. STAKE ATTRIBUTION POLICY:
 *    - Parlay/multi-leg bets attribute the FULL ticket stake and net to each
 *      entity/leg when computing per-entity or per-leg statistics.
 *    - This is intentional "ticket-level" attribution (known double-count risk).
 *    - Rationale: A player appearing in a parlay affects the full ticket outcome.
 *
 * 3. OVER/UNDER BREAKDOWN:
 *    - Uses the same ticket-level attribution as parlays.
 *    - Each O/U leg in a multi-leg bet gets full ticket stake/net attributed.
 *
 * @see docs/DISPLAY_SYSTEM_GAP_ANALYSIS_V1.md - Gaps 3, 4, 8
 */

import { Bet, BetResult, BetType, BetLeg, LegResult } from '../types';
import { formatNet } from '../utils/formatters';

// =============================================================================
// STAKE ATTRIBUTION POLICY
// =============================================================================

/**
 * Stake attribution policy for per-entity/per-leg rollups.
 *
 * - "ticket-level": Full ticket stake/net attributed to each entity/leg.
 *   This causes intentional double-counting when summing across entities
 *   in multi-leg bets. Used for answering: "What's my P/L on bets involving X?"
 *
 * - "split": (Future) Divide stake/net by leg count. More accurate for
 *   "How much did I actually risk on X?" but loses ticket-level context.
 */
export type StakeAttributionPolicy = 'ticket-level' | 'split';

/**
 * Current attribution policy used throughout the app.
 * Ticket-level attribution is the established behavior.
 */
export const STAKE_ATTRIBUTION_POLICY: StakeAttributionPolicy = 'ticket-level';

// =============================================================================
// NET CALCULATION SEMANTICS
// =============================================================================

/**
 * Returns the numeric net profit/loss for a bet, suitable for KPI calculations.
 *
 * SEMANTIC RULES:
 * - win/loss/push: net = payout - stake
 * - pending: net = 0 (undecided, should not affect P/L totals)
 *
 * @param bet - The bet to calculate net for
 * @returns Numeric net value (can be positive, negative, or zero)
 */
export function getNetNumeric(bet: Bet): number {
  if (bet.result === 'pending') {
    // Pending bets contribute 0 to net profit.
    // They are undecided and should not be counted as losses.
    return 0;
  }
  return bet.payout - bet.stake;
}

/**
 * Returns a display-formatted net string for a bet.
 *
 * SEMANTIC RULES:
 * - win/loss/push: formatted net (e.g., "25.50", "-10.00")
 * - pending: empty string (indicates undecided)
 *
 * This matches the behavior in finalRowValidators.calculateFormattedNet().
 *
 * @param bet - The bet to format net for
 * @returns Formatted net string or empty string for pending
 */
export function getNetDisplay(bet: Bet): string {
  if (bet.result === 'pending') {
    // Display strings show blank for pending bets.
    return '';
  }
  const net = bet.payout - bet.stake;
  return formatNet(net);
}

// =============================================================================
// STAKE ATTRIBUTION HELPERS
// =============================================================================

/**
 * Input for stake/net attribution calculation.
 */
export interface AttributionInput {
  /** The bet to attribute stake/net from */
  bet: Bet;
  /** Number of legs/entities to attribute to (for 'split' policy) */
  legCount: number;
  /** Attribution policy to use (defaults to STAKE_ATTRIBUTION_POLICY) */
  policy?: StakeAttributionPolicy;
}

/**
 * Output from stake/net attribution calculation.
 */
export interface AttributionResult {
  /** Stake amount to attribute to this leg/entity */
  stake: number;
  /** Net amount to attribute to this leg/entity */
  net: number;
}

/**
 * Calculates the stake and net to attribute to a single leg or entity.
 *
 * This helper encapsulates the attribution policy logic for per-entity
 * and per-leg rollups (e.g., player stats tables, O/U breakdowns).
 *
 * CURRENT POLICY (ticket-level):
 * - Full ticket stake and net are attributed to each entity/leg.
 * - For a 3-leg parlay, each leg "gets" the full stake/net.
 * - This intentionally double-counts when summing across all legs.
 *
 * FUTURE POLICY (split):
 * - Stake/net would be divided by legCount.
 * - More accurate for individual contribution but loses ticket context.
 *
 * @param input - Attribution input parameters
 * @returns Stake and net to attribute to the leg/entity
 */
export function getAttributedStakeAndNet(input: AttributionInput): AttributionResult {
  const { bet, legCount, policy = STAKE_ATTRIBUTION_POLICY } = input;
  const net = getNetNumeric(bet);

  if (policy === 'split' && legCount > 1) {
    // Split policy: divide by leg count
    return {
      stake: bet.stake / legCount,
      net: net / legCount,
    };
  }

  // Ticket-level policy (default): full attribution
  return {
    stake: bet.stake,
    net: net,
  };
}

// =============================================================================
// RESULT TYPE HELPERS
// =============================================================================

/**
 * Checks if a bet result represents a decided (settled) bet.
 * Decided bets have a final outcome (win/loss/push).
 *
 * @param result - The bet result to check
 * @returns true if the bet is decided (not pending)
 */
export function isDecidedResult(result: BetResult): boolean {
  return result === 'win' || result === 'loss' || result === 'push';
}

/**
 * Checks if a bet result is pending (undecided).
 *
 * @param result - The bet result to check
 * @returns true if the bet is pending
 */
export function isPendingResult(result: BetResult): boolean {
  return result === 'pending';
}

// =============================================================================
// PARLAY-AWARE ENTITY ATTRIBUTION (P4)
// =============================================================================

/**
 * Leg outcome type for entity-level leg accuracy tracking.
 * 'unknown' means leg.result was not present in data.
 */
export type LegOutcomeType = 'win' | 'loss' | 'push' | 'pending' | 'unknown';

/**
 * Checks if a bet type is a parlay variant.
 * 
 * POLICY: Parlays (sgp, sgp_plus, parlay) should NOT contribute
 * stake/net to entity breakdowns. Only non-parlay bets contribute money.
 *
 * @param betType - The bet type to check
 * @returns true if betType is a parlay variant
 */
export function isParlayBetType(betType: BetType): boolean {
  return betType === 'sgp' || betType === 'sgp_plus' || betType === 'parlay';
}

/**
 * Returns the money contribution (stake/net) for entity breakdowns.
 *
 * POLICY:
 * - Non-parlays: Full stake and net attributed to entity
 * - Parlays: Zero stake and net (prevents double-counting)
 *
 * @param bet - The bet to get money contribution from
 * @returns Object with stake and net to attribute to entity
 */
export function getEntityMoneyContribution(bet: Bet): { stake: number; net: number } {
  if (isParlayBetType(bet.betType)) {
    // Parlays contribute 0 to entity money breakdowns
    return { stake: 0, net: 0 };
  }
  // Non-parlays contribute full stake and net
  return {
    stake: bet.stake,
    net: getNetNumeric(bet),
  };
}

/**
 * Gets the leg outcome for leg-accuracy tracking.
 *
 * P4 POLICY:
 * - Prefer leg.result if present (may be LegResult or BetResult)
 * - If leg.result is missing, return 'unknown' (DO NOT infer from ticket result)
 * - Unknown legs are excluded from win% denominator but counted in total legs
 *
 * @param leg - The bet leg to get outcome for
 * @param bet - The parent bet (for context, but NOT used to infer leg outcome)
 * @returns Leg outcome type
 */
export function getLegOutcome(leg: BetLeg, bet: Bet): LegOutcomeType {
  if (!leg.result) {
    return 'unknown';
  }
  
  // Normalize to lowercase for comparison (leg.result can be LegResult or BetResult)
  const result = typeof leg.result === 'string' ? leg.result.toLowerCase() : '';
  
  if (result === 'win') return 'win';
  if (result === 'loss') return 'loss';
  if (result === 'push') return 'push';
  if (result === 'pending') return 'pending';
  
  // Fallback to unknown if result doesn't match expected values
  return 'unknown';
}

/**
 * Returns leg contribution counts for entity stats.
 * Used to increment leg counters per entity.
 *
 * @param leg - The bet leg
 * @param bet - The parent bet
 * @returns Object with leg count and outcome-specific counts
 */
export function getEntityLegContribution(leg: BetLeg, bet: Bet): {
  legs: 1;
  win?: 1;
  loss?: 1;
  push?: 1;
  pending?: 1;
  unknown?: 1;
} {
  const outcome = getLegOutcome(leg, bet);
  const contribution: {
    legs: 1;
    win?: 1;
    loss?: 1;
    push?: 1;
    pending?: 1;
    unknown?: 1;
  } = { legs: 1 };
  
  if (outcome === 'win') contribution.win = 1;
  else if (outcome === 'loss') contribution.loss = 1;
  else if (outcome === 'push') contribution.push = 1;
  else if (outcome === 'pending') contribution.pending = 1;
  else if (outcome === 'unknown') contribution.unknown = 1;
  
  return contribution;
}

