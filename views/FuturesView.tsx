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

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useBets } from "../hooks/useBets";
import { Bet } from "../types";
import { VALID_FUTURES_TYPES } from "../services/marketClassification.config";
import {
  TrendingUp,
  Clock,
  Calendar,
  ChevronDown,
  ChevronRight,
  Scale,
  Search,
  X,
  Layers,
  Trophy,
} from "../components/icons";
import MultiHedgeCalculator from "../components/MultiHedgeCalculator";

// ============================================================================
// Sport Color Mapping
// ============================================================================

const SPORT_COLORS: Record<
  string,
  {
    border: string;
    bg: string;
    text: string;
    pill: string;
    pillActive: string;
    dot: string;
    gradient: string;
  }
> = {
  NBA: {
    border: "border-l-orange-500",
    bg: "bg-orange-500/10",
    text: "text-orange-500",
    pill: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    pillActive: "bg-orange-500 text-white",
    dot: "bg-orange-500",
    gradient: "from-orange-500/15",
  },
  NFL: {
    border: "border-l-blue-500",
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    pill: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    pillActive: "bg-blue-500 text-white",
    dot: "bg-blue-500",
    gradient: "from-blue-500/15",
  },
  MLB: {
    border: "border-l-red-500",
    bg: "bg-red-500/10",
    text: "text-red-500",
    pill: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    pillActive: "bg-red-500 text-white",
    dot: "bg-red-500",
    gradient: "from-red-500/15",
  },
  NHL: {
    border: "border-l-cyan-500",
    bg: "bg-cyan-500/10",
    text: "text-cyan-500",
    pill: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400",
    pillActive: "bg-cyan-500 text-white",
    dot: "bg-cyan-500",
    gradient: "from-cyan-500/15",
  },
  NCAAB: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    pill: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    pillActive: "bg-amber-500 text-white",
    dot: "bg-amber-500",
    gradient: "from-amber-500/15",
  },
  NCAAF: {
    border: "border-l-amber-600",
    bg: "bg-amber-600/10",
    text: "text-amber-600",
    pill: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    pillActive: "bg-amber-600 text-white",
    dot: "bg-amber-600",
    gradient: "from-amber-600/15",
  },
  Soccer: {
    border: "border-l-green-500",
    bg: "bg-green-500/10",
    text: "text-green-500",
    pill: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    pillActive: "bg-green-500 text-white",
    dot: "bg-green-500",
    gradient: "from-green-500/15",
  },
  UFC: {
    border: "border-l-rose-500",
    bg: "bg-rose-500/10",
    text: "text-rose-500",
    pill: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
    pillActive: "bg-rose-500 text-white",
    dot: "bg-rose-500",
    gradient: "from-rose-500/15",
  },
};

const DEFAULT_SPORT_COLOR = {
  border: "border-l-purple-500",
  bg: "bg-purple-500/10",
  text: "text-purple-500",
  pill: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  pillActive: "bg-purple-500 text-white",
  dot: "bg-purple-500",
  gradient: "from-purple-500/15",
};

function getSportColor(sport: string) {
  return SPORT_COLORS[sport] || DEFAULT_SPORT_COLOR;
}

// ============================================================================
// Types
// ============================================================================

