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

// ============================================================================
// KEYWORD LISTS - Consolidated from all sources
// ============================================================================

/**
 * Keywords that indicate a Futures bet.
 * Consolidated from classificationService.ts, betToFinalRows.ts, and ImportConfirmationModal.tsx
 */
const FUTURES_KEYWORDS = [
  'to win',
  'award',
  'mvp',
  'dpoy',
  'roy',
  'champion',
  'championship',
  'outright',
  'win total',
  'win totals',
  'make playoffs',
  'miss playoffs',
  'nba finals',
  'super bowl',
  'world series',
  'stanley cup',
] as const;

/**
 * Keywords that indicate a Main Market bet.
 * Consolidated from classificationService.ts, betToFinalRows.ts, and ImportConfirmationModal.tsx
 */
const MAIN_MARKET_KEYWORDS = [
  'moneyline',
  'ml',
  'spread',
  'point spread',
  'total',
  'totals',
  'over',
  'under',
  'run line',
  'puck line',
] as const;

/**
 * Keywords that indicate a Props bet.
 * Consolidated from classificationService.ts, betToFinalRows.ts, and ImportConfirmationModal.tsx
 */
const PROP_KEYWORDS = [
  // Special props (longer forms checked first for specificity)
  'triple double',
  'triple-double',
  'double double',
  'double-double',
  'first basket',
  'first field goal',
  'first fg',
  'top scorer',
  'top points',
  'top pts',
  
  // Stat types
  'points',
  'pts',
  'rebounds',
  'reb',
  'assists',
  'ast',
  'threes',
  '3pt',
  '3-pointers',
  'made threes',
  'steals',
  'stl',
  'blocks',
  'blk',
  'turnovers',
  
  // Combined stats
  'pra',
  'pr',
  'ra',
  'pa',
  'stocks',
  
  // General prop indicators
  'player',
  'prop',
  'to record',
  'to score',
  
  // NFL/Football
  'yards',
  'touchdown',
  'td',
  'receiving',
  'rushing',
  'passing',
  
  // MLB/Baseball
  'home runs',
  'strikeouts',
  'hits',
  'runs',
  
  // NHL/Soccer
  'goals',
  'shots on goal',
] as const;

/**
 * Sport-specific stat type mappings for Props category.
 * Maps market text patterns to stat type codes.
 * Consolidated from betToFinalRows.ts
 */
const STAT_TYPE_MAPPINGS: Record<string, Record<string, string>> = {
  NBA: {
    // Combined stats (check before individual)
    'points rebounds assists': 'PRA',
    'pts reb ast': 'PRA',
    'points rebounds': 'PR',
    'pts reb': 'PR',
    'rebounds assists': 'RA',
    'reb ast': 'RA',
    'points assists': 'PA',
    'pts ast': 'PA',
    'steals blocks': 'Stocks',
    'stl blk': 'Stocks',
    
    // Special props
    'first basket': 'FB',
    'first field goal': 'FB',
    'first fg': 'FB',
    'top scorer': 'Top Pts',
    'top points': 'Top Pts',
    'top pts': 'Top Pts',
    'double double': 'DD',
    'double-double': 'DD',
    'triple double': 'TD',
    'triple-double': 'TD',
    
    // Individual stats
    'made threes': '3pt',
    '3-pointers': '3pt',
    'threes': '3pt',
    '3pt': '3pt',
    'points': 'Pts',
    'pts': 'Pts',
    'rebounds': 'Reb',
    'reb': 'Reb',
    'assists': 'Ast',
    'ast': 'Ast',
    'steals': 'Stl',
    'stl': 'Stl',
    'blocks': 'Blk',
    'blk': 'Blk',
    'turnovers': 'TO',
  },
  // Add other sports as needed
};

/**
 * Main Markets type mappings.
 * Consolidated from betToFinalRows.ts
 */
const MAIN_MARKET_TYPES: Record<string, string> = {
  'spread': 'Spread',
  'point spread': 'Spread',
  'total': 'Total',
  'totals': 'Total',
  'over': 'Total',
  'under': 'Total',
  'moneyline': 'Moneyline',
  'ml': 'Moneyline',
  'money line': 'Moneyline',
};

/**
 * Futures type mappings.
 * Consolidated from betToFinalRows.ts
 */
