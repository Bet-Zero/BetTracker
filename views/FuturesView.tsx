/**
 * Futures Management View
 *
 * A comprehensive management tool for futures betting positions.
 * Treats futures as holdings/investments rather than traditional bets.
 *
 * Features:
 * - Position grouping: Multiple bets on same entity aggregated
 * - Analytics: Average odds, average stake, individual bet breakdown
 * - Enhanced hedge calculator: Multi-outcome scenarios, adjustable balance
 * - Timeline: Estimated resolution dates with countdown
 * - Historical tracking: Settled futures performance
 *
 * Dataset: All futures bets (marketCategory === 'Futures')
 */

import React, { useMemo, useState } from "react";
import { useBets } from "../hooks/useBets";
import { Bet } from "../types";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  ChevronDown,
  ChevronRight,
  BarChart2,
  Scale,
  Info,
} from "../components/icons";
import { InfoTooltip } from "../components/debug/InfoTooltip";
import MultiHedgeCalculator from "../components/MultiHedgeCalculator";

// ============================================================================
// Types
// ============================================================================

interface FuturesPosition {
  /** Unique key for grouping (entity + futures type) */
  key: string;
  /** Entity name (team/player) */
  entity: string;
  /** Futures type (Championship, MVP, Win Total, etc.) */
  futuresType: string;
  /** Sport */
  sport: string;
  /** All bets in this position */
  bets: Bet[];
  /** Total stakes across all bets */
  totalStake: number;
  /** Total potential payout (sum of individual payouts) */
  totalPotentialPayout: number;
  /** Weighted average odds (by stake) */
  averageOdds: number;
  /** Average stake per bet */
  averageStake: number;
  /** Max profit if all win */
  maxProfit: number;
  /** Estimated resolution date */
  resolutionDate: Date | null;
  /** Days until resolution */
  daysUntil: number | null;
  /** Status: 'pending', 'won', 'lost', 'mixed' */
  status: "pending" | "won" | "lost" | "mixed";
}

