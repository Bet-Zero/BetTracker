/**
 * Market Classification Service
 * 
 * SINGLE SOURCE OF TRUTH for all market/category/type classification logic.
 * 
 * This service consolidates classification logic previously scattered across:
 * - services/classificationService.ts
 * - parsing/shared/betToFinalRows.ts
 * - components/ImportConfirmationModal.tsx
 * 
 * ALL layers (import, confirmation, storage, display) must call this service
 * for market classification. NO callers should re-interpret or override results.
 */

import { Bet, MarketCategory } from '../types';
import {
  FUTURES_KEYWORDS,
  MAIN_MARKET_KEYWORDS,
  PROP_KEYWORDS,
  STAT_TYPE_MAPPINGS,
  MAIN_MARKET_TYPES,
  FUTURES_TYPES,
  BASKETBALL_SPORTS,
} from './marketClassification.config';

// ============================================================================
// CACHED REGEX PATTERNS (for performance)
// ============================================================================

/**
 * Pre-compiled regex patterns for prop keyword matching.
 * Cached at module level to avoid re-creating RegExp objects on every call.
 * @internal
 */
const PROP_KEYWORD_PATTERNS = PROP_KEYWORDS.map(keyword => {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedKeyword}\\b`, 'i');
});

/**
 * Pre-compiled regex patterns for futures keyword matching.
 * Cached at module level to avoid re-creating RegExp objects on every call.
 * @internal
 */
const FUTURES_KEYWORD_PATTERNS = FUTURES_KEYWORDS.map(keyword => {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedKeyword}\\b`, 'i');
});

/**
 * Pre-compiled regex patterns for main market keyword matching.
 * Cached at module level to avoid re-creating RegExp objects on every call.
 * @internal
 */
