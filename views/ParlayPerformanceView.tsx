/**
 * Parlay Performance View
 * 
 * Dedicated page for parlay ticket analytics.
 * 
 * PARLAY ISOLATION RULES ENFORCED:
 * 1. Dataset: ONLY parlay tickets (parlay, sgp, sgp_plus)
 * 2. Row unit: ONE ROW = ONE PARLAY TICKET (not legs, not entities)
 * 3. All headers clearly state "Parlay tickets only"
 * 4. Tickets drive money. Legs never do.
 */

import React, { useMemo, useState } from 'react';
import { useBets } from '../hooks/useBets';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  BarChart2,
  Layers,
} from '../components/icons';
import { Bet } from '../types';
import { isParlayBetType, getNetNumeric } from '../services/displaySemantics';
import {
  calculateRoi,
  computeOverallStats,
  computeProfitOverTime,
  computeStatsByDimension,
  mapToStatsArray,
} from '../services/aggregationService';
import {
  createDateRangePredicate,
  DateRange,
  CustomDateRange,
} from '../utils/filterPredicates';
import { InfoTooltip } from '../components/debug/InfoTooltip';

import { StatCard } from '../components/StatCard';
import { formatCurrency, formatNet } from '../utils/formatters';

// --- HELPER COMPONENTS ---

