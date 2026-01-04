/**
 * Futures Exposure Panel
 * 
 * Shows pending futures positions.
 * 
 * Dataset: bets where marketCategory === 'Futures' && result === 'pending'
 * 
 * Labeling: "Pending futures only (open positions)"
 */

import React, { useMemo, useState } from 'react';
import { Bet } from '../types';
import {
  TrendingUp,
  Clock,
  Calendar,
} from '../components/icons';
import { InfoTooltip } from '../components/debug/InfoTooltip';
import {
  calculateRoi,
} from '../services/aggregationService';

interface FuturesExposurePanelProps {
  bets: Bet[];
}

type FuturesStat = {
  name: string;
  count: number;
  exposure: number;
  potentialPayout: number;
  maxProfit: number;
};

type FuturesTimelineItem = {
  id: string;
  description: string;
  sport: string;
  stake: number;
  potential: number;
  profit: number;
  resolutionDate: string | null;
  daysUntil: number | null;
};

/**
 * Estimate resolution date based on keyword matching in description.
 * Uses current year for date estimation.
 */
function estimateResolutionDate(description: string, sport: string): Date | null {
  const desc = description.toLowerCase();
  const currentYear = new Date().getFullYear();
  
  // Championship events
  if (desc.includes('super bowl') || desc.includes('nfl championship')) {
    return new Date(currentYear, 1, 9); // February 9
  }
  if (desc.includes('nba finals') || desc.includes('nba championship')) {
    return new Date(currentYear, 5, 15); // June 15
  }
  if (desc.includes('world series') || desc.includes('mlb championship')) {
    return new Date(currentYear, 9, 30); // October 30
  }
  if (desc.includes('stanley cup') || desc.includes('nhl championship')) {
    return new Date(currentYear, 5, 20); // June 20
  }
  
  // Win totals (check sport)
  if (desc.includes('win total')) {
    const sportLower = sport.toLowerCase();
    if (sportLower === 'nfl' || sportLower === 'football') {
      return new Date(currentYear, 0, 8); // January 8
    }
    if (sportLower === 'nba' || sportLower === 'basketball') {
      return new Date(currentYear, 3, 14); // April 14
    }
    if (sportLower === 'mlb' || sportLower === 'baseball') {
      return new Date(currentYear, 9, 1); // October 1
    }
    if (sportLower === 'nhl' || sportLower === 'hockey') {
      return new Date(currentYear, 3, 15); // April 15
    }
  }
  
  return null;
}

/**
 * Calculate days until a target date.
 * Returns null if date is in the past or invalid.
 */
