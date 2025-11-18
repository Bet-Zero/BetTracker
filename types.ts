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
  odds: number;
  stake: number;
  payout: number;
  result: BetResult;
  legs?: BetLeg[];
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