const ToggleButton: React.FC<{
  value: string;
  label: string;
  currentValue: string;
  onClick: (value: string) => void;
}> = ({ value, label, currentValue, onClick }) => (
  <button
    onClick={() => onClick(value)}
    className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
      currentValue === value
        ? 'bg-primary-600 text-white shadow'
        : 'text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
    }`}
  >
    {label}
  </button>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-neutral-800 p-2 border border-neutral-300 dark:border-neutral-600 rounded shadow-lg text-sm">
        <p className="label font-bold mb-1">{`${label}`}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.color || pld.fill }}>
            {`${pld.name}: ${
              typeof pld.value === 'number' ? pld.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : pld.value
            }`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const ChartContainer: React.FC<{
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
    <div className="mb-4">
      <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          {subtitle}
        </p>
      )}
    </div>
    <div className="h-72">{children}</div>
  </div>
);



type StatsData = {
  name: string;
  count: number;
  wins: number;
  losses: number;
  stake: number;
  net: number;
  roi: number;
};

interface StatsTableProps {
  data: StatsData[];
  title: string;
  subtitle?: string;
  searchPlaceholder: string;
  firstColumnHeader?: string;
}

const StatsTable: React.FC<StatsTableProps> = ({
  data,
  title,
  subtitle,
  searchPlaceholder,
  firstColumnHeader,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof StatsData | "winRate";
    direction: 'asc' | 'desc';
  }>({ key: 'net', direction: 'desc' });

  const sortedData = useMemo(() => {
    const filtered = data.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      let valA: number | string;
      let valB: number | string;

      if (sortConfig.key === "winRate") {
        const totalA = a.wins + a.losses;
        const totalB = b.wins + b.losses;
        valA = totalA > 0 ? (a.wins / totalA) : 0;
        valB = totalB > 0 ? (b.wins / totalB) : 0;
      } else {
        valA = a[sortConfig.key] || 0;
        valB = b[sortConfig.key] || 0;
      }

      // Handle strings (like name) distinct from numbers
      if (typeof valA === "string" && typeof valB === "string") {
         return sortConfig.direction === "asc" 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
      }

      if (valA < valB)
        return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB)
        return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, searchTerm, sortConfig]);

  const requestSort = (key: keyof StatsData | "winRate") => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 flex flex-col">
      <div>
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {subtitle}
          </p>
        )}
      </div>
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="my-4 p-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-neutral-50 dark:bg-neutral-800 w-full"
      />
      <div className="overflow-y-auto flex-grow">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-neutral-500 dark:text-neutral-400 uppercase sticky top-0 bg-white dark:bg-neutral-900">
            <tr>
              <th
                className="px-4 py-2 cursor-pointer"
                onClick={() => requestSort('name')}
              >
                {firstColumnHeader || searchPlaceholder.split(' ')[1].replace("...", "")}{' '}
                {sortConfig.key === 'name'
                  ? sortConfig.direction === 'desc'
                    ? '▼'
                    : '▲'
                  : '◇'}
              </th>
              <th
                className="px-4 py-2 cursor-pointer text-center"
                onClick={() => requestSort('count')}
              >
                # Parlays{' '}
                {sortConfig.key === 'count'
                  ? sortConfig.direction === 'desc'
                    ? '▼'
                    : '▲'
                  : '◇'}
              </th>
              <th
                className="px-4 py-2 cursor-pointer text-center"
                onClick={() => requestSort('wins')}
              >
                Win{' '}
                {sortConfig.key === 'wins'
                  ? sortConfig.direction === 'desc'
                    ? '▼'
                    : '▲'
                  : '◇'}
              </th>
              <th
                className="px-4 py-2 cursor-pointer text-center"
                onClick={() => requestSort('losses')}
              >
                Loss{' '}
                {sortConfig.key === 'losses'
                  ? sortConfig.direction === 'desc'
                    ? '▼'
                    : '▲'
                  : '◇'}
              </th>
              <th className="px-4 py-2 text-center cursor-pointer" onClick={() => requestSort("winRate")}>
                Win %{" "}
                {sortConfig.key === "winRate"
                  ? sortConfig.direction === "desc"
                    ? "▼"
                    : "▲"
                  : "◇"}
              </th>
              <th
                className="px-4 py-2 cursor-pointer text-right"
                onClick={() => requestSort('stake')}
              >
                Wagered{' '}
                {sortConfig.key === 'stake'
                  ? sortConfig.direction === 'desc'
                    ? '▼'
                    : '▲'
                  : '◇'}
              </th>
              <th
                className="px-4 py-2 cursor-pointer text-right"
                onClick={() => requestSort('net')}
              >
                Net{' '}
                {sortConfig.key === 'net'
                  ? sortConfig.direction === 'desc'
                    ? '▼'
                    : '▲'
                  : '◇'}
              </th>
              <th
                className="px-4 py-2 cursor-pointer text-right"
                onClick={() => requestSort('roi')}
              >
                ROI{' '}
                {sortConfig.key === 'roi'
                  ? sortConfig.direction === 'desc'
                    ? '▼'
                    : '▲'
                  : '◇'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sortedData.map((item) => {
              const netColor =
                item.net > 0
                  ? 'text-accent-500'
                  : item.net < 0
                  ? 'text-danger-500'
                  : 'text-neutral-500';
              const winPct =
                item.wins + item.losses > 0
                  ? (item.wins / (item.wins + item.losses)) * 100
                  : 0;
              const winPctColor =
                winPct > 50
                  ? 'text-accent-500'
                  : winPct < 50 && item.wins + item.losses > 0
                  ? 'text-danger-500'
                  : 'text-neutral-500';

              return (
                <tr
                  key={item.name}
                  className="odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-200 dark:even:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <td className="px-4 py-2 font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-xs">
                    {item.name}
                  </td>
                  <td className="px-4 py-2 text-center">{item.count}</td>
                  <td className="px-4 py-2 text-center">{item.wins}</td>
                  <td className="px-4 py-2 text-center">{item.losses}</td>
                  <td
                    className={`px-4 py-2 text-center font-semibold ${winPctColor}`}
                  >
                    {winPct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2 text-right">{formatCurrency(item.stake)}</td>
                  <td className={`px-4 py-2 font-semibold text-right ${netColor}`}>
                    {formatCurrency(item.net)}
                  </td>
                  <td className={`px-4 py-2 font-semibold text-right ${netColor}`}>
                    {item.roi.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DateRangeButton: React.FC<{
  range: DateRange;
  label: string;
  currentRange: DateRange;
  onClick: (range: DateRange) => void;
}> = ({ range, label, currentRange, onClick }) => (
  <button
    onClick={() => onClick(range)}
    className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
      currentRange === range
        ? 'bg-primary-600 text-white shadow'
        : 'text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700'
    }`}
  >
    {label}
  </button>
);

