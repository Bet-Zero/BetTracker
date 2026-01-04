/**
 * Parlay Strategy Insights Card
 *
 * Shows users which parlay strategies work best for them.
 * PRESERVATION RULE: Ticket-level money only ("Tickets drive money. Legs never do.")
 *
 * Insights computed:
 * 1. Most Profitable Leg Count - bucket with highest net
 * 2. Best Performing Type - type with highest win rate (tie-break by net)
 * 3. SGP vs Standard Comparison - which strategy performs better
 */

import React from 'react';
import { Bet } from '../types';
import { getNetNumeric } from '../services/displaySemantics';
import { Lightbulb, TrendingUp, TrendingDown } from './icons';

// Minimum parlays required to show insights
const MIN_PARLAYS_FOR_INSIGHTS = 5;

interface ParlayInsightsCardProps {
  parlayBets: Bet[];
}

interface LegCountStats {
  bucket: string;
  count: number;
  stake: number;
  net: number;
  wins: number;
  losses: number;
}

interface TypeStats {
  type: string;
  count: number;
  stake: number;
  net: number;
  wins: number;
  losses: number;
  winRate: number;
}

/**
 * Gets the leg count bucket for a parlay bet
 */
function getLegCountBucket(bet: Bet): string {
  const legCount = bet.legs?.length || 0;
  if (legCount < 2) return '2-leg';
  if (legCount === 2) return '2-leg';
  if (legCount === 3) return '3-leg';
  if (legCount === 4) return '4-leg';
  return '5+ legs';
}

/**
 * Maps betType to user-friendly parlay type names
 */
function getParlayTypeName(bet: Bet): 'Standard' | 'SGP' | 'SGP+' {
  if (bet.betType === 'sgp') return 'SGP';
  if (bet.betType === 'sgp_plus') return 'SGP+';
  return 'Standard';
}

/**
 * Computes stats grouped by leg count bucket
 */
function computeLegCountStats(parlayBets: Bet[]): LegCountStats[] {
  const buckets = new Map<string, LegCountStats>();

  for (const bet of parlayBets) {
    const bucket = getLegCountBucket(bet);
    const existing = buckets.get(bucket) || {
      bucket,
      count: 0,
      stake: 0,
      net: 0,
      wins: 0,
      losses: 0,
    };

    existing.count += 1;
    existing.stake += bet.stake;
    existing.net += getNetNumeric(bet);
    if (bet.result === 'win') existing.wins += 1;
    if (bet.result === 'loss') existing.losses += 1;

    buckets.set(bucket, existing);
  }

  return Array.from(buckets.values());
}

/**
 * Computes stats grouped by parlay type (Standard, SGP, SGP+)
 */
function computeTypeStats(parlayBets: Bet[]): TypeStats[] {
  const types = new Map<string, TypeStats>();

  for (const bet of parlayBets) {
    const type = getParlayTypeName(bet);
    const existing = types.get(type) || {
      type,
      count: 0,
      stake: 0,
      net: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
    };

    existing.count += 1;
    existing.stake += bet.stake;
    existing.net += getNetNumeric(bet);
    if (bet.result === 'win') existing.wins += 1;
    if (bet.result === 'loss') existing.losses += 1;

    types.set(type, existing);
  }

  // Calculate win rates
  for (const stats of types.values()) {
    const total = stats.wins + stats.losses;
    stats.winRate = total > 0 ? (stats.wins / total) * 100 : 0;
  }

  return Array.from(types.values());
}

/**
 * Find most profitable leg count bucket
 */
function findMostProfitableLegCount(legCountStats: LegCountStats[]): {
  bucket: string;
  net: number;
  roi: number;
} | null {
  if (legCountStats.length === 0) return null;

  const best = legCountStats.reduce((best, current) =>
    current.net > best.net ? current : best
  );

  const roi = best.stake > 0 ? (best.net / best.stake) * 100 : 0;

  return {
    bucket: best.bucket,
    net: best.net,
    roi,
  };
}

/**
 * Find best performing type by win rate (tie-break by net)
 */
function findBestParlayType(typeStats: TypeStats[]): {
  type: string;
  winRate: number;
  net: number;
} | null {
  if (typeStats.length === 0) return null;

  const best = typeStats.reduce((best, current) => {
    if (current.winRate > best.winRate) return current;
    if (current.winRate === best.winRate && current.net > best.net) return current;
    return best;
  });

  return {
    type: best.type,
    winRate: best.winRate,
    net: best.net,
  };
}