export interface FuturesPosition {
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

export interface MarketGroup {
  /** Unique key: `${futuresType}__${sport}` */
  key: string;
  /** Award or market name (e.g. "NBA MVP", "NBA Championship") */
  futuresType: string;
  /** Sport */
  sport: string;
  /** All entity-level positions within this market, sorted by payout desc */
  positions: FuturesPosition[];
  /** Sum of stakes across all picks in this market */
  totalStake: number;
  /**
   * Best-case payout: the max single-position payout.
   * Since outcomes are mutually exclusive, only one pick can win.
   */
  bestCasePayout: number;
  /** bestCasePayout - totalStake */
  bestCaseProfit: number;
  /** If none of your picks win: -totalStake */
  worstCaseNet: number;
  /** Resolution date (taken from first non-null position date) */
  resolutionDate: Date | null;
  /** Days until resolution */
  daysUntil: number | null;
  /** Aggregate status across all positions in the market */
  status: "pending" | "won" | "lost" | "mixed";
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
    if (market.includes("mvp")) return "MVP";
    if (market.includes("dpoy") || market.includes("defensive player"))
      return "DPOY";
    if (
      market.includes("roy") ||
      market.includes("rookie of the year") ||
      market.includes("rookie")
    )
      return "ROY";
    if (market.includes("6moy") || market.includes("sixth man")) return "6MOY";
    if (market.includes("mip") || market.includes("most improved"))
      return "MIP";
    if (market.includes("coy") || market.includes("coach of the year"))
      return "COY";
    if (market.includes("cy young")) return "Cy Young";
    if (market.includes("win total")) return "Win Total";
    if (market.includes("outright") || market.includes("winner"))
      return "Outright Winner";
    if (market.includes("championship") || market.includes("finals"))
      return getChampionshipName(sport);
    if (market.includes("division")) return "Division Winner";
    if (market.includes("conference")) return "Conference Winner";
    if (market.includes("playoff") && market.includes("miss"))
      return "Miss Playoffs";
    if (market.includes("playoff")) return "Make Playoffs";
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
  const opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  if (amount < 0) return `-$${Math.abs(amount).toLocaleString("en-US", opts)}`;
  return `$${amount.toLocaleString("en-US", opts)}`;
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
// Position Card Component (list item — click opens detail modal)
// ============================================================================

interface PositionCardProps {
  position: FuturesPosition;
  onSelect: (position: FuturesPosition) => void;
  flat?: boolean;
}

const PositionCard: React.FC<PositionCardProps> = ({
  position,
  onSelect,
  flat = false,
}) => {
  const statusColors = {
    pending:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    won: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    lost: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    mixed: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };

  const sportColor = getSportColor(position.sport);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(position)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(position)}
      aria-label={`View details for ${position.entity} ${position.futuresType}`}
      className={
        flat
          ? `overflow-hidden border-l-4 ${sportColor.border} cursor-pointer transition-all duration-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 group`
          : `bg-white dark:bg-neutral-900 rounded-xl shadow-md overflow-hidden border-l-4 ${sportColor.border} cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] group`
      }
    >
      <div className="px-6 py-4">
        {/* Grid layout matching table headers: 5 | 2 | 2 | 3 */}
        <div className="grid grid-cols-12 gap-4 items-center">
          {/* Position info - col-span-5 */}
          <div className="col-span-12 sm:col-span-5 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {position.entity}
              </h3>
              {position.status !== "pending" && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[position.status]}`}
                >
                  {position.status.charAt(0).toUpperCase() +
                    position.status.slice(1)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium ${sportColor.text}`}>
                {position.sport}
              </span>
              <span className="text-neutral-300 dark:text-neutral-600">
                &middot;
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {position.futuresType}
              </span>
              <span className="text-neutral-300 dark:text-neutral-600">
                &middot;
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {position.bets.length} bet
                {position.bets.length !== 1 ? "s" : ""}
              </span>
              {position.daysUntil !== null && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-600">
                    &middot;
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium tabular-nums bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {position.daysUntil}d
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Stake - col-span-2 */}
          <div className="hidden sm:block col-span-2 text-right tabular-nums">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              {formatCurrency(position.totalStake)}
            </span>
          </div>

          {/* Odds - col-span-2 */}
          <div className="hidden sm:block col-span-2 text-right tabular-nums">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              {formatOdds(position.averageOdds)}
            </span>
          </div>

          {/* Payout + arrow - col-span-3 */}
          <div className="hidden sm:flex col-span-3 items-center justify-end gap-3">
            <span className="text-base font-bold text-accent-500 tabular-nums">
              {formatCurrency(position.totalPotentialPayout)}
            </span>
            <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-primary-500 transition-colors shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Market Card Component (list item — click opens detail modal)
// ============================================================================

interface MarketCardProps {
  market: MarketGroup;
  onSelect: (market: MarketGroup) => void;
}

const MarketCard: React.FC<MarketCardProps> = ({ market, onSelect }) => {
  const sportColor = getSportColor(market.sport);

  const statusColors = {
    pending:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    won: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    lost: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    mixed: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(market)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(market)}
      aria-label={`View details for ${market.futuresType} (${market.sport})`}
      className={`overflow-hidden border-l-4 ${sportColor.border} cursor-pointer transition-all duration-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 group`}
    >
      <div className="px-6 py-4">
        {/* Grid layout matching table headers: 5 | 2 | 2 | 3 */}
        <div className="grid grid-cols-12 gap-4 items-center">
          {/* Market info - col-span-5 */}
          <div className="col-span-12 sm:col-span-5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {market.futuresType}
              </h3>
              {market.status !== "pending" && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[market.status]}`}
                >
                  {market.status.charAt(0).toUpperCase() +
                    market.status.slice(1)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-xs font-medium ${sportColor.text}`}>
                {market.sport}
              </span>
              <span className="text-neutral-300 dark:text-neutral-600">
                &middot;
              </span>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {market.positions.length} pick
                {market.positions.length !== 1 ? "s" : ""}
              </span>
              {market.daysUntil !== null && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-600">
                    &middot;
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium tabular-nums bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {market.daysUntil}d
                  </span>
                </>
              )}
              {/* Preview picks inline */}
              <span className="text-neutral-300 dark:text-neutral-600">
                &middot;
              </span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate max-w-[200px]">
                {market.positions
                  .slice(0, 3)
                  .map((p) => p.entity)
                  .join(", ")}
                {market.positions.length > 3
                  ? ` +${market.positions.length - 3} more`
                  : ""}
              </span>
            </div>
          </div>

          {/* Picks count - col-span-2 */}
          <div className="hidden sm:block col-span-2 text-right tabular-nums">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              {market.positions.length}
            </span>
          </div>

          {/* Exposure - col-span-2 */}
          <div className="hidden sm:block col-span-2 text-right tabular-nums">
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">
              {formatCurrency(market.totalStake)}
            </span>
          </div>

          {/* Best/Worst + arrow - col-span-3 */}
          <div className="hidden sm:flex col-span-3 items-center justify-end gap-3">
            <div className="flex flex-col items-end tabular-nums text-xs gap-0.5">
              <span className="text-neutral-500 dark:text-neutral-400">
                <span className="font-semibold text-accent-500">
                  {market.bestCaseProfit >= 0 ? "+" : ""}
                  {formatCurrency(market.bestCaseProfit)}
                </span>
              </span>
              <span className="text-neutral-500 dark:text-neutral-400">
                <span className="font-semibold text-red-500">
                  {formatCurrency(market.worstCaseNet)}
                </span>
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-primary-500 transition-colors shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Position Detail Modal
// ============================================================================

