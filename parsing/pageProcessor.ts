import { SportsbookName, Bet } from '../types';
import { parse as parseFanDuel } from './parsers/fanduel';
import { parse as parseDraftKings } from './parsers/draftkings';

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
        parsedBets = parseDraftKings(html);
        break;
      case 'Other':
        // A generic parser or a user-defined parser could be called here.
        console.warn('Parsing for "Other" is not implemented.');
        break;
      default:
        console.warn(`No specific parser available for sportsbook: ${book}. A generic attempt can be made here in the future.`);
        break;
    }
  } catch (error) {
    console.error(`Error parsing data for ${book}:`, error);
    alert(`An error occurred while parsing the page for ${book}. Check the console for details.`);
    return [];
  }

  return parsedBets;
};
