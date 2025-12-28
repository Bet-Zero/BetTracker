/**
 * Shared Filter Predicates Module
 * 
 * Provides composable filter functions for bet filtering across all display views.
 * Extracted from DashboardView, BySportView, SportsbookBreakdownView, PlayerProfileView.
 */

import { Bet, BetType } from '../types';

// --- Types ---

export type DateRange = 'all' | '1d' | '3d' | '1w' | '1m' | '1y' | 'custom';

export interface CustomDateRange {
  start: string;  // YYYY-MM-DD format
  end: string;    // YYYY-MM-DD format
}

// --- Core Predicates ---

/**
 * Check if a betType is a parlay type.
 * Includes: sgp, sgp_plus, parlay
 */
export function isParlayType(betType: BetType): boolean {
  return betType === 'sgp' || betType === 'sgp_plus' || betType === 'parlay';
}

/**
 * Create a predicate to filter bets by bet type (non-parlays, parlays, or all).
 */
export function createBetTypePredicate(
  betTypeFilter: 'non-parlays' | 'parlays' | 'all'
): (bet: Bet) => boolean {
  return (bet: Bet) => {
    if (betTypeFilter === 'all') return true;
    if (betTypeFilter === 'non-parlays') return !isParlayType(bet.betType);
    // parlays
    return isParlayType(bet.betType);
  };
}

/**
 * Get the start date for a preset date range.
 * Uses current time as the reference point.
 */
export function getDateRangeStart(range: Exclude<DateRange, 'all' | 'custom'>): Date {
  const now = new Date();
  
  switch (range) {
    case '1d':
      return new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    case '3d':
      return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    case '1w':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '1m':
      return new Date(new Date().setMonth(now.getMonth() - 1));
    case '1y':
      return new Date(new Date().setFullYear(now.getFullYear() - 1));
  }
}

/**
 * Create a predicate to filter bets by date range.
 */
export function createDateRangePredicate(
  range: DateRange,
  customRange?: CustomDateRange
): (bet: Bet) => boolean {
  return (bet: Bet) => {
    if (range === 'all') return true;

    if (range === 'custom') {
      const customStart = customRange?.start 
        ? new Date(`${customRange.start}T00:00:00.000Z`) 
        : null;
      const customEnd = customRange?.end 
        ? new Date(`${customRange.end}T23:59:59.999Z`) 
        : null;
      
      const betDate = new Date(bet.placedAt);
      if (customStart && betDate < customStart) return false;
      if (customEnd && betDate > customEnd) return false;
      return true;
    }

    // Preset range
    const startDate = getDateRangeStart(range);
    return new Date(bet.placedAt) >= startDate;
  };
}

/**
 * Create a predicate to filter bets by sportsbook.
 */
export function createBookPredicate(selectedBook: string): (bet: Bet) => boolean {
  return (bet: Bet) => {
    if (selectedBook === 'all') return true;
    return bet.book === selectedBook;
  };
}

/**
 * Create a predicate to filter bets by sport.
 */
export function createSportPredicate(selectedSport: string | 'all'): (bet: Bet) => boolean {
  return (bet: Bet) => {
    // Some views might pass 'all', others might just rely on single sport selection. 
    // Handling 'all' explicitly is safer for reusability.
    if (selectedSport === 'all') return true; 
    return bet.sport === selectedSport;
  };
}

/**
 * Create a predicate to filter bets by market category.
 */
export function createMarketCategoryPredicate(
  selectedMarketCategory: string
): (bet: Bet) => boolean {
  return (bet: Bet) => {
    if (selectedMarketCategory === 'all') return true;
    return bet.marketCategory === selectedMarketCategory;
  };
}

/**
 * Create a predicate to filter bets by entity (player or team).
 * Used in PlayerProfileView logic.
 */
export function createEntityPredicate(
  selectedEntity: string | null
): (bet: Bet) => boolean {
  return (bet: Bet) => {
    if (!selectedEntity) return true; // logic in PlayerProfileView was: if (!selectedPlayer) return []; but usually filters run on list. 
    // IF selectedPlayer is null, the view short-circuits. Here we return true to not filter? 
    // Actually in PlayerProfileView: if (!selectedPlayer) return [];
    // But as a predicate, if no entity selected, maybe valid?
    // Let's stick to the filter logic: "Filter to only bets involving the selected player".
    
    return bet.legs?.some(leg => leg.entities?.includes(selectedEntity)) ?? false;
  };
}

// --- BetTable Helper ---

/**
 * Create a predicate for BetTable search and filtering.
 * Note: BetTable operates on "FlatRows", requiring adequate typing or loose typing.
 * This predicate handles the specific BetTable filtering requirements.
 */
export function createBetTableFilterPredicate(
  filters: {
    sport: string | "all";
    type: string | "all";
    result: string | "all";
    category: string | "all";
  },
  searchTerm: string,
  searchFields: ('name' | 'name2' | 'type' | 'category' | 'tail')[] = ['name', 'name2', 'type', 'category', 'tail']
): (row: any) => boolean {
  const lowerSearchTerm = searchTerm.toLowerCase();

  return (row: any) => {
    // 1. Structural Filters
    if (filters.sport !== "all" && row.sport !== filters.sport) return false;
    if (filters.type !== "all" && row.type !== filters.type) return false;
    if (filters.result !== "all" && 
        (row.result !== filters.result && row.overallResult !== filters.result)) return false;
    if (filters.category !== "all" && row.category !== filters.category) return false;

    // 2. Search Term
    if (!lowerSearchTerm) return true;

    // Check all specified fields
    for (const field of searchFields) {
      if (row[field] && row[field].toString().toLowerCase().includes(lowerSearchTerm)) {
        return true;
      }
    }
    
    return false;
  };
}
