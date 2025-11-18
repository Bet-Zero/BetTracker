/**
 * Page Processor V2 - Simplified Architecture
 * 
 * Routes HTML to the appropriate parser and returns Bet objects directly.
 * No intermediate transformations.
 */

import { SportsbookName, Bet } from '../types';
import { parse as parseFanDuel } from './parsers/fanduel-v2';

/**
 * Processes HTML from a sportsbook page and returns parsed bets.
 * @param book - The sportsbook name
 * @param html - Raw HTML content
 * @returns Array of Bet objects ready for storage
 */
export const processPage = (book: SportsbookName, html: string): Bet[] => {
  if (!html) {
    console.warn("HTML content is empty, skipping parse.");
    return [];
  }

  let parsedBets: Bet[] = [];
  try {
    switch (book) {
      case 'FanDuel':
        parsedBets = parseFanDuel(html);
        break;
      case 'DraftKings':
        // TODO: Implement DraftKings v2 parser
        console.warn('DraftKings parser v2 not yet implemented.');
        break;
      case 'Other':
        console.warn('Parsing for "Other" is not implemented.');
        break;
      default:
        console.warn(`No specific parser available for sportsbook: ${book}.`);
        break;
    }
  } catch (error) {
    console.error(`Error parsing data for ${book}:`, error);
    // Optionally, handle error notification via a toast/snackbar in the calling component.
    return [];
  }

  return parsedBets;
};
