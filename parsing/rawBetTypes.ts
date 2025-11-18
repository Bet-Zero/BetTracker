/**
 * RawBet represents raw extracted data from HTML before any interpretation.
 * This is Stage A output - no logic, no mapping, just raw text extraction.
 */
export interface RawBet {
  site: string;           // "FanDuel" or "DraftKings"
  rawMarketText: string;   // ex: "3+ MADE THREES"
  playerName?: string;     // if present
  teamNames?: string[];    // if present
  game?: string;           // "Golden State Warriors @ New Orleans Pelicans"
  eventDateTime?: string;  // like "Nov 16, 7:11pm ET"
  placedAt?: string;       // from PLACED: (raw string, e.g., "11/16/2025 7:09PM ET")
  odds?: string;           // "+360" (keep as string with sign)
  wager?: string;          // "$1.00"
  returned?: string;       // "$0.00"
  betId?: string;
  miscLabels?: string[];   // any random label text
  isMultiLeg?: boolean;    // true if SGP/parlay detected
  isLive?: boolean;        // true if "Live" or "In-Game" detected
  isTail?: boolean;        // true if tailing indicated
}

