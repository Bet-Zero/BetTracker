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
 * 
 * This matches the P1 semantic alignment where "parlays" filter includes all three types.
 */
export function isParlayType(betType: BetType): boolean {
  return betType === 'sgp' || betType === 'sgp_plus' || betType === 'parlay';
}

/**
 * Filter bets by bet type (singles, parlays, or all).
 * 
 * - 'singles': Only bets with betType === 'single'
 * - 'parlays': Bets with betType in {sgp, sgp_plus, parlay}
 * - 'all': No filtering
 * 
 * Mirrors logic from DashboardView (lines 721-725) and PlayerProfileView (lines 392-401).
 */
export function filterByBetType(
  bets: Bet[],
  betTypeFilter: 'singles' | 'parlays' | 'all'
): Bet[] {
  if (betTypeFilter === 'all') {
    return bets;
  }
  
  if (betTypeFilter === 'singles') {
    return bets.filter(bet => bet.betType === 'single');
  }
  
  // parlays
  return bets.filter(bet => isParlayType(bet.betType));
}

/**
 * Get the start date for a preset date range.
 * 
 * Uses current time as the reference point.
 * Mirrors logic from DashboardView (lines 755-773), BySportView (lines 421-428),
 * SportsbookBreakdownView (lines 121-140), PlayerProfileView (lines 374-381).
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
 * Filter bets by date range (preset or custom).
 * 
 * - 'all': No date filtering
 * - 'custom': Filter between customRange.start and customRange.end (inclusive)
 * - Preset ranges: Filter from start date to now
 * 
 * Custom range boundaries:
 * - start: Treated as start of day (T00:00:00.000Z)
 * - end: Treated as end of day (T23:59:59.999Z)
 * 
 * Mirrors logic from all views that implement date filtering.
 */
export function filterByDateRange(
  bets: Bet[],
  range: DateRange,
  customRange?: CustomDateRange
): Bet[] {
  if (range === 'all') {
    return bets;
  }
  
  if (range === 'custom') {
    const customStart = customRange?.start 
      ? new Date(`${customRange.start}T00:00:00.000Z`) 
      : null;
    const customEnd = customRange?.end 
      ? new Date(`${customRange.end}T23:59:59.999Z`) 
      : null;
    
    return bets.filter(bet => {
      const betDate = new Date(bet.placedAt);
      if (customStart && betDate < customStart) return false;
      if (customEnd && betDate > customEnd) return false;
      return true;
    });
  }
  
  // Preset range
  const startDate = getDateRangeStart(range);
  return bets.filter(bet => new Date(bet.placedAt) >= startDate);
}

/**
 * Filter bets by market category.
 * 
 * - 'all': No filtering
 * - Otherwise: Only bets matching the category
 * 
 * Mirrors logic from DashboardView (lines 729-732).
 */
export function filterByCategory(bets: Bet[], category: string): Bet[] {
  if (category === 'all') {
    return bets;
  }
  return bets.filter(bet => bet.marketCategory === category);
}

/**
 * Filter bets by sport.
 * 
 * Mirrors logic from BySportView (line 405).
 */
export function filterBySport(bets: Bet[], sport: string): Bet[] {
  return bets.filter(bet => bet.sport === sport);
}

/**
 * Filter bets by sportsbook.
 * 
 * - 'all': No filtering
 * - Otherwise: Only bets from the specified book
 * 
 * Mirrors logic from SportsbookBreakdownView (lines 97-100).
 */
export function filterByBook(bets: Bet[], book: string): Bet[] {
  if (book === 'all') {
    return bets;
  }
  return bets.filter(bet => bet.book === book);
}

/**
 * Filter bets by search term across multiple fields.
 * 
 * Default fields: name, type, category, tail
 * Case-insensitive matching.
 * 
 * Note: BetTableView operates on FlatBet[], not Bet[], so it may continue
 * using inline search logic that includes FlatBet-specific fields like name2.
 */
export function filterBySearchTerm(
  bets: Bet[],
  searchTerm: string,
  fields: ('name' | 'type' | 'category' | 'tail')[] = ['name', 'type', 'category', 'tail']
): Bet[] {
  if (!searchTerm) {
    return bets;
  }
  
  const lowerSearchTerm = searchTerm.toLowerCase();
  
  return bets.filter(bet => {
    for (const field of fields) {
      const value = bet[field];
      if (value && value.toLowerCase().includes(lowerSearchTerm)) {
        return true;
      }
    }
    return false;
  });
}
