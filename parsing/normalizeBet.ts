/**
 * Global Normalizer - THE BRAIN
 * 
 * This is the ONLY place in the entire codebase where Category/Type/Line/Over/Under/Sport/Result/Net logic lives.
 * Every site parser must feed RawBet → normalizeBet → FinalRow.
 * Nothing else may implement bet logic.
 */

import { RawBet } from './rawBetTypes';
import { FinalRow } from '../types';

/**
 * Normalizes a RawBet into a FinalRow.
 * Returns null for multi-leg bets (parlays/SGPs) - skip them for now.
 */
export function normalizeBet(raw: RawBet): FinalRow | null {
  // Skip multi-leg bets
  if (raw.isMultiLeg) {
    return null;
  }

  // Extract and normalize fields
  const site = raw.site || '';
  const rawMarketText = raw.rawMarketText || '';
  const playerName = raw.playerName;
  const teamNames = raw.teamNames || [];
  const game = raw.game || '';
  const placedAt = raw.placedAt || '';
  const odds = raw.odds || '';
  const wager = raw.wager || '';
  const returned = raw.returned || '';

  // ===== SPORT DETECTION =====
  const sport = detectSport(playerName, teamNames, game, rawMarketText);

  // ===== CATEGORY ASSIGNMENT =====
  const category = detectCategory(rawMarketText, playerName, game);
  if (!category) {
    return null; // Skip if we can't determine category
  }

  // ===== TYPE DETECTION =====
  const type = detectType(rawMarketText, category);

  // ===== LINE EXTRACTION =====
  const line = extractLine(rawMarketText);

  // ===== OVER/UNDER FLAGS =====
  const { over, under } = detectOverUnder(rawMarketText, line);

  // ===== ODDS =====
  const oddsFormatted = formatOdds(odds);

  // ===== BET AMOUNT =====
  const bet = extractBetAmount(wager);

  // ===== TO WIN =====
  const toWin = calculateToWin(bet, oddsFormatted);

  // ===== RESULT =====
  const result = determineResult(returned, bet);

  // ===== NET =====
  const net = calculateNet(result, returned, bet);

  // ===== DATE =====
  const date = formatDate(placedAt);

  // ===== NAME =====
  const name = extractName(playerName, teamNames, rawMarketText, game);

  // ===== LIVE/TAIL =====
  const live = raw.isLive ? '1' : '';
  const tail = raw.isTail ? '1' : '';

  return {
    Date: date,
    Site: site,
    Sport: sport,
    Category: category,
    Type: type,
    Name: name,
    Over: over,
    Under: under,
    Line: line,
    Odds: oddsFormatted,
    Bet: bet,
    'To Win': toWin,
    Result: result,
    Net: net,
    Live: live,
    Tail: tail,
  };
}

/**
 * Detects sport from context.
 * Never returns "Other".
 */
