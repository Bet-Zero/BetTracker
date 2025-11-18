export type BetResult = 'win' | 'loss' | 'push' | 'pending';
export type BetType = 'single' | 'parlay' | 'sgp' | 'live' | 'other';
export type SportsbookName = string;
export type MarketCategory = string;

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
  odds?: number;
  actual?: number | string;
  result: BetResult;
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
  type?: string; // Stat type for props (e.g., "3pt", "Pts", "Ast") - only for single bets
  line?: string; // Line/threshold (e.g., "3+", "25.5") - only for single bets
  ou?: 'Over' | 'Under'; // Over/Under - only for single bets
  legs?: BetLeg[]; // Only for parlays/SGPs - single bets should NOT have legs
  tail?: string; // Who the bet was tailed from
  raw?: string; // Full raw text block for this bet
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
 * FinalRow represents the normalized output from the global normalizer.
 * All fields are strings matching the exact column schema.
 * Date format: MM/DD/YY
 */
export interface FinalRow {
  Date: string;        // MM/DD/YY format
  Site: string;
  Sport: string;
  Category: string;
  Type: string;
  Name: string;
  Over: string;        // "1" or "0"
  Under: string;      // "1" or "0"
  Line: string;
  Odds: string;       // "+360" or "-120" (keep sign)
  Bet: string;        // "1.00" (no $)
  "To Win": string;   // "3.60"
  Result: string;     // "Win", "Loss", "Push", "Pending"
  Net: string;        // "-1.00", "0", "3.60"
  Live: string;       // "1" or ""
  Tail: string;       // "1" or ""
}