interface PositionDetailModalProps {
  position: FuturesPosition;
  onClose: () => void;
  onHedge: (position: FuturesPosition) => void;
  customResolutionDates: Record<string, string>;
  onUpdateDate: (key: string, date: string) => void;
}

const PositionDetailModal: React.FC<PositionDetailModalProps> = ({
  position,
  onClose,
  onHedge,
  customResolutionDates,
  onUpdateDate,
}) => {
  const sportColor = getSportColor(position.sport);
  const hasCustomDate = customResolutionDates[position.key] !== undefined;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const breakdown: PositionBreakdown[] = position.bets.map((bet) => {
    const potentialPayout = calculatePotentialPayout(bet);
    return {
      id: bet.id,
      date: new Date(bet.placedAt).toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
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

  const resultColors = {
    win: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    loss: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    push: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400",
    pending:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="modal-panel relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-neutral-900 ring-1 ring-black/10 dark:ring-white/5"
      >
        {/* Hero Zone */}
        <div
          className={`px-6 pt-5 pb-6 bg-gradient-to-br ${sportColor.gradient} to-transparent border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0`}
        >
          {/* Top row: status + close */}
          <div className="flex items-center justify-between mb-4">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[position.status]}`}
            >
              {position.status.charAt(0).toUpperCase() +
                position.status.slice(1)}
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Entity name */}
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white leading-tight mb-2">
            {position.entity}
          </h2>

          {/* Subtitle */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${sportColor.text}`}>
              {position.sport}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600">
              &middot;
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {position.futuresType}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600">
              &middot;
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {position.bets.length} bet
              {position.bets.length !== 1 ? "s" : ""}
            </span>
            {position.daysUntil !== null && (
              <>
                <span className="text-neutral-300 dark:text-neutral-600">
                  &middot;
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium tabular-nums bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {position.daysUntil}d
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide">
              Exposure
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1 tabular-nums">
              {formatCurrency(position.totalStake)}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide">
              Avg Odds
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1 tabular-nums">
              {formatOdds(position.averageOdds)}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide">
              Payout
            </p>
            <p className="text-xl font-bold text-accent-500 mt-1 tabular-nums">
              {formatCurrency(position.totalPotentialPayout)}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide">
              Max Profit
            </p>
            <p
              className={`text-xl font-bold mt-1 tabular-nums ${position.maxProfit >= 0 ? "text-accent-500" : "text-red-500"}`}
            >
              {position.maxProfit >= 0 ? "+" : ""}
              {formatCurrency(position.maxProfit)}
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 scrollbar-hidden">
          {/* Resolution */}
          <div className="px-6 py-5 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide">
                Resolution
                {hasCustomDate && (
                  <span className="text-primary-500 ml-2 normal-case font-medium text-xs">
                    (custom)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={
                    position.resolutionDate
                      ? position.resolutionDate.toISOString().split("T")[0]
                      : ""
                  }
                  onChange={(e) => onUpdateDate(position.key, e.target.value)}
                  className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white cursor-pointer hover:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                />
                {hasCustomDate && (
                  <button
                    onClick={() => onUpdateDate(position.key, "")}
                    className="text-xs text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            {!position.resolutionDate && (
              <p className="text-sm text-neutral-400 dark:text-neutral-500 italic">
                No resolution date set
              </p>
            )}
          </div>

          {/* Bets */}
          <div className="px-6 py-5">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide mb-3">
              {position.bets.length} Bet
              {position.bets.length !== 1 ? "s" : ""}
            </p>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {breakdown.map((bet) => {
                const aboveAvg = bet.odds > position.averageOdds;
                return (
                  <div
                    key={bet.id}
                    className="flex items-center gap-4 px-4 py-3.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <span className="text-xs text-neutral-400 dark:text-neutral-500 tabular-nums w-14 flex-shrink-0">
                      {bet.date}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full text-sm font-bold tabular-nums flex-shrink-0 ${
                        aboveAvg
                          ? "bg-accent-100 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                      }`}
                    >
                      {formatOdds(bet.odds)}
                    </span>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="text-sm text-neutral-500 dark:text-neutral-400 tabular-nums">
                        {formatCurrency(bet.stake)}
                      </span>
                      <span className="text-neutral-300 dark:text-neutral-600 flex-shrink-0">
                        →
                      </span>
                      <span className="text-sm font-semibold text-neutral-900 dark:text-white tabular-nums">
                        {formatCurrency(bet.potentialPayout)}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                        resultColors[bet.result as keyof typeof resultColors] ??
                        resultColors.pending
                      }`}
                    >
                      {bet.result.charAt(0).toUpperCase() + bet.result.slice(1)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer — hedge CTA for pending positions */}
        {position.status === "pending" && (
          <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex-shrink-0">
            <button
              onClick={() => {
                onClose();
                onHedge(position);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
            >
              <Scale className="w-4 h-4" />
              Open Hedge Calculator
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Market Detail Modal
// ============================================================================

interface MarketDetailModalProps {
  market: MarketGroup;
  onClose: () => void;
}

const MarketDetailModal: React.FC<MarketDetailModalProps> = ({
  market,
  onClose,
}) => {
  const sportColor = getSportColor(market.sport);
  const wonPosition = market.positions.find((p) => p.status === "won");

  const bestNetIfWins = Math.max(
    ...market.positions.map((p) => p.totalPotentialPayout - market.totalStake),
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const statusColors = {
    pending:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
    won: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    lost: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    mixed: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="modal-panel relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-neutral-900 ring-1 ring-black/10 dark:ring-white/5">
        {/* Hero Zone */}
        <div
          className={`px-6 pt-5 pb-6 bg-gradient-to-br ${sportColor.gradient} to-transparent border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0`}
        >
          {/* Top row: status + close */}
          <div className="flex items-center justify-between mb-4">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[market.status]}`}
            >
              {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Market title */}
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white leading-tight mb-2">
            {market.futuresType}
          </h2>

          {/* Subtitle */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-semibold ${sportColor.text}`}>
              {market.sport}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600">
              &middot;
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {market.positions.length} pick
              {market.positions.length !== 1 ? "s" : ""}
            </span>
            {market.resolutionDate && (
              <>
                <span className="text-neutral-300 dark:text-neutral-600">
                  &middot;
                </span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  Resolves {formatDate(market.resolutionDate)}
                </span>
              </>
            )}
            {market.daysUntil !== null && (
              <>
                <span className="text-neutral-300 dark:text-neutral-600">
                  &middot;
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-medium tabular-nums bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {market.daysUntil}d
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide">
              Exposure
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1 tabular-nums">
              {formatCurrency(market.totalStake)}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide">
              Best Case
            </p>
            <p className="text-xl font-bold text-accent-500 mt-1 tabular-nums">
              {market.bestCaseProfit >= 0 ? "+" : ""}
              {formatCurrency(market.bestCaseProfit)}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide">
              Worst Case
            </p>
            <p className="text-xl font-bold text-red-500 mt-1 tabular-nums">
              {formatCurrency(market.worstCaseNet)}
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide">
              Picks
            </p>
            <p className="text-xl font-bold text-neutral-900 dark:text-white mt-1">
              {market.positions.length}
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 scrollbar-hidden">
          {/* Won callout */}
          {wonPosition && (
            <div className="mx-6 mt-5 px-5 py-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 flex items-center gap-3">
              <Trophy className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-base font-semibold text-green-700 dark:text-green-400">
                {wonPosition.entity} won this market
              </p>
            </div>
          )}

          {/* Picks */}
          <div className="px-6 py-5">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide mb-3">
              Picks
            </p>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {market.positions.map((pos) => {
                const netIfWins = pos.totalPotentialPayout - market.totalStake;
                return (
                  <div
                    key={pos.key}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-900 dark:text-white truncate">
                        {pos.entity}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                        {pos.bets.length} bet{pos.bets.length !== 1 ? "s" : ""}{" "}
                        · {formatOdds(pos.averageOdds)} ·{" "}
                        {formatCurrency(pos.totalStake)}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-bold tabular-nums flex-shrink-0 ${netIfWins >= 0 ? "text-accent-500" : "text-red-500"}`}
                    >
                      {netIfWins >= 0 ? "+" : ""}
                      {formatCurrency(netIfWins)}
                    </span>
                    {market.status === "mixed" && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${statusColors[pos.status]}`}
                      >
                        {pos.status.charAt(0).toUpperCase() +
                          pos.status.slice(1)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scenarios — 2-col cards */}
          <div className="px-6 pb-6">
            <p className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500 tracking-wide mb-3">
              Scenarios
            </p>
            <div className="grid grid-cols-2 gap-4">
              {market.positions.map((pos) => {
                const netIfWins = pos.totalPotentialPayout - market.totalStake;
                const isBest = netIfWins === bestNetIfWins;
                const isPositive = netIfWins >= 0;
                return (
                  <div
                    key={pos.key}
                    className={`rounded-xl p-5 border-2 transition-all ${
                      isBest
                        ? "border-accent-400 dark:border-accent-500 bg-accent-50 dark:bg-accent-900/20"
                        : isPositive
                          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/15"
                          : "border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40"
                    }`}
                  >
                    {isBest && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <Trophy className="w-3.5 h-3.5 text-accent-500" />
                        <span className="text-[10px] uppercase font-bold text-accent-500 tracking-wide">
                          Best Outcome
                        </span>
                      </div>
                    )}
                    <p className="font-bold text-neutral-900 dark:text-white text-sm leading-snug">
                      {pos.entity}
                    </p>
                    <p
                      className={`text-2xl font-bold mt-3 tabular-nums ${isPositive ? "text-accent-500" : "text-red-500"}`}
                    >
                      {isPositive ? "+" : ""}
                      {formatCurrency(netIfWins)}
                    </p>
                  </div>
                );
              })}
              {/* None win card */}
              <div className="rounded-xl p-5 border-2 border-dashed border-neutral-200 dark:border-neutral-700">
                <p className="font-medium text-neutral-400 dark:text-neutral-500 text-sm italic">
                  None win
                </p>
                <p className="text-2xl font-bold mt-3 tabular-nums text-red-500">
                  {formatCurrency(market.worstCaseNet)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export type ViewMode = "positions" | "timeline" | "markets" | "history";
export type SortBy = "exposure" | "potential" | "odds" | "resolution";
export type MarketSortBy = "exposure" | "bestCase" | "picks" | "resolution";

const SORT_LABELS: Record<SortBy, string> = {
  exposure: "Exposure",
  potential: "Potential payout",
  odds: "Average odds",
  resolution: "Soonest resolution",
};

export function sortFuturesPositions(
  positions: FuturesPosition[],
  sortBy: SortBy,
  viewMode: ViewMode,
): FuturesPosition[] {
  const effectiveSortBy = viewMode === "timeline" ? "resolution" : sortBy;

  return [...positions].sort((a, b) => {
    switch (effectiveSortBy) {
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
}

/**
 * Build market groups by grouping positions by futuresType + sport.
 * Each group contains all entity-level picks within the same award/market.
 *
 * Note: Win Totals are technically not mutually exclusive (Over/Under can coexist),
 * but bestCasePayout (max single payout) still gives the best realistic return per pick.
 * The "Other | [sport]" group aggregates unclassified positions.
 */
function buildMarketGroups(positions: FuturesPosition[]): MarketGroup[] {
  const map = new Map<string, FuturesPosition[]>();

  for (const pos of positions) {
    const key = `${pos.futuresType}__${pos.sport}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(pos);
  }

  return Array.from(map.entries()).map(([key, groupPositions]) => {
    const [futuresType, sport] = key.split("__");
    const totalStake = groupPositions.reduce((s, p) => s + p.totalStake, 0);
    const bestCasePayout = Math.max(
      ...groupPositions.map((p) => p.totalPotentialPayout),
    );
    const bestCaseProfit = bestCasePayout - totalStake;
    const worstCaseNet = -totalStake;

    const resolutionDate =
      groupPositions.find((p) => p.resolutionDate)?.resolutionDate ?? null;
    const daysUntil = calculateDaysUntil(resolutionDate);

    const allStatuses = groupPositions.map((p) => p.status);
    const hasWon = allStatuses.includes("won");
    const hasLost = allStatuses.includes("lost");
    const hasPending = allStatuses.includes("pending");
    let status: MarketGroup["status"];
    if (hasPending && !hasWon && !hasLost) status = "pending";
    else if (hasWon && !hasLost && !hasPending) status = "won";
    else if (hasLost && !hasWon && !hasPending) status = "lost";
    else status = "mixed";

    return {
      key,
      futuresType,
      sport,
      positions: [...groupPositions].sort(
        (a, b) => b.totalPotentialPayout - a.totalPotentialPayout,
      ),
      totalStake,
      bestCasePayout,
      bestCaseProfit,
      worstCaseNet,
      resolutionDate,
      daysUntil,
      status,
    };
  });
}

// LocalStorage key for custom resolution dates
const CUSTOM_DATES_KEY = "bettracker_futures_resolution_dates";

const FuturesView: React.FC = () => {
  const { bets } = useBets();
  const [viewMode, setViewMode] = useState<ViewMode>("positions");
  const [sortBy, setSortBy] = useState<SortBy>("exposure");
  const [marketSortBy, setMarketSortBy] = useState<MarketSortBy>("exposure");
  const [showHedgeCalc, setShowHedgeCalc] = useState(false);
  const [hedgePosition, setHedgePosition] = useState<FuturesPosition | null>(
    null,
  );
  const [selectedPosition, setSelectedPosition] =
    useState<FuturesPosition | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<MarketGroup | null>(
    null,
  );
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupBySport, setGroupBySport] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

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

    const marketGroups = buildMarketGroups(pendingPositions);

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
      marketGroups,
      marketGroupCount: marketGroups.length,
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
    return sortFuturesPositions(positions, sortBy, viewMode);
  }, [futuresData, viewMode, sortBy, sportFilter, typeFilter, searchQuery]);

  // Filter and sort market groups (Markets view)
  const displayMarkets = useMemo(() => {
    if (!futuresData) return [];

    let markets = futuresData.marketGroups;

    if (sportFilter !== "all") {
      markets = markets.filter((m) => m.sport === sportFilter);
    }
    if (typeFilter !== "all") {
      markets = markets.filter((m) => m.futuresType === typeFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      markets = markets.filter(
        (m) =>
          m.futuresType.toLowerCase().includes(query) ||
          m.sport.toLowerCase().includes(query) ||
          m.positions.some((p) => p.entity.toLowerCase().includes(query)),
      );
    }

    return [...markets].sort((a, b) => {
      switch (marketSortBy) {
        case "exposure":
          return b.totalStake - a.totalStake;
        case "bestCase":
          return b.bestCaseProfit - a.bestCaseProfit;
        case "picks":
          return b.positions.length - a.positions.length;
        case "resolution":
          if (a.daysUntil === null && b.daysUntil === null) return 0;
          if (a.daysUntil === null) return 1;
          if (b.daysUntil === null) return -1;
          return a.daysUntil - b.daysUntil;
        default:
          return 0;
      }
    });
  }, [futuresData, sportFilter, typeFilter, searchQuery, marketSortBy]);

  const handleHedge = (position: FuturesPosition) => {
    setHedgePosition(position);
    setShowHedgeCalc(true);
  };

  const hasActiveFilters =
    sportFilter !== "all" || typeFilter !== "all" || searchQuery.trim() !== "";
  const activeFilterCount =
    (sportFilter !== "all" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);
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

  const totalViewPositions =
    viewMode === "history"
      ? futuresData.settledPositions.length
      : viewMode === "markets"
        ? futuresData.marketGroupCount
        : futuresData.pendingPositions.length;
  const resultSummaryText =
    viewMode === "history"
      ? `Showing ${displayPositions.length} of ${totalViewPositions} settled position${totalViewPositions !== 1 ? "s" : ""}`
      : viewMode === "markets"
        ? `Showing ${displayMarkets.length} of ${totalViewPositions} market${totalViewPositions !== 1 ? "s" : ""}`
        : `Showing ${displayPositions.length} of ${totalViewPositions} open position${totalViewPositions !== 1 ? "s" : ""}`;
  return (
    <div className="h-full flex flex-col bg-neutral-100 dark:bg-neutral-950 p-4 lg:p-6 gap-3 overflow-hidden">
      {/* Header Card: Title + KPIs + Tabs */}
      <div className="shrink-0 bg-white dark:bg-neutral-900 rounded-xl shadow-md overflow-hidden">
        {/* Title + KPI Summary Row */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
          {/* Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary-500" />
            </div>
            <h1 className="text-lg font-bold text-neutral-900 dark:text-white">
              Futures
            </h1>
          </div>

          {/* KPI Summary - grows to fill space */}
          <div className="flex-1 grid grid-cols-3 divide-x divide-neutral-200 dark:divide-neutral-700">
            <div className="px-4">
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                Exposure
              </p>
              <p className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">
                {formatCurrency(futuresData.totalExposure)}
              </p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                Max Profit
              </p>
              <p className="text-base font-bold text-accent-500 tabular-nums">
                {formatCurrency(futuresData.totalMaxProfit)}
              </p>
            </div>
            <div className="px-4">
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-medium">
                Settled
              </p>
              <p className="text-base font-bold text-neutral-900 dark:text-white tabular-nums">
                {futuresData.settledStats.wins}W -{" "}
                {futuresData.settledStats.losses}L
                <span
                  className={`ml-2 text-xs ${futuresData.settledStats.net >= 0 ? "text-accent-500" : "text-red-500"}`}
                >
                  {futuresData.settledStats.net >= 0 ? "+" : ""}
                  {formatCurrency(futuresData.settledStats.net)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div
          className="flex items-center bg-neutral-50 dark:bg-neutral-800/50"
          role="tablist"
          aria-label="View mode"
        >
          {(["positions", "timeline", "markets", "history"] as const).map(
            (mode) => {
              const count =
                mode === "history"
                  ? futuresData.settledPositions.length
                  : mode === "markets"
                    ? futuresData.marketGroupCount
                    : futuresData.pendingPositions.length;
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex-1 px-3 py-2 font-medium text-sm transition-all border-b-2 ${
                    isActive
                      ? "border-primary-600 text-primary-600 dark:text-primary-400 bg-white dark:bg-neutral-900"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`futures-${mode}-panel`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                        isActive
                          ? "bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                          : "bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* Unified Table Container: Filters + Positions */}
      <div className="flex-1 flex flex-col bg-white dark:bg-neutral-900 rounded-xl shadow-md overflow-hidden min-h-0">
        {/* Filter Bar */}
        <div className="p-4 space-y-3">
          {/* Top row: Collapsible filters toggle + Search + Sort */}
          <div className="flex items-center gap-3">
            {/* Filters toggle button */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                hasActiveFilters
                  ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform ${filtersExpanded ? "rotate-180" : ""}`}
              />
              Filters
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 bg-primary-600 text-white text-xs rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSportFilter("all");
                  setTypeFilter("all");
                  setSearchQuery("");
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear all
              </button>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Search input */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-neutral-900 dark:text-white placeholder-neutral-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort dropdown - unified for all views */}
            <select
              value={
                viewMode === "markets"
                  ? marketSortBy
                  : viewMode === "timeline"
                    ? "resolution"
                    : sortBy
              }
              onChange={(e) => {
                if (viewMode === "markets") {
                  setMarketSortBy(e.target.value as MarketSortBy);
                } else if (viewMode !== "timeline") {
                  setSortBy(e.target.value as SortBy);
                }
              }}
              disabled={viewMode === "timeline"}
              className={`px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 min-w-[140px] ${
                viewMode === "timeline"
                  ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300"
                  : "bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white"
              }`}
            >
              {viewMode === "markets" ? (
                <>
                  <option value="exposure">Sort: Exposure</option>
                  <option value="bestCase">Sort: Best case</option>
                  <option value="picks">Sort: Most picks</option>
                  <option value="resolution">Sort: Resolution</option>
                </>
              ) : (
                <>
                  <option value="exposure">Sort: Exposure</option>
                  <option value="potential">Sort: Potential</option>
                  <option value="odds">Sort: Odds</option>
                  <option value="resolution">Sort: Resolution</option>
                </>
              )}
            </select>

            {/* Group by sport toggle - always visible, disabled for markets */}
            <button
              onClick={() =>
                viewMode !== "markets" && setGroupBySport(!groupBySport)
              }
              disabled={viewMode === "markets"}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "markets"
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed"
                  : groupBySport
                    ? "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">
                {groupBySport ? "Grouped" : "Group"}
              </span>
            </button>
          </div>

          {/* Collapsible filter panel */}
          {filtersExpanded && (
            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700 space-y-4">
              {/* Sport filter */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Sport
                </span>
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={() => setSportFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      sportFilter === "all"
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    All
                  </button>
                  {futuresData.sports.map((sport) => {
                    const sportColor = getSportColor(sport);
                    const isActive = sportFilter === sport;
                    return (
                      <button
                        key={sport}
                        onClick={() =>
                          setSportFilter(sportFilter === sport ? "all" : sport)
                        }
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? `${sportColor.pillActive} shadow-md`
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        }`}
                      >
                        {sport}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Type filter */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                  Type
                </span>
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={() => setTypeFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      typeFilter === "all"
                        ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-md"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    All
                  </button>
                  {futuresData.types.map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setTypeFilter(typeFilter === type ? "all" : type)
                      }
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        typeFilter === type
                          ? "bg-primary-600 text-white shadow-md"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Unified table header - always visible */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-2.5 bg-neutral-50 dark:bg-neutral-800/50 border-y border-neutral-200 dark:border-neutral-700 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
          <div className="col-span-5">
            {viewMode === "markets" ? "Market" : "Position"}
          </div>
          <div className="col-span-2 text-right">
            {viewMode === "markets" ? "Picks" : "Stake"}
          </div>
          <div className="col-span-2 text-right">
            {viewMode === "markets" ? "Exposure" : "Odds"}
          </div>
          <div className="col-span-3 text-right">
            {viewMode === "markets" ? "Best / Worst" : "Payout"}
          </div>
        </div>

        {/* Result summary - always visible */}
        <div className="px-6 py-2 bg-neutral-50/50 dark:bg-neutral-800/30 border-b border-neutral-100 dark:border-neutral-800">
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {resultSummaryText}
          </span>
        </div>

        {/* Positions / Timeline View */}
        <div
          className="flex-1 overflow-y-auto min-h-0 scrollbar-hidden"
          role="tabpanel"
          id={`futures-${viewMode}-panel`}
          aria-label={`${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} view`}
        >
          {/* Markets View */}
          {viewMode === "markets" && (
            <>
              {displayMarkets.length > 0 ? (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {displayMarkets.map((market) => (
                    <MarketCard
                      key={market.key}
                      market={market}
                      onSelect={setSelectedMarket}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-neutral-500 dark:text-neutral-400">
                    No markets match your filters.
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

          {/* Timeline View */}
          {viewMode === "timeline" && (
            <>
              {displayPositions.length > 0 ? (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {displayPositions.map((position) => {
                    const hasCustomDate =
                      customResolutionDates[position.key] !== undefined;
                    const tlSportColor = getSportColor(position.sport);
                    return (
                      <div
                        key={position.key}
                        className={`px-5 py-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer border-l-4 ${tlSportColor.border}`}
                        onClick={() => setSelectedPosition(position)}
                      >
                        <div className="flex items-center gap-4">
                          {/* Entity + Type */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-neutral-900 dark:text-white truncate">
                                {position.entity}
                              </p>
                              <span
                                className={`text-xs font-medium ${tlSportColor.text}`}
                              >
                                {position.sport}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">
                              {position.futuresType}
                            </p>
                          </div>

                          {/* Resolution date */}
                          <div className="text-center shrink-0">
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                              Resolution{" "}
                              {hasCustomDate && (
                                <span className="text-primary-500">
                                  (custom)
                                </span>
                              )}
                            </p>
                            <p className="font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">
                              {position.resolutionDate
                                ? position.resolutionDate.toLocaleDateString()
                                : "TBD"}
                            </p>
                            {position.daysUntil !== null && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                {position.daysUntil}d
                              </span>
                            )}
                          </div>

                          {/* Exposure */}
                          <div className="text-right shrink-0">
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase">
                              Exposure
                            </p>
                            <p className="font-medium text-neutral-700 dark:text-neutral-300 tabular-nums">
                              {formatCurrency(position.totalStake)}
                            </p>
                            <p className="text-xs text-accent-500 font-medium tabular-nums">
                              +{formatCurrency(position.maxProfit)} max
                            </p>
                          </div>

                          {/* Chevron */}
                          <ChevronRight className="w-4 h-4 text-neutral-300 dark:text-neutral-600 shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-neutral-500 dark:text-neutral-400">
                    No positions match your filters.
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

          {/* Positions / History View */}
          {(viewMode === "positions" || viewMode === "history") && (
            <>
              {displayPositions.length > 0 ? (
                groupBySport ? (
                  <div>
                    {(
                      Object.entries(
                        displayPositions.reduce<
                          Record<string, FuturesPosition[]>
                        >((groups, pos) => {
                          const sport = pos.sport;
                          if (!groups[sport]) groups[sport] = [];
                          groups[sport].push(pos);
                          return groups;
                        }, {}),
                      ) as [string, FuturesPosition[]][]
                    )
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([sport, positions]) => {
                        const groupColor = getSportColor(sport);
                        return (
                          <div key={sport}>
                            {/* Sport section header */}
                            <div
                              className={`flex items-center gap-3 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-800/40 border-b border-neutral-200 dark:border-neutral-800`}
                            >
                              <div
                                className={`w-1.5 h-5 rounded-full ${groupColor.dot}`}
                              />
                              <h2
                                className={`text-sm font-bold uppercase tracking-wider ${groupColor.text}`}
                              >
                                {sport}
                              </h2>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                {positions.length} position
                                {positions.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            {/* Cards for this sport */}
                            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                              {positions.map((position) => (
                                <PositionCard
                                  key={position.key}
                                  position={position}
                                  onSelect={setSelectedPosition}
                                  flat
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {displayPositions.map((position) => (
                      <PositionCard
                        key={position.key}
                        position={position}
                        onSelect={setSelectedPosition}
                        flat
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="p-8 text-center">
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
        </div>
      </div>
      {/* end Unified Table Container */}

      {/* Position Detail Modal */}

      {/* Position Detail Modal */}
      {selectedPosition && (
        <PositionDetailModal
          position={selectedPosition}
          onClose={() => setSelectedPosition(null)}
          onHedge={(pos) => {
            setSelectedPosition(null);
            handleHedge(pos);
          }}
          customResolutionDates={customResolutionDates}
          onUpdateDate={updateCustomDate}
        />
      )}

      {/* Market Detail Modal */}
      {selectedMarket && (
        <MarketDetailModal
          market={selectedMarket}
          onClose={() => setSelectedMarket(null)}
        />
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
