/**
 * Bet to FinalRow Converter
 * 
 * This module converts Bet objects (from parsers) into FinalRow format
 * for display and editing in the spreadsheet-like UI.
 * 
 * KEY PRINCIPLES:
 * - Name: SUBJECT ONLY (player/team name from entities/leg.name)
 * - Type: Depends on Category:
 *   - Props → stat type code (Pts, Ast, 3pt, Reb, PRA, etc.) from market text
 *   - Main → {Spread, Total, Moneyline} from market text
 *   - Futures → {Win Total, NBA Finals, Super Bowl, etc.} from market text
 *   - Type must NEVER contain bet form concepts (single/parlay/sgp/etc.)
 * - One FinalRow per leg for multi-leg bets (parlays/SGPs produce multiple rows)
 * - Over/Under: "1"/"0" flags (or "" when not applicable)
 * - Live: "1" or "" flag (uses bet.isLive boolean, not bet.betType)
 */

import { Bet, FinalRow } from '../types';

/**
 * Sport-specific stat type mappings for Props category.
 * Maps market text patterns to stat type codes.
 */
const STAT_TYPE_MAPPINGS: Record<string, Record<string, string>> = {
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
    'to': 'TO',
  },
  // Add other sports as needed
};

/**
 * Main Markets type mappings.
 */
const MAIN_MARKET_TYPES: Record<string, string> = {
  'spread': 'Spread',
  'total': 'Total',
  'over': 'Total',
  'under': 'Total',
  'moneyline': 'Moneyline',
  'ml': 'Moneyline',
};

/**
 * Futures type mappings.
 */
const FUTURES_TYPES: Record<string, string> = {
  'nba finals': 'NBA Finals',
  'super bowl': 'Super Bowl',
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
};

/**
 * Converts a Bet to one or more FinalRow objects.
 * Multi-leg bets produce one FinalRow per leg.
 * 
 * @param bet - The Bet object from the parser
 * @returns Array of FinalRow objects (one per leg, or one for single bets)
 */
export function betToFinalRows(bet: Bet): FinalRow[] {
  const rows: FinalRow[] = [];
  
  // Determine if we have legs to process
  const hasLegs = bet.legs && bet.legs.length > 0;
  
  if (!hasLegs) {
    // Single bet without structured legs - use bet-level fields
    const row = createFinalRow(bet, {
      name: bet.name || '',
      market: bet.type || '',
      target: bet.line,
      ou: bet.ou,
      result: bet.result,
    }, false);
    rows.push(row);
  } else {
    // Bet with structured legs - create one row per leg
    // For multi-leg bets (parlays/SGPs), use bet result for Net calculation
    const isMultiLeg = bet.legs.length > 1;
    
    // Safety check: Limit legs to prevent parsing errors from creating thousands of rows
    const legsToProcess = bet.legs.length > 10 ? bet.legs.slice(0, 10) : bet.legs;
    
    if (bet.legs.length > 10) {
      console.error(`betToFinalRows: Bet ${bet.betId} has ${bet.legs.length} legs - limiting to 10 to prevent excessive rows`);
    }
    
    legsToProcess.forEach((leg) => {
      const row = createFinalRow(bet, {
        name: leg.entities?.[0] || '',
        market: leg.market,
        target: leg.target,
        ou: leg.ou,
        result: leg.result,
      }, isMultiLeg);
      rows.push(row);
    });
  }
  
  return rows;
}

/**
 * Creates a single FinalRow from a Bet and leg data.
 * @param isMultiLeg - If true, Net is calculated from bet result (not leg result) for parlays/SGPs
 */
function createFinalRow(
  bet: Bet,
  legData: {
    name: string;
    market: string;
    target?: string | number;
    ou?: 'Over' | 'Under';
    result: string;
  },
  isMultiLeg: boolean
): FinalRow {
  // Format date to MM/DD/YY
  const date = formatDate(bet.placedAt);
  
  // Site abbreviation or full name
  const site = bet.book;
  
  // Sport
  const sport = bet.sport || '';
  
  // Normalize category
  const category = normalizeCategory(bet.marketCategory);
  
  // Determine Type based on Category
  const type = determineType(legData.market, category, bet.sport);
  
  // Name: SUBJECT ONLY (player/team from entities)
  const name = legData.name;
  
  // Over/Under flags
  const { over, under } = determineOverUnder(legData.ou, legData.target);
  
  // Line
  const line = formatLine(legData.target);
  
  // Odds (with sign)
  const odds = formatOdds(bet.odds);
  
  // Bet amount (stake)
  const betAmount = bet.stake.toFixed(2);
  
  // To Win (potential payout)
  const toWin = calculateToWin(bet.stake, bet.odds);
  
  // Result - for display, show leg result
  const result = capitalizeFirstLetter(legData.result);
  
  // Net (profit/loss) - for multi-leg bets, use bet result to reflect actual bankroll impact
  const netResult = isMultiLeg ? bet.result : legData.result;
  const net = calculateNet(netResult, bet.stake, bet.odds, bet.payout);
  
  // Live flag (uses isLive boolean field on Bet, not betType which is 'single'|'parlay'|'sgp'|'live'|'other')
  const live = bet.isLive ? '1' : '';
  
  // Tail
  const tail = bet.tail ? '1' : '';
  
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
    Odds: odds,
    Bet: betAmount,
    'To Win': toWin,
    Result: result,
    Net: net,
    Live: live,
    Tail: tail,
  };
}

