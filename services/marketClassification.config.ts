/**
 * Market Classification Configuration
 * 
 * This file contains all keyword lists and mapping constants used for
 * market classification. Separated from the main service for easier
 * maintenance and testing.
 * 
 * All keyword matching is case-insensitive with word boundary detection
 * to prevent false positives (e.g., "spread" won't match "widespread").
 */

// ============================================================================
// KEYWORD LISTS
// ============================================================================

/**
 * Keywords that indicate a Futures bet.
 * 
 * Used to identify bets on long-term outcomes like championships, awards,
 * and season-long propositions.
 * 
 * Matching: Case-insensitive, word boundary detection
 * 
 * Examples:
 * - "Lakers to win NBA Finals" → Futures
 * - "LeBron James MVP" → Futures
 * - "Lakers Win Total Over 52.5" → Futures
 * 
 * @constant {ReadonlyArray<string>}
 */
export const FUTURES_KEYWORDS = [
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
 * 
 * Used to identify standard game outcome bets like spreads, totals,
 * and moneylines. These are the most common bet types for team-based
 * wagering on game outcomes.
 * 
 * Matching: Case-insensitive, word boundary detection
 * 
 * Examples:
 * - "Lakers Spread -7.5" → Main Markets
 * - "Total Over 220.5" → Main Markets
 * - "Lakers Moneyline" → Main Markets
 * 
 * @constant {ReadonlyArray<string>}
 */
export const MAIN_MARKET_KEYWORDS = [
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
 * 
 * Used to identify player or team proposition bets on specific
 * statistics or achievements within a game.
 * 
 * Matching: Case-insensitive, word boundary detection
 * 
 * Examples:
 * - "LeBron James Points Over 25.5" → Props
 * - "Triple Double" → Props
 * - "Patrick Mahomes Passing Yards" → Props
 * 
 * Note: Keywords are ordered with longer phrases first to ensure
 * more specific matches take precedence (e.g., "triple double" before "double").
 * 
 * @constant {ReadonlyArray<string>}
 */
export const PROP_KEYWORDS = [
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

// ============================================================================
// TYPE MAPPINGS
// ============================================================================

/**
 * Sport-specific stat type mappings for Props category.
 * 
 * IMPORTANT: This is for CLASSIFICATION PATTERN MATCHING, not normalization.
 * 
 * Purpose: Maps market TEXT PATTERNS to stat type codes during classification.
 * For example, when classifying "Player Points Rebounds Assists", we match
 * "points rebounds assists" → "PRA" to determine the bet type.
 * 
 * This is intentionally separate from normalization (services/normalizationService.ts)
 * which maps ALIASES to CANONICAL names (e.g., "Rebounds" → "Reb").
 * 
 * - Classification needs: "points rebounds assists" → "PRA" (pattern matching)
 * - Normalization needs: "Rebounds", "Rebs", "REB" → "Reb" (alias resolution)
 * 
 * Patterns are matched case-insensitively as substrings.
 * Note: Patterns are checked in order, so more specific patterns
 * (like "points rebounds assists") should appear before less specific
 * ones (like "points").
 * 
 * @constant {Record<string, Record<string, string>>}
 */
export const STAT_TYPE_MAPPINGS: Record<string, Record<string, string>> = {
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
 * 
 * Maps market text patterns to standardized main market type names.
 * Used to determine the specific type within the Main Markets category.
 * 
 * Matching: Case-insensitive substring matching
 * 
 * Usage:
 * - Input: "Lakers Spread -7.5", Category: "Main Markets"
 * - Pattern match: "spread" → "Spread"
 * - Output: Type = "Spread"
 * 
 * @constant {Record<string, string>}
 */
export const MAIN_MARKET_TYPES: Record<string, string> = {
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
 * 
 * Maps market text patterns to standardized futures type names.
 * Used to determine the specific type within the Futures category.
 * 
 * Matching: Case-insensitive substring matching
 * 
 * Usage:
 * - Input: "Lakers to win NBA Finals", Category: "Futures"
 * - Pattern match: "nba finals" → "NBA Finals"
 * - Output: Type = "NBA Finals"
 * 
 * @constant {Record<string, string>}
 */
export const FUTURES_TYPES: Record<string, string> = {
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

/**
 * Basketball sports that treat "TD" as Triple-Double.
 * 
 * Used to determine context-specific classification of "TD" market text.
 * In basketball leagues, TD means Triple-Double (a prop bet).
 * In football leagues, TD means Touchdown (also a prop bet but with different handling).
 * 
 * @constant {ReadonlyArray<string>}
 */
export const BASKETBALL_SPORTS = ['NBA', 'WNBA', 'CBB', 'NCAAB'] as const;
