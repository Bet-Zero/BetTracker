/**
 * Utility functions for Bet Type categorization.
 * Used by UI to group stat types into buckets (Props, Main Markets, Parlays, Futures).
 */

export type StatCategory = "props" | "main" | "parlay" | "future";

// Categorization matching sets (canonical names)
export const PARLAY_CANONICALS = new Set(["Parlay", "SGP", "SGP+"]);

export const FUTURE_CANONICALS = new Set([
  "Championship", "Conference Winner", "Division Winner", 
  "Win Total", "Make Playoffs", "Miss Playoffs",
  "NBA Finals", "Super Bowl", "World Series", "Stanley Cup",
  "Awards", "MVP", "DPOY", "ROY", "6MOY", "MIP", "COTY"
]);

export const MAIN_MARKET_CANONICALS = new Set([
  "Moneyline", "Spread", "Total", "Over", "Under", "Run Line", "Puck Line"
]);

/**
 * Determines the category bucket for a given bet type canonical name.
 * 
 * @param canonical The canonical name of the bet type (e.g. "Moneyline", "Points")
 * @returns The category string ('main', 'parlay', 'future', or 'props')
 */
export const getBetTypeCategory = (canonical: string): StatCategory => {
  if (PARLAY_CANONICALS.has(canonical)) return "parlay";
  if (FUTURE_CANONICALS.has(canonical)) return "future";
  if (MAIN_MARKET_CANONICALS.has(canonical)) return "main";
  return "props"; // Default bucket
};
