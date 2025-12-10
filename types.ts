export type BetResult = 'win' | 'loss' | 'push' | 'pending';
export type LegResult = "WIN" | "LOSS" | "PUSH" | "PENDING" | "UNKNOWN";
export type BetType = 'single' | 'parlay' | 'sgp' | 'sgp_plus' | 'live' | 'other';
export type SportsbookName = string;
export type MarketCategory = "Props" | "Main Markets" | "Futures" | "SGP/SGP+" | "Parlays";

export interface Sportsbook {
  name: SportsbookName;
  abbreviation: string;
  url: string;
}

export interface BetLeg {
  entities?: string[];
  market: string;
  target?: number | string;
  ou?: 'Over' | 'Under';
  odds?: number | null;
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
  odds: number;
  stake: number;
  payout: number;
  result: BetResult;
  type?: string; // Stat type for props (e.g., "3pt", "Pts", "Ast") - convenience field derived from legs[0]
  line?: string; // Line/threshold (e.g., "3+", "25.5") - convenience field derived from legs[0]
  ou?: 'Over' | 'Under'; // Over/Under - convenience field derived from legs[0]
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
  Date: string;        // MM/DD/YY format
  Site: string;
  Sport: string;
  Category: string;
  Type: string;
  Name: string;
  Name2?: string;     // Second name for totals bets (team 2)
  Over: string;        // "1" or "0" or ""
  Under: string;      // "1" or "0" or ""
  Line: string;
  Odds: string;       // "+360" or "-120" (keep sign)
  Bet: string;        // "1.00" (no $)
  "To Win": string;   // "3.60"
  Result: string;     // "Win", "Loss", "Push", "Pending"
  Net: string;        // "-1.00", "0", "3.60"
  Live: string;       // "1" or ""
  Tail: string;       // "1" or ""
  
  // Internal parlay metadata (not visible in spreadsheet)
  _parlayGroupId?: string | null;
  _legIndex?: number | null;
  _legCount?: number | null;
  _isParlayHeader?: boolean;
  _isParlayChild?: boolean;
}