const FUTURES_TYPES: Record<string, string> = {
  'nba finals': 'NBA Finals',
  'super bowl': 'Super Bowl',
  'world series': 'World Series',
  'stanley cup': 'Stanley Cup',
  'wcc': 'WCC',
  'ecc': 'ECC',
  'win total': 'Win Total',
  'win totals': 'Win Total',
  'make playoffs': 'Make Playoffs',
  'miss playoffs': 'Miss Playoffs',
  'mvp': 'MVP',
  'dpoy': 'DPOY',
  'roy': 'ROY',
  'champion': 'Champion',
  'championship': 'Champion',
};

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
  // SGP/SGP+ classification based on bet type
  if (bet.betType === 'sgp' || bet.betType === 'sgp_plus') {
    return 'SGP/SGP+';
  }
  
  // Parlay classification based on bet type
  if (bet.betType === 'parlay') {
    return 'Parlays';
  }
  
  // For single/live/other bets, check market characteristics
  if (isFutureBet(bet.description)) {
    return 'Futures';
  }
  
  if (['single', 'live', 'other'].includes(bet.betType)) {
    if (isMainMarket(bet)) {
      return 'Main Markets';
    }
    if (isProp(bet)) {
      return 'Props';
    }
  }
  
  // Fallback for parlays/sgps that might be prop-heavy but not caught above
  if (isProp(bet)) {
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
  if (!market) return 'Props'; // Default to Props if no market text
  
  const lowerMarket = market.toLowerCase();
  
  // Check for futures keywords first
  if (isFutureMarket(lowerMarket)) {
    return 'Futures';
  }
  
  // Check for main market keywords
  if (isMainMarketText(lowerMarket)) {
    // But exclude if it's clearly a prop (e.g., "player points total")
    if (!lowerMarket.includes('player') && !lowerMarket.includes('prop')) {
      return 'Main Markets';
    }
  }
  
  // Sport-specific: "td" means triple-double in basketball, touchdown in football
  // Check this BEFORE the general propKeywords to avoid false positives
  const basketballSports = ['NBA', 'WNBA', 'CBB', 'NCAAB'];
  if (basketballSports.includes(sport)) {
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
  if (isPropMarket(lowerMarket, sport)) {
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
  const lowerMarket = market.toLowerCase();
  const normalizedMarket = lowerMarket.trim();
  
  if (category === 'Props') {
    // Direct code/alias mappings for special props
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
    
    // Sport-specific: "td" means triple-double in basketball, touchdown in football
    const basketballSports = ['NBA', 'WNBA', 'CBB', 'NCAAB'];
    if (basketballSports.includes(sport)) {
      if (
        normalizedMarket === 'td' ||
        lowerMarket.includes(' td ') ||
        lowerMarket.startsWith('td ') ||
        lowerMarket.endsWith(' td')
      ) {
        return 'TD';
      }
    }
    
    if (directMap[normalizedMarket]) {
      return directMap[normalizedMarket];
    }
    
    // Look up stat type from sport-specific mappings
    const sportMappings = STAT_TYPE_MAPPINGS[sport] || STAT_TYPE_MAPPINGS.NBA;
    
    // Check each mapping pattern
    for (const [pattern, statType] of Object.entries(sportMappings)) {
      if (lowerMarket.includes(pattern)) {
        return statType;
      }
    }
    
    // If no match, return empty string for manual review
    return '';
  }
  
  if (category === 'Main Markets') {
    // Check main market types
    for (const [pattern, type] of Object.entries(MAIN_MARKET_TYPES)) {
      if (lowerMarket.includes(pattern)) {
        return type;
      }
    }
    return 'Spread'; // Default
  }
  
  if (category === 'Futures') {
    // Check futures types
    for (const [pattern, type] of Object.entries(FUTURES_TYPES)) {
      if (lowerMarket.includes(pattern)) {
        return type;
      }
    }
    return 'Future'; // Generic fallback
  }
  
  return '';
}

// ============================================================================
// HELPER FUNCTIONS (Internal)
// ============================================================================

/**
 * Checks if a bet is a prop bet based on bet-level fields.
 * @internal
 */
function isProp(bet: Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'>): boolean {
  // If bet has a name field (player/team name), it's almost certainly a prop
  if (bet.name && bet.name.trim().length > 0) {
    return true;
  }
  
  // If bet has a type field (stat code like "3pt", "Pts", etc.), it's a prop
  if (bet.type && bet.type.trim().length > 0) {
    return true;
  }
  
  // Check legs for player/team props
  if (bet.legs?.some(leg => leg.entities && leg.entities.length > 0)) {
    return true;
  }
  
  // Check description for common prop keywords
  return PROP_KEYWORDS.some(keyword => 
    new RegExp(`\\b${keyword}\\b`, 'i').test(bet.description)
  );
}

/**
 * Checks if a bet is a main market bet based on bet-level fields.
 * @internal
 */
function isMainMarket(bet: Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'>): boolean {
  if (MAIN_MARKET_KEYWORDS.some(keyword => 
    new RegExp(`\\b${keyword}\\b`, 'i').test(bet.description)
  )) {
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
function isFutureBet(description: string): boolean {
  return FUTURES_KEYWORDS.some(keyword => 
    new RegExp(`\\b${keyword}\\b`, 'i').test(description)
  );
}

/**
 * Checks if market text indicates a futures market.
 * @internal
 */
function isFutureMarket(lowerMarket: string): boolean {
  return FUTURES_KEYWORDS.some(keyword => lowerMarket.includes(keyword));
}

/**
 * Checks if market text indicates a main market.
 * @internal
 */
function isMainMarketText(lowerMarket: string): boolean {
  return MAIN_MARKET_KEYWORDS.some(keyword => lowerMarket.includes(keyword));
}

/**
 * Checks if market text indicates a prop market.
 * @internal
 */
function isPropMarket(lowerMarket: string, sport: string): boolean {
  // Check prop keywords
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
