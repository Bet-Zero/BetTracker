/**
 * Entity Stats Service
 *
 * Computes per-entity statistics with P4 parlay semantics:
 * - Singles: Money (stake/net) attributed to entities
 * - Parlays: Zero money attribution; leg-accuracy metrics only
 *
 * This service replaces the previous "ticket-level" attribution for entity breakdowns,
 * preventing parlay stake inflation while still providing leg-level insight.
 *
 * @see docs/DISPLAY_SYSTEM_TIGHTENING_PLAN_V1.md - P4 section
 */

import { Bet, BetLeg } from '../types';
import {
  isParlayBetType,
  getEntityMoneyContribution,
  getEntityLegContribution,
} from './displaySemantics';
import { calculateRoi } from './aggregationService';

/**
 * Entity-level statistics combining singles money and parlay leg accuracy.
 */
export interface EntityStats {
  /** Total tickets this entity appeared on */
  tickets: number;
  /** Count of single bets */
  singles: number;
  /** Count of parlay bets */
  parlays: number;
  /** Sum of stake from singles only (parlays excluded) */
  stakeSingles: number;
  /** Sum of net from singles only (parlays excluded) */
  netSingles: number;
  /** Total leg appearances across all bets */
  legs: number;
  /** Leg wins */
  legWins: number;
  /** Leg losses */
  legLosses: number;
  /** Leg pushes */
  legPushes: number;
  /** Leg pending */
  legPending: number;
  /** Leg unknown (missing result data) */
  legUnknown: number;
  /** Leg win rate: legWins / (legWins + legLosses), excluding pending/push/unknown */
  legWinRate: number;
  /** ROI on singles only: netSingles / stakeSingles * 100 */
  roiSingles: number;
}

/**
 * Key extractor function type for extracting entity keys from a leg.
 * Returns array of entity keys (e.g., player/team names) or null if no entities.
 */
export type EntityKeyExtractor = (leg: BetLeg, bet: Bet) => string[] | null;

/**
 * Computes entity statistics map from bets.
 *
 * P4 SEMANTICS:
 * - Singles: Money (stake/net) attributed to each entity
 * - Parlays: Zero money; only leg outcomes counted
 * - Leg outcomes tracked independently of ticket result
 *
 * @param bets - Array of bets to process
 * @param keyExtractor - Function to extract entity keys from a leg
 * @returns Map from entity key to EntityStats
 */
export function computeEntityStatsMap(
  bets: Bet[],
  keyExtractor: EntityKeyExtractor
): Map<string, EntityStats> {
  const map = new Map<string, EntityStats>();

  for (const bet of bets) {
    const isParlay = isParlayBetType(bet.betType);
    const moneyContribution = getEntityMoneyContribution(bet);

    // Collect all unique entities in this bet (for ticket counting)
    const entitiesInBet = new Set<string>();

    // Process legs if present
    if (bet.legs && bet.legs.length > 0) {
      for (const leg of bet.legs) {
        const entityKeys = keyExtractor(leg, bet);
        if (!entityKeys || entityKeys.length === 0) continue;

        const legContribution = getEntityLegContribution(leg, bet);

        for (const entityKey of entityKeys) {
          if (!entityKey) continue;
          
          // Track entity for ticket counting
          entitiesInBet.add(entityKey);

          // Initialize stats if needed
          if (!map.has(entityKey)) {
            map.set(entityKey, {
              tickets: 0,
              singles: 0,
              parlays: 0,
              stakeSingles: 0,
              netSingles: 0,
              legs: 0,
              legWins: 0,
              legLosses: 0,
              legPushes: 0,
              legPending: 0,
              legUnknown: 0,
              legWinRate: 0,
              roiSingles: 0,
            });
          }

          const stats = map.get(entityKey)!;

          // Count bet type (only once per bet, but we'll handle this after loop)
          // Attribute money (only for singles, and only once per bet per entity)
          // We'll handle bet type counting after collecting all entities

          // Count leg outcomes
          stats.legs += legContribution.legs;
          if (legContribution.win) stats.legWins += legContribution.win;
          if (legContribution.loss) stats.legLosses += legContribution.loss;
          if (legContribution.push) stats.legPushes += legContribution.push;
          if (legContribution.pending) stats.legPending += legContribution.pending;
          if (legContribution.unknown) stats.legUnknown += legContribution.unknown;
        }
      }
    } else if (bet.name) {
      // Handle single-leg bets without legs array (legacy or simple bets)
      entitiesInBet.add(bet.name);
    }

    // Now process bet-level attributes once per entity
    for (const entityKey of entitiesInBet) {
      if (!map.has(entityKey)) {
        map.set(entityKey, {
          tickets: 0,
          singles: 0,
          parlays: 0,
          stakeSingles: 0,
          netSingles: 0,
          legs: 0,
          legWins: 0,
          legLosses: 0,
          legPushes: 0,
          legPending: 0,
          legUnknown: 0,
          legWinRate: 0,
          roiSingles: 0,
        });
      }

      const stats = map.get(entityKey)!;

      // Count ticket (once per bet per entity)
      stats.tickets++;

      // Count bet type (once per bet per entity)
      if (isParlay) {
        stats.parlays++;
      } else {
        stats.singles++;
      }

      // Attribute money (only for singles, once per bet per entity)
      stats.stakeSingles += moneyContribution.stake;
      stats.netSingles += moneyContribution.net;
    }
  }

  // Calculate derived metrics
  for (const [entityKey, stats] of map.entries()) {
    // Leg win rate: legWins / (legWins + legLosses), excluding pending/push/unknown
    const decidedLegs = stats.legWins + stats.legLosses;
    stats.legWinRate = decidedLegs > 0 ? (stats.legWins / decidedLegs) * 100 : 0;

    // ROI on singles: netSingles / stakeSingles * 100
    stats.roiSingles = calculateRoi(stats.netSingles, stats.stakeSingles);
  }

  return map;
}

