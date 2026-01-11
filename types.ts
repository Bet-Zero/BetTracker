export type BetResult = "win" | "loss" | "push" | "pending";
export type LegResult = "WIN" | "LOSS" | "PUSH" | "PENDING" | "UNKNOWN";

/**
 * FinalRow result values (title-case format for spreadsheet display).
 * These match the capitalized BetResult values used in FinalRow.Result.
 */
export type FinalResult = "Win" | "Loss" | "Push" | "Pending";

/**
 * Flag values for Over/Under fields: "1" for set, "0" for not set, "" for not applicable.
 */
export type OverUnderFlag = "1" | "0" | "";

/**
 * Flag values for single-flag fields like Live and Tail: "1" for set, "" for not set.
 */
export type SingleFlag = "1" | "";

/**
 * Formatted American odds string (e.g., "+360", "-120", "").
 * Must include sign for positive odds, no sign needed for negative (but typically includes "-").
 */
export type FormattedOdds = string & { readonly __brand: "FormattedOdds" };

/**
 * Formatted monetary amount string (e.g., "1.00", "3.60", "").
 * Always 2 decimal places when non-empty, no currency symbol.
 */
export type FormattedAmount = string & { readonly __brand: "FormattedAmount" };

/**
 * Formatted net profit/loss string (e.g., "-1.00", "0.00", "3.60", "").
 * Can be negative (loss), zero (push), positive (win), or empty (pending).
 * Always 2 decimal places when non-empty, no currency symbol.
 */
export type FormattedNet = string & { readonly __brand: "FormattedNet" };
export type BetType =
  | "single"
  | "parlay"
  | "sgp"
  | "sgp_plus"
  | "live"
  | "other";
export type SportsbookName = string;
export type MarketCategory =
  | "Props"
  | "Main Markets"
  | "Futures"
  | "Parlays";

export interface Sportsbook {
  name: SportsbookName;
  abbreviation: string;
  url: string;
  aliases?: string[];  // Search terms for typeahead (e.g., ["draftkings", "draft kings"])
}

/**
 * Tail - A person whose picks are followed ("tailed").
 * Used to track which bets were tailed and from whom.
 */
export interface Tail {
  name: string;        // Full name (e.g., "Tony's Picks")
  displayName: string; // Short display name, 5-6 chars (e.g., "Tony")
}

export interface BetLeg {
  entities?: string[];
  /**
   * Entity type classification set by parsers based on market structure.
   * - "player": Player prop markets (e.g., points, rebounds, assists)
   * - "team": Main markets (spread, total, moneyline) and team-level bets
   * - "unknown": Explicitly set by parsers when the market type is ambiguous
   * - undefined: Field not present (older data or parsers that didn't set it)
   *
   * IMPORTANT for consumers: Both `undefined` and `"unknown"` indicate the
   * entity type could not be reliably determined. Treat them identically:
   * do NOT auto-add entities to reference lists when entityType is missing
   * or "unknown". Check for either condition, e.g.:
   *   `if (!leg.entityType || leg.entityType === "unknown") { ... }`
   */
  entityType?: "player" | "team" | "unknown";
  market: string;
  target?: number | string;
  ou?: "Over" | "Under";
  odds?: number;
  actual?: number | string;
  /**
   * Leg-level result parsed from inline SVG icons when available.
   * Keep compatibility with legacy lowercase BetResult values.
   */
  result?: LegResult | BetResult;
  /**
   * Marks an SGP leg inside an SGP+ bet. Children carry the actual selections.
   */
  isGroupLeg?: boolean;
  /**
   * Nested legs for grouped selections (e.g., the inner Same Game Parlay within SGP+).
   */
  children?: BetLeg[];
}

export interface Bet {
  id: string; // Unique identifier, could be betId + placedAt
  book: SportsbookName;
  betId: string;
  placedAt: string; // ISO timestamp
  settledAt?: string; // ISO timestamp
  betType: BetType;
  marketCategory: MarketCategory;
  sport: string;
  description: string;
  name?: string; // Player/team name only (e.g., "Will Richard") - separate from description
  odds?: number | null;
  stake: number;
  payout: number;
  result: BetResult;
  type?: string; // Stat type for props (e.g., "3pt", "Pts", "Ast") - convenience field derived from legs[0]
  line?: string; // Line/threshold (e.g., "3+", "25.5") - convenience field derived from legs[0]
  ou?: "Over" | "Under"; // Over/Under - convenience field derived from legs[0]
  legs?: BetLeg[]; // All bets have legs: singles have legs.length === 1, parlays/SGPs have legs.length > 1
  tail?: string; // Who the bet was tailed from
  raw?: string; // Full raw text block for this bet
  isLive?: boolean; // Whether bet was placed live/in-game (separate from betType)
  isSample?: boolean; // Whether this is sample data (for migration detection)
}

export interface StrictBetRow {
  Date: string;
  Site: string;
  Sport: string;
  Category: string;
  Type: string;
  Name: string;
  Over: string;
  Under: string;
  Line: string;
  Odds: string;
  Bet: string;
  "To Win": string;
  Result: string;
  Net: string;
  Live: string;
  Tail: string;
}

/**
 * FinalRow - THE CANONICAL SPREADSHEET ROW TYPE
 *
 * This interface represents the EXACT columns in the user's spreadsheet.
 * All fields must match the spreadsheet schema exactly.
 *
 * RULES:
 * - Name: SUBJECT ONLY (player or team name, nothing else)
 * - Type: Depends on Category:
 *   - Props → stat type (Pts, Reb, Ast, 3pt, PRA, etc.)
 *   - Main → {Spread, Total, Moneyline}
 *   - Futures → {Win Total, NBA Finals, Super Bowl, Make Playoffs, Miss Playoffs, etc.}
 * - Type must NEVER contain bet form concepts (single/parlay/sgp/etc.)
 * - Over/Under: "1" or "0" (or "" when not applicable)
 * - Date format: MM/DD/YY
 */
export interface FinalRow {
  Date: string; // MM/DD/YY format
  Site: string;
  Sport: string;
  Category: string;
  Type: string;
  Name: string;
  Name2?: string; // Second name for totals bets (team 2)
  Over: OverUnderFlag;
  Under: OverUnderFlag;
  Line: string;
  Odds: FormattedOdds;
  Bet: FormattedAmount;
  "To Win": FormattedAmount;
  Result: FinalResult;
  Net: FormattedNet;
  Live: SingleFlag;
  Tail: SingleFlag;

  // Internal parlay metadata (not visible in spreadsheet)
  _parlayGroupId?: string | null;
  _legIndex?: number | null;
  _legCount?: number | null;
  _isParlayHeader?: boolean;
  _isParlayChild?: boolean;
  // Raw numeric values for editing/calculations (avoids string parsing)
  // These are populated by betToFinalRows alongside formatted string fields
  /** Raw odds value. Undefined for parlay children without leg odds, or when odds unavailable. */
  _rawOdds?: number;
  /** Raw bet amount. Undefined for parlay child rows (only shown on headers). */
  _rawBet?: number;
  /** Raw to-win amount. Undefined for parlay child rows or when calculation not possible. */
  _rawToWin?: number;
  /** Raw net profit/loss. Undefined for pending bets or parlay child rows. */
  _rawNet?: number;
}
