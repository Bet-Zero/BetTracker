/**
 * Converts FinalRow (normalized spreadsheet format) back to Bet (internal storage format).
 * This bridges the new parsing system with the existing storage/display system.
 */

import { FinalRow } from '../types';
import { Bet, BetResult, BetType } from '../types';

/**
 * Converts a FinalRow to a Bet object for internal storage.
 */
export function convertFinalRowToBet(finalRow: FinalRow): Bet {
  // Parse date from MM/DD/YY to ISO timestamp
  const placedAt = parseDateToISO(finalRow.Date);

  // Parse odds from string to number
  const odds = parseOddsToNumber(finalRow.Odds);

  // Parse bet amount
  const stake = parseFloat(finalRow.Bet) || 0;

  // Parse result
  const result: BetResult = parseResult(finalRow.Result);

  // Calculate payout from result and net
  const payout = calculatePayoutFromNet(stake, finalRow.Net, result);

  // Determine bet type
  const betType: BetType = finalRow.Live === '1' ? 'live' : 'single';

  // Create bet ID from site, date, name, odds, and line
  const id = generateBetId(finalRow.Site, finalRow.Date, finalRow.Name, finalRow.Odds, finalRow.Line);

  // Don't create legs for single bets - legs are only for parlays/SGPs
  // Single bets store type, line, and ou directly on the bet object

  // Build description
  const description = buildDescription(finalRow);

  // Ensure category is never 'Other' - use Props if we have a Type
  let marketCategory = finalRow.Category;
  if (marketCategory === 'Other' && finalRow.Type) {
    marketCategory = 'Props';
  }
  // If category is empty or invalid, default to Props for prop-like bets
  if (!marketCategory || marketCategory === 'Other') {
    if (finalRow.Type || finalRow.Name) {
      marketCategory = 'Props';
    }
  }

  const bet = {
    id,
    book: finalRow.Site,
    betId: id, // Use id as betId for now
    placedAt,
    settledAt: result !== 'pending' ? placedAt : undefined,
    betType,
    marketCategory: marketCategory as any, // Ensure it's a valid MarketCategory
    sport: finalRow.Sport,
    description,
    name: finalRow.Name || undefined, // Store player/team name separately (just the name, not description)
    odds,
    stake,
    payout,
    result,
    type: finalRow.Type || undefined, // Store stat type directly for single bets
    line: finalRow.Line || undefined, // Store line directly for single bets
    ou: finalRow.Over === '1' ? 'Over' : finalRow.Under === '1' ? 'Under' : undefined, // Store Over/Under directly
    legs: undefined, // Single bets don't have legs - legs are only for parlays/SGPs
    tail: finalRow.Tail === '1' ? 'tailed' : undefined,
  };
  
  // Debug logging
  if (finalRow.Type) {
    console.log(`convertFinalRowToBet: Setting type="${finalRow.Type}" for bet ${id}`, {
      finalRowType: finalRow.Type,
      finalRowLine: finalRow.Line,
      finalRowOver: finalRow.Over,
      finalRowUnder: finalRow.Under,
      betType: bet.type,
      betLine: bet.line,
      betOu: bet.ou,
    });
  }
  
  return bet;
}

/**
 * Parses MM/DD/YY date format to ISO timestamp.
 */
function parseDateToISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Parse MM/DD/YY format
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/);
  if (match) {
    const [, month, day, yearShort] = match;
    // Convert 2-digit year to 4-digit (assume 2000s)
    const year = 2000 + parseInt(yearShort, 10);
    const date = new Date(year, parseInt(month, 10) - 1, parseInt(day, 10));
    return date.toISOString();
  }

  return new Date().toISOString();
}

/**
 * Parses odds string to number.
 */
function parseOddsToNumber(oddsStr: string): number {
  if (!oddsStr) return 0;
  // Remove + sign and parse
  const cleaned = oddsStr.replace(/[+\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses result string to BetResult.
 */
function parseResult(resultStr: string): BetResult {
  const lower = resultStr.toLowerCase();
  if (lower === 'win') return 'win';
  if (lower === 'loss') return 'loss';
  if (lower === 'push') return 'push';
  return 'pending';
}

/**
 * Calculates payout from net, stake, and result.
 */
function calculatePayoutFromNet(stake: number, netStr: string, result: BetResult): number {
  if (result === 'loss') return 0;
  if (result === 'push') return stake;
  if (result === 'win') {
    const net = parseFloat(netStr) || 0;
    return stake + net;
  }
  return 0;
}

/**
 * Generates a unique bet ID.
 * Uses a hash of key fields to ensure same bet gets same ID.
 */
function generateBetId(site: string, date: string, name: string, odds: string, line: string): string {
  const datePart = date.replace(/\//g, '-');
  const namePart = name.substring(0, 20).replace(/\s+/g, '-');
  // Create a hash from key fields to ensure same bet = same ID
  const hashInput = `${site}-${datePart}-${namePart}-${odds}-${line}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${site}-${datePart}-${Math.abs(hash).toString(36)}`;
}

/**
 * Builds description from FinalRow fields.
 * Description is used for display/search, but Name field should be just the player/team name.
 */
function buildDescription(finalRow: FinalRow): string {
  // For Props, description can include line and type for context
  // But the Name field itself should be just the player/team name
  if (finalRow.Category === 'Props' && finalRow.Name) {
    const parts = [finalRow.Name];
    if (finalRow.Line) {
      parts.push(finalRow.Line);
    }
    if (finalRow.Type) {
      parts.push(finalRow.Type);
    }
    return parts.join(' ');
  }
  return finalRow.Name || finalRow.Type || 'Bet';
}