// --- PARLAY TYPE HELPERS ---

/**
 * Determines the parlay type for display.
 * Maps betType to user-friendly names.
 */
function getParlayTypeName(bet: Bet): string {
  if (bet.betType === 'sgp') return 'SGP';
  if (bet.betType === 'sgp_plus') return 'SGP+';
  if (bet.betType === 'parlay') {
    // Check marketCategory for additional context
    if (bet.marketCategory === 'Parlays') {
      // Could be SGP/SGP+ based on marketCategory
      return 'Standard Parlay';
    }
    return 'Standard Parlay';
  }
  return 'Parlay';
}

/**
 * Gets the leg count bucket for breakdown.
 * Note: By definition parlays have 2+ legs. Bets with <2 legs are classified
 * as single bets and filtered out by isParlayBetType(), but we handle
 * edge cases defensively here.
 */
function getLegCountBucket(bet: Bet): string {
  const legCount = bet.legs?.length || 0;
  if (legCount < 2) return '2-leg'; // Edge case: shouldn't happen for parlays
  if (legCount === 2) return '2-leg';
  if (legCount === 3) return '3-leg';
  if (legCount === 4) return '4-leg';
  return '5+ legs';
}

// --- MAIN VIEW ---

const ParlayPerformanceView: React.FC = () => {
  const { bets, loading } = useBets();
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [customDateRange, setCustomDateRange] = useState<{
    start: string;
    end: string;
  }>({ start: '', end: '' });
  const [parlayTypeFilter, setParlayTypeFilter] = useState<
    'all' | 'parlay' | 'sgp' | 'sgp_plus'
  >('all');

  // MANDATORY: Filter to ONLY parlay tickets
  const parlayBets = useMemo(() => {
    const datePredicate = createDateRangePredicate(
      dateRange,
      customDateRange as CustomDateRange
    );

    return bets.filter((bet) => {
      const isParlay = isParlayBetType(bet.betType);
      if (!isParlay) return false;

      const matchesType =
        parlayTypeFilter === 'all' || bet.betType === parlayTypeFilter;
      
      return matchesType && datePredicate(bet);
    });
  }, [bets, dateRange, customDateRange, parlayTypeFilter]);

  const processedData = useMemo(() => {
    if (parlayBets.length === 0) return null;

    // 1. Overall Stats for parlay tickets only
    const overallStats = computeOverallStats(parlayBets);

    // 2. Average legs per parlay
    const totalLegs = parlayBets.reduce(
      (sum, bet) => sum + (bet.legs?.length || 0),
      0
    );
    const avgLegs = parlayBets.length > 0 ? totalLegs / parlayBets.length : 0;

    // 3. Profit over time (parlay tickets only)
    const profitOverTime = computeProfitOverTime(parlayBets);

    // 4. By leg count breakdown
    const legCountMap = computeStatsByDimension(parlayBets, (bet) =>
      getLegCountBucket(bet)
    );
    const legCountStats = mapToStatsArray(legCountMap).sort((a, b) => {
      // Sort by leg count order: 2-leg, 3-leg, 4-leg, 5+
      const order = ['2-leg', '3-leg', '4-leg', '5+ legs'];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });

    // 5. By parlay type breakdown (Standard / SGP / SGP+)
    const typeMap = computeStatsByDimension(parlayBets, (bet) =>
      getParlayTypeName(bet)
    );
    const typeStats = mapToStatsArray(typeMap).sort((a, b) => b.net - a.net);

    // 6. By sportsbook
    const bookMap = computeStatsByDimension(parlayBets, (bet) => bet.book);
    const bookStats = mapToStatsArray(bookMap).sort((a, b) => b.net - a.net);

    // 7. By sport
    const sportMap = computeStatsByDimension(parlayBets, (bet) => bet.sport);
    const sportStats = mapToStatsArray(sportMap).sort((a, b) => b.net - a.net);

    return {
      overallStats,
      avgLegs,
      profitOverTime,
      legCountStats,
      typeStats,
      bookStats,
      sportStats,
    };
  }, [parlayBets]);

  if (loading) {
    return <div className="p-6 text-center">Loading parlay data...</div>;
  }

  // Count total parlays in dataset (unfiltered)
  const totalParlaysInDataset = bets.filter((bet) =>
    isParlayBetType(bet.betType)
  ).length;

  if (totalParlaysInDataset === 0) {
    return (
      <div className="p-6 h-full flex flex-col space-y-6 bg-neutral-100 dark:bg-neutral-950 overflow-y-auto">
        <header>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Parlay Performance
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Parlay tickets only — Tickets drive money. Legs never do.
          </p>
        </header>
        <div className="flex-grow flex items-center justify-center text-center text-neutral-500 dark:text-neutral-400">
          <div>
            <Layers className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600" />
            <h3 className="mt-4 text-xl font-semibold">No Parlays Found</h3>
            <p className="mt-1">
              Import some parlay bets to see your parlay performance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Pie chart colors
  const PIE_COLORS = ['#8b5cf6', '#6d28d9', '#4c1d95', '#a78bfa', '#c4b5fd'];

  return (
    <div className="p-6 h-full flex flex-col space-y-6 bg-neutral-100 dark:bg-neutral-950 overflow-y-auto">
      <header>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
          Parlay Performance
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1 flex items-center gap-2">
          Parlay tickets only — Tickets drive money. Legs never do.
          <InfoTooltip
            text="This page shows ONLY parlay/SGP/SGP+ bets. Leg-level stats are not shown because parlay legs do not independently contribute money."
            position="right"
          />
        </p>
      </header>

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
             <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
              <ToggleButton
                value="all"
                label="All"
                currentValue={parlayTypeFilter}
                onClick={(v) => setParlayTypeFilter(v as any)}
              />
              <ToggleButton
                value="parlay"
                label="Parlay"
                currentValue={parlayTypeFilter}
                onClick={(v) => setParlayTypeFilter(v as any)}
              />
              <ToggleButton
                value="sgp"
                label="SGP"
                currentValue={parlayTypeFilter}
                onClick={(v) => setParlayTypeFilter(v as any)}
              />
              <ToggleButton
                value="sgp_plus"
                label="SGP+"
                currentValue={parlayTypeFilter}
                onClick={(v) => setParlayTypeFilter(v as any)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
            <DateRangeButton
              range="all"
              label="All"
              currentRange={dateRange}
              onClick={setDateRange}
            />
            <DateRangeButton
              range="1d"
              label="1D"
              currentRange={dateRange}
              onClick={setDateRange}
            />
            <DateRangeButton
              range="3d"
              label="3D"
              currentRange={dateRange}
              onClick={setDateRange}
            />
            <DateRangeButton
              range="1w"
              label="1W"
              currentRange={dateRange}
              onClick={setDateRange}
            />
            <DateRangeButton
              range="1m"
              label="1M"
              currentRange={dateRange}
              onClick={setDateRange}
            />
            <DateRangeButton
              range="1y"
              label="1Y"
              currentRange={dateRange}
              onClick={setDateRange}
            />
            <DateRangeButton
              range="custom"
              label="Custom"
              currentRange={dateRange}
              onClick={setDateRange}
            />
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex sm:justify-end items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label
                htmlFor="start-date"
                className="text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                From
              </label>
              <input
                type="date"
                id="start-date"
                value={customDateRange.start}
                onChange={(e) =>
                  setCustomDateRange((prev) => ({
                    ...prev,
                    start: e.target.value,
                  }))
                }
                className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label
                htmlFor="end-date"
                className="text-sm font-medium text-neutral-500 dark:text-neutral-400"
              >
                To
              </label>
              <input
                type="date"
                id="end-date"
                value={customDateRange.end}
                onChange={(e) =>
                  setCustomDateRange((prev) => ({
                    ...prev,
                    end: e.target.value,
                  }))
                }
                className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2"
              />
            </div>
          </div>
        )}

        {processedData ? (
          <>
            {/* Main KPI Cards - 4 Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
              <StatCard
                title="Net Profit"
                value={formatCurrency(processedData.overallStats.netProfit)}
                icon={<Scale className="w-6 h-6" />}
                subtitle={`${processedData.overallStats.roi.toFixed(1)}% ROI`}
                subtitleClassName={
                  processedData.overallStats.roi > 0
                    ? 'text-accent-500'
                    : processedData.overallStats.roi < 0
                    ? 'text-danger-500'
                    : undefined
                }
              />
              <StatCard
                title="Total Wagered"
                value={formatCurrency(processedData.overallStats.totalWagered)}
                icon={<BarChart2 className="w-6 h-6" />}
              />
              <StatCard
                title="Total Bets"
                value={processedData.overallStats.totalBets.toLocaleString()}
                icon={<Layers className="w-6 h-6" />}
                subtitle={`Avg Legs: ${processedData.avgLegs.toFixed(1)}`}
              />
              <StatCard
                title="Win Rate"
                value={`${processedData.overallStats.winRate.toFixed(1)}%`}
                icon={<BarChart2 className="w-6 h-6" />}
                subtitle={`${processedData.overallStats.wins}-${processedData.overallStats.losses}`}
                valueClassName={
                  processedData.overallStats.winRate > 50
                    ? 'text-accent-500'
                    : processedData.overallStats.winRate < 50
                    ? 'text-danger-500'
                    : undefined
                }
              />
            </div>



            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
              <ChartContainer
                title="Parlay Profit Over Time"
                subtitle="Parlay tickets only"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={processedData.profitOverTime}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(128, 128, 128, 0.2)"
                    />
                    <XAxis
                      dataKey="date"
                      stroke="rgb(113, 113, 122)"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      stroke="rgb(113, 113, 122)"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Profit"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>

              <ChartContainer
                title="By Leg Count"
                subtitle="Parlay tickets only"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedData.legCountStats}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(128, 128, 128, 0.2)"
                    />
                    <XAxis
                      dataKey="name"
                      stroke="rgb(113, 113, 122)"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      stroke="rgb(113, 113, 122)"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="net" name="Net Profit">
                      {processedData.legCountStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.net >= 0 ? '#22c55e' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center text-neutral-500 dark:text-neutral-400 p-8">
              <Layers className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600" />
              <h3 className="mt-4 text-xl font-semibold">No Data Found</h3>
              <p className="mt-1">
                No parlay data matches your selected filters.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Breakdowns Section */}
      {processedData && (
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center space-x-3 mb-6">
            <Layers className="w-8 h-8 text-primary-500" />
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Parlay Breakdowns
            </h2>
            <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded font-medium text-xs">
              Parlay tickets only
            </span>
          </div>

          <div className="space-y-6">
            {/* By Parlay Type */}
            <StatsTable
              data={processedData.typeStats}
              title="By Parlay Type"
              subtitle="Parlay tickets only"
              searchPlaceholder="Search type..."
            />

            {/* By Leg Count */}
            <StatsTable
              data={processedData.legCountStats}
              title="By Leg Count"
              subtitle="Parlay tickets only"
              searchPlaceholder="Search legs..."
            />

            {/* By Sportsbook */}
            <StatsTable
              data={processedData.bookStats}
              title="By Sportsbook"
              subtitle="Parlay tickets only"
              searchPlaceholder="Search book..."
            />

            {/* By Sport */}
            <StatsTable
              data={processedData.sportStats}
              title="By Sport"
              subtitle="Parlay tickets only"
              searchPlaceholder="Search sport..."
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ParlayPerformanceView;