/**
 * Compare SGP (SGP + SGP+) vs Standard parlays
 */
function compareSgpVsStandard(typeStats: TypeStats[]): {
  sgpNet: number;
  standardNet: number;
  diff: number;
  recommendation: 'SGP' | 'Standard';
} | null {
  const sgpStats = typeStats.filter((t) => t.type === 'SGP' || t.type === 'SGP+');
  const standardStats = typeStats.filter((t) => t.type === 'Standard');

  // Need at least one of each to compare
  if (sgpStats.length === 0 || standardStats.length === 0) return null;

  const sgpNet = sgpStats.reduce((sum, s) => sum + s.net, 0);
  const standardNet = standardStats.reduce((sum, s) => sum + s.net, 0);
  const diff = sgpNet - standardNet;

  return {
    sgpNet,
    standardNet,
    diff,
    recommendation: sgpNet >= standardNet ? 'SGP' : 'Standard',
  };
}

/**
 * Format currency for display
 */
function formatCurrency(value: number): string {
  const prefix = value >= 0 ? '$' : '-$';
  return `${prefix}${Math.abs(value).toFixed(2)}`;
}

const ParlayInsightsCard: React.FC<ParlayInsightsCardProps> = ({ parlayBets }) => {
  // Check if we have enough parlays
  if (parlayBets.length < MIN_PARLAYS_FOR_INSIGHTS) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-2 rounded-full">
            <Lightbulb className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            Parlay Strategy Insights
          </h3>
          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded font-medium text-xs">
            Parlay tickets only
          </span>
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">
          Need at least {MIN_PARLAYS_FOR_INSIGHTS} parlays with varied types to show insights.
        </p>
      </div>
    );
  }

  // Compute stats
  const legCountStats = computeLegCountStats(parlayBets);
  const typeStats = computeTypeStats(parlayBets);

  // Compute insights
  const mostProfitableLegCount = findMostProfitableLegCount(legCountStats);
  const bestType = findBestParlayType(typeStats);
  const sgpVsStandard = compareSgpVsStandard(typeStats);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-2 rounded-full">
          <Lightbulb className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
          Parlay Strategy Insights
        </h3>
        <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded font-medium text-xs">
          Parlay tickets only
        </span>
      </div>

      <div className="space-y-4">
        {/* Most Profitable Leg Count */}
        {mostProfitableLegCount && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <span className="text-primary-600 dark:text-primary-400 text-xs font-bold">1</span>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Most Profitable Leg Count:
              </p>
              <p className="text-base font-semibold">
                <span className="text-neutral-900 dark:text-white">
                  {mostProfitableLegCount.bucket}
                </span>
                <span className={`ml-2 ${mostProfitableLegCount.net >= 0 ? 'text-accent-500' : 'text-danger-500'}`}>
                  ({formatCurrency(mostProfitableLegCount.net)}, {mostProfitableLegCount.roi.toFixed(1)}% ROI)
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Best Performing Type */}
        {bestType && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <span className="text-primary-600 dark:text-primary-400 text-xs font-bold">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Best Performing Type:
              </p>
              <p className="text-base font-semibold">
                <span className="text-neutral-900 dark:text-white">{bestType.type}</span>
                <span className={`ml-2 ${bestType.net >= 0 ? 'text-accent-500' : 'text-danger-500'}`}>
                  ({bestType.winRate.toFixed(1)}% win, {formatCurrency(bestType.net)})
                </span>
              </p>
            </div>
          </div>
        )}

        {/* SGP vs Standard Comparison */}
        {sgpVsStandard && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <span className="text-primary-600 dark:text-primary-400 text-xs font-bold">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                SGP vs Standard Comparison:
              </p>
              <p className="text-base font-semibold flex items-center gap-2">
                {sgpVsStandard.diff >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-accent-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-danger-500" />
                )}
                <span className={sgpVsStandard.diff >= 0 ? 'text-accent-500' : 'text-danger-500'}>
                  You're {formatCurrency(Math.abs(sgpVsStandard.diff))}{' '}
                  {sgpVsStandard.diff >= 0 ? 'better' : 'worse'} with {sgpVsStandard.recommendation}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Show message if no comparison data available */}
        {!sgpVsStandard && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
              <span className="text-neutral-500 dark:text-neutral-400 text-xs font-bold">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                SGP vs Standard Comparison:
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Need both SGP and Standard parlays to compare
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParlayInsightsCard;
