/**
 * Page Processor V2 - Simplified Architecture
 * 
 * Routes HTML to the appropriate parser and returns Bet objects directly.
 * No intermediate transformations.
 */

import { SportsbookName, Bet } from '../../types';
import { parse as parseFanDuel } from '../fanduel/fanduel';
import { parse as parseDraftKings } from '../draftkings/parsers';

/**
 * Processes HTML from a sportsbook page and returns parsed bets.
 * @param book - The sportsbook name
 * @param html - Raw HTML content
 * @returns Array of Bet objects ready for storage
 */
export interface ParseResult {
  bets: Bet[];
  error?: string;
}

/**
 * Processes HTML from a sportsbook page and returns parsed bets with error information
 * @param book - The sportsbook name
 * @param html - Raw HTML content
 * @returns Parse result with bets array and optional error message
 */
export const processPage = (book: SportsbookName, html: string): ParseResult => {
  if (!html || !html.trim()) {
    return {
      bets: [],
      error: 'HTML content is empty. Please make sure you copied the full page source.',
    };
  }

  let parsedBets: Bet[] = [];
  try {
    switch (book) {
      case 'FanDuel':
        parsedBets = parseFanDuel(html);
        if (parsedBets.length === 0) {
          return {
            bets: [],
            error: 'Could not find any bets in the HTML. Make sure you copied the full page source from your FanDuel settled bets page.',
          };
        }
        break;
      case 'DraftKings':
        // Using the old parser as placeholder until v2 is implemented
        parsedBets = parseDraftKings(html);
        if (parsedBets.length === 0) {
          return {
            bets: [],
            error: 'Could not find any bets in the HTML. Make sure you copied the full page source from your DraftKings settled bets page. Note: DraftKings parser is currently a placeholder and may not work with real HTML.',
          };
        }
        break;
      case 'Other':
        return {
          bets: [],
          error: 'Parsing for "Other" sportsbooks is not yet implemented.',
        };
      default:
        return {
          bets: [],
          error: `No parser available for sportsbook: ${book}.`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error parsing data for ${book}:`, error);
    return {
      bets: [],
      error: `Failed to parse ${book} HTML: ${errorMessage}. Please check that you copied the correct page source.`,
    };
  }

  return { bets: parsedBets };
};