interface PositionBreakdown {
  id: string;
  date: string;
  odds: number;
  stake: number;
  potentialPayout: number;
  profit: number;
  result: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract entity name from bet description for futures.
 */
function extractEntityFromDescription(description: string): string {
  if (!description) return "";

  const patterns: RegExp[] = [
    /^(.*?)\s+to\s+win/i,
    /^(.*?)\s+win\s+total/i,
    /^(.*?)\s+vs\./i,
    /^(.*?)\s+-\s+/,
    /^(.*?)\s+(?:Over|Under)\s+\d/i,
    /^(.*?)\s+\([+-]\d+\)/,
    /^(.*?)\s+\(/,
    /^(.*?)\s+(?:Finals|Championship)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const entity = match[1].trim();
      if (entity.length > 1) {
        return entity;
      }
    }
  }

  if (description.length > 40) {
    return description.substring(0, 40) + "…";
  }
  return description;
}

/**
 * Extract futures type from bet data.
 * Uses description, bet type field, and legs data to determine futures type.
 */
function extractFuturesType(bet: Bet): string {
  const description = bet.description || "";
  const desc = description.toLowerCase();
  const sport = (bet.sport || "").toLowerCase();

  // First try the bet's type field if it exists and is meaningful
  if (bet.type && bet.type !== "single" && bet.type !== "parlay") {
    const betType = bet.type.toLowerCase();
    // Map common type field values
    if (betType.includes("win total")) return "Win Total";
    if (betType.includes("championship") || betType.includes("finals"))
      return getChampionshipName(sport);
    if (betType.includes("mvp")) return "MVP";
    if (betType.includes("dpoy")) return "DPOY";
    if (betType.includes("roy") || betType.includes("rookie")) return "ROY";
    if (betType.includes("playoff"))
      return betType.includes("miss") ? "Miss Playoffs" : "Make Playoffs";
    if (betType.includes("division")) return "Division Winner";
    if (betType.includes("conference")) return "Conference Winner";
    if (betType.includes("winner") || betType.includes("outright"))
      return "Outright Winner";
  }

  // Check legs for market info
  if (bet.legs && bet.legs.length > 0 && bet.legs[0].market) {
    const market = bet.legs[0].market.toLowerCase();
    if (market.includes("outright") || market.includes("winner"))
      return "Outright Winner";
    if (market.includes("championship") || market.includes("finals"))
      return getChampionshipName(sport);
  }

  // Pattern matching on description
  if (
    desc.includes("championship") ||
    desc.includes("to win") ||
    desc.includes("winner")
  ) {
    return getChampionshipName(sport);
  }

  if (
    desc.includes("win total") ||
    desc.includes("wins total") ||
    desc.includes("season wins")
  )
    return "Win Total";
  if (desc.includes("mvp")) return "MVP";
  if (desc.includes("dpoy") || desc.includes("defensive player")) return "DPOY";
  if (
    desc.includes("roy") ||
    desc.includes("rookie of the year") ||
    desc.includes("rookie")
  )
    return "ROY";
  if (desc.includes("make playoff")) return "Make Playoffs";
  if (desc.includes("miss playoff")) return "Miss Playoffs";
  if (desc.includes("division")) return "Division Winner";
  if (desc.includes("conference")) return "Conference Winner";
  if (desc.includes("scoring") && desc.includes("leader"))
    return "Scoring Leader";
  if (desc.includes("6moy") || desc.includes("sixth man")) return "6MOY";
  if (desc.includes("mip") || desc.includes("most improved")) return "MIP";
  if (desc.includes("coy") || desc.includes("coach of the year")) return "COY";
  if (desc.includes("cy young")) return "Cy Young";
  if (desc.includes("home run")) return "HR Leader";
  if (desc.includes("batting")) return "Batting Title";

  // If description contains common futures terms, use a generic descriptor
  if (desc.includes("future") || desc.includes("outright"))
    return "Outright Winner";

  // Last resort: try to extract something meaningful from description
  const shortDesc =
    description.length > 20
      ? description.substring(0, 20).trim() + "..."
      : description;
  return shortDesc || "Future";
}

/**
 * Get championship name based on sport.
 */
function getChampionshipName(sport: string): string {
  const s = sport.toLowerCase();
  if (s === "nba" || s === "basketball") return "NBA Championship";
  if (s === "nfl" || s === "football") return "Super Bowl";
  if (s === "mlb" || s === "baseball") return "World Series";
  if (s === "nhl" || s === "hockey") return "Stanley Cup";
  if (s === "soccer" || s === "mls") return "MLS Cup";
  if (s === "tennis") return "Tournament Winner";
  if (s === "golf") return "Tournament Winner";
  return "Championship";
}

/**
 * Estimate resolution date based on futures type and sport.
 */
function estimateResolutionDate(
  futuresType: string,
  sport: string,
): Date | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  const type = futuresType.toLowerCase();
  const sportLower = sport.toLowerCase();

  let date: Date | null = null;

