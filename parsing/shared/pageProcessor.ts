/**
 * Page Processor V2 - Simplified Architecture
 * 
 * Routes HTML to the appropriate parser and returns Bet objects directly.
 * Uses Result<T> pattern for consistent error handling across the pipeline.
 * 
 * Parser discovery is now centralized in parserRegistry.ts. To add a new
 * sportsbook parser, register it there - no changes needed here.
 * 
 * SECURITY NOTE:
 * - Input size is validated before parsing to prevent memory/performance issues.
 * - DOMParser is used safely in an in-memory context (scripts are not executed).
 * - Raw HTML is never stored in localStorage or rendered via innerHTML.
 */

import { SportsbookName, Bet } from '../../types';
import { 
  Result, 
  ok, 
  err, 
  createImportError, 
  getErrorMessage 
} from '../../services/errors';
import {
  isParserEnabled,
  getParser,
  getParserUnavailableMessage
} from '../parserRegistry';

/** Conversion factor for bytes to megabytes */
const CHARS_PER_MB = 1024 * 1024;

/**
 * Maximum allowed input size in characters.
 * 5MB is generous for page source HTML while preventing memory issues.
 * Typical sportsbook bet history pages are 500KB-2MB.
 */
export const MAX_INPUT_SIZE_CHARS = 5 * CHARS_PER_MB; // 5MB in characters

/**
 * Legacy ParseResult interface for backward compatibility.
 * @deprecated Use Result<Bet[]> instead.
 */
export interface ParseResult {
  bets: Bet[];
  error?: string;
}

/**
 * Processes HTML from a sportsbook page and returns parsed bets using Result pattern.
 * 
 * Uses the parser registry to look up parsers, making it easy to add new
 * sportsbooks without modifying this file.
 * 
 * Error handling:
 * - EMPTY_HTML: HTML is empty or whitespace-only
 * - INPUT_TOO_LARGE: Input exceeds MAX_INPUT_SIZE_CHARS (security guardrail)
 * - NO_BETS_FOUND: Parser ran but found no bets
 * - PARSER_NOT_AVAILABLE: No parser exists or parser is disabled for the sportsbook
 * - PARSER_FAILED: Parser threw an unexpected error
 * 
 * @param book - The sportsbook name
 * @param html - Raw HTML content
 * @returns Result<Bet[]> with either parsed bets or an ImportError
 */
export const processPageResult = (book: SportsbookName, html: string): Result<Bet[]> => {
  // Check for empty HTML
  if (!html || !html.trim()) {
    return err(createImportError(
      'EMPTY_HTML',
      getErrorMessage('EMPTY_HTML')
    ));
  }

  // SECURITY: Check input size before parsing to prevent memory/performance issues
  if (html.length > MAX_INPUT_SIZE_CHARS) {
    const sizeMB = (html.length / CHARS_PER_MB).toFixed(1);
    const maxMB = (MAX_INPUT_SIZE_CHARS / CHARS_PER_MB).toFixed(0);
    return err(createImportError(
      'INPUT_TOO_LARGE',
      getErrorMessage('INPUT_TOO_LARGE'),
      `Input size: ${sizeMB}MB exceeds maximum of ${maxMB}MB. Copy a smaller range of bets or export in batches.`
    ));
  }

  // Check if parser is available and enabled
  if (!isParserEnabled(book)) {
    const message = getParserUnavailableMessage(book);
    return err(createImportError(
      'PARSER_NOT_AVAILABLE',
      message
    ));
  }

  // Get the parser function
  const parser = getParser(book);
  if (!parser) {
    // This shouldn't happen if isParserEnabled returned true, but handle it anyway
    return err(createImportError(
      'PARSER_NOT_AVAILABLE',
      `No parser available for sportsbook: ${book}.`
    ));
  }

  let parsedBets: Bet[] = [];
  
  try {
    const result = parser(html);
    
    // Handle both Result<Bet[]> and Bet[] return types
    if (Array.isArray(result)) {
      // Legacy parser returning Bet[]
      parsedBets = result;
    } else if ('ok' in result) {
      // Result pattern parser
      if (!result.ok) {
        return result; // Pass through the error
      }
      parsedBets = result.value;
    } else {
      // Unknown return type
      return err(createImportError(
        'PARSER_FAILED',
        `Parser for ${book} returned an unexpected format.`
      ));
    }
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error(`Error parsing data for ${book}:`, error);
    return err(createImportError(
      'PARSER_FAILED',
      getErrorMessage('PARSER_FAILED'),
      `${book} parser error: ${errorDetails}`
    ));
  }

  // Check for no bets found
  if (parsedBets.length === 0) {
    return err(createImportError(
      'NO_BETS_FOUND',
      `${getErrorMessage('NO_BETS_FOUND')} (${book})`
    ));
  }

  return ok(parsedBets);
};

/**
 * Legacy processPage function for backward compatibility.
 * Converts Result<Bet[]> to ParseResult format.
 * 
 * @deprecated Use processPageResult for new code.
 * @param book - The sportsbook name
 * @param html - Raw HTML content
 * @returns ParseResult with bets array and optional error message
 */
export const processPage = (book: SportsbookName, html: string): ParseResult => {
  const result = processPageResult(book, html);
  
  if (result.ok) {
    return { bets: result.value };
  }
  
  return {
    bets: [],
    error: result.error.message,
  };
};
