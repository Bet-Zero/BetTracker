import React, { useMemo, useState } from "react";
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
  Trophy,
} from "../components/icons";
import { Bet, BetResult } from "../types";
import {
  createDateRangePredicate,
  DateRange,
  CustomDateRange,
} from "../utils/filterPredicates";
import { formatCurrency, formatNet } from "../utils/formatters";
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
import {
  computeEntityStatsMap,
  EntityStats,
} from "../services/entityStatsService";
import { normalizeTeamName, getTeamInfo } from "../services/normalizationService";
import { abbreviateMarket } from "../services/marketClassification";
// Phase 1: Resolver for team aggregation
// Phase 2: Extended with player aggregation
import { getTeamAggregationKey, getPlayerAggregationKey } from "../services/resolver";
// Task C: UI Clarity tooltips
import { InfoTooltip } from "../components/debug/InfoTooltip";
import { StatCard } from "../components/StatCard";
import { FitText } from "../components/FitText";

// --- HELPER FUNCTIONS & COMPONENTS ---

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-neutral-800 p-2 border border-neutral-300 dark:border-neutral-600 rounded shadow-lg text-sm">
        <p className="label font-bold mb-1">{`${label}`}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.color || pld.fill }}>
            {`${pld.name}: ${
              typeof pld.value === "number" ? pld.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : pld.value
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
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
    <h2 className="text-xl font-semibold mb-4 text-neutral-800 dark:text-neutral-200">
      {title}
    </h2>
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
  sport?: string;
};
interface StatsTableProps {
  data: StatsData[];
  title: React.ReactNode;
  searchPlaceholder: string;
  firstColumnHeader?: string;
  className?: string;
  children?: React.ReactNode;
  hideWinLoss?: boolean;
}

const StatsTable: React.FC<StatsTableProps> = ({
  data,
  title,
  searchPlaceholder,
  firstColumnHeader,
  className,
  children,
  hideWinLoss,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof StatsData;
    direction: "asc" | "desc";
  }>({ key: "net", direction: "desc" });

  const sortedData = useMemo(() => {
    const filtered = data.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key])
        return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key])
        return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, searchTerm, sortConfig]);

  const requestSort = (key: keyof StatsData) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  return (
    <div
      className={`bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 flex flex-col ${className}`}
    >
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
          {title}
        </h2>
        {children}
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
                onClick={() => requestSort("name")}
              >
                {firstColumnHeader || searchPlaceholder.split(" ")[1].replace("...", "")}{" "}
                {sortConfig.key === "name"
                  ? sortConfig.direction === "desc"
                    ? "▼"
                    : "▲"
                  : "◇"}
              </th>
              <th
                className="px-4 py-2 cursor-pointer text-center"
                onClick={() => requestSort("count")}
              >
                # Bets{" "}
                {sortConfig.key === "count"
                  ? sortConfig.direction === "desc"
                    ? "▼"
                    : "▲"
                  : "◇"}
              </th>
              {!hideWinLoss && (
                <>
                  <th
                    className="px-4 py-2 cursor-pointer text-center"
                    onClick={() => requestSort("wins")}
                  >
                    Win{" "}
                    {sortConfig.key === "wins"
                      ? sortConfig.direction === "desc"
                        ? "▼"
                        : "▲"
                      : "◇"}
                  </th>
                  <th
                    className="px-4 py-2 cursor-pointer text-center"
                    onClick={() => requestSort("losses")}
                  >
                    Loss{" "}
                    {sortConfig.key === "losses"
                      ? sortConfig.direction === "desc"
                        ? "▼"
                        : "▲"
                      : "◇"}
                  </th>
                  <th className="px-4 py-2 text-center">Win %</th>
                </>
              )}
              <th
                className="px-4 py-2 cursor-pointer"
                onClick={() => requestSort("stake")}
              >
                Wagered{" "}
                {sortConfig.key === "stake"
                  ? sortConfig.direction === "desc"
                    ? "▼"
                    : "▲"
                  : "◇"}
              </th>
              <th
                className="px-4 py-2 cursor-pointer"
                onClick={() => requestSort("net")}
              >
                Net{" "}
                {sortConfig.key === "net"
                  ? sortConfig.direction === "desc"
                    ? "▼"
                    : "▲"
                  : "◇"}
              </th>
              <th
                className="px-4 py-2 cursor-pointer"
                onClick={() => requestSort("roi")}
              >
                ROI{" "}
                {sortConfig.key === "roi"
                  ? sortConfig.direction === "desc"
                    ? "▼"
                    : "▲"
                  : "◇"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {sortedData.map((item) => {
              const netColor =
                item.net > 0
                  ? "text-accent-500"
                  : item.net < 0
                  ? "text-danger-500"
                  : "text-neutral-500";
              const winPct =
                item.wins + item.losses > 0
                  ? (item.wins / (item.wins + item.losses)) * 100
                  : 0;
              const winPctColor =
                winPct > 50
                  ? "text-accent-500"
                  : winPct < 50 && item.wins + item.losses > 0
                  ? "text-danger-500"
                  : "text-neutral-500";

              return (
                <tr
                  key={item.sport ? `${item.sport}-${item.name}` : item.name}
                  className="odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-200 dark:even:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <td className="px-4 py-2 font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-xs">
                    {item.name}
                  </td>
                  <td className="px-4 py-2 text-center">{item.count}</td>
                  {!hideWinLoss && (
                    <>
                      <td className="px-4 py-2 text-center">{item.wins}</td>
                      <td className="px-4 py-2 text-center">{item.losses}</td>
                      <td
                        className={`px-4 py-2 text-center font-semibold ${winPctColor}`}
                      >
                        {winPct.toFixed(1)}%
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2">{formatCurrency(item.stake)}</td>
                  <td className={`px-4 py-2 font-semibold ${netColor}`}>
                    {formatNet(item.net)}
                  </td>
                  <td className={`px-4 py-2 font-semibold ${netColor}`}>
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

const extractEntityFromDescription = (description: string): string => {
  const patterns = [
    /^(.*?)\s+([+-]\d+(\.\d+)?|ML|PK|pk)$/i,
    /^(.*?)\s+(?:to win|To Win|to Win Outright)/i,
    /^(.*?)\s+(?:Over|Under|O|U)\s+\d+(\.\d+)?/i,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return description;
};

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
        ? "bg-primary-600 text-white shadow"
        : "text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
    }`}
  >
    {label}
  </button>
);