  // NFL
  if (
    type.includes("super bowl") ||
    (type.includes("championship") && sportLower === "nfl") ||
    (type.includes("outright") && sportLower === "nfl")
  ) {
    date = new Date(currentYear, 1, 9); // February 9
  }
  // NBA
  else if (
    type.includes("nba championship") ||
    type.includes("nba finals") ||
    (type.includes("championship") && sportLower === "nba") ||
    (type.includes("outright") && sportLower === "nba")
  ) {
    date = new Date(currentYear, 5, 15); // June 15
  }
  // MLB
  else if (
    type.includes("world series") ||
    (type.includes("championship") && sportLower === "mlb") ||
    (type.includes("outright") && sportLower === "mlb")
  ) {
    date = new Date(currentYear, 9, 30); // October 30
  }
  // NHL
  else if (
    type.includes("stanley cup") ||
    (type.includes("championship") && sportLower === "nhl") ||
    (type.includes("outright") && sportLower === "nhl")
  ) {
    date = new Date(currentYear, 5, 20); // June 20
  }
  // Win Totals
  else if (type.includes("win total")) {
    if (sportLower === "nfl" || sportLower === "football")
      date = new Date(currentYear, 0, 8);
    else if (sportLower === "nba" || sportLower === "basketball")
      date = new Date(currentYear, 3, 14);
    else if (sportLower === "mlb" || sportLower === "baseball")
      date = new Date(currentYear, 9, 1);
    else if (sportLower === "nhl" || sportLower === "hockey")
      date = new Date(currentYear, 3, 15);
    else date = new Date(currentYear, 5, 1); // Default mid-year
  }
  // Awards (MVP, DPOY, ROY, etc.)
  else if (
    type.includes("mvp") ||
    type.includes("dpoy") ||
    type.includes("roy") ||
    type.includes("mip") ||
    type.includes("6moy") ||
    type.includes("coy")
  ) {
    if (sportLower === "nfl" || sportLower === "football")
      date = new Date(currentYear, 1, 1);
    else if (sportLower === "nba" || sportLower === "basketball")
      date = new Date(currentYear, 4, 15);
    else if (sportLower === "mlb" || sportLower === "baseball")
      date = new Date(currentYear, 10, 15);
    else if (sportLower === "nhl" || sportLower === "hockey")
      date = new Date(currentYear, 5, 1);
    else date = new Date(currentYear, 5, 1);
  }
  // MLB specific awards
  else if (
    type.includes("cy young") ||
    type.includes("hr leader") ||
    type.includes("batting")
  ) {
    date = new Date(currentYear, 10, 15); // November 15
  }
  // Playoffs
  else if (type.includes("playoff")) {
    if (sportLower === "nfl" || sportLower === "football")
      date = new Date(currentYear, 0, 15);
    else if (sportLower === "nba" || sportLower === "basketball")
      date = new Date(currentYear, 3, 14);
    else if (sportLower === "mlb" || sportLower === "baseball")
      date = new Date(currentYear, 9, 1);
    else if (sportLower === "nhl" || sportLower === "hockey")
      date = new Date(currentYear, 3, 15);
  }
  // Division/Conference winners
  else if (type.includes("division") || type.includes("conference")) {
    if (sportLower === "nfl" || sportLower === "football")
      date = new Date(currentYear, 0, 12);
    else if (sportLower === "nba" || sportLower === "basketball")
      date = new Date(currentYear, 3, 14);
    else if (sportLower === "mlb" || sportLower === "baseball")
      date = new Date(currentYear, 9, 1);
    else if (sportLower === "nhl" || sportLower === "hockey")
      date = new Date(currentYear, 3, 14);
  }
  // Tournament winner (tennis, golf)
  else if (type.includes("tournament winner")) {
    // Can't estimate without knowing the specific tournament
    date = null;
  }
  // Generic outright/championship for unknown sports
  else if (type.includes("outright") || type.includes("championship")) {
    // Default to mid-year for unknown sports
    date = new Date(currentYear, 5, 30);
  }

  // If estimated date is already past, bump to next year
  if (date && date < now) {
    date.setFullYear(date.getFullYear() + 1);
  }

  return date;
}

/**
 * Calculate days until target date.
 */
function calculateDaysUntil(targetDate: Date | null): number | null {
  if (!targetDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntil <= 0) return null;
  return daysUntil;
}

/**
 * Calculate weighted average odds.
 */
function calculateWeightedAverageOdds(bets: Bet[]): number {
  const totalStake = bets.reduce((sum, bet) => sum + bet.stake, 0);
  if (totalStake === 0) return 0;

  const weightedSum = bets.reduce((sum, bet) => {
    const odds = bet.odds || 0;
    return sum + odds * bet.stake;
  }, 0);

  return Math.round(weightedSum / totalStake);
}

/**
 * Convert American odds to decimal multiplier.
 */
function americanToDecimal(odds: number): number {
  if (odds > 0) return 1 + odds / 100;
  if (odds < 0) return 1 + 100 / Math.abs(odds);
  return 1;
}

/**
 * Calculate potential payout for a bet.
 * For pending bets, calculate from odds and stake.
 * For settled bets, use actual payout.
 */
