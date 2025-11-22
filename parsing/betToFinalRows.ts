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
    // Special props
    'first basket': 'FB',
    'first field goal': 'FB',
    'first fg': 'FB',
    'top scorer': 'Top Pts',
    'top points': 'Top Pts',
    'top pts': 'Top Pts',
    'double double': 'DD',
    'double-double': 'DD',
    'triple double': 'TD',
    'triple-double': 'TD',
    
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

  // Drop placeholder SGP container legs that don't have entities/children,
  // then flatten group legs (SGP+ inner SGP) so UI shows the actual selections.
  const normalizedLegs = hasLegs
    ? bet.legs!.filter((leg) => {
        const market = (leg.market || "").toLowerCase();
        const isSgpPlaceholder =
          market.includes("same game parlay") &&
          (!leg.entities || !leg.entities.length) &&
          (!leg.children || !leg.children.length);
        return !isSgpPlaceholder;
      })
    : [];

  const expandedLegs = normalizedLegs.flatMap((leg) => {
    if (leg.isGroupLeg) {
      // If we have children, use them; if not, drop the placeholder leg entirely
      return leg.children && leg.children.length ? leg.children : [];
    }
    return leg;
  });

  const isParlay = hasLegs && expandedLegs.length > 1;
  const parlayGroupId = isParlay ? bet.id : null;
  
  if (!hasLegs) {
    // Single bet without structured legs - use bet-level fields
    const row = createFinalRow(bet, {
      name: bet.name || '',
      market: bet.type || '',
      target: bet.line,
      ou: bet.ou,
      result: bet.result,
    }, {
      parlayGroupId: null,
      legIndex: null,
      legCount: null,
      isParlayHeader: false,
      isParlayChild: false,
      showMonetaryValues: true,
    });
    rows.push(row);
  } else {
    // Bet with structured legs - create one row per leg
    // Safety check: Limit legs to prevent parsing errors from creating thousands of rows
    const legsToProcess =
      expandedLegs.length > 10 ? expandedLegs.slice(0, 10) : expandedLegs;

    if (expandedLegs.length > 10) {
      console.error(
        `betToFinalRows: Bet ${bet.betId} has ${expandedLegs.length} legs - limiting to 10 to prevent excessive rows`
      );
    }
    
    legsToProcess.forEach((leg, index) => {
      const isHeader = index === 0;
      const row = createFinalRow(bet, {
        name: leg.entities?.[0] || '',
        market: leg.market,
        target: leg.target,
        ou: leg.ou,
        result: leg.result,
      }, {
        parlayGroupId: parlayGroupId,
        legIndex: isParlay ? index + 1 : null,
        legCount: isParlay && isHeader ? legsToProcess.length : null,
        isParlayHeader: isParlay && isHeader,
        isParlayChild: isParlay,
        showMonetaryValues: isHeader || !isParlay,
      });
      rows.push(row);
    });
  }
  
  return rows;
}

/**
 * Creates a single FinalRow from a Bet and leg data.
 * @param metadata - Parlay metadata and display flags
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
  metadata: {
    parlayGroupId: string | null;
    legIndex: number | null;
    legCount: number | null;
    isParlayHeader: boolean;
    isParlayChild: boolean;
    showMonetaryValues: boolean;
  }
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
  
  // Monetary values - only show on header rows for parlays
  const odds = metadata.showMonetaryValues ? formatOdds(bet.odds) : '';
  const betAmount = metadata.showMonetaryValues ? bet.stake.toFixed(2) : '';
  const toWin = metadata.showMonetaryValues ? calculateToWin(bet.stake, bet.odds) : '';
  
  // Result - header shows bet.result, children show leg.result
  const resultValue = metadata.isParlayHeader ? bet.result : legData.result;
  const result = capitalizeFirstLetter(resultValue);
  
  // Net (profit/loss) - only on header rows, use bet result for parlays
  let net = '';
  if (metadata.showMonetaryValues) {
    const netResult = metadata.isParlayChild ? bet.result : legData.result;
    net = calculateNet(netResult, bet.stake, bet.odds, bet.payout);
  }
  
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
    _parlayGroupId: metadata.parlayGroupId,
    _legIndex: metadata.legIndex,
    _legCount: metadata.legCount,
    _isParlayHeader: metadata.isParlayHeader,
    _isParlayChild: metadata.isParlayChild,
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
  const normalizedMarket = lowerMarket.trim();
  
  if (category === 'Props') {
    // Direct code/alias mappings for special props
    const directMap: Record<string, string> = {
      fb: 'FB',
      'first basket': 'FB',
      'first field goal': 'FB',
      'first fg': 'FB',
      'top pts': 'Top Pts',
      'top scorer': 'Top Pts',
      'top points': 'Top Pts',
      'top points scorer': 'Top Pts',
      dd: 'DD',
      'double double': 'DD',
      'double-double': 'DD',
      td: 'TD',
      'triple double': 'TD',
      'triple-double': 'TD',
    };
    if (directMap[normalizedMarket]) {
      return directMap[normalizedMarket];
    }

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
