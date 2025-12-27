/**
 * Shared Aggregation Service
 * 
 * Provides aggregation functions for KPI calculations across all display views.
 * Extracted from DashboardView, BySportView, SportsbookBreakdownView, PlayerProfileView.
 *
 * Net calculations use displaySemantics.getNetNumeric() to ensure consistent
 * handling of pending bets (pending = 0, not -stake).
 */

import { Bet, BetResult } from '../types';
import { getNetNumeric } from './displaySemantics';

// --- Types ---

export interface OverallStats {
  totalBets: number;
  totalWagered: number;
  netProfit: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
  winRate: number;
  roi: number;
}

export interface ProfitDataPoint {
  date: string;    // YYYY-MM-DD format ('en-CA' locale)
  profit: number;  // Cumulative profit at this point
}

export interface DimensionStats {
  count: number;
  stake: number;
  net: number;
  wins: number;
  losses: number;
  pushes: number;
}

// --- Core Functions ---

/**
 * Calculate ROI percentage.
 * Handles zero stake by returning 0.
 */
export function calculateRoi(net: number, stake: number): number {
  return stake > 0 ? (net / stake) * 100 : 0;
}

/**
 * Add bet stats to a dimension map.
 * Used for grouping stats by a dimension (sport, category, player, etc.).
 * Mutates the provided map.
 */
export function addToMap(
  map: Map<string, DimensionStats>,
  key: string,
  stake: number,
  net: number,
  result: BetResult
): void {
  if (!key) return;
  
  if (!map.has(key)) {
    map.set(key, { count: 0, stake: 0, net: 0, wins: 0, losses: 0, pushes: 0 });
  }
  
  const stats = map.get(key)!;
  stats.count++;
  stats.stake += stake;
  stats.net += net;
  
  if (result === 'win') stats.wins++;
  if (result === 'loss') stats.losses++;
  if (result === 'push') stats.pushes = (stats.pushes || 0) + 1;
}

/**
 * Compute overall statistics for a set of bets.
 */
export function computeOverallStats(bets: Bet[]): OverallStats {
  const stats: OverallStats = {
    totalBets: bets.length,
    totalWagered: 0,
    netProfit: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    pending: 0,
    winRate: 0,
    roi: 0,
  };

  if (bets.length === 0) {
    return stats;
  }

  for (const bet of bets) {
    const net = getNetNumeric(bet);
    stats.totalWagered += bet.stake;
    stats.netProfit += net;
    
    switch (bet.result) {
      case 'win':
        stats.wins++;
        break;
      case 'loss':
        stats.losses++;
        break;
      case 'push':
        stats.pushes++;
        break;
      case 'pending':
        stats.pending++;
        break;
    }
  }

  // Win rate excludes pushes and pending - only considers decided bets
  const decidedBets = stats.wins + stats.losses;
  stats.winRate = decidedBets > 0 ? (stats.wins / decidedBets) * 100 : 0;
  stats.roi = calculateRoi(stats.netProfit, stats.totalWagered);

  return stats;
}

/**
 * Compute cumulative profit over time.
 * Returns an array of data points sorted chronologically.
 */
export function computeProfitOverTime(bets: Bet[]): ProfitDataPoint[] {
  if (bets.length === 0) {
    return [];
  }

  // Sort by placedAt chronologically
  const sortedBets = [...bets].sort(
    (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()
  );

  let cumulativeProfit = 0;
  return sortedBets.map(bet => {
    cumulativeProfit += getNetNumeric(bet);
    return {
      date: new Date(bet.placedAt).toLocaleDateString('en-CA'),
      profit: cumulativeProfit,
    };
  });
}

/**
 * Compute stats grouped by a dynamic dimension derived from each bet.
 * Returns a Map where keys are the dimension values.
 * 
 * @param bets List of bets to aggregate
 * @param keyFn Function to derive the grouping key(s) from a bet. Can return a single key or array of keys.
 */
export function computeStatsByDimension(
  bets: Bet[], 
  keyFn: (bet: Bet) => string | string[] | null | undefined
): Map<string, DimensionStats> {
  const map = new Map<string, DimensionStats>();

  for (const bet of bets) {
    const keys = keyFn(bet);
    if (!keys) continue;

    const keyList = Array.isArray(keys) ? keys : [keys];
    const net = getNetNumeric(bet);

    for (const key of keyList) {
      if (key) {
        addToMap(map, key, bet.stake, net, bet.result);
      }
    }
  }

  return map;
}

/**
 * Convert a dimension stats map to an array with ROI calculated.
 */
export function mapToStatsArray(
  map: Map<string, DimensionStats>
): (DimensionStats & { name: string; roi: number })[] {
  return Array.from(map.entries()).map(([name, stats]) => ({
    name,
    ...stats,
    roi: calculateRoi(stats.net, stats.stake),
  }));
}
