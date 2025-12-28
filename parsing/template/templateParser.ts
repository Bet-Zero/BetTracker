/**
 * Template Parser - Minimal Example for New Sportsbook Implementations
 * 
 * This file demonstrates the contract-compliant structure for a sportsbook parser.
 * Use this as a starting point when implementing a new parser.
 * 
 * IMPORTANT: This template is NOT a working parser. It returns a clear error
 * indicating that the parser is not implemented. Do NOT register this as an
 * enabled parser in parserRegistry.ts.
 * 
 * @module parsing/template/templateParser
 */

import { Bet, BetResult, BetType, MarketCategory, BetLeg, LegResult } from '../../types';
import { 
  Result, 
  ImportError, 
  ok, 
  err, 
  createImportError 
} from '../../services/errors';
import { 
  ParserFunction, 
  ResultParserFunction,
  validateBetContract 
} from '../parserContract';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Sportsbook name - update for your implementation */
const SPORTSBOOK_NAME = 'TemplateSportsbook';

/** Enable debug logging (set via environment or constant for development) */
const DEBUG = false;

// ============================================================================
// DEBUG HELPER
// ============================================================================

/**
 * Debug logging helper. Enable by setting DEBUG = true.
 */
function debug(...args: unknown[]): void {
  if (DEBUG) {
    console.log(`[${SPORTSBOOK_NAME} Parser]`, ...args);
  }
}

// ============================================================================
// MAIN PARSER FUNCTION
// ============================================================================

/**
 * Main parser entry point.
 * 
 * This is the function exported for use by pageProcessor.ts.
 * It follows the Result<Bet[]> pattern for proper error handling.
 * 
 * @param html - Raw HTML content from the sportsbook's settled bets page
 * @returns Result<Bet[]> - Either parsed bets or a typed error
 * 
 * IMPLEMENTATION GUIDE:
 * 1. Validate input HTML (check for empty/invalid content)
 * 2. Parse HTML using DOMParser
 * 3. Find bet card containers
 * 4. For each bet card:
 *    a. Extract header info (description, odds, sport, etc.)
 *    b. Extract footer info (betId, placedAt, stake, payout, result)
 *    c. Extract leg details (entities, markets, targets, leg results)
 *    d. Determine betType based on leg count and structure
 *    e. Build fully populated Bet object
 * 5. Return ok(bets) or err(importError)
 */
export const parseTemplateSportsbook: ResultParserFunction = (html: string): Result<Bet[]> => {
  debug('parseTemplateSportsbook called with', html.length, 'chars');
  
  // -------------------------------------------------------------------------
  // Step 1: Input Validation
  // -------------------------------------------------------------------------
  if (!html || !html.trim()) {
    return err(createImportError(
      'EMPTY_HTML',
      'Please paste the page source HTML. The content appears to be empty.'
    ));
  }
  
  // -------------------------------------------------------------------------
  // Step 2: Check for parser implementation
  // -------------------------------------------------------------------------
  // TEMPLATE: This is where you would implement actual parsing logic.
  // Since this is a template, we return a clear "not implemented" error.
  //
  // Remove this error and implement parsing when creating a real parser.
  
  return err(createImportError(
    'PARSER_NOT_AVAILABLE',
    `The ${SPORTSBOOK_NAME} parser is a template and not implemented. ` +
    'Use FanDuel or DraftKings parser as a reference implementation.'
  ));
  
  // -------------------------------------------------------------------------
  // TEMPLATE CODE BELOW - Uncomment and customize when implementing
  // -------------------------------------------------------------------------
  
  /*
  // Step 2: Parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Step 3: Find bet containers
  // Update selector based on sportsbook's HTML structure
  const betCards = doc.querySelectorAll('.bet-card-selector');
  
  if (betCards.length === 0) {
    return err(createImportError(
      'NO_BETS_FOUND',
      `No bets were found in the HTML. Make sure you copied the full page source from your ${SPORTSBOOK_NAME} settled bets page.`
    ));
  }
  
  const bets: Bet[] = [];
  
  // Step 4: Process each bet card
  for (const card of betCards) {
    try {
      const bet = parseBetCard(card as HTMLElement);
      if (bet) {
        // Validate before adding
        const validation = validateBetContract(bet, SPORTSBOOK_NAME);
        if (!validation.isValid) {
          debug('Skipping invalid bet:', validation.errors);
          continue;
        }
        bets.push(bet);
      }
    } catch (error) {
      debug('Error parsing bet card:', error);
      // Continue processing other bets
    }
  }
  
  if (bets.length === 0) {
    return err(createImportError(
      'NO_BETS_FOUND',
      'Found bet cards but could not parse any valid bets. Check HTML format.'
    ));
  }
  
  return ok(bets);
  */
};

// ============================================================================
// HELPER FUNCTIONS (Templates for implementation)
// ============================================================================

/**
 * Parses a single bet card element into a Bet object.
 * 
 * @param card - HTMLElement containing the bet card
 * @returns Bet object or null if parsing fails
 */