function detectSport(
  playerName: string | undefined,
  teamNames: string[],
  game: string,
  rawMarketText: string
): string {
  const allText = [
    playerName,
    ...teamNames,
    game,
    rawMarketText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // NBA detection
  const nbaKeywords = [
    'nba',
    'warriors',
    'pelicans',
    'lakers',
    'celtics',
    'bulls',
    'jazz',
    'knicks',
    'heat',
    'nuggets',
    'bucks',
    'suns',
    'mavericks',
    'clippers',
    'nets',
    '76ers',
    'raptors',
    'rockets',
    'thunder',
    'spurs',
    'kings',
    'pistons',
    'hornets',
    'wizards',
    'hawks',
    'magic',
    'pacers',
    'cavaliers',
    'grizzlies',
    'timberwolves',
    'trail blazers',
    'points',
    'rebounds',
    'assists',
    'threes',
    '3pt',
    'pts',
    'reb',
    'ast',
  ];

  if (nbaKeywords.some((keyword) => allText.includes(keyword))) {
    return 'NBA';
  }

  // Default to NBA if we have basketball stats
  if (
    rawMarketText.toLowerCase().includes('points') ||
    rawMarketText.toLowerCase().includes('rebounds') ||
    rawMarketText.toLowerCase().includes('assists') ||
    rawMarketText.toLowerCase().includes('threes') ||
    rawMarketText.toLowerCase().includes('made threes')
  ) {
    return 'NBA';
  }

  // If we have team names but can't identify sport, default to NBA for now
  // (since most bets in this system are NBA)
  if (teamNames.length > 0 || game) {
    return 'NBA';
  }

  // Last resort: if we have a player name, assume NBA
  if (playerName) {
    return 'NBA';
  }

  // Should never reach here, but return NBA as safe default
  return 'NBA';
}

/**
 * Detects category: Props, Main Markets, Futures, Parlays, SGP
 */
function detectCategory(
  rawMarketText: string,
  playerName: string | undefined,
  game: string
): string | null {
  // ALWAYS return Props if playerName exists - this is the strongest indicator
  if (playerName && playerName.trim().length > 0) {
    return 'Props';
  }

  const text = rawMarketText.toLowerCase();

  // Props: references stats OR "X+" format
  if (
    /\d+\+/.test(rawMarketText) ||
    text.includes('points') ||
    text.includes('rebounds') ||
    text.includes('assists') ||
    text.includes('threes') ||
    text.includes('made threes') ||
    text.includes('steals') ||
    text.includes('blocks') ||
    text.includes('turnovers') ||
    text.includes('pts') ||
    text.includes('reb') ||
    text.includes('ast') ||
    text.includes('3pt') ||
    text.includes('stl') ||
    text.includes('blk') ||
    text.includes('to')
  ) {
    return 'Props';
  }

  // Main Markets: Spread, game totals, moneyline
  if (
    text.includes('spread') ||
    text.includes('moneyline') ||
    text.includes('ml') ||
    /[+-]\d+\.?\d*/.test(rawMarketText) || // Spread pattern
    (text.includes('over') || text.includes('under')) && !playerName // Game totals
  ) {
    return 'Main Markets';
  }

  // Futures: Long-term outcomes
  if (
    text.includes('nba finals') ||
    text.includes('wcc') ||
    text.includes('ecc') ||
    text.includes('win totals') ||
    text.includes('make playoffs') ||
    text.includes('miss playoffs') ||
    text.includes('mvp') ||
    text.includes('dpoy') ||
    text.includes('roy') ||
    text.includes('champion') ||
    text.includes('award')
  ) {
    return 'Futures';
  }

  // If we can't determine, return null (will be skipped)
  return null;
}

/**
 * Detects Type (stat code or market subtype) using keyword/pattern matching.
 */
function detectType(rawMarketText: string, category: string): string {
  const text = rawMarketText.toLowerCase();
  const normalized = rawMarketText.trim();

  if (category === 'Props') {
    // Combined stats (check before individual stats)
    if (
      (text.includes('points') || text.includes('pts')) &&
      (text.includes('rebounds') || text.includes('reb')) &&
      (text.includes('assists') || text.includes('ast'))
    ) {
      return 'PRA';
    }

    if (
      (text.includes('points') || text.includes('pts')) &&
      (text.includes('rebounds') || text.includes('reb'))
    ) {
      return 'PR';
    }

    if (
      (text.includes('rebounds') || text.includes('reb')) &&
      (text.includes('assists') || text.includes('ast'))
    ) {
      return 'RA';
    }

    if (
      (text.includes('points') || text.includes('pts')) &&
      (text.includes('assists') || text.includes('ast'))
    ) {
      return 'PA';
    }

    if (
      (text.includes('steals') || text.includes('stl')) &&
      (text.includes('blocks') || text.includes('blk'))
    ) {
      return 'Stocks';
    }

    // Individual stats
    if (
      text.includes('made threes') ||
      text.includes('3-pointers') ||
      text.includes('3 pointers') ||
      text.includes('threes')
    ) {
      return '3pt';
    }

    if (text.includes('points') || text.includes('pts')) {
      return 'Pts';
    }

    if (text.includes('assists') || text.includes('ast')) {
      return 'Ast';
    }

    if (text.includes('rebounds') || text.includes('reb')) {
      return 'Reb';
    }

    if (text.includes('steals') || text.includes('stl')) {
      return 'Stl';
    }

    if (text.includes('blocks') || text.includes('blk')) {
      return 'Blk';
    }

    if (text.includes('turnovers') || text.includes('to')) {
      return 'TO';
    }

    // Fallback: return first meaningful word or empty
    return normalized.split(/\s+/)[0] || '';
  }

  if (category === 'Main Markets') {
    if (text.includes('spread') || /[+-]\d+\.?\d*/.test(rawMarketText)) {
      return 'Side';
    }
    if (text.includes('over') || text.includes('under') || text.includes('total')) {
      return 'Total';
    }
    if (text.includes('moneyline') || text.includes('ml')) {
      return 'Moneyline';
    }
    return 'Side'; // Default for main markets
  }

  if (category === 'Futures') {
    if (text.includes('nba finals')) return 'NBA Finals';
    if (text.includes('wcc')) return 'WCC';
    if (text.includes('ecc')) return 'ECC';
    if (text.includes('win totals')) return 'Win Totals';
    if (text.includes('make playoffs')) return 'Make Playoffs';
    if (text.includes('miss playoffs')) return 'Miss Playoffs';
    if (text.includes('mvp')) return 'MVP';
    if (text.includes('dpoy')) return 'DPOY';
    if (text.includes('roy')) return 'ROY';
    return 'Futures'; // Generic fallback
  }

  return '';
}

/**
 * Extracts Line from market text.
 * Keeps plus sign for "X+" format.
 */
function extractLine(rawMarketText: string): string {
  if (!rawMarketText) return '';

  // Check for "X+" pattern first
  const plusMatch = rawMarketText.match(/(\d+(?:\.\d+)?)\s*\+/);
  if (plusMatch) {
    return plusMatch[1] + '+';
  }

  // Check for spread pattern: "+4.5" or "-4.5"
  const spreadMatch = rawMarketText.match(/([+-]\d+(?:\.\d+)?)/);
  if (spreadMatch) {
    return spreadMatch[1];
  }

  // Check for numeric value (for Over/Under totals)
  const numMatch = rawMarketText.match(/(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return numMatch[1];
  }

  return '';
}

/**
 * Detects Over/Under flags.
 */
function detectOverUnder(rawMarketText: string, line: string): { over: string; under: string } {
  const text = rawMarketText.toLowerCase();

  // If line has "+", it's an Over bet
  if (line.includes('+')) {
    return { over: '1', under: '0' };
  }

  // Check for explicit Over/Under text
  if (text.includes('over') && !text.includes('under')) {
    return { over: '1', under: '0' };
  }

  if (text.includes('under') && !text.includes('over')) {
    return { over: '0', under: '1' };
  }

  // For spreads/moneyline/futures, both are 0
  if (
    text.includes('spread') ||
    text.includes('moneyline') ||
    text.includes('ml') ||
    text.includes('futures') ||
    text.includes('mvp') ||
    text.includes('champion')
  ) {
    return { over: '0', under: '0' };
  }

  // Default: if we have a line but no explicit Over/Under, assume Over for props
  if (line && !line.includes('+') && !line.includes('-')) {
    // This is likely a total, default to Over
    return { over: '1', under: '0' };
  }

  return { over: '0', under: '0' };
}

/**
 * Formats odds as American format with sign.
 */
function formatOdds(odds: string): string {
  if (!odds) return '';

  // Remove any whitespace
  const cleaned = odds.trim();

  // If it already has a sign, return as-is
  if (/^[+-]/.test(cleaned)) {
    return cleaned;
  }

  // If it's a number without sign, add +
  const num = parseFloat(cleaned);
  if (!isNaN(num)) {
    return num >= 0 ? `+${num}` : `${num}`;
  }

  return '';
}

/**
 * Extracts bet amount from wager string (removes $).
 */
function extractBetAmount(wager: string): string {
  if (!wager) return '0.00';

  // Remove $ and commas, then parse
  const cleaned = wager.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);

  if (isNaN(num)) return '0.00';

  return num.toFixed(2);
}

/**
 * Calculates To Win amount from bet and odds.
 */
function calculateToWin(bet: string, odds: string): string {
  const betNum = parseFloat(bet);
  if (isNaN(betNum) || betNum === 0) return '0.00';

  if (!odds) return '0.00';

  // Parse odds (remove + sign for calculation)
  const oddsNum = parseFloat(odds.replace(/[+\s]/g, ''));
  if (isNaN(oddsNum)) return '0.00';

  let toWin = 0;

  if (oddsNum > 0) {
    // Positive odds: bet * (odds/100)
    toWin = betNum * (oddsNum / 100);
  } else {
    // Negative odds: bet / (abs(odds)/100)
    toWin = betNum / (Math.abs(oddsNum) / 100);
  }

  return toWin.toFixed(2);
}

/**
 * Determines result from returned amount.
 */
function determineResult(returned: string, bet: string): string {
  const returnedNum = parseFloat(returned.replace(/[$,\s]/g, '') || '0');
  const betNum = parseFloat(bet || '0');

  if (returnedNum === 0 && betNum > 0) {
    return 'Loss';
  }

  if (returnedNum === betNum && betNum > 0) {
    return 'Push';
  }

  if (returnedNum > betNum) {
    return 'Win';
  }

  return 'Pending';
}

/**
 * Calculates Net from result, returned, and bet.
 */
function calculateNet(result: string, returned: string, bet: string): string {
  const returnedNum = parseFloat(returned.replace(/[$,\s]/g, '') || '0');
  const betNum = parseFloat(bet || '0');

  if (result === 'Loss') {
    return `-${betNum.toFixed(2)}`;
  }

  if (result === 'Push') {
    return '0';
  }

  if (result === 'Win') {
    const net = returnedNum - betNum;
    return net.toFixed(2);
  }

  return '0';
}

/**
 * Formats date from placedAt string to MM/DD/YY format.
 */
function formatDate(placedAt: string): string {
  if (!placedAt) return '';

  // Try to parse FanDuel format: "11/16/2025 7:09PM ET"
  const fanDuelMatch = placedAt.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (fanDuelMatch) {
    const [, month, day, year] = fanDuelMatch;
    const yearShort = year.slice(-2); // Last 2 digits
    return `${month}/${day}/${yearShort}`;
  }

  // Try ISO format
  try {
    const date = new Date(placedAt);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1);
      const day = String(date.getDate());
      const year = String(date.getFullYear()).slice(-2);
      return `${month}/${day}/${year}`;
    }
  } catch {
    // Fall through
  }

  return '';
}

/**
 * Extracts Name field from available data.
 */
function extractName(
  playerName: string | undefined,
  teamNames: string[],
  rawMarketText: string,
  game: string
): string {
  // Prefer player name
  if (playerName) {
    return playerName;
  }

  // Use team names if available
  if (teamNames.length > 0) {
    return teamNames.join(' vs ');
  }

  // Use game if available
  if (game) {
    return game;
  }

  // Fallback to first part of market text
  const parts = rawMarketText.split(/\s*[,\s]\s*/);
  if (parts.length > 0 && parts[0].length > 2) {
    return parts[0];
  }

  return '';
}

