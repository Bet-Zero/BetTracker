/**
 * Entity Stats Service
 *
 * Computes per-entity statistics with parlay-aware semantics:
 * - Non-parlays: Money (stake/net) attributed to entities
 * - Parlays: Zero money attribution (parlays count as one bet, not per-leg)
 *
 * This service prevents parlay stake inflation in entity breakdowns.
 *
 * @see docs/DISPLAY_SYSTEM_TIGHTENING_PLAN_V1.md - P4 section
 */

import { Bet, BetLeg } from '../types';
import {
  isParlayBetType,
  getEntityMoneyContribution,
} from './displaySemantics';
import { calculateRoi } from './aggregationService';

/**
 * Entity-level statistics for bet tracking.
 * All metrics are for STRAIGHT BETS ONLY (parlays excluded).
 */
export interface EntityStats {
  /** Total straight bets this entity appeared on */
  tickets: number;
  /** Count of parlay bets (informational only, not included in other stats) */
  parlays: number;
  /** Wins from straight bets */
  wins: number;
  /** Losses from straight bets */
  losses: number;
  /** Sum of stake from straight bets */
  stake: number;
  /** Sum of net from straight bets */
  net: number;
  /** ROI: net / stake * 100 */
  roi: number;
}

/**
 * Key extractor function type for extracting entity keys from a leg.
 * Returns array of entity keys (e.g., player/team names) or null if no entities.
 */
export type EntityKeyExtractor = (leg: BetLeg, bet: Bet) => string[] | null;

/**
 * Computes entity statistics map from bets.
 *
 * SEMANTICS:
 * - Non-parlays: Money (stake/net) attributed to each entity
 * - Parlays: Zero money attribution (counted as one bet, not per-leg)
 * - All metrics are bet-level, not leg-level
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
    
    // Skip parlays entirely - we don't attribute money to entities from parlays
    // This prevents empty entries in the map for parlay-only entities
    if (isParlay) {
      continue;
    }
    
    const moneyContribution = getEntityMoneyContribution(bet);

    // Collect all unique entities in this bet
    const entitiesInBet = new Set<string>();

    // Process legs if present
    if (bet.legs && bet.legs.length > 0) {
      for (const leg of bet.legs) {
        const entityKeys = keyExtractor(leg, bet);
        if (!entityKeys || entityKeys.length === 0) continue;

        for (const entityKey of entityKeys) {
          if (!entityKey) continue;
          entitiesInBet.add(entityKey);
        }
      }
    } else if (bet.name) {
      // Handle bets without legs array (legacy or simple bets)
      entitiesInBet.add(bet.name);
    }

    // Process bet-level attributes once per entity (straight bets only)
    for (const entityKey of entitiesInBet) {
      if (!map.has(entityKey)) {
        map.set(entityKey, {
          tickets: 0,
          parlays: 0,
          wins: 0,
          losses: 0,
          stake: 0,
          net: 0,
          roi: 0,
        });
      }

      const stats = map.get(entityKey)!;

      // For straight bets: count ticket, wins/losses, and money
      stats.tickets++;
      
      if (bet.result === 'win') {
        stats.wins++;
      } else if (bet.result === 'loss') {
        stats.losses++;
      }
      // Push/pending/cashout don't count as win or loss

      stats.stake += moneyContribution.stake;
      stats.net += moneyContribution.net;
    }
  }

  // Calculate derived metrics
  for (const [entityKey, stats] of map.entries()) {
    // ROI: net / stake * 100
    stats.roi = calculateRoi(stats.net, stats.stake);
  }

  return map;
}