const MAIN_MARKET_KEYWORD_PATTERNS = MAIN_MARKET_KEYWORDS.map(keyword => {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedKeyword}\\b`, 'i');
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if any pre-compiled pattern matches the text.
 * 
 * @param text - The text to search in
 * @param patterns - Array of pre-compiled RegExp patterns
 * @returns true if any pattern matches, false otherwise
 * 
 * @internal
 */
function hasAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(text));
}

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Classifies a bet's market category.
 * This is the primary function for bet-level classification.
 * 
 * @param bet - Bet object to classify (without id, marketCategory, raw, tail fields)
 * @returns MarketCategory - One of: 'Props', 'Main Markets', 'Futures', 'SGP/SGP+', 'Parlays'
 */
export function classifyBet(bet: Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'>): MarketCategory {
  // Input validation
  if (!bet || typeof bet !== 'object') {
    console.error('[classifyBet] Invalid bet object provided:', bet);
    return 'Props';
  }

  if (!bet.betType) {
    console.warn(`[classifyBet] Missing betType for bet ${bet.betId || 'unknown'}`);
  }

  // SGP/SGP+ classification based on bet type
  if (bet.betType === 'sgp' || bet.betType === 'sgp_plus') {
    return 'SGP/SGP+';
  }
  
  // Parlay classification based on bet type
  if (bet.betType === 'parlay') {
    return 'Parlays';
  }
  
  // For single/live/other bets, check market characteristics
  if (isBetFuture(bet.description)) {
    return 'Futures';
  }
  
  if (['single', 'live', 'other'].includes(bet.betType)) {
    if (isBetMainMarket(bet)) {
      return 'Main Markets';
    }
    if (isBetProp(bet)) {
      return 'Props';
    }
  }
  
  // Fallback for parlays/sgps that might be prop-heavy but not caught above
  if (isBetProp(bet)) {
    return 'Props';
  }
  
  // NEVER return 'Other' - if we have a name or type, it's Props
  // Otherwise default to Main Markets (safer default than Props)
  if (bet.name || bet.type) {
    return 'Props';
  }
  
  // Last resort: default to Main Markets (never Other)
  return 'Main Markets';
}

/**
 * Classifies a leg's market category based on market text.
 * Used for parlay legs and SGP legs.
 * 
 * @param market - The market text from the leg
 * @param sport - The sport (e.g., "NBA")
 * @returns Category string - One of: 'Props', 'Main Markets', 'Futures'
 */
export function classifyLeg(market: string, sport: string): string {
  // Input validation
  if (typeof market !== 'string') {
    console.warn('[classifyLeg] Invalid market type provided:', typeof market);
    return 'Props';
  }

  if (!sport || typeof sport !== 'string' || sport.trim() === '') {
    console.warn('[classifyLeg] Invalid or empty sport provided, defaulting to NBA');
    sport = 'NBA';
  }

  // Handle empty/whitespace-only market
  if (!market || market.trim() === '') {
    return 'Props'; // Default to Props if no market text
  }
  
  const lowerMarket = market.toLowerCase();
  
  // Check for futures keywords first
  if (isMarketFuture(lowerMarket)) {
    return 'Futures';
  }
  
  // Check for main market keywords
  if (isMarketMainMarket(lowerMarket)) {
    // But exclude if it's clearly a prop (e.g., "player points total")
    if (!lowerMarket.includes('player') && !lowerMarket.includes('prop')) {
      return 'Main Markets';
    }
  }
  
  // Sport-specific: "td" means triple-double in basketball, touchdown in football
  // Check this BEFORE the general propKeywords to avoid false positives
  if (BASKETBALL_SPORTS.includes(sport as any)) {
    if (
      lowerMarket === 'td' ||
      lowerMarket.includes(' td ') ||
      lowerMarket.startsWith('td ') ||
      lowerMarket.endsWith(' td')
    ) {
      return 'Props';
    }
  }
  
  // Check for prop keywords
  if (isMarketProp(lowerMarket, sport)) {
    return 'Props';
  }
  
  // Default to Props if unclear (safer than Main for player/team bets)
  return 'Props';
}

/**
 * Determines the Type field based on Category and market text.
 * Used for display in the Type column.
 * 
 * @param market - The market text
 * @param category - The category (Props, Main Markets, Futures)
 * @param sport - The sport (e.g., "NBA")
 * @returns Type string - Stat type code or market type
 */
export function determineType(market: string, category: string, sport: string): string {
  // Input validation
  if (typeof market !== 'string') {
    console.warn('[determineType] Invalid market type provided:', typeof market);
    return '';
  }

  if (typeof category !== 'string') {
    console.warn('[determineType] Invalid category type provided:', typeof category);
    return '';
  }

  if (typeof sport !== 'string') {
    console.warn('[determineType] Invalid sport type provided:', typeof sport);
    sport = 'NBA'; // Fallback to NBA
  }

  // Handle empty strings - early return
  if (market.trim() === '') {
    return '';
  }

  const lowerMarket = market.toLowerCase();
  const normalizedMarket = lowerMarket.trim();
  
  if (category === 'Props') {
    return determinePropsType(lowerMarket, normalizedMarket, sport);
  }
  
  if (category === 'Main Markets') {
    return determineMainMarketType(lowerMarket);
  }
  
  if (category === 'Futures') {
    return determineFutureType(lowerMarket);
  }
  
  return '';
}

/**
 * Determines type for Props category with early returns.
 * @internal
 */
function determinePropsType(lowerMarket: string, normalizedMarket: string, sport: string): string {
  // Direct code/alias mappings for special props - check first for exact matches
  const directMap: Record<string, string> = {
    'fb': 'FB',
    'first basket': 'FB',
    'first field goal': 'FB',
    'first fg': 'FB',
    'top pts': 'Top Pts',
    'top scorer': 'Top Pts',
    'top points': 'Top Pts',
    'top points scorer': 'Top Pts',
    'dd': 'DD',
    'double double': 'DD',
    'double-double': 'DD',
    'triple double': 'TD',
    'triple-double': 'TD',
  };
  
  // Check direct map first for exact normalized market - early return
  if (directMap[normalizedMarket]) {
    return directMap[normalizedMarket];
  }
  
  // Sport-specific: "td" means triple-double in basketball - early return
  if (BASKETBALL_SPORTS.includes(sport as any)) {
    if (
      normalizedMarket === 'td' ||
      lowerMarket.includes(' td ') ||
      lowerMarket.startsWith('td ') ||
      lowerMarket.endsWith(' td')
    ) {
      return 'TD';
    }
  }
  
  // Look up stat type from sport-specific mappings
  const sportMappings = STAT_TYPE_MAPPINGS[sport] || STAT_TYPE_MAPPINGS.NBA;
  
  // Check each mapping pattern - early return on first match
  for (const [pattern, statType] of Object.entries(sportMappings)) {
    if (lowerMarket.includes(pattern)) {
      return statType;
    }
  }
  
  // No match found - return empty string for manual review
  return '';
}

/**
 * Determines type for Main Markets category.
 * @internal
 */
function determineMainMarketType(lowerMarket: string): string {
  // Check main market types - early return on first match
  for (const [pattern, type] of Object.entries(MAIN_MARKET_TYPES)) {
    if (lowerMarket.includes(pattern)) {
      return type;
    }
  }
  // Default fallback
  return 'Spread';
}

/**
 * Determines type for Futures category.
 * @internal
 */
function determineFutureType(lowerMarket: string): string {
  // Check futures types - early return on first match
  for (const [pattern, type] of Object.entries(FUTURES_TYPES)) {
    if (lowerMarket.includes(pattern)) {
      return type;
    }
  }
  // Generic fallback
  return 'Future';
}

// ============================================================================
// HELPER FUNCTIONS (Internal)
// ============================================================================

/**
 * Checks if a bet is a prop bet based on bet-level fields.
 * @internal
 */
function isBetProp(bet: Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'>): boolean {
  // If bet has a name field (player/team name), it's almost certainly a prop
  if (bet.name && bet.name.trim().length > 0) {
    return true;
  }
  
  // If bet has a type field (stat code like "3pt", "Pts", etc.), it's a prop
  if (bet.type && bet.type.trim().length > 0) {
    return true;
  }
  
  // Check legs for player/team props - explicitly check for non-empty array
  if (bet.legs && bet.legs.length > 0) {
    if (bet.legs.some(leg => leg.entities && leg.entities.length > 0)) {
      return true;
    }
  }
  
  // Check description for common prop keywords using cached patterns
  return hasAnyPattern(bet.description, PROP_KEYWORD_PATTERNS);
}

/**
 * Checks if a bet is a main market bet based on bet-level fields.
 * @internal
 */
function isBetMainMarket(bet: Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'>): boolean {
  // Use cached patterns for keyword matching
  if (hasAnyPattern(bet.description, MAIN_MARKET_KEYWORD_PATTERNS)) {
    return true;
  }
  
  // Check for spread patterns like -7.5 or +3.5 at the end of the description
  if (/[+-]\d{1,3}(\.5)?$/.test(bet.description.trim())) {
    return true;
  }
  
  // Check for totals patterns
  if (/\b(Total|Over|Under)\b/i.test(bet.description)) {
    return true;
  }
  
  return false;
}

/**
 * Checks if a bet is a futures bet based on description.
 * @internal
 */
function isBetFuture(description: string): boolean {
  // Use cached patterns for keyword matching
  return hasAnyPattern(description, FUTURES_KEYWORD_PATTERNS);
}

/**
 * Checks if market text indicates a futures market.
 * @internal
 */
function isMarketFuture(lowerMarket: string): boolean {
  return FUTURES_KEYWORDS.some(keyword => lowerMarket.includes(keyword));
}

/**
 * Checks if market text indicates a main market.
 * @internal
 */
function isMarketMainMarket(lowerMarket: string): boolean {
  return MAIN_MARKET_KEYWORDS.some(keyword => lowerMarket.includes(keyword));
}

/**
 * Checks if market text indicates a prop market.
 * @internal
 */
function isMarketProp(lowerMarket: string, sport: string): boolean {
  // Check prop keywords using substring matching (not word boundary for flexibility)
  if (PROP_KEYWORDS.some(keyword => lowerMarket.includes(keyword))) {
    return true;
  }
  
  // Check sport-specific stat mappings
  const sportMappings = STAT_TYPE_MAPPINGS[sport] || STAT_TYPE_MAPPINGS.NBA;
  for (const pattern of Object.keys(sportMappings)) {
    if (lowerMarket.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}