const OverUnderBreakdown: React.FC<{ bets: Bet[] }> = ({ bets }) => {
  const [filter, setFilter] = useState<OverUnderMarketFilter>("all");

  const data = useMemo(() => {
    // Use shared O/U stats service (consolidates parlay exclusion logic)
    const filteredBets = filterBetsByMarketCategory(bets, filter);
    return computeOverUnderStats(filteredBets);
  }, [bets, filter]);

  const pieData = [
    { name: "Over", value: data.over.count, color: "#8b5cf6" },
    { name: "Under", value: data.under.count, color: "#6d28d9" },
  ].filter((d) => d.value > 0);

  const StatCard = ({
    title,
    stats,
    color,
  }: {
    title: string;
    stats: any;
    color: string;
  }) => {
    const netColor =
      stats.net > 0
        ? "text-accent-500"
        : stats.net < 0
        ? "text-danger-500"
        : "";
    const winPct =
      stats.wins + stats.losses > 0
        ? (stats.wins / (stats.wins + stats.losses)) * 100
        : 0;
    return (
      <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 flex-1">
        <h4 className="font-bold text-lg" style={{ color }}>
          {title}
        </h4>
        <div className="text-sm mt-2 space-y-1 text-neutral-600 dark:text-neutral-300">
          <p>
            <b>Bets:</b> {stats.count}
          </p>
          <p>
            <b>Record:</b> {stats.wins}-{stats.losses}
          </p>
          <p>
            <b>Win %:</b> {winPct.toFixed(1)}%
          </p>
          <div className="flex justify-between items-center">
            <b>Net:</b>
            <div className="flex items-center ml-1">
              <div className="w-20 h-6">
                 <FitText maxFontSize={16} minFontSize={10} className={`justify-end font-bold ${netColor}`}>
                   {formatCurrency(stats.net)}
                 </FitText>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <b>ROI:</b>
            <span className={`font-bold ${netColor}`}>{stats.roi.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  const isPlaceholder = pieData.length === 0;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
            Over vs. Under
          </h2>
          {/* Task C1: BySportView O/U Breakdown tooltip */}
          <InfoTooltip
            text="Straight bets only (excludes parlay/SGP legs)"
            position="right"
          />
        </div>
        <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
          <ToggleButton
            value="props"
            label="Props"
            currentValue={filter}
            onClick={(v) => setFilter(v as any)}
          />
          <ToggleButton
            value="totals"
            label="Totals"
            currentValue={filter}
            onClick={(v) => setFilter(v as any)}
          />
          <ToggleButton
            value="all"
            label="All"
            currentValue={filter}
            onClick={(v) => setFilter(v as any)}
          />
        </div>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={isPlaceholder ? [{ name: "No Data", value: 1 }] : pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={isPlaceholder ? 50 : 0}
              outerRadius={60}
              label={
                isPlaceholder
                  ? undefined
                  : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
              }
              stroke="none"
              fill={isPlaceholder ? "#e5e5e5" : undefined}
            >
              {!isPlaceholder &&
                pieData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
            </Pie>
            {!isPlaceholder && <Tooltip />}
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-4">
        <StatCard
          title="Over"
          stats={data.over}
          color={pieData.find((d) => d.name === "Over")?.color || "#8b5cf6"}
        />
        <StatCard
          title="Under"
          stats={data.under}
          color={pieData.find((d) => d.name === "Under")?.color || "#6d28d9"}
        />
      </div>
    </div>
  );
};

const LiveVsPreMatchBreakdown: React.FC<{ bets: Bet[] }> = ({ bets }) => {
  const [filter, setFilter] = useState<"all" | "props" | "main">("all");

  const data = useMemo(() => {
    const filteredBets = bets.filter((bet) => {
      if (filter === "props") return bet.marketCategory === "Props";
      if (filter === "main") return bet.marketCategory === "Main Markets";
      return true; // all
    });

    const stats = {
      live: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 },
      preMatch: { count: 0, wins: 0, losses: 0, stake: 0, net: 0 },
    };

    filteredBets.forEach((bet) => {
      const result = bet.result;
      const net = getNetNumeric(bet);
      const liveTarget = bet.isLive ? stats.live : stats.preMatch;
      liveTarget.count++;
      liveTarget.stake += bet.stake;
      liveTarget.net += net;
      if (result === "win") liveTarget.wins++;
      if (result === "loss") liveTarget.losses++;
    });

    // Using imported calculateRoi from aggregationService

    return {
      live: {
        ...stats.live,
        roi: calculateRoi(stats.live.net, stats.live.stake),
      },
      preMatch: {
        ...stats.preMatch,
        roi: calculateRoi(stats.preMatch.net, stats.preMatch.stake),
      },
    };
  }, [bets, filter]);

  const pieData = [
    { name: "Pre-Match", value: data.preMatch.count, color: "#4c1d95" },
    { name: "Live", value: data.live.count, color: "#a78bfa" },
  ].filter((d) => d.value > 0);

  const isPlaceholder = pieData.length === 0;

  const StatCard = ({
    title,
    stats,
    color,
  }: {
    title: string;
    stats: any;
    color: string;
  }) => {
    const netColor =
      stats.net > 0
        ? "text-accent-500"
        : stats.net < 0
        ? "text-danger-500"
        : "";
    const winPct =
      stats.wins + stats.losses > 0
        ? (stats.wins / (stats.wins + stats.losses)) * 100
        : 0;
    return (
      <div className="p-4 rounded-lg bg-neutral-100 dark:bg-neutral-800/50 flex-1">
        <h4 className="font-bold text-lg" style={{ color }}>
          {title}
        </h4>
        <div className="text-sm mt-2 space-y-1 text-neutral-600 dark:text-neutral-300">
          <p>
            <b>Bets:</b> {stats.count}
          </p>
          <p>
            <b>Record:</b> {stats.wins}-{stats.losses}
          </p>
          <p>
            <b>Win %:</b> {winPct.toFixed(1)}%
          </p>
          <div className="flex justify-between items-center">
            <b>Net:</b>
            <div className="flex items-center ml-1">
              <div className="w-20 h-6">
                 <FitText maxFontSize={16} minFontSize={10} className={`justify-end font-bold ${netColor}`}>
                   {formatCurrency(stats.net)}
                 </FitText>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <b>ROI:</b>
            <span className={`font-bold ${netColor}`}>{stats.roi.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200">
          Live vs. Pre-Game
        </h2>
        <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
          <ToggleButton
            value="props"
            label="Props"
            currentValue={filter}
            onClick={(v) => setFilter(v as any)}
          />
          <ToggleButton
            value="main"
            label="Main Markets"
            currentValue={filter}
            onClick={(v) => setFilter(v as any)}
          />
          <ToggleButton
            value="all"
            label="All"
            currentValue={filter}
            onClick={(v) => setFilter(v as any)}
          />
        </div>
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={isPlaceholder ? [{ name: "No Data", value: 1 }] : pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={isPlaceholder ? 50 : 0}
              outerRadius={60}
              label={
                isPlaceholder
                  ? undefined
                  : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
              }
              stroke="none"
              fill={isPlaceholder ? "#e5e5e5" : undefined}
            >
              {!isPlaceholder &&
                pieData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
            </Pie>
            {!isPlaceholder && <Tooltip />}
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-4">
        <StatCard
          title="Pre-Game"
          stats={data.preMatch}
          color={
            pieData.find((d) => d.name === "Pre-Match")?.color || "#4c1d95"
          }
        />
        <StatCard
          title="Live"
          stats={data.live}
          color={pieData.find((d) => d.name === "Live")?.color || "#a78bfa"}
        />
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
        ? "bg-primary-600 text-white shadow"
        : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
    }`}
  >
    {label}
  </button>
);

const SportBreakdownChart: React.FC<{ data: StatsData[] }> = ({ data }) => {
  return (
    <ChartContainer title="Sport Breakdown (Net Profit)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
          <XAxis dataKey="name" stroke="rgb(113, 113, 122)" tick={{ fontSize: 12 }} />
          <YAxis
            stroke="rgb(113, 113, 122)"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-neutral-800 p-2 border border-neutral-300 dark:border-neutral-600 rounded shadow-lg text-sm">
                    <p className="label font-bold mb-1">{label}</p>
                    <p className={data.net >= 0 ? "text-accent-500" : "text-danger-500"}>
                      Net: {formatCurrency(data.net)}
                    </p>
                    <p>ROI: {data.roi.toFixed(1)}%</p>
                    <p>Bets: {data.count}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="net" name="Net Profit">
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.net >= 0 ? "#8b5cf6" : "#ef4444"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

const BySportView: React.FC = () => {
  const { bets, loading } = useBets();
  const { sports } = useInputs();
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customDateRange, setCustomDateRange] = useState<{
    start: string;
    end: string;
  }>({ start: "", end: "" });
  const [entityType, setEntityType] = useState<"all" | "player" | "team">(
    "all"
  );

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
            // Fallback: check if entity is a known team via normalization service
            const teamInfo = getTeamInfo(entity);
            if (teamInfo) {
              const aggregationKey = getTeamAggregationKey(entity, '[Unresolved]');
              teams.add(aggregationKey);
            } else {
              // Assume player if not a known team - use player aggregation
              const aggregationKey = getPlayerAggregationKey(entity, '[Unresolved]', { sport: bet.sport as any });
              players.add(aggregationKey);
            }
          }
        }
      }
    }
    
    return { allPlayers: players, allTeams: teams };
  }, [bets]);

  const availableSports = useMemo(() => {
    if (loading) return [];
    const sports = new Set(bets.map((bet) => bet.sport));
    return [...Array.from(sports).filter(s => s && s.trim() !== "").sort()];
  }, [bets, loading]);



  const filteredBets = useMemo(() => {
    // First filter by sport, then apply date range filter
    // Note: Sport is filtered manually here because createSportPredicate handles 'all', but here we select specific sport from list.
    // Actually, we can use simple equality or createSportPredicate.
    // Let's use clean manual filter for strict equality as before, then composed date predicate.
    // Or createSportPredicate(selectedSport).
    const datePredicate = createDateRangePredicate(
      dateRange,
      customDateRange as CustomDateRange
    );

    return bets.filter(
      (bet) =>
        (selectedSport === "All" || bet.sport === selectedSport) &&
        datePredicate(bet)
    );
  }, [bets, selectedSport, dateRange, customDateRange]);

  const processedData = useMemo(() => {
    if (filteredBets.length === 0) return null;

    const overallStats = computeOverallStats(filteredBets);
    const profitOverTime = computeProfitOverTime(filteredBets);

    // Breakdowns
    // Market Stats: group by market name (since sport is constant)
    const marketMap = computeStatsByDimension(filteredBets, (bet) => {
      if (bet.legs?.length) return bet.legs.map((leg) => abbreviateMarket(leg.market, bet.sport));
      return null;
    });

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

    // Tail Stats
    const tailMap = computeStatsByDimension(filteredBets, (bet) =>
      bet.tail ? bet.tail.trim() : null
    );

    // Sport Stats (for "All" view)
    const sportMap = computeStatsByDimension(filteredBets, (bet) => bet.sport);

    // Convert EntityStats map to StatsData array
    let playerTeamStats: StatsData[] = Array.from(playerTeamMap.entries()).map(
      ([name, stats]: [string, EntityStats]) => ({
        name,
        count: stats.tickets, // Straight bets only (parlays excluded)
        wins: stats.wins,
        losses: stats.losses,
        stake: stats.stake,
        net: stats.net,
        roi: stats.roi,
      })
    );

    // Filter Player/Team Stats
    if (entityType === "player") {
      playerTeamStats = playerTeamStats.filter((item) =>
        allPlayers.has(item.name)
      );
    } else if (entityType === "team") {
      playerTeamStats = playerTeamStats.filter((item) =>
        allTeams.has(item.name)
      );
    }
    playerTeamStats.sort((a, b) => b.net - a.net);

    return {
      overallStats,
      profitOverTime,
      playerTeamStats,
      marketStats: mapToStatsArray(marketMap).sort((a, b) => b.net - a.net),
      tailStats: mapToStatsArray(tailMap).sort((a, b) => b.net - a.net),
      sportStats: mapToStatsArray(sportMap).sort((a, b) => b.net - a.net),
    };
  }, [filteredBets, entityType, allPlayers, allTeams]);

  if (loading)
    return <div className="p-6 text-center">Loading sport data...</div>;

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
      <header>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
          By Sport
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          A detailed performance analysis for each sport.
        </p>
      </header>

      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
            <button
              onClick={() => setSelectedSport("All")}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                selectedSport === "All"
                  ? "bg-primary-600 text-white shadow"
                  : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
              }`}
            >
              All
            </button>
            {availableSports.map((sport) => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                  selectedSport === sport
                    ? "bg-primary-600 text-white shadow"
                    : "text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700"
                }`}
              >
                {sport}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-1 flex-wrap gap-y-2 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg">
            <DateRangeButton
              range="all"
              label="All Time"
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
        {dateRange === "custom" && (
          <div className="flex sm:justify-end items-center space-x-4">
            <input
              type="date"
              value={customDateRange.start}
              onChange={(e) =>
                setCustomDateRange((p) => ({ ...p, start: e.target.value }))
              }
              className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 text-sm"
            />
            <input
              type="date"
              value={customDateRange.end}
              onChange={(e) =>
                setCustomDateRange((p) => ({ ...p, end: e.target.value }))
              }
              className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg p-2 text-sm"
            />
          </div>
        )}

        {processedData ? (
          <div className="space-y-6 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Net Profit"
                value={formatCurrency(processedData.overallStats.netProfit)}
                icon={<Scale className="w-6 h-6" />}
                subtitle={`${processedData.overallStats.roi.toFixed(1)}% ROI`}
                subtitleClassName={processedData.overallStats.roi > 0 ? "text-accent-500" : processedData.overallStats.roi < 0 ? "text-danger-500" : undefined}
              />
              <StatCard
                title="Total Wagered"
                value={formatCurrency(processedData.overallStats.totalWagered)}
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
                subtitle={`${processedData.overallStats.wins}-${processedData.overallStats.losses}`}
                valueClassName={processedData.overallStats.winRate > 50 ? "text-accent-500" : processedData.overallStats.winRate < 50 ? "text-danger-500" : undefined}
              />
            </div>
            {selectedSport === "All" ? (
              <SportBreakdownChart data={processedData.sportStats} />
            ) : (
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
            )}
          </div>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center text-neutral-500 dark:text-neutral-400 p-8">
              <Trophy className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600" />
              <h3 className="mt-4 text-xl font-semibold">No Data Found</h3>
              <p className="mt-1">
                No betting data found for{" "}
                {selectedSport === "All" ? "any sport" : selectedSport} in the
                selected date range.
              </p>
            </div>
          </div>
        )}
      </div>

      {processedData && (
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">
            Performance Analysis for{" "}
            {selectedSport === "All" ? "All Sports" : selectedSport}
          </h2>
          <div className="space-y-6">
            {selectedSport === "All" ? (
              <StatsTable
                data={processedData.sportStats}
                title="Sport Performance"
                searchPlaceholder="Search sport..."
                firstColumnHeader="Sport"
              />
            ) : (
              <>
                <StatsTable
                  data={processedData.marketStats}
                  title="Market Performance"
                  searchPlaceholder="Search market..."
                  firstColumnHeader="Market"
                />
                <div className="h-[500px]">
                  <StatsTable
                    data={processedData.playerTeamStats}
                    title={
                      <span className="flex items-center gap-2">
                        Player & Team Performance
                        {/* Task C2: BySportView Player & Team Table tooltip */}
                        <InfoTooltip
                          text="Parlays/SGP/SGP+ contribute $0 stake/net to entity breakdowns (prevents double-counting)."
                          position="right"
                        />
                      </span>
                    }
                    searchPlaceholder="Search player/team..."
                    firstColumnHeader="Player / Team"
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
                    firstColumnHeader="Tail"
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BySportView;
