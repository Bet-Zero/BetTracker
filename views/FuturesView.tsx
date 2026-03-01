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
import { VALID_FUTURES_TYPES } from "../services/marketClassification.config";
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  ChevronDown,
  ChevronRight,
  BarChart2,
  Scale,
  Search,
  X,
  Layers,
  Trophy,
} from "../components/icons";
import { InfoTooltip } from "../components/debug/InfoTooltip";
import MultiHedgeCalculator from "../components/MultiHedgeCalculator";
import { StatCard } from "../components/StatCard";

// ============================================================================
// Sport Color Mapping
// ============================================================================

const SPORT_COLORS: Record<
  string,
  { border: string; bg: string; text: string; pill: string; pillActive: string; dot: string }
> = {
  NBA: {
    border: "border-l-orange-500",
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    pill: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    pillActive: "bg-orange-500 text-white",
    dot: "bg-orange-500",
  },
  NFL: {
    border: "border-l-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    pill: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    pillActive: "bg-blue-500 text-white",
    dot: "bg-blue-500",
  },
  MLB: {
    border: "border-l-red-500",
    bg: "bg-red-500/10",
    text: "text-red-500",
    pill: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    pillActive: "bg-red-500 text-white",
    dot: "bg-red-500",
  },
  NHL: {
    border: "border-l-cyan-500",
    bg: "bg-cyan-500/10",
    text: "text-cyan-500",
    pill: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400",
    pillActive: "bg-cyan-500 text-white",
    dot: "bg-cyan-500",
  },
  NCAAB: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    pill: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    pillActive: "bg-amber-500 text-white",
    dot: "bg-amber-500",
  },
  NCAAF: {
    border: "border-l-amber-600",
    bg: "bg-amber-600/10",
    text: "text-amber-600",
    pill: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    pillActive: "bg-amber-600 text-white",
    dot: "bg-amber-600",
  },
  Soccer: {
    border: "border-l-green-500",
    bg: "bg-green-500/10",
    text: "text-green-500",
    pill: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    pillActive: "bg-green-500 text-white",
    dot: "bg-green-500",
  },
  UFC: {
    border: "border-l-rose-500",
    bg: "bg-rose-500/10",
    text: "text-rose-500",
    pill: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
    pillActive: "bg-rose-500 text-white",
    dot: "bg-rose-500",
  },
};

const DEFAULT_SPORT_COLOR = {
  border: "border-l-purple-500",
  bg: "bg-purple-500/10",
  text: "text-purple-500",
  pill: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  pillActive: "bg-purple-500 text-white",
  dot: "bg-purple-500",
};

