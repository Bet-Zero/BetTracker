/**
 * Parser Contract - Single Source of Truth for Sportsbook Parsers
 * 
 * This module defines the contract that ALL sportsbook parsers must satisfy.
 * Use this as the authoritative reference when implementing new parsers.
 * 
 * @module parsing/parserContract
 */

import { Bet, BetLeg, BetResult, BetType, MarketCategory, LegResult } from '../types';
import { Result, ImportError } from '../services/errors';

// ============================================================================
// PARSER FUNCTION SIGNATURE
// ============================================================================

/**
 * Parser function type signature.
 * 
 * All sportsbook parsers MUST export a function matching this signature.
 * The function receives raw HTML content and returns either:
 * - A successful Result containing parsed Bet[] array
 * - A failed Result containing a typed ImportError
 * 
 * @param html - Raw HTML content from the sportsbook's settled bets page
 * @returns Result<Bet[]> - Either parsed bets or a typed error
 * 
 * @example
 * // Parser implementation
 * export const parseFanDuel: ParserFunction = (html: string): Result<Bet[]> => {
 *   if (!html.trim()) {
 *     return err(createImportError('EMPTY_HTML', 'HTML content is empty'));
 *   }
 *   // ... parsing logic
 *   return ok(bets);
 * };
 * 
 * // Legacy parsers that return Bet[] directly are also supported
 * // but should be migrated to Result<Bet[]> pattern
 */
export type ParserFunction = (html: string) => Bet[] | Result<Bet[]>;

/**
 * Parser function that returns Result<Bet[]> (preferred pattern).
 * New parsers SHOULD use this signature for proper error handling.
 */
export type ResultParserFunction = (html: string) => Result<Bet[]>;

/**
 * Legacy parser function that returns Bet[] directly.
 * Existing parsers may use this pattern. Errors are handled by try/catch
 * in pageProcessor. Migration to ResultParserFunction is recommended.
 */
export type LegacyParserFunction = (html: string) => Bet[];

// ============================================================================
// REQUIRED BET FIELDS
// ============================================================================

/**
 * Required fields for every Bet object.
 * Parsers MUST populate all of these fields.
 * 
 * See PARSER_TARGET_FIELDS.md for detailed documentation.
 */
export const REQUIRED_BET_FIELDS = [
  'id',           // Unique identifier: "{book}:{betId}:{placedAt}"
  'book',         // Sportsbook name (e.g., "FanDuel", "DraftKings")
  'betId',        // Sportsbook's bet identifier
  'placedAt',     // ISO 8601 timestamp
  'betType',      // "single" | "parlay" | "sgp" | "sgp_plus" | "live" | "other"
  'marketCategory', // "Props" | "Main Markets" | "Futures" | "SGP/SGP+" | "Parlays"
  'sport',        // Sport name (e.g., "NBA", "NFL")
  'description',  // Human-readable bet description
  'odds',         // American odds (number, can be null for certain bet types)
  'stake',        // Wager amount (number > 0)
  'payout',       // Total payout (number >= 0)
  'result',       // "win" | "loss" | "push" | "pending"
  'legs',         // Non-empty BetLeg[] array
] as const;

/**
 * Valid bet result values (lowercase).
 */
export const VALID_BET_RESULTS: BetResult[] = ['win', 'loss', 'push', 'pending'];

/**
 * Valid bet type values.
 */
export const VALID_BET_TYPES: BetType[] = ['single', 'parlay', 'sgp', 'sgp_plus', 'live', 'other'];

/**
 * Valid market category values.
 */
export const VALID_MARKET_CATEGORIES: MarketCategory[] = [
  'Props',
  'Main Markets', 
  'Futures',
  'SGP/SGP+',
  'Parlays'
];

// ============================================================================
// REQUIRED LEG FIELDS
// ============================================================================

/**
 * Required fields for BetLeg objects.
 * Note: Different bet types have different requirements.
 */
export const REQUIRED_LEG_FIELDS = [
  'market',       // Market type (e.g., "Pts", "Spread", "Moneyline")
] as const;

/**
 * Optional but recommended leg fields.
 */
