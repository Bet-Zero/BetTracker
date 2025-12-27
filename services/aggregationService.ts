/**
 * Shared Aggregation Service
 * 
 * Provides aggregation functions for KPI calculations across all display views.
 * Extracted from DashboardView, BySportView, SportsbookBreakdownView, PlayerProfileView.
 */

import { Bet, BetResult } from '../types';

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
}

// --- Core Functions ---

/**
 * Calculate ROI percentage.
 * Handles zero stake by returning 0.
 * 
 * Formula: (netProfit / totalWagered) * 100
 * 
 * Mirrors logic used in:
 * - DashboardView (lines 481-482, 848-851, 970-971)
 * - BySportView (lines 214, 300, 447-448, 493)
 * - SportsbookBreakdownView (line 180)
 * - PlayerProfileView (lines 231, 417, 446)
 */
export function calculateRoi(net: number, stake: number): number {
  return stake > 0 ? (net / stake) * 100 : 0;
}

/**
 * Compute overall statistics for a set of bets.
 * 
 * Returns:
 * - totalBets: Count of bets
 * - totalWagered: Sum of stakes
 * - netProfit: Sum of (payout - stake)
 * - wins/losses/pushes/pending: Counts by result
 * - winRate: wins / (wins + losses) * 100
 * - roi: calculateRoi(netProfit, totalWagered)
 * 
 * Note: Pending bets contribute net = 0 (payout === 0 for pending bets in most imports).
 * This matches existing view behavior where pending bets don't affect netProfit calculations.
 * 
 * Mirrors logic from:
 * - DashboardView (lines 830-855)
 * - BySportView (lines 440-448)
 * - SportsbookBreakdownView (lines 159-181)
 * - PlayerProfileView (lines 412-418)
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
    const net = bet.payout - bet.stake;
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
 * 
 * Returns an array of data points sorted chronologically by placedAt,
 * with each point showing the cumulative profit up to that bet.
 * 
 * Date format uses 'en-CA' locale (YYYY-MM-DD) as established in P1.
 * 
 * Mirrors logic from:
 * - DashboardView (lines 857-867)
 * - BySportView (lines 451-455)
 * - SportsbookBreakdownView (lines 153-157)
 * - PlayerProfileView (lines 421-425)
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
    cumulativeProfit += bet.payout - bet.stake;
    return {
      date: new Date(bet.placedAt).toLocaleDateString('en-CA'),
      profit: cumulativeProfit,
    };
  });
}

/**
 * Add bet stats to a dimension map.
 * Used for grouping stats by a dimension (sport, category, player, etc.).
 * 
 * If the key doesn't exist, creates a new entry with zeroed stats.
 * Accumulates count, stake, net, and win/loss counts.
 * 
 * Note: This mutates the provided map.
 * 
 * Mirrors logic from:
 * - DashboardView (lines 922-938)
 * - BySportView (lines 461-469)
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
    map.set(key, { count: 0, stake: 0, net: 0, wins: 0, losses: 0 });
  }
  
  const stats = map.get(key)!;
  stats.count++;
  stats.stake += stake;
  stats.net += net;
  
  if (result === 'win') stats.wins++;
  if (result === 'loss') stats.losses++;
}

/**
 * Convert a dimension stats map to an array with ROI calculated.
 * 
 * Returns an array of stats objects with:
 * - name: The map key
 * - All DimensionStats fields
 * - roi: Calculated from net/stake
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

/**
 * Convenience type for stats array entries.
 */
export type StatsArrayEntry = DimensionStats & { name: string; roi: number };
