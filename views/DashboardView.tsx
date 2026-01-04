import React, { useMemo, useState, useLayoutEffect, useRef } from "react";
import { useBets } from "../hooks/useBets";
import { useInputs } from "../hooks/useInputs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Sector,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  BarChart2,
} from "../components/icons";
import { Bet } from "../types";
import { formatDateChartKey } from "../utils/formatters";
import {
  createBetTypePredicate,
  createDateRangePredicate,
  createMarketCategoryPredicate,
  DateRange,
  CustomDateRange,
} from "../utils/filterPredicates";
import {
  calculateRoi,
  computeOverallStats,
  computeProfitOverTime,
  computeStatsByDimension,
  mapToStatsArray,
  DimensionStats,
} from "../services/aggregationService";
import { getNetNumeric, isParlayBetType } from "../services/displaySemantics";
import { computeOverUnderStats, filterBetsByMarketCategory, OverUnderMarketFilter } from "../services/overUnderStatsService";
import { computeEntityStatsMap, EntityStats } from "../services/entityStatsService";
import { normalizeTeamName, getTeamInfo } from "../services/normalizationService";
// Phase 1: Resolver for team aggregation
// Phase 2: Extended with player aggregation
import { resolveTeam, getTeamAggregationKey, getPlayerAggregationKey } from "../services/resolver";
// Dashboard UI Clarity Phase: DEV-ONLY debug overlay and tooltips
import { DashboardTruthOverlay } from "../components/debug/DashboardTruthOverlay";
import { InfoTooltip } from "../components/debug/InfoTooltip";
// Shared Components
import { FitText } from "../components/FitText";
import { StatCard } from "../components/StatCard";
// Futures Exposure Panel (Task B)
import FuturesExposurePanel from "../components/FuturesExposurePanel";
// Local Components
import CustomTooltip from "../components/CustomTooltip";
import ChartContainer from "../components/ChartContainer";
import StatsTable from "../components/StatsTable";
import ToggleButton from "../components/ToggleButton";
import OverUnderBreakdown from "../components/OverUnderBreakdown";
import LiveVsPreMatchBreakdown from "../components/LiveVsPreMatchBreakdown";
import DateRangeButton from "../components/DateRangeButton";
import QuickStatCard from "../components/QuickStatCard";


// --- MAIN DASHBOARD VIEW ---