export const RECOMMENDED_LEG_FIELDS = [
  'entities',     // Player/team names involved
  'entityType',   // "player" | "team" | "unknown" - IMPORTANT for downstream
  'target',       // Line/threshold value
  'ou',           // Over/Under indicator
  'odds',         // Leg-specific odds (null for SGP inner legs)
  'result',       // Leg outcome (uppercase: "WIN", "LOSS", "PUSH", "PENDING")
] as const;

/**
 * Valid leg result values (uppercase).
 */
export const VALID_LEG_RESULTS: LegResult[] = ['WIN', 'LOSS', 'PUSH', 'PENDING', 'UNKNOWN'];

/**
 * Valid entity types for bet legs.
 */
export const VALID_ENTITY_TYPES = ['player', 'team', 'unknown'] as const;
export type EntityType = typeof VALID_ENTITY_TYPES[number];

// ============================================================================
// PARSER RESPONSIBILITIES
// ============================================================================

/**
 * Parser Responsibilities Checklist
 * 
 * Every parser implementation MUST handle these responsibilities:
 * 
 * 1. DEDUPLICATION
 *    - Remove duplicate legs before returning
 *    - Use entity names + market + target for dedup key
 *    - Call dedupeLegs() helper or implement equivalent logic
 * 
 * 2. ENTITY TYPE CLASSIFICATION  
 *    - Set `entityType` on each leg ("player", "team", or "unknown")
 *    - Use market context to determine type:
 *      - Player props → entityType: "player"
 *      - Spread/Total/Moneyline → entityType: "team"
 *      - Ambiguous markets → entityType: "unknown"
 *    - NEVER leave entityType undefined for new parsers
 * 
 * 3. MARKET CATEGORY ASSIGNMENT
 *    - Set `marketCategory` on each bet
 *    - Use bet structure to determine:
 *      - Single player prop → "Props"
 *      - Spread/Total/ML → "Main Markets"
 *      - Season-long → "Futures"
 *      - SGP/SGP+ → "SGP/SGP+"
 *      - Multi-game parlay → "Parlays"
 * 
 * 4. DATE NORMALIZATION
 *    - Parse sportsbook date formats to ISO 8601
 *    - Handle timezone conversions
 *    - Store in `placedAt` field
 * 
 * 5. AMOUNT NORMALIZATION
 *    - Parse currency strings (remove $, commas)
 *    - Convert to numbers
 *    - Validate: stake > 0, payout >= 0
 * 
 * 6. RESULT DETECTION
 *    - Map sportsbook indicators to standard values
 *    - Bet results: lowercase ("win", "loss", "push", "pending")
 *    - Leg results: uppercase ("WIN", "LOSS", "PUSH", "PENDING")
 * 
 * 7. ID GENERATION
 *    - Format: "{book}:{betId}:{placedAt}"
 *    - Must be unique and deterministic
 * 
 * 8. ERROR HANDLING
 *    - Return typed ImportError on failure
 *    - Use error codes from services/errors.ts
 *    - Never throw for expected failures
 */

// ============================================================================
// CONTRACT VALIDATION
// ============================================================================

/**
 * Validation result for a single bet.
 */
export interface BetValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates a bet object against the parser contract.
 * Use this for testing and debugging parser output.
 * 
 * @param bet - The bet object to validate
 * @param sportsbook - Sportsbook name for error messages
 * @returns Validation result with errors and warnings
 */