function parseBetCard(_card: HTMLElement): Bet | null {
  // TEMPLATE: Implement bet card parsing
  // 
  // Example structure:
  // const betId = extractBetId(card);
  // const placedAt = extractPlacedAt(card);
  // const stake = extractStake(card);
  // const payout = extractPayout(card);
  // const result = inferResult(stake, payout);
  // const legs = extractLegs(card);
  // const betType = inferBetType(legs);
  // const marketCategory = inferMarketCategory(betType, legs);
  // const sport = extractSport(card);
  // const description = buildDescription(legs, betType);
  // 
  // return {
  //   id: `${SPORTSBOOK_NAME}:${betId}:${placedAt}`,
  //   book: SPORTSBOOK_NAME,
  //   betId,
  //   placedAt,
  //   betType,
  //   marketCategory,
  //   sport,
  //   description,
  //   odds: extractOdds(card),
  //   stake,
  //   payout,
  //   result,
  //   legs,
  // };
  
  return null;
}

/**
 * Extracts bet legs from a bet card.
 * 
 * @param card - HTMLElement containing the bet card
 * @returns Array of BetLeg objects
 */
function extractLegs(_card: HTMLElement): BetLeg[] {
  // TEMPLATE: Implement leg extraction
  //
  // For each leg, extract:
  // - entities: Player or team names
  // - entityType: "player" | "team" | "unknown"
  // - market: Stat type or market type
  // - target: Line/threshold value
  // - ou: Over/Under indicator
  // - odds: Leg-specific odds (null for SGP inner legs)
  // - result: "WIN" | "LOSS" | "PUSH" | "PENDING"
  //
  // Example:
  // const legElements = card.querySelectorAll('.leg-selector');
  // return Array.from(legElements).map(el => ({
  //   entities: [extractEntity(el)],
  //   entityType: inferEntityType(el),
  //   market: extractMarket(el),
  //   target: extractTarget(el),
  //   ou: extractOverUnder(el),
  //   odds: extractLegOdds(el),
  //   result: extractLegResult(el),
  // }));
  
  return [];
}

/**
 * Infers entity type from market context.
 * 
 * @param market - The market type string
 * @returns "player" | "team" | "unknown"
 */
function inferEntityType(market: string): 'player' | 'team' | 'unknown' {
  const marketLower = market.toLowerCase();
  
  // Player prop indicators
  const playerMarkets = [
    'pts', 'points', 'reb', 'rebounds', 'ast', 'assists',
    '3pt', 'threes', 'stl', 'steals', 'blk', 'blocks',
    'passing', 'rushing', 'receiving', 'hits', 'strikeouts'
  ];
  
  // Team/main market indicators
  const teamMarkets = [
    'spread', 'moneyline', 'total', 'ml', 'line'
  ];
  
  if (playerMarkets.some(p => marketLower.includes(p))) {
    return 'player';
  }
  
  if (teamMarkets.some(t => marketLower.includes(t))) {
    return 'team';
  }
  
  return 'unknown';
}

/**
 * Infers bet type from legs structure.
 * 
 * @param legs - Array of bet legs
 * @returns BetType
 */
function inferBetType(legs: BetLeg[]): BetType {
  if (legs.length === 0) return 'other';
  if (legs.length === 1) {
    // Check if single leg is a group leg (SGP)
    if (legs[0].isGroupLeg && legs[0].children && legs[0].children.length > 1) {
      return 'sgp';
    }
    return 'single';
  }
  
  // Check for SGP+ (has at least one group leg)
  const hasGroupLeg = legs.some(leg => leg.isGroupLeg);
  if (hasGroupLeg) {
    return 'sgp_plus';
  }
  
  return 'parlay';
}

/**
 * Infers market category from bet type and legs.
 * 
 * @param betType - The bet type
 * @param legs - Array of bet legs
 * @returns MarketCategory
 */
function inferMarketCategory(betType: BetType, legs: BetLeg[]): MarketCategory {
  // All parlay types (parlay, SGP, SGP+) are categorized as 'Parlays'
  if (betType === 'parlay' || betType === 'sgp' || betType === 'sgp_plus') {
    return 'Parlays';
  }
  
  // For singles, check the leg's entity type
  if (legs.length > 0) {
    const leg = legs[0];
    const entityType = leg.entityType;
    
    if (entityType === 'player') {
      return 'Props';
    }
    
    if (entityType === 'team') {
      return 'Main Markets';
    }
  }
  
  // Default fallback
  return 'Props';
}

/**
 * Infers bet result from stake and payout.
 * 
 * @param stake - Wager amount
 * @param payout - Payout amount
 * @returns BetResult
 */
function inferResult(stake: number, payout: number): BetResult {
  if (payout === 0) return 'loss';
  if (payout > stake) return 'win';
  if (Math.abs(payout - stake) < 0.01) return 'push';
  return 'pending';
}

/**
 * Removes duplicate legs based on entity + market + target.
 * 
 * @param legs - Array of bet legs
 * @returns Deduplicated array
 */
function dedupeLegs(legs: BetLeg[]): BetLeg[] {
  const seen = new Set<string>();
  return legs.filter(leg => {
    const key = [
      leg.entities?.join(',') || '',
      leg.market || '',
      String(leg.target || '')
    ].join('|');
    
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Main parser export (Result pattern).
 * Use this for new code that expects proper error handling.
 */
export const parse = parseTemplateSportsbook;

/**
 * Legacy parser export (Bet[] return).
 * Wraps the Result parser for backward compatibility.
 * 
 * @deprecated Use parse (Result pattern) for new implementations
 */
export const parseLegacy: (html: string) => Bet[] = (html: string) => {
  const result = parseTemplateSportsbook(html);
  if (result.ok) {
    return result.value;
  }
  // Legacy behavior: return empty array on error
  debug('Parse error:', result.error);
  return [];
};

export default parse;