const DashboardView: React.FC = () => {
  const { bets, loading } = useBets();
  const { categories } = useInputs();
  const [selectedMarketCategory, setSelectedMarketCategory] =
    useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customDateRange, setCustomDateRange] = useState<{
    start: string;
    end: string;
  }>({ start: "", end: "" });
  const [entityType, setEntityType] = useState<"all" | "player" | "team">(
    "all"
  );
  const [betTypeFilter, setBetTypeFilter] = useState<"non-parlays" | "parlays" | "all">("all");

  // Extract players and teams from bet data using leg.entityType and normalization service
  // This ensures entities appear even if not manually added to localStorage
  const { allPlayers, allTeams } = useMemo(() => {
    const players = new Set<string>();
    const teams = new Set<string>();
    
    for (const bet of bets) {
      if (!bet.legs) continue;
      for (const leg of bet.legs) {
        if (!leg.entities) continue;
        for (const entity of leg.entities) {
          // Determine entity type using leg.entityType or fallback to team lookup
          if (leg.entityType === 'player') {
            // Phase 2: Use player aggregation key for player entities
            const aggregationKey = getPlayerAggregationKey(entity, '[Unresolved]', { sport: bet.sport as any });
            players.add(aggregationKey);
          } else if (leg.entityType === 'team') {
            const aggregationKey = getTeamAggregationKey(entity, '[Unresolved]');
            teams.add(aggregationKey);
          } else {
            // FALLBACK BEHAVIOR: When leg.entityType is missing or 'unknown',
            // we check if the entity is a known team in our reference data.
            // If found as a team, classify as team; otherwise default to player.
            // This may misclassify new teams not yet in reference data as players.
            // See Issue #6 in backend_data_wiring_audit.md for details.
            const teamInfo = getTeamInfo(entity);
            if (teamInfo) {
              const aggregationKey = getTeamAggregationKey(entity, '[Unresolved]');
              teams.add(aggregationKey);
            } else {
              // Default to player when entity type is unknown and not in team reference
              const aggregationKey = getPlayerAggregationKey(entity, '[Unresolved]', { sport: bet.sport as any });
              players.add(aggregationKey);
            }
          }
        }
      }
    }
    
    return { allPlayers: players, allTeams: teams };
  }, [bets]);

  const filteredBets = useMemo(() => {
    // Apply filters using shared filter predicates
    const typePredicate = createBetTypePredicate(betTypeFilter);
    const categoryPredicate = createMarketCategoryPredicate(selectedMarketCategory);
    const datePredicate = createDateRangePredicate(dateRange, customDateRange as CustomDateRange);

    return bets.filter((bet) =>
      typePredicate(bet) && categoryPredicate(bet) && datePredicate(bet)
    );
  }, [bets, selectedMarketCategory, dateRange, customDateRange, betTypeFilter]);

  const processedData = useMemo(() => {
    const initialData = {
      profitByBook: [],
      profitOverTime: [],
      marketCategoryStats: [],
      playerTeamStats: [],
      tailStats: [],
      sportStats: [],
      quickNetStats: { net1d: 0, net3d: 0, net1w: 0, net1m: 0, net1y: 0 },
      overallStats: {
        totalBets: 0,
        totalWagered: 0,
        netProfit: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        roi: 0,
      },
    };

    const now = new Date();
    // INTENTIONAL: quickNetStats uses ALL bets (not filteredBets) to provide
    // a consistent "at-a-glance" view of recent performance regardless of
    // which filters the user has applied to the main dashboard charts.
    // See Issue #5 in backend_data_wiring_audit.md for discussion.
    const calculateNetForPeriod = (startDate: Date) => {
      return bets
        .filter((bet) => new Date(bet.placedAt) >= startDate)
        .reduce((sum, bet) => sum + getNetNumeric(bet), 0);
    };
    const quickNetStats = {
      net1d: calculateNetForPeriod(
        new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
      ),
      net3d: calculateNetForPeriod(
        new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      ),
      net1w: calculateNetForPeriod(
        new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      ),
      net1m: calculateNetForPeriod(
        new Date(new Date().setMonth(now.getMonth() - 1))
      ),
      net1y: calculateNetForPeriod(
        new Date(new Date().setFullYear(now.getFullYear() - 1))
      ),
    };

    if (filteredBets.length === 0) return { ...initialData, quickNetStats };

    // 1. Overall Stats
    const overallStats = computeOverallStats(filteredBets);

    // 2. Profit Over Time
    const profitOverTime = computeProfitOverTime(filteredBets);

    // 3. Breakdown by dimensions
    const bookMap = computeStatsByDimension(filteredBets, (bet) => bet.book);
    const categoryMap = computeStatsByDimension(filteredBets, (bet) => bet.marketCategory);
    const sportMap = computeStatsByDimension(filteredBets, (bet) => bet.sport);
    const tailMap = computeStatsByDimension(filteredBets, (bet) => bet.tail ? bet.tail.trim() : null);
    
    // Player/Team Stats (P4: Use entity stats service for parlay-aware attribution)
    // Phase 1/2: Use resolver to get aggregation keys, using player or team key based on leg.entityType
    const playerTeamMap = computeEntityStatsMap(filteredBets, (leg, bet) => {
      if (leg.entities && leg.entities.length > 0) {
        return leg.entities.map(entity => {
          // Use appropriate aggregation key based on entity type
          if (leg.entityType === 'player') {
            return getPlayerAggregationKey(entity, '[Unresolved]', { sport: bet.sport as any });
          } else if (leg.entityType === 'team') {
            return getTeamAggregationKey(entity, '[Unresolved]');
          } else {
            // Fallback: check if known team, otherwise treat as player
            const teamInfo = getTeamInfo(entity);
            if (teamInfo) {
              return getTeamAggregationKey(entity, '[Unresolved]');
            }
            return getPlayerAggregationKey(entity, '[Unresolved]', { sport: bet.sport as any });
          }
        });
      }
      return null;
    });

    // Convert EntityStats map to StatsData array
    const playerTeamStats: StatsData[] = Array.from(playerTeamMap.entries())
      .map(([name, stats]: [string, EntityStats]) => ({
        name,
        count: stats.tickets, // Total straight bets involving this entity
        wins: stats.wins, // Wins from straight bets
        losses: stats.losses, // Losses from straight bets
        stake: stats.stake, // Non-parlay bets only
        net: stats.net, // Non-parlay bets only
        roi: stats.roi, // ROI on non-parlay bets
      }))
      .sort((a, b) => b.net - a.net);

    // Convert other maps to sorted arrays
    const profitByBook = mapToStatsArray(bookMap).sort((a, b) => b.net - a.net);
    const marketCategoryStats = mapToStatsArray(categoryMap).sort((a, b) => b.count - a.count);
    const sportStats = mapToStatsArray(sportMap).sort((a, b) => b.net - a.net);
    const tailStats = mapToStatsArray(tailMap).sort((a, b) => b.net - a.net);
    
    // Apply entity type filter to playerTeamStats
    let filteredPlayerTeamStats = playerTeamStats;
    if (entityType === "player") {
      filteredPlayerTeamStats = playerTeamStats.filter((item) => allPlayers.has(item.name));
    } else if (entityType === "team") {
      filteredPlayerTeamStats = playerTeamStats.filter((item) => allTeams.has(item.name));
    }

    return {
      profitOverTime,
      profitByBook,
      quickNetStats,
      overallStats,
      marketCategoryStats,
      sportStats,
      playerTeamStats: filteredPlayerTeamStats,
      tailStats,
    };
  }, [bets, filteredBets, allPlayers, allTeams, entityType]);

  const hasData = processedData.profitOverTime.length > 0;

  if (loading)
    return <div className="p-6 text-center">Loading dashboard...</div>;
  if (bets.length === 0)
    return (
      <div className="p-6 text-center text-neutral-500">
        No data to display. Please import some bets first.
      </div>
    );

  const EntityTypeButton: React.FC<{
    type: "all" | "player" | "team";
    label: string;
  }> = ({ type, label }) => (
    <button
      onClick={() => setEntityType(type)}
      className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
        entityType === type
          ? "bg-primary-600 text-white shadow"
          : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-6 h-full flex flex-col space-y-6 bg-neutral-100 dark:bg-neutral-950 overflow-y-auto">
      {/* DEV-ONLY: Truth Overlay for debugging */}
      <DashboardTruthOverlay
        allBets={bets}
        filteredBets={filteredBets}
        dateRange={dateRange}
        customDateRange={customDateRange as { start: string; end: string }}
        betTypeFilter={betTypeFilter}
        selectedMarketCategory={selectedMarketCategory}
        entityType={entityType}
      />

      <div className="flex-shrink-0 bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            A high-level overview of your betting performance.
          </p>
        </div>



        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 pt-2">
          <QuickStatCard
            label="Last 24h"
            value={processedData.quickNetStats.net1d}
          />
          <QuickStatCard
            label="Last 3 Days"
            value={processedData.quickNetStats.net3d}
          />
          <QuickStatCard
            label="Last Week"
            value={processedData.quickNetStats.net1w}
          />
          <QuickStatCard
            label="Last Month"
            value={processedData.quickNetStats.net1m}
          />
          <QuickStatCard
            label="Last Year"
            value={processedData.quickNetStats.net1y}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
            <button
              onClick={() => setSelectedMarketCategory("all")}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                selectedMarketCategory === "all"
                  ? "bg-primary-600 text-white shadow"
                  : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
              }`}
            >
              All
            </button>
            {["Main Markets", "Props", "Parlays", "Futures"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedMarketCategory(cat)}
                className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                  selectedMarketCategory === cat
                    ? "bg-primary-600 text-white shadow"
                    : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
            <button
              onClick={() => setBetTypeFilter("all")}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                betTypeFilter === "all"
                  ? "bg-primary-600 text-white shadow"
                  : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setBetTypeFilter("non-parlays")}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                betTypeFilter === "non-parlays"
                  ? "bg-primary-600 text-white shadow"
                  : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
              }`}
            >
              Singles
            </button>
            <button
              onClick={() => setBetTypeFilter("parlays")}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                betTypeFilter === "parlays"
                  ? "bg-primary-600 text-white shadow"
                  : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
              }`}
            >
              Parlays
            </button>
          </div>
          <div className="flex items-center gap-2">
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
        </div>

        {dateRange === "custom" && (
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

        {hasData ? (
          <>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
              <StatCard
                title="Net Profit"
                value={`${
                  processedData.overallStats.netProfit >= 0 ? "$" : "-$"
                }${Math.abs(processedData.overallStats.netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<Scale className="w-6 h-6" />}
                subtitle={`${processedData.overallStats.roi.toFixed(1)}% ROI`}
                subtitleClassName={processedData.overallStats.roi > 0 ? "text-accent-500" : processedData.overallStats.roi < 0 ? "text-danger-500" : undefined}
              />
              <StatCard
                title="Total Wagered"
                value={`$${processedData.overallStats.totalWagered.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<BarChart2 className="w-6 h-6" />}
              />
              <StatCard
                title="Total Bets"
                value={processedData.overallStats.totalBets.toString()}
                icon={<BarChart2 className="w-6 h-6" />}
              />
              <StatCard
                title="Win Rate"
                value={`${processedData.overallStats.winRate.toFixed(1)}%`}
                icon={<BarChart2 className="w-6 h-6" />}
                valueClassName={processedData.overallStats.winRate > 50 ? "text-accent-500" : processedData.overallStats.winRate < 50 ? "text-danger-500" : undefined}
                subtitle={`${processedData.overallStats.wins}-${processedData.overallStats.losses}`}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartContainer title="Profit Over Time">
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
                      tickFormatter={(value) => `$${value}`}
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

              <ChartContainer title="Total Profit by Sportsbook">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={processedData.profitByBook}>
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
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="profit" name="Profit">
                      {processedData.profitByBook.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.profit >= 0 ? "#22c55e" : "#ef4444"}
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
              <BarChart2 className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600" />
              <h3 className="mt-4 text-xl font-semibold">No Data Found</h3>
              <p className="mt-1">
                No betting data matches your selected filters.
              </p>
            </div>
          </div>
        )}
      </div>

      {hasData && (
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center space-x-3 mb-6">
            <BarChart2 className="w-8 h-8 text-primary-500" />
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Performance Review
            </h2>
          </div>
          <div className="space-y-6">
            <StatsTable
              data={processedData.marketCategoryStats}
              title="Performance by Market Category"
              searchPlaceholder="Search category..."
            />
            <StatsTable
              data={processedData.sportStats}
              title="Performance by Sport"
              searchPlaceholder="Search sport..."
            />
            <div className="h-[500px]">
              <StatsTable
                data={processedData.playerTeamStats}
                title={
                  <span className="flex items-center gap-2">
                    Player & Team Performance
                    <InfoTooltip
                      text="Parlays/SGP/SGP+ contribute $0 stake/net to entity breakdowns (prevents double-counting)."
                      position="right"
                    />
                  </span>
                }
                searchPlaceholder="Search player/team..."
                className="h-full"
              >
                <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
                  <EntityTypeButton type="all" label="All" />
                  <EntityTypeButton type="player" label="Player" />
                  <EntityTypeButton type="team" label="Team" />
                </div>
              </StatsTable>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <OverUnderBreakdown bets={filteredBets} />
              <LiveVsPreMatchBreakdown bets={filteredBets} />
            </div>
            {processedData.tailStats.length > 0 && (
              <StatsTable
                data={processedData.tailStats}
                title="Performance by Tail"
                searchPlaceholder="Search tail..."
              />
            )}
            {/* Futures Exposure Panel (Task B) */}
            <FuturesExposurePanel bets={bets} />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;