export function validateBetContract(bet: Bet, sportsbook: string): BetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!bet.id) errors.push(`${sportsbook}: Missing bet.id`);
  if (!bet.book) errors.push(`${sportsbook}: Missing bet.book`);
  if (!bet.betId) errors.push(`${sportsbook}: Missing bet.betId`);
  if (!bet.placedAt) errors.push(`${sportsbook}: Missing bet.placedAt`);
  if (!bet.betType) errors.push(`${sportsbook}: Missing bet.betType`);
  if (!bet.sport) errors.push(`${sportsbook}: Missing bet.sport`);
  if (!bet.description) errors.push(`${sportsbook}: Missing bet.description`);
  if (bet.stake === undefined || bet.stake === null) errors.push(`${sportsbook}: Missing bet.stake`);
  if (bet.payout === undefined || bet.payout === null) errors.push(`${sportsbook}: Missing bet.payout`);
  if (!bet.result) errors.push(`${sportsbook}: Missing bet.result`);
  
  // Type validations
  if (typeof bet.stake !== 'number' || bet.stake <= 0) {
    errors.push(`${sportsbook}: Invalid stake (must be positive number)`);
  }
  if (typeof bet.payout !== 'number' || bet.payout < 0) {
    errors.push(`${sportsbook}: Invalid payout (must be non-negative number)`);
  }
  if (bet.odds !== undefined && bet.odds !== null && typeof bet.odds !== 'number') {
    errors.push(`${sportsbook}: Invalid odds type (must be number or null)`);
  }
  
  // Date validation
  if (bet.placedAt) {
    const date = new Date(bet.placedAt);
    if (isNaN(date.getTime())) {
      errors.push(`${sportsbook}: Invalid placedAt date`);
    }
  }
  
  // Enum validations
  if (bet.result && !VALID_BET_RESULTS.includes(bet.result)) {
    errors.push(`${sportsbook}: Invalid result value "${bet.result}"`);
  }
  if (bet.betType && !VALID_BET_TYPES.includes(bet.betType)) {
    errors.push(`${sportsbook}: Invalid betType value "${bet.betType}"`);
  }
  
  // Market category
  if (!bet.marketCategory) {
    warnings.push(`${sportsbook}: Missing marketCategory`);
  } else if (!VALID_MARKET_CATEGORIES.includes(bet.marketCategory)) {
    errors.push(`${sportsbook}: Invalid marketCategory value "${bet.marketCategory}"`);
  }
  
  // Legs validation
  if (!bet.legs || !Array.isArray(bet.legs)) {
    errors.push(`${sportsbook}: Missing or invalid legs array`);
  } else if (bet.legs.length === 0) {
    errors.push(`${sportsbook}: Empty legs array`);
  } else {
    // Validate leg structure
    bet.legs.forEach((leg, index) => {
      if (!leg.market) {
        errors.push(`${sportsbook}: Leg ${index} missing market`);
      }
      
      // Check entityType
      if (leg.entityType === undefined) {
        warnings.push(`${sportsbook}: Leg ${index} missing entityType (should be set for new parsers)`);
      } else if (!VALID_ENTITY_TYPES.includes(leg.entityType)) {
        errors.push(`${sportsbook}: Leg ${index} invalid entityType "${leg.entityType}"`);
      }
      
      // Check leg result format (should be uppercase)
      if (leg.result && typeof leg.result === 'string') {
        const upper = leg.result.toUpperCase();
        // Type-safe check: verify upper is in VALID_LEG_RESULTS before warning
        const isValidUppercase = (VALID_LEG_RESULTS as readonly string[]).includes(upper);
        if (leg.result !== upper && isValidUppercase) {
          warnings.push(`${sportsbook}: Leg ${index} result should be uppercase ("${upper}" not "${leg.result}")`);
        }
      }
      
      // Validate children for group legs
      if (leg.isGroupLeg && leg.children) {
        if (!Array.isArray(leg.children) || leg.children.length === 0) {
          errors.push(`${sportsbook}: Leg ${index} is group leg but has empty/invalid children`);
        }
      }
    });
    
    // Bet type vs legs count validation
    if (bet.betType === 'single' && bet.legs.length !== 1) {
      warnings.push(`${sportsbook}: Single bet should have exactly 1 leg, has ${bet.legs.length}`);
    }
    if (bet.betType === 'parlay' && bet.legs.length < 2) {
      warnings.push(`${sportsbook}: Parlay should have 2+ legs, has ${bet.legs.length}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates multiple bets and returns summary.
 */
export function validateBetsContract(bets: Bet[], sportsbook: string): {
  totalBets: number;
  validBets: number;
  invalidBets: number;
  allErrors: string[];
  allWarnings: string[];
} {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  let validBets = 0;
  let invalidBets = 0;
  
  for (const bet of bets) {
    const result = validateBetContract(bet, sportsbook);
    if (result.isValid) {
      validBets++;
    } else {
      invalidBets++;
    }
    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }
  
  return {
    totalBets: bets.length,
    validBets,
    invalidBets,
    allErrors,
    allWarnings
  };
}