function calculatePotentialPayout(bet: Bet): number {
  // If bet has actual payout, use it
  if (bet.payout > 0) return bet.payout;

  // For pending bets, calculate from odds and stake
  if (bet.result === "pending" && bet.odds) {
    return bet.stake * americanToDecimal(bet.odds);
  }

  return 0;
}

/**
 * Format American odds for display.
 */
function formatOdds(odds: number): string {
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

/**
 * Format date for display.
 */
function formatDate(date: Date | null): string {
  if (!date) return "TBD";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format currency.
 */
function formatCurrency(amount: number): string {
  if (amount < 0) return `-$${Math.abs(amount).toFixed(2)}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Get position status from bets.
 */
function getPositionStatus(bets: Bet[]): "pending" | "won" | "lost" | "mixed" {
  const hasWin = bets.some((b) => b.result === "win");
  const hasLoss = bets.some((b) => b.result === "loss");
  const hasPending = bets.some((b) => b.result === "pending");

  if (hasPending && !hasWin && !hasLoss) return "pending";
  if (hasWin && !hasLoss && !hasPending) return "won";
  if (hasLoss && !hasWin && !hasPending) return "lost";
  return "mixed";
}

// ============================================================================
// Position Card Component
// ============================================================================

interface PositionCardProps {
  position: FuturesPosition;
  onHedge: (position: FuturesPosition) => void;
}

const PositionCard: React.FC<PositionCardProps> = ({ position, onHedge }) => {
  const [expanded, setExpanded] = useState(false);

  const breakdown: PositionBreakdown[] = position.bets.map((bet) => {
    const potentialPayout = calculatePotentialPayout(bet);
    return {
      id: bet.id,
      date: new Date(bet.placedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "2-digit",
      }),
      odds: bet.odds || 0,
      stake: bet.stake,
      potentialPayout,
      profit: potentialPayout - bet.stake,
      result: bet.result,
    };
  });

  const statusColors = {
    pending:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    won: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    lost: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    mixed: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
              {expanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>
            <div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                {position.entity}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {position.futuresType}
                </span>
                <span className="text-neutral-300 dark:text-neutral-600">
                  •
                </span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  {position.sport}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Badge */}
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[position.status]}`}
            >
              {position.status.charAt(0).toUpperCase() +
                position.status.slice(1)}
            </span>

            {/* Quick Stats */}
            <div className="text-right hidden md:block">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {position.bets.length} bet
                {position.bets.length !== 1 ? "s" : ""}
              </p>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {formatCurrency(position.totalStake)} exposure
              </p>
            </div>

            {/* Potential Payout */}
            <div className="text-right">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Potential
              </p>
              <p className="text-lg font-bold text-accent-500">
                {formatCurrency(position.totalPotentialPayout)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          {/* Position Analytics */}
          <div className="p-4 bg-neutral-50 dark:bg-neutral-800/30">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                  Total Exposure
                </p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">
                  {formatCurrency(position.totalStake)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                  Avg. Odds
                </p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">
                  {formatOdds(position.averageOdds)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                  Avg. Stake
                </p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">
                  {formatCurrency(position.averageStake)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                  Max Profit
                </p>
                <p className="text-xl font-bold text-accent-500 mt-1">
                  {formatCurrency(position.maxProfit)}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                  Resolution
                </p>
                <p className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mt-1">
                  {formatDate(position.resolutionDate)}
                </p>
                {position.daysUntil !== null && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {position.daysUntil} days
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Individual Bets Table */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Individual Bets
              </h4>
              {position.status === "pending" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHedge(position);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors flex items-center gap-1.5"
                >
                  <Scale className="w-4 h-4" />
                  Hedge Calculator
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Odds</th>
                    <th className="px-3 py-2 text-right">Stake</th>
                    <th className="px-3 py-2 text-right">Potential</th>
                    <th className="px-3 py-2 text-right">Profit</th>
                    <th className="px-3 py-2 text-center">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {breakdown.map((bet) => (
                    <tr
                      key={bet.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                        {bet.date}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-neutral-900 dark:text-white">
                        {formatOdds(bet.odds)}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-700 dark:text-neutral-300">
                        {formatCurrency(bet.stake)}
                      </td>
                      <td className="px-3 py-2 text-right text-neutral-700 dark:text-neutral-300">
                        {formatCurrency(bet.potentialPayout)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-medium ${
                          bet.profit >= 0 ? "text-accent-500" : "text-red-500"
                        }`}
                      >
                        {bet.profit >= 0 ? "+" : ""}
                        {formatCurrency(bet.profit)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            bet.result === "win"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : bet.result === "loss"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                : bet.result === "push"
                                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          }`}
                        >
                          {bet.result.charAt(0).toUpperCase() +
                            bet.result.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

type ViewMode = "positions" | "timeline" | "history";
type SortBy = "exposure" | "potential" | "odds" | "resolution";

// LocalStorage key for custom resolution dates
const CUSTOM_DATES_KEY = "bettracker_futures_resolution_dates";

const FuturesView: React.FC = () => {
  const { bets } = useBets();
  const [viewMode, setViewMode] = useState<ViewMode>("positions");
  const [sortBy, setSortBy] = useState<SortBy>("exposure");
  const [showHedgeCalc, setShowHedgeCalc] = useState(false);
  const [hedgePosition, setHedgePosition] = useState<FuturesPosition | null>(
    null,
  );
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Custom resolution dates stored by position key
  const [customResolutionDates, setCustomResolutionDates] = useState<
    Record<string, string>
  >(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_DATES_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Save custom dates to localStorage when they change
  const updateCustomDate = (positionKey: string, dateStr: string) => {
    const updated = { ...customResolutionDates };
    if (dateStr) {
      updated[positionKey] = dateStr;
    } else {
      delete updated[positionKey];
    }
    setCustomResolutionDates(updated);
    try {
      localStorage.setItem(CUSTOM_DATES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore localStorage errors
    }
  };

  // Process futures data
  const futuresData = useMemo(() => {
    // Filter futures bets
    const futuresBets = bets.filter((bet) => bet.marketCategory === "Futures");

    if (futuresBets.length === 0) return null;

    // Separate pending and settled
    const pendingBets = futuresBets.filter((b) => b.result === "pending");
    const settledBets = futuresBets.filter((b) => b.result !== "pending");

    // Group bets into positions
    const positionMap = new Map<string, Bet[]>();

    for (const bet of futuresBets) {
      const entity = bet.name || extractEntityFromDescription(bet.description);
      const futuresType = extractFuturesType(bet);
      const key = `${entity}__${futuresType}__${bet.sport || "Unknown"}`;

      if (!positionMap.has(key)) {
        positionMap.set(key, []);
      }
      positionMap.get(key)!.push(bet);
    }

    // Build position objects
    const positions: FuturesPosition[] = Array.from(positionMap.entries()).map(
      ([key, positionBets]) => {
        const [entity, futuresType, sport] = key.split("__");
        const totalStake = positionBets.reduce((sum, b) => sum + b.stake, 0);
        const totalPotentialPayout = positionBets.reduce(
          (sum, b) => sum + calculatePotentialPayout(b),
          0,
        );

        // Use custom date if set, otherwise estimate
        const customDateStr = customResolutionDates[key];
        const resolutionDate = customDateStr
          ? new Date(customDateStr)
          : estimateResolutionDate(futuresType, sport);

        return {
          key,
          entity,
          futuresType,
          sport,
          bets: positionBets.sort(
            (a, b) =>
              new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime(),
          ),
          totalStake,
          totalPotentialPayout,
          averageOdds: calculateWeightedAverageOdds(positionBets),
          averageStake: totalStake / positionBets.length,
          maxProfit: totalPotentialPayout - totalStake,
          resolutionDate,
          daysUntil: calculateDaysUntil(resolutionDate),
          status: getPositionStatus(positionBets),
        };
      },
    );

    // Calculate totals for pending positions only
    const pendingPositions = positions.filter((p) => p.status === "pending");
    const totalExposure = pendingPositions.reduce(
      (sum, p) => sum + p.totalStake,
      0,
    );
    const totalPotentialPayout = pendingPositions.reduce(
      (sum, p) => sum + p.totalPotentialPayout,
      0,
    );
    const totalMaxProfit = totalPotentialPayout - totalExposure;

    // Get unique sports and types for filters
    const sports = [...new Set(positions.map((p) => p.sport))].sort();
    const types = [...new Set(positions.map((p) => p.futuresType))].sort();

    // Calculate settled stats
    const settledWins = settledBets.filter((b) => b.result === "win");
    const settledLosses = settledBets.filter((b) => b.result === "loss");
    const settledNet = settledBets.reduce((sum, b) => {
      if (b.result === "win") return sum + (b.payout - b.stake);
      if (b.result === "loss") return sum - b.stake;
      return sum;
    }, 0);

    return {
      positions,
      pendingPositions,
      settledPositions: positions.filter((p) => p.status !== "pending"),
      totalExposure,
      totalPotentialPayout,
      totalMaxProfit,
      openCount: pendingPositions.length,
      positionCount: positions.length,
      betCount: futuresBets.length,
      pendingBetCount: pendingBets.length,
      settledBetCount: settledBets.length,
      settledStats: {
        wins: settledWins.length,
        losses: settledLosses.length,
        net: settledNet,
        wagered: settledBets.reduce((sum, b) => sum + b.stake, 0),
      },
      sports,
      types,
    };
  }, [bets, customResolutionDates]);

  // Filter and sort positions
  const displayPositions = useMemo(() => {
    if (!futuresData) return [];

    let positions =
      viewMode === "history"
        ? futuresData.settledPositions
        : futuresData.pendingPositions;

    // Apply filters
    if (sportFilter !== "all") {
      positions = positions.filter((p) => p.sport === sportFilter);
    }
    if (typeFilter !== "all") {
      positions = positions.filter((p) => p.futuresType === typeFilter);
    }

    // Sort
    return [...positions].sort((a, b) => {
      switch (sortBy) {
        case "exposure":
          return b.totalStake - a.totalStake;
        case "potential":
          return b.totalPotentialPayout - a.totalPotentialPayout;
        case "odds":
          return b.averageOdds - a.averageOdds;
        case "resolution":
          if (a.daysUntil === null && b.daysUntil === null) return 0;
          if (a.daysUntil === null) return 1;
          if (b.daysUntil === null) return -1;
          return a.daysUntil - b.daysUntil;
        default:
          return 0;
      }
    });
  }, [futuresData, viewMode, sortBy, sportFilter, typeFilter]);

  const handleHedge = (position: FuturesPosition) => {
    setHedgePosition(position);
    setShowHedgeCalc(true);
  };

  const hasActiveFilters = sportFilter !== "all" || typeFilter !== "all";
  const activeFilterMessage = hasActiveFilters
    ? `Filtering by${sportFilter !== "all" ? ` sport: ${sportFilter}` : ""}${sportFilter !== "all" && typeFilter !== "all" ? "," : ""}${typeFilter !== "all" ? ` type: ${typeFilter}` : ""}. Try adjusting your filters.`
    : "";

  // Empty state
  if (!futuresData) {
    return (
      <div className="p-8">
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-8 text-center">
          <Clock className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600 mb-4" />
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
            No Futures Bets Found
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400">
            Import futures bets to start tracking your positions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-8 h-8 text-primary-500" />
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Futures Management
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Track and manage your futures positions like holdings
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("positions")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              viewMode === "positions"
                ? "bg-primary-600 text-white"
                : "text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
          >
            Positions
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              viewMode === "timeline"
                ? "bg-primary-600 text-white"
                : "text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              viewMode === "history"
                ? "bg-primary-600 text-white"
                : "text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Open Positions
          </p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
            {futuresData.openCount}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {futuresData.pendingBetCount} bets
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Total Exposure
          </p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
            {formatCurrency(futuresData.totalExposure)}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            at risk
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Potential Payout
          </p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
            {formatCurrency(futuresData.totalPotentialPayout)}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            if all hit
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Max Profit
          </p>
          <p className="text-2xl font-bold text-accent-500 mt-1">
            {formatCurrency(futuresData.totalMaxProfit)}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            potential gain
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Settled Futures
          </p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
            {futuresData.settledStats.wins}W - {futuresData.settledStats.losses}
            L
          </p>
          <p
            className={`text-xs mt-1 ${futuresData.settledStats.net >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {futuresData.settledStats.net >= 0 ? "+" : ""}
            {formatCurrency(futuresData.settledStats.net)} net
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-4">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
            Total Bets
          </p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
            {futuresData.betCount}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {futuresData.positionCount} unique positions
          </p>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-neutral-900 rounded-lg shadow-md p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Sport:
          </label>
          <select
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
          >
            <option value="all">All Sports</option>
            {futuresData.sports.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Type:
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
          >
            <option value="all">All Types</option>
            {futuresData.types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Sort by:
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
          >
            <option value="exposure">Exposure (High to Low)</option>
            <option value="potential">Potential (High to Low)</option>
            <option value="odds">Odds (Best to Worst)</option>
            <option value="resolution">Resolution (Soonest)</option>
          </select>
        </div>
      </div>

      {/* Positions / Timeline View */}
      {viewMode === "timeline" ? (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Resolution Timeline
            </h2>
            <InfoTooltip
              text="Set or edit resolution dates for your futures positions. Click the date to modify."
              position="right"
            />
          </div>

          <div className="space-y-4">
            {displayPositions.map((position) => {
              const hasCustomDate =
                customResolutionDates[position.key] !== undefined;
              return (
                <div
                  key={position.key}
                  className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-neutral-900 dark:text-white">
                      {position.entity}
                    </p>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {position.futuresType} • {position.sport}
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                        Resolution{" "}
                        {hasCustomDate && (
                          <span className="text-primary-500">(custom)</span>
                        )}
                      </p>
                      <input
                        type="date"
                        value={
                          position.resolutionDate
                            ? position.resolutionDate
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                        onChange={(e) =>
                          updateCustomDate(position.key, e.target.value)
                        }
                        className="px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white cursor-pointer hover:border-primary-500 transition-colors"
                      />
                      {position.daysUntil !== null && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          {position.daysUntil} days
                        </p>
                      )}
                      {hasCustomDate && (
                        <button
                          onClick={() => updateCustomDate(position.key, "")}
                          className="text-xs text-neutral-400 hover:text-red-500 mt-1"
                        >
                          Reset to estimate
                        </button>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                        Exposure → Potential
                      </p>
                      <p className="font-medium text-neutral-700 dark:text-neutral-300">
                        {formatCurrency(position.totalStake)} →{" "}
                        {formatCurrency(position.totalPotentialPayout)}
                      </p>
                      <p className="text-xs text-accent-500 font-medium">
                        +{formatCurrency(position.maxProfit)}
                      </p>
                    </div>

                    <button
                      onClick={() => handleHedge(position)}
                      className="px-3 py-1.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                    >
                      🔄 Hedge
                    </button>
                  </div>
                </div>
              );
            })}

            {displayPositions.length === 0 && (
              <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                <p>No positions match your filters.</p>
                {hasActiveFilters && (
                  <p className="text-xs mt-2">{activeFilterMessage}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {displayPositions.map((position) => (
            <PositionCard
              key={position.key}
              position={position}
              onHedge={handleHedge}
            />
          ))}

          {displayPositions.length === 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-8 text-center">
              <p className="text-neutral-500 dark:text-neutral-400">
                {viewMode === "history"
                  ? "No settled futures match your filters."
                  : "No pending positions match your filters."}
              </p>
              {hasActiveFilters && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                  {activeFilterMessage}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Multi-Outcome Hedge Calculator Modal */}
      {showHedgeCalc && hedgePosition && (
        <MultiHedgeCalculator
          position={hedgePosition}
          onClose={() => {
            setShowHedgeCalc(false);
            setHedgePosition(null);
          }}
        />
      )}
    </div>
  );
};

export default FuturesView;