/**
 * Normalizes marketCategory (from Bet) to spreadsheet Category values.
 * Maps MarketCategory values (Props, Main Markets, Futures, SGP/SGP+, Parlays) to simpler Category values (Props, Main, Futures).
 */
function normalizeCategory(marketCategory: string): string {
  const lower = marketCategory.toLowerCase();
  
  if (lower.includes('prop')) return 'Props';
  if (lower.includes('main')) return 'Main';
  if (lower.includes('future')) return 'Futures';
  if (lower.includes('parlay') || lower.includes('sgp')) return 'Props'; // SGP/SGP+ and Parlays default to Props in spreadsheet
  
  // Default to Props if unclear
  return 'Props';
}

/**
 * Determines the Type field based on Category and market text.
 */
function determineType(market: string, category: string, sport: string): string {
  const lowerMarket = market.toLowerCase();
  
  if (category === 'Props') {
    // Look up stat type from sport-specific mappings
    const sportMappings = STAT_TYPE_MAPPINGS[sport] || STAT_TYPE_MAPPINGS.NBA;
    
    // Check each mapping pattern
    for (const [pattern, statType] of Object.entries(sportMappings)) {
      if (lowerMarket.includes(pattern)) {
        return statType;
      }
    }
    
    // If no match, return empty string for manual review
    return '';
  }
  
  if (category === 'Main') {
    // Check main market types
    for (const [pattern, type] of Object.entries(MAIN_MARKET_TYPES)) {
      if (lowerMarket.includes(pattern)) {
        return type;
      }
    }
    return 'Spread'; // Default
  }
  
  if (category === 'Futures') {
    // Check futures types
    for (const [pattern, type] of Object.entries(FUTURES_TYPES)) {
      if (lowerMarket.includes(pattern)) {
        return type;
      }
    }
    return 'Future'; // Generic fallback
  }
  
  return '';
}

/**
 * Determines Over/Under flags based on leg data.
 */
function determineOverUnder(
  ou?: 'Over' | 'Under',
  target?: string | number
): { over: string; under: string } {
  if (ou === 'Over') {
    return { over: '1', under: '0' };
  }
  if (ou === 'Under') {
    return { over: '0', under: '1' };
  }
  
  // Check if target has "+" (milestone bet)
  if (target && target.toString().includes('+')) {
    return { over: '1', under: '0' };
  }
  
  // Default: both blank for non-O/U bets
  return { over: '', under: '' };
}

/**
 * Formats line value.
 */
function formatLine(target?: string | number): string {
  if (!target) return '';
  return target.toString();
}

/**
 * Formats odds with appropriate sign.
 */
function formatOdds(odds: number): string {
  if (odds > 0) return `+${odds}`;
  return odds.toString();
}

/**
 * Calculates To Win amount (stake + potential profit).
 */
function calculateToWin(stake: number, odds: number): string {
  let profit = 0;
  
  if (odds > 0) {
    profit = stake * (odds / 100);
  } else if (odds < 0) {
    profit = stake / (Math.abs(odds) / 100);
  }
  
  const toWin = stake + profit;
  return toWin.toFixed(2);
}

/**
 * Calculates Net profit/loss.
 */
function calculateNet(
  result: string,
  stake: number,
  odds: number,
  payout?: number
): string {
  const resultLower = result.toLowerCase();
  
  if (resultLower === 'win') {
    // Use payout if available, otherwise calculate from odds
    if (payout !== undefined && payout > 0) {
      const net = payout - stake;
      return net.toFixed(2);
    }
    
    // Calculate from odds
    let profit = 0;
    if (odds > 0) {
      profit = stake * (odds / 100);
    } else if (odds < 0) {
      profit = stake / (Math.abs(odds) / 100);
    }
    return profit.toFixed(2);
  }
  
  if (resultLower === 'loss') {
    return `-${stake.toFixed(2)}`;
  }
  
  if (resultLower === 'push') {
    return '0.00';
  }
  
  // Pending - return empty or 0
  return '';
}

/**
 * Formats date to MM/DD/YY.
 */
function formatDate(isoString: string): string {
  if (!isoString) return '';
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    
    return `${month}/${day}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Capitalizes first letter of a string.
 */
function capitalizeFirstLetter(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
