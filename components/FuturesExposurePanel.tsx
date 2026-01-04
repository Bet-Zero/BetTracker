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

const FuturesExposurePanel: React.FC<FuturesExposurePanelProps> = ({ bets }) => {
  const [breakdownView, setBreakdownView] = useState<'sport' | 'entity'>('sport');

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

    return {
      totalCount,
      totalExposure,
      totalPotentialPayout,
      totalMaxProfit,
      bySport: Array.from(sportMap.values()).sort((a, b) => b.exposure - a.exposure),
      byEntity: Array.from(entityMap.values()).sort((a, b) => b.exposure - a.exposure),
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
    </div>
  );
};

/**
 * Extract entity name from bet description for futures.
 * Tries to identify team/player names from futures bet descriptions.
 */
function extractEntityFromDescription(description: string): string {
  if (!description) return '';
  
  // Common futures patterns:
  // "Lakers to win NBA Championship" -> "Lakers"
  // "Celtics Win Total Over 52.5" -> "Celtics"
  // "LeBron James MVP (+500)" -> "LeBron James"
  // "Warriors vs. Celtics - Finals Winner" -> "Warriors"
  
  // Try to extract before "to Win", "Win Total", "MVP", "vs.", "-", etc.
  const patterns = [
    /^(.*?)\s+to\s+win/i,                    // "X to win Y"
    /^(.*?)\s+win\s+total/i,                 // "X Win Total"
    /^(.*?)\s+MVP\s*\(/i,                    // "X MVP (+odds)"
    /^(.*?)\s+vs\.\s+/i,                     // "X vs. Y"
    /^(.*?)\s+-\s+/i,                        // "X - Y"
    /^(.*?)\s+(?:Over|Under)\s+\d/i,         // "X Over/Under N"
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Fallback: truncate to 40 chars ending with "…" for long descriptions
  if (description.length > 40) {
    return description.substring(0, 40) + '…';
  }
  return description;
}

export default FuturesExposurePanel;