function getSportColor(sport: string) {
  return SPORT_COLORS[sport] || DEFAULT_SPORT_COLOR;
}

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

  // Fallback: return 'Other' for unrecognized futures types
  // This prevents random bet descriptions from appearing as type options
  return "Other";
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

  const sportColor = getSportColor(position.sport);

  return (
    <div className={`bg-white dark:bg-neutral-900 rounded-lg shadow-md overflow-hidden border-l-4 ${sportColor.border} transition-shadow hover:shadow-lg`}>
      {/* Card Header */}
      <div
        className="p-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {/* Expand toggle */}
          <button className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex-shrink-0">
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>

          {/* Entity name + metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white truncate">
                {position.entity}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusColors[position.status]}`}>
                {position.status.charAt(0).toUpperCase() + position.status.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium ${sportColor.text}`}>
                {position.sport}
              </span>
              <span className="text-neutral-300 dark:text-neutral-600">&middot;</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {position.futuresType}
              </span>
              <span className="text-neutral-300 dark:text-neutral-600">&middot;</span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {position.bets.length} bet{position.bets.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Inline metrics */}
          <div className="hidden md:flex items-center gap-6 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">Exposure</p>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                {formatCurrency(position.totalStake)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">Avg Odds</p>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                {formatOdds(position.averageOdds)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">Potential</p>
              <p className="text-sm font-bold text-accent-500">
                {formatCurrency(position.totalPotentialPayout)}
              </p>
            </div>
            {position.daysUntil !== null && (
              <div className="text-right">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">Resolves</p>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  {position.daysUntil}d
                </p>
              </div>
            )}
          </div>

          {/* Hedge button - visible in header for pending positions */}
          {position.status === "pending" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHedge(position);
              }}
              className="flex-shrink-0 p-2 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              title="Open Hedge Calculator"
            >
              <Scale className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-800">
          {/* Position Analytics */}
          <div className="p-4 bg-neutral-50/50 dark:bg-neutral-800/20">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Total Exposure", value: formatCurrency(position.totalStake), color: "" },
                { label: "Avg. Odds", value: formatOdds(position.averageOdds), color: "" },
                { label: "Avg. Stake", value: formatCurrency(position.averageStake), color: "" },
                { label: "Max Profit", value: formatCurrency(position.maxProfit), color: "text-accent-500" },
                { label: "Resolution", value: formatDate(position.resolutionDate), color: "text-amber-600 dark:text-amber-400", sub: position.daysUntil !== null ? `${position.daysUntil} days` : undefined },
              ].map((stat) => (
                <div key={stat.label} className="bg-white dark:bg-neutral-900 rounded-md p-3 border border-neutral-200/60 dark:border-neutral-700/40">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                    {stat.label}
                  </p>
                  <p className={`text-lg font-bold mt-1 ${stat.color || "text-neutral-900 dark:text-white"}`}>
                    {stat.value}
                  </p>
                  {stat.sub && <p className="text-xs text-amber-600 dark:text-amber-400">{stat.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Individual Bets Table */}
          <div className="p-4">
            <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
              Individual Bets
            </h4>
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-800">
                    <th className="px-3 py-2.5 text-left text-xs text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Date</th>
                    <th className="px-3 py-2.5 text-right text-xs text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Odds</th>
                    <th className="px-3 py-2.5 text-right text-xs text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Stake</th>
                    <th className="px-3 py-2.5 text-right text-xs text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Potential</th>
                    <th className="px-3 py-2.5 text-right text-xs text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Profit</th>
                    <th className="px-3 py-2.5 text-center text-xs text-neutral-500 dark:text-neutral-400 uppercase font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((bet, index) => (
                    <tr
                      key={bet.id}
                      className={`hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors ${
                        index % 2 === 0
                          ? "bg-white dark:bg-neutral-900"
                          : "bg-neutral-50 dark:bg-neutral-900/50"
                      }`}
                    >
                      <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">{bet.date}</td>
                      <td className="px-3 py-2 text-right font-medium text-neutral-900 dark:text-white">{formatOdds(bet.odds)}</td>
                      <td className="px-3 py-2 text-right text-neutral-700 dark:text-neutral-300">{formatCurrency(bet.stake)}</td>
                      <td className="px-3 py-2 text-right text-neutral-700 dark:text-neutral-300">{formatCurrency(bet.potentialPayout)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${bet.profit >= 0 ? "text-accent-500" : "text-red-500"}`}>
                        {bet.profit >= 0 ? "+" : ""}{formatCurrency(bet.profit)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          bet.result === "win"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                            : bet.result === "loss"
                              ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                              : bet.result === "push"
                                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        }`}>
                          {bet.result.charAt(0).toUpperCase() + bet.result.slice(1)}
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
  const [searchQuery, setSearchQuery] = useState("");
  const [groupBySport, setGroupBySport] = useState(false);

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
    // Only include types that are in the valid futures types list
    const sports = [...new Set(positions.map((p) => p.sport))].sort();
    const validTypesSet = new Set<string>(VALID_FUTURES_TYPES);
    const types = [...new Set(positions.map((p) => p.futuresType))]
      .filter((t) => validTypesSet.has(t))
      .sort();

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
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      positions = positions.filter(
        (p) =>
          p.entity.toLowerCase().includes(query) ||
          p.futuresType.toLowerCase().includes(query) ||
          p.sport.toLowerCase().includes(query),
      );
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
  }, [futuresData, viewMode, sortBy, sportFilter, typeFilter, searchQuery]);

  const handleHedge = (position: FuturesPosition) => {
    setHedgePosition(position);
    setShowHedgeCalc(true);
  };

  const hasActiveFilters = sportFilter !== "all" || typeFilter !== "all" || searchQuery.trim() !== "";
  const activeFilterCount = (sportFilter !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  // Empty state
  if (!futuresData) {
    return (
      <div className="min-h-full bg-neutral-100 dark:bg-neutral-950 p-6 lg:p-8">
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-12 text-center max-w-md mx-auto mt-12">
          <div className="p-4 bg-primary-100 dark:bg-primary-900/50 rounded-full inline-block mb-4">
            <Clock className="w-12 h-12 text-primary-500" />
          </div>
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
    <div className="min-h-full bg-neutral-100 dark:bg-neutral-950 p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <TrendingUp className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
                Futures Management
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {futuresData.openCount} open position{futuresData.openCount !== 1 ? "s" : ""} &middot; {formatCurrency(futuresData.totalExposure)} exposure
              </p>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
            {(["positions", "timeline", "history"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors ${
                  viewMode === mode
                    ? "bg-primary-600 text-white shadow-sm"
                    : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Open Positions"
          value={futuresData.openCount.toString()}
          icon={<Layers className="w-5 h-5" />}
          subtitle={`${futuresData.pendingBetCount} bets`}
        />
        <StatCard
          title="Total Exposure"
          value={formatCurrency(futuresData.totalExposure)}
          icon={<TrendingDown className="w-5 h-5" />}
          subtitle="at risk"
        />
        <StatCard
          title="Potential Payout"
          value={formatCurrency(futuresData.totalPotentialPayout)}
          icon={<TrendingUp className="w-5 h-5" />}
          subtitle="if all hit"
        />
        <StatCard
          title="Max Profit"
          value={formatCurrency(futuresData.totalMaxProfit)}
          icon={<Trophy className="w-5 h-5" />}
          subtitle="potential gain"
          valueClassName="text-accent-500"
        />
        <StatCard
          title="Settled Futures"
          value={`${futuresData.settledStats.wins}W - ${futuresData.settledStats.losses}L`}
          icon={<BarChart2 className="w-5 h-5" />}
          subtitle={`${futuresData.settledStats.net >= 0 ? "+" : ""}${formatCurrency(futuresData.settledStats.net)} net`}
          subtitleClassName={futuresData.settledStats.net >= 0 ? "text-accent-500" : "text-danger-500"}
        />
        <StatCard
          title="Total Bets"
          value={futuresData.betCount.toString()}
          icon={<BarChart2 className="w-5 h-5" />}
          subtitle={`${futuresData.positionCount} positions`}
        />
      </div>

      {/* Filter & Organization Bar */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-4 space-y-3">
        {/* Top row: Search + Sort + Group toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search positions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-primary-500 text-neutral-900 dark:text-white placeholder-neutral-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="hidden sm:block w-px h-6 bg-neutral-200 dark:bg-neutral-700" />

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded p-1 py-0.5 text-xs focus:ring-1 focus:ring-primary-500 text-neutral-900 dark:text-white"
            >
              <option value="exposure">Exposure</option>
              <option value="potential">Potential</option>
              <option value="odds">Odds</option>
              <option value="resolution">Resolution</option>
            </select>
          </div>

          <div className="hidden sm:block w-px h-6 bg-neutral-200 dark:bg-neutral-700" />

          {/* Group by sport toggle */}
          <button
            onClick={() => setGroupBySport(!groupBySport)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              groupBySport
                ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Group
          </button>

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSportFilter("all");
                setTypeFilter("all");
                setSearchQuery("");
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              <X className="w-3 h-3" />
              Clear ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Bottom row: Sport pills + Type pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mr-0.5">Sport:</span>
          <button
            onClick={() => setSportFilter("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              sportFilter === "all"
                ? "bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
          >
            All
          </button>
          {futuresData.sports.map((sport) => {
            const colors = getSportColor(sport);
            return (
              <button
                key={sport}
                onClick={() => setSportFilter(sportFilter === sport ? "all" : sport)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  sportFilter === sport ? colors.pillActive : colors.pill
                }`}
              >
                {sport}
              </button>
            );
          })}

          <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-700 mx-1" />

          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mr-0.5">Type:</span>
          <button
            onClick={() => setTypeFilter("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              typeFilter === "all"
                ? "bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
            }`}
          >
            All
          </button>
          {futuresData.types.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? "all" : type)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                typeFilter === type
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              {type}
            </button>
          ))}
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

          {/* Timeline with vertical line */}
          <div className="relative">
            {displayPositions.length > 0 && (
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-200 dark:bg-neutral-700" />
            )}

            <div className="space-y-1">
              {displayPositions.map((position) => {
                const hasCustomDate = customResolutionDates[position.key] !== undefined;
                const tlSportColor = getSportColor(position.sport);
                return (
                  <div key={position.key} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className={`absolute left-2.5 top-5 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900 ${tlSportColor.dot} z-10`} />

                    {/* Timeline card */}
                    <div className={`p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border-l-2 ${tlSportColor.border.replace("border-l-", "border-l-")} hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors`}>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex-1 min-w-[150px]">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-neutral-900 dark:text-white">
                              {position.entity}
                            </p>
                            <span className={`text-xs font-medium ${tlSportColor.text}`}>
                              {position.sport}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">
                            {position.futuresType}
                          </p>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase mb-1">
                              Resolution{" "}
                              {hasCustomDate && <span className="text-primary-500">(custom)</span>}
                            </p>
                            <input
                              type="date"
                              value={position.resolutionDate ? position.resolutionDate.toISOString().split("T")[0] : ""}
                              onChange={(e) => updateCustomDate(position.key, e.target.value)}
                              className="px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white cursor-pointer hover:border-primary-500 transition-colors"
                            />
                            {position.daysUntil !== null && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                                {position.daysUntil} days
                              </p>
                            )}
                            {hasCustomDate && (
                              <button
                                onClick={() => updateCustomDate(position.key, "")}
                                className="text-xs text-neutral-400 hover:text-red-500 mt-1"
                              >
                                Reset
                              </button>
                            )}
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                              Exposure
                            </p>
                            <p className="font-medium text-neutral-700 dark:text-neutral-300">
                              {formatCurrency(position.totalStake)}
                            </p>
                            <p className="text-xs text-accent-500 font-medium">
                              +{formatCurrency(position.maxProfit)} max
                            </p>
                          </div>

                          <button
                            onClick={() => handleHedge(position)}
                            className="p-2 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                            title="Hedge Calculator"
                          >
                            <Scale className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {displayPositions.length === 0 && (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              <p>No positions match your filters.</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Position cards with optional sport grouping */}
          {groupBySport && displayPositions.length > 0 ? (
            <div className="space-y-6">
              {(Object.entries(
                displayPositions.reduce<Record<string, FuturesPosition[]>>((groups, pos) => {
                  const sport = pos.sport;
                  if (!groups[sport]) groups[sport] = [];
                  groups[sport].push(pos);
                  return groups;
                }, {}),
              ) as [string, FuturesPosition[]][])
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([sport, positions]) => {
                  const groupColor = getSportColor(sport);
                  return (
                    <div key={sport}>
                      {/* Sport section header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-1 h-6 rounded-full ${groupColor.dot}`} />
                        <h2 className={`text-sm font-bold uppercase tracking-wider ${groupColor.text}`}>
                          {sport}
                        </h2>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          {positions.length} position{positions.length !== 1 ? "s" : ""}
                        </span>
                        <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
                      </div>
                      {/* Cards for this sport */}
                      <div className="space-y-3 ml-4">
                        {positions.map((position) => (
                          <PositionCard key={position.key} position={position} onHedge={handleHedge} />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="space-y-3">
              {displayPositions.map((position) => (
                <PositionCard key={position.key} position={position} onHedge={handleHedge} />
              ))}
            </div>
          )}

          {displayPositions.length === 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-md p-8 text-center">
              <p className="text-neutral-500 dark:text-neutral-400">
                {viewMode === "history"
                  ? "No settled futures match your filters."
                  : "No pending positions match your filters."}
              </p>
              {hasActiveFilters && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">
                  Try adjusting your filters or search.
                </p>
              )}
            </div>
          )}
        </>
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
