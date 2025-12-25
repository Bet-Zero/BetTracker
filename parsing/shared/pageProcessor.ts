/**
 * Page Processor V2 - Simplified Architecture
 * 
 * Routes HTML to the appropriate parser and returns Bet objects directly.
 * Uses Result<T> pattern for consistent error handling across the pipeline.
 */

import { SportsbookName, Bet } from '../../types';
import { parse as parseFanDuel } from '../fanduel/fanduel';
import { parse as parseDraftKings } from '../draftkings/parsers';
import { 
  Result, 
  ImportError, 
  ok, 
  err, 
  createImportError, 
  getErrorMessage 
} from '../../services/errors';

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
 * Error handling:
 * - EMPTY_HTML: HTML is empty or whitespace-only
 * - NO_BETS_FOUND: Parser ran but found no bets
 * - PARSER_NOT_AVAILABLE: No parser exists for the sportsbook
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

  let parsedBets: Bet[] = [];
  
  try {
    switch (book) {
      case 'FanDuel':
        parsedBets = parseFanDuel(html);
        break;
      case 'DraftKings':
        parsedBets = parseDraftKings(html);
        break;
      case 'Other':
        return err(createImportError(
          'PARSER_NOT_AVAILABLE',
          'Parsing for "Other" sportsbooks is not yet implemented.'
        ));
      default:
        return err(createImportError(
          'PARSER_NOT_AVAILABLE',
          `No parser available for sportsbook: ${book}.`
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
