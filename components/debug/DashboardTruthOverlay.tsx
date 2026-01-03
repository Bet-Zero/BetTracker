/**
 * DashboardTruthOverlay - DEV-ONLY Debug Panel
 * 
 * Displays reconciliation information and filter state to make the
 * Dashboard self-explanatory during development.
 * 
 * This component only renders when import.meta.env.DEV is true.
 */

/// <reference types="vite/client" />

import React, { useState, useMemo } from 'react';
import { Bet } from '../../types';
import { getNetNumeric } from '../../services/displaySemantics';
import { computeOverallStats } from '../../services/aggregationService';
import { DateRange, CustomDateRange } from '../../utils/filterPredicates';

interface DashboardTruthOverlayProps {
  allBets: Bet[];
  filteredBets: Bet[];
  dateRange: DateRange;
  customDateRange: CustomDateRange;
  betTypeFilter: string;
  selectedMarketCategory: string;
  entityType: string;
}

interface ReconciliationResult {
  netSumGetNetNumeric: number;
  netFromComputeOverallStats: number;
  reconciles: boolean;
}

export const DashboardTruthOverlay: React.FC<DashboardTruthOverlayProps> = ({
  allBets,
  filteredBets,
  dateRange,
  customDateRange,
  betTypeFilter,
  selectedMarketCategory,
  entityType,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calculate reconciliation values
  const reconciliation = useMemo((): ReconciliationResult => {
    const netSumGetNetNumeric = filteredBets.reduce(
      (sum, bet) => sum + getNetNumeric(bet),
      0
    );
    const stats = computeOverallStats(filteredBets);
    const netFromComputeOverallStats = stats.netProfit;

    // Use a small epsilon for floating point comparison
    const reconciles = Math.abs(netSumGetNetNumeric - netFromComputeOverallStats) < 0.001;

    return {
      netSumGetNetNumeric,
      netFromComputeOverallStats,
      reconciles,
    };
  }, [filteredBets]);

  // Format date range display
  const dateRangeDisplay = useMemo(() => {
    if (dateRange === 'custom') {
      const start = customDateRange.start || '(not set)';
      const end = customDateRange.end || '(not set)';
      return `Custom: ${start} to ${end}`;
    }
    return dateRange === 'all' ? 'All Time' : dateRange.toUpperCase();
  }, [dateRange, customDateRange]);

  // Don't render in production
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div
      className="fixed top-20 right-4 z-50 bg-neutral-900/95 text-white rounded-lg shadow-xl border border-neutral-700 text-xs font-mono max-w-xs"
      style={{ fontSize: '11px' }}
    >
      {/* Header with collapse toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-3 py-2 flex items-center justify-between bg-neutral-800/50 rounded-t-lg hover:bg-neutral-700/50 transition-colors"
      >
        <span className="font-bold text-yellow-400">🔍 Truth Overlay</span>
        <span className="text-neutral-400">{isCollapsed ? '▼' : '▲'}</span>
      </button>

      {!isCollapsed && (
        <div className="p-3 space-y-3">
          {/* Bet Counts */}
          <div className="space-y-1">
            <div className="text-neutral-400 uppercase text-[10px] font-bold">Bet Counts</div>
            <div className="flex justify-between">
              <span>All Bets:</span>
              <span className="text-blue-400">{allBets.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Filtered Bets:</span>
              <span className="text-blue-400">{filteredBets.length}</span>
            </div>
          </div>

          {/* Filter State */}
          <div className="space-y-1 border-t border-neutral-700 pt-2">
            <div className="text-neutral-400 uppercase text-[10px] font-bold">Filter State</div>
            <div className="flex justify-between">
              <span>Date Range:</span>
              <span className="text-purple-400">{dateRangeDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span>Bet Type:</span>
              <span className="text-purple-400">{betTypeFilter}</span>
            </div>
            <div className="flex justify-between">
              <span>Category:</span>
              <span className="text-purple-400">{selectedMarketCategory}</span>
            </div>
            <div className="flex justify-between">
              <span>Entity:</span>
              <span className="text-purple-400">{entityType}</span>
            </div>
          </div>

          {/* Reconciliation */}
          <div className="space-y-1 border-t border-neutral-700 pt-2">
            <div className="text-neutral-400 uppercase text-[10px] font-bold">Reconciliation</div>
            <div className="flex justify-between">
              <span>Σ getNetNumeric:</span>
              <span className="text-cyan-400">
                ${reconciliation.netSumGetNetNumeric.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>stats.netProfit:</span>
              <span className="text-cyan-400">
                ${reconciliation.netFromComputeOverallStats.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Status:</span>
              <span className={reconciliation.reconciles ? 'text-green-400' : 'text-red-400'}>
                {reconciliation.reconciles ? 'RECONCILES ✅' : 'RECONCILES ❌'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardTruthOverlay;