function calculateDaysUntil(targetDate: Date | null): number | null {
  if (!targetDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffMs = targetDate.getTime() - today.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  // If negative or zero, return null (event already passed or happening today)
  if (daysUntil <= 0) return null;
  
  return daysUntil;
}

/**
 * Format date for display
 */
function formatResolutionDate(date: Date | null): string {
  if (!date) return 'TBD';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const FuturesExposurePanel: React.FC<FuturesExposurePanelProps> = ({ bets }) => {
  const [breakdownView, setBreakdownView] = useState<'sport' | 'entity'>('sport');
  const [showTimeline, setShowTimeline] = useState(true);

  const futuresData = useMemo(() => {
    // Dataset: pending futures only
    const openFutures = bets.filter(
      (bet) => bet.marketCategory === 'Futures' && bet.result === 'pending'
    );

    if (openFutures.length === 0) return null;

    // Metrics
    const totalCount = openFutures.length;
    const totalExposure = openFutures.reduce((sum, bet) => sum + bet.stake, 0);
    const totalPotentialPayout = openFutures.reduce((sum, bet) => sum + bet.payout, 0);
    const totalMaxProfit = totalPotentialPayout - totalExposure;

    // By sport breakdown
    const sportMap = new Map<string, FuturesStat>();
    for (const bet of openFutures) {
      const key = bet.sport || 'Unknown';
      if (!sportMap.has(key)) {
        sportMap.set(key, {
          name: key,
          count: 0,
          exposure: 0,
          potentialPayout: 0,
          maxProfit: 0,
        });
      }
      const stat = sportMap.get(key)!;
      stat.count++;
      stat.exposure += bet.stake;
      stat.potentialPayout += bet.payout;
      stat.maxProfit = stat.potentialPayout - stat.exposure;
    }

    // By entity breakdown (from description or name field)
    const entityMap = new Map<string, FuturesStat>();
    for (const bet of openFutures) {
      // Try to extract entity from name or description
      const entity = bet.name || extractEntityFromDescription(bet.description) || 'Unknown';
      if (!entityMap.has(entity)) {
        entityMap.set(entity, {
          name: entity,
          count: 0,
          exposure: 0,
          potentialPayout: 0,
          maxProfit: 0,
        });
      }
      const stat = entityMap.get(entity)!;
      stat.count++;
      stat.exposure += bet.stake;
      stat.potentialPayout += bet.payout;
      stat.maxProfit = stat.potentialPayout - stat.exposure;
    }

    // Timeline data - sorted by daysUntil ascending, nulls at bottom
    const timelineItems: FuturesTimelineItem[] = openFutures.map((bet) => {
      const resolutionDate = estimateResolutionDate(bet.description, bet.sport || '');
      const daysUntil = calculateDaysUntil(resolutionDate);
      
      return {
        id: bet.id,
        description: bet.description,
        sport: bet.sport || 'Unknown',
        stake: bet.stake,
        potential: bet.payout,
        profit: bet.payout - bet.stake,
        resolutionDate: resolutionDate ? resolutionDate.toISOString() : null,
        daysUntil,
      };
    }).sort((a, b) => {
      // Sort by daysUntil ascending, nulls at bottom
      if (a.daysUntil === null && b.daysUntil === null) return 0;
      if (a.daysUntil === null) return 1;
      if (b.daysUntil === null) return -1;
      return a.daysUntil - b.daysUntil;
    });

    return {
      totalCount,
      totalExposure,
      totalPotentialPayout,
      totalMaxProfit,
      bySport: Array.from(sportMap.values()).sort((a, b) => b.exposure - a.exposure),
      byEntity: Array.from(entityMap.values()).sort((a, b) => b.exposure - a.exposure),
      timeline: timelineItems,
    };
  }, [bets]);

  if (!futuresData) {
    return (
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
            Futures Exposure
          </h2>
          <InfoTooltip
            text="Pending futures only (open positions)"
            position="right"
          />
        </div>
        <div className="text-center text-neutral-500 dark:text-neutral-400 py-8">
          <Clock className="w-12 h-12 mx-auto text-neutral-400 dark:text-neutral-600 mb-4" />
          <p>No pending futures found.</p>
        </div>
      </div>
    );
  }

  const currentBreakdown = breakdownView === 'sport' ? futuresData.bySport : futuresData.byEntity;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
            Futures Exposure
          </h2>
          <InfoTooltip
            text="Pending futures only (open positions)"
            position="right"
          />
        </div>
        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-medium text-xs">
          Pending futures only
        </span>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-100 dark:bg-neutral-800/50 p-4 rounded-lg">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Open Futures
          </p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
            {futuresData.totalCount}
          </p>
        </div>
        <div className="bg-neutral-100 dark:bg-neutral-800/50 p-4 rounded-lg">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Total Exposure
          </p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
            ${futuresData.totalExposure.toFixed(2)}
          </p>
        </div>
        <div className="bg-neutral-100 dark:bg-neutral-800/50 p-4 rounded-lg">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Potential Payout
          </p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
            ${futuresData.totalPotentialPayout.toFixed(2)}
          </p>
        </div>
        <div className="bg-neutral-100 dark:bg-neutral-800/50 p-4 rounded-lg">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Max Profit
          </p>
          <p className="text-2xl font-bold text-accent-500 mt-1">
            ${futuresData.totalMaxProfit.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Breakdown Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setBreakdownView('sport')}
          className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
            breakdownView === 'sport'
              ? 'bg-primary-600 text-white shadow'
              : 'text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          By Sport
        </button>
        <button
          onClick={() => setBreakdownView('entity')}
          className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
            breakdownView === 'entity'
              ? 'bg-primary-600 text-white shadow'
              : 'text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          By Team/Player
        </button>
      </div>

      {/* Breakdown Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
            <tr>
              <th className="px-4 py-2">
                {breakdownView === 'sport' ? 'Sport' : 'Team/Player'}
              </th>
              <th className="px-4 py-2 text-center"># Bets</th>
              <th className="px-4 py-2 text-right">Exposure</th>
              <th className="px-4 py-2 text-right">Potential Payout</th>
              <th className="px-4 py-2 text-right">Max Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {currentBreakdown.map((item) => (
              <tr
                key={item.name}
                className="odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-200 dark:even:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <td className="px-4 py-2 font-medium text-neutral-900 dark:text-neutral-100">
                  {item.name}
                </td>
                <td className="px-4 py-2 text-center">{item.count}</td>
                <td className="px-4 py-2 text-right">${item.exposure.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">${item.potentialPayout.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-accent-500 font-semibold">
                  ${item.maxProfit.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Futures Timeline Section */}
      <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
              Futures Timeline
            </h3>
            <InfoTooltip
              text="Estimated resolution dates based on event type"
              position="right"
            />
          </div>
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            {showTimeline ? 'Hide' : 'Show'}
          </button>
        </div>

        {showTimeline && (
          <div className="space-y-3">
            {futuresData.timeline.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {item.description}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {item.sport}
                  </p>
                </div>
                <div className="flex items-center gap-6 ml-4">
                  <div className="text-right">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                      Resolution
                    </p>
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      {item.resolutionDate 
                        ? formatResolutionDate(new Date(item.resolutionDate))
                        : 'TBD'}
                    </p>
                    {item.daysUntil !== null && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {item.daysUntil} days
                      </p>
                    )}
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                      Stake → Potential
                    </p>
                    <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      ${item.stake.toFixed(2)} → ${item.potential.toFixed(2)}
                    </p>
                    <p className="text-xs text-accent-500 font-medium">
                      +${item.profit.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {futuresData.timeline.length === 0 && (
              <p className="text-center text-neutral-500 dark:text-neutral-400 py-4">
                No timeline data available.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Extract entity name from bet description for futures.
 * Tries to identify team/player names from futures bet descriptions.
 * Uses ordered pattern matching - returns first match with length > 1.
 */
function extractEntityFromDescription(description: string): string {
  if (!description) return '';
  
  // Pattern checks in order - return first match with length > 1
  // NOTE: Order matters! More specific patterns should come before general ones
  const patterns: RegExp[] = [
    /^(.*?)\s+to\s+win/i,                    // "Lakers to win NBA Championship" -> "Lakers"
    /^(.*?)\s+win\s+total/i,                 // "Celtics Win Total Over 52.5" -> "Celtics"
    /^(.*?)\s+vs\./i,                        // "Warriors vs. Celtics" -> "Warriors" (before dash!)
    /^(.*?)\s+-\s+/,                         // "Lakers - Championship Winner" -> "Lakers"
    /^(.*?)\s+(?:Over|Under)\s+\d/i,         // "Patrick Mahomes Over 4500.5" -> "Patrick Mahomes"
    /^(.*?)\s+\([+-]\d+\)/,                  // "Lakers (+500)" -> "Lakers"
    /^(.*?)\s+\(/,                           // "Warriors (Regular Season Wins)" -> "Warriors"
    /^(.*?)\s+(?:Finals|Championship)/i,    // "Lakers Finals" -> "Lakers"
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const entity = match[1].trim();
      // Validation: entity must have length > 1 (reject single characters)
      if (entity.length > 1) {
        return entity;
      }
    }
  }
  
  // Fallback: truncate to 40 chars ending with "…" for long descriptions
  if (description.length > 40) {
    return description.substring(0, 40) + '…';
  }
  return description;
}

export default FuturesExposurePanel;
