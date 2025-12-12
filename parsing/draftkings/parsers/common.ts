import { BetResult, LegResult } from "../../../types";

// DEBUG toggle
export const DK_DEBUG = true;
export const dkDebug = (...args: any[]) => {
  if (!DK_DEBUG) return;
  // eslint-disable-next-line no-console
  console.log("[DK-DEBUG]", ...args);
};

export interface FooterMeta {
  stake: number | null;
  payout: number | null;
  result: BetResult | null;
}

export interface HeaderInfo {
  betId: string;
  placedAt: string;
}

/* -------------------------------------------------------------------------- */
/*                                EXTRACTORS                                  */
/* -------------------------------------------------------------------------- */

/**
 * Extract Bet ID and Date from the header area
 */
export const extractHeaderInfo = (element: Element): HeaderInfo => {
  // Date: span[data-test-id^="bet-reference-"][data-test-id$="-0"]
  // "Nov 18, 2025, 11:11:19 PM"
  const dateEl = element.querySelector('span[data-test-id^="bet-reference-"][data-test-id$="-0"]');
  const dateStr = dateEl?.textContent ? normalizeSpaces(dateEl.textContent) : '';
  
  // Bet ID: span[data-test-id^="bet-reference-"][data-test-id$="-1"]
  // "DK638991222795551269"
  const idEl = element.querySelector('span[data-test-id^="bet-reference-"][data-test-id$="-1"]');
  let betId = idEl?.textContent ? normalizeSpaces(idEl.textContent) : '';
  
  let placedAt = dateStr;
  try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
          placedAt = d.toISOString();
      }
  } catch (e) {
      dkDebug('Failed to parse date', dateStr);
  }

  return { betId, placedAt };
};

/**
 * Extract Stake, Payout, and Result from the footer area
 */
export const extractFooterMeta = (element: Element): FooterMeta => {
  // Stake: span[data-test-id^="bet-stake-"] -> "Wager: $1.00"
  const stakeEl = element.querySelector('span[data-test-id^="bet-stake-"]');
  const stakeText = stakeEl?.textContent || '';
  const stake = parseMoney(stakeText);

  // Return: span[data-test-id^="bet-returns-"] -> "Paid: $1.89"
  const payoutEl = element.querySelector('span[data-test-id^="bet-returns-"]');
  const payoutText = payoutEl?.textContent || '';
  const payout = parseMoney(payoutText);

  // Result: div[data-test-id^="bet-details-status-"] -> "Won"
  const statusEl = element.querySelector('div[data-test-id^="bet-details-status-"]');
  const statusText = statusEl?.textContent?.toLowerCase().trim() || '';

  let result: BetResult = 'pending';
  if (statusText === 'won') result = 'win';
  else if (statusText === 'lost') result = 'loss';
  else if (statusText === 'void') result = 'push';

  return { stake, payout, result };
};

/* -------------------------------------------------------------------------- */
/*                                UTILS                                       */
/* -------------------------------------------------------------------------- */

export const parseMoney = (raw: string): number | null => {
  const cleaned = raw.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
};

export const normalizeSpaces = (text: string): string =>
  (text || "").replace(/\s+/g, " ").trim();

/* -------------------------------------------------------------------------- */
/*                          LEAGUE/SPORT DETECTION                            */
/* -------------------------------------------------------------------------- */

/**
 * Infer league from DraftKings team logo URL.
 * URL pattern: https://sportsbook.draftkings.com/static/logos/teams/{league}/{team}.png
 * 
 * Examples:
 *   /teams/nba/PHX.png → "NBA"
 *   /teams/nfl/NYG.png → "NFL"
 *   /teams/mlb/NYY.png → "MLB"
 */
export const inferLeagueFromLogoUrl = (url: string): string | null => {
  const match = url.match(/\/teams\/([a-z]+)\//i);
  if (match) {
    return match[1].toUpperCase(); // "nba" → "NBA"
  }
  return null;
};

/**
 * Extract league from event card by checking team logo URLs.
 * Returns the first detected league or 'Unknown'.
 */
export const extractLeagueFromEventCard = (element: Element): string => {
  const logos = element.querySelectorAll('img[src*="/teams/"]');
  for (const logo of Array.from(logos)) {
    const src = logo.getAttribute('src') || '';
    const league = inferLeagueFromLogoUrl(src);
    if (league) return league;
  }
  return 'Unknown';
};

/* -------------------------------------------------------------------------- */
/*                          NAME & TYPE EXTRACTION                            */
/* -------------------------------------------------------------------------- */

// Stat type patterns - order matters (check combined before individual)
const STAT_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  // Combined stats first
  { pattern: /points.*rebounds.*assists|pts.*reb.*ast|pra/i, type: 'PRA' },
  { pattern: /points.*rebounds|pts.*reb/i, type: 'PR' },
  { pattern: /points.*assists|pts.*ast/i, type: 'PA' },
  { pattern: /rebounds.*assists|reb.*ast/i, type: 'RA' },
  { pattern: /steals.*blocks|stl.*blk|stocks/i, type: 'Stocks' },
  
  // Individual stats
  { pattern: /three\s*pointers?\s*made|made\s*threes|3[\s-]*pointers?|threes/i, type: '3pt' },
  { pattern: /points|pts/i, type: 'Pts' },
  { pattern: /assists|ast/i, type: 'Ast' },
  { pattern: /rebounds|reb/i, type: 'Reb' },
  { pattern: /steals|stl/i, type: 'Stl' },
  { pattern: /blocks|blk/i, type: 'Blk' },
  { pattern: /turnovers/i, type: 'TO' },
  { pattern: /first\s*(basket|field\s*goal|fg)/i, type: 'FB' },
  { pattern: /double\s*double/i, type: 'DD' },
  { pattern: /triple\s*double/i, type: 'TD' },
  
  // Main market types
  { pattern: /spread/i, type: 'Spread' },
  { pattern: /total/i, type: 'Total' },
  { pattern: /moneyline|money\s*line|ml/i, type: 'Moneyline' },
];

/**
 * Detect stat/bet type from market text.
 * Returns the stat code (e.g., "Pts", "Ast", "3pt", "Spread").
 */
export const detectStatType = (market: string): string => {
  for (const { pattern, type } of STAT_PATTERNS) {
    if (pattern.test(market)) {
      return type;
    }
  }
  return ''; // Unknown type
};

/**
 * Extract player name from a player prop market description.
 * 
 * Examples:
 *   "Jordan Hawkins Points" → "Jordan Hawkins"
 *   "Zach LaVine Three Pointers Made" → "Zach LaVine"
 *   "Paul George Assists" → "Paul George"
 */
export const extractPlayerName = (market: string): string => {
  if (!market) return '';
  
  // Remove common suffixes that indicate stat types
  const statSuffixes = [
    /\s+(points|pts|assists|ast|rebounds|reb|steals|stl|blocks|blk|threes?|three\s*pointers?\s*made|turnovers|double\s*double|triple\s*double|first\s*basket|fb)$/i,
    /\s+\d+\+?$/, // Remove trailing numbers like "25+" 
  ];
  
  let name = market.trim();
  for (const suffix of statSuffixes) {
    name = name.replace(suffix, '').trim();
  }
  
  // If what remains looks like a name (has at least 2 parts, all capitalized words)
  const words = name.split(/\s+/);
  if (words.length >= 2 && words.every(w => /^[A-Z]/.test(w))) {
    return name;
  }
  
  return '';
};

/**
 * Extract team name from main market descriptions.
 * 
 * Examples:
 *   "PHO Suns +2.5" → "PHO Suns"
 *   "LA Lakers -5.5" → "LA Lakers"
 *   "Over 235.5" → "" (no team name for totals)
 */
export const extractTeamName = (target: string): string => {
  if (!target) return '';
  
  // Remove spread/line numbers
  const cleaned = target.replace(/[+\-]?\d+\.?\d*/g, '').trim();
  
  // Skip if it's an over/under total
  if (/^(over|under)$/i.test(cleaned)) return '';
  
  return cleaned;
};

/**
 * Extract name and type from market description.
 * Works for both player props and main market bets.
 */
export const extractNameAndType = (market: string, target?: string): { name: string; type: string } => {
  const type = detectStatType(market);
  
  // For player props, extract player name from market
  let name = extractPlayerName(market);
  
  // If no player name, try to extract team name from target (for spreads/moneylines)
  if (!name && target) {
    name = extractTeamName(target);
  }
  
  return { name, type };
};

/**
 * Extract line (numeric threshold) and over/under from target text.
 * 
 * Examples:
 *   "PHO Suns +2.5" → { line: "+2.5", ou: undefined }
 *   "LA Lakers -5.5" → { line: "-5.5", ou: undefined }
 *   "Over 235.5" → { line: "235.5", ou: "Over" }
 *   "Under 220.5" → { line: "220.5", ou: "Under" }
 *   "18+" → { line: "18+", ou: "Over" }  (props with + are Over bets)
 */
export const extractLineAndOu = (target: string): { line: string; ou?: 'Over' | 'Under' } => {
  if (!target) return { line: '' };
  
  let ou: 'Over' | 'Under' | undefined = undefined;
  let line = '';
  
  // Check for Over/Under prefix
  const overMatch = target.match(/^Over\s*([+-]?\d+\.?\d*)/i);
  const underMatch = target.match(/^Under\s*([+-]?\d+\.?\d*)/i);
  
  if (overMatch) {
    ou = 'Over';
    line = overMatch[1];
  } else if (underMatch) {
    ou = 'Under';
    line = underMatch[1];
  } else {
    // Check prop format first (e.g., "18+", "25+") before spread format
    // This is more specific and should take precedence to avoid misidentifying
    // prop thresholds as spread lines (e.g., "18+" is a prop, not a spread)
    const propMatch = target.match(/(\d+)\+/);
    if (propMatch) {
      line = propMatch[1] + '+';
      ou = 'Over';
    } else {
      // Look for spread lines like "+2.5" or "-5.5" (main markets)
      const spreadMatch = target.match(/([+-]?\d+(?:\.\d+)?)\s*$/);
      if (spreadMatch) {
        line = spreadMatch[1];
      }
    }
  }
  
  return { line, ou };
};

/**
 * Normalize bet type names across books.
 * DraftKings uses "SGPx" where FanDuel uses "SGP+".
 */
export const normalizeBetType = (text: string): 'single' | 'parlay' | 'sgp' | 'sgp_plus' | null => {
  const lower = text.toLowerCase();
  
  // SGPx (DraftKings) → sgp_plus
  if (lower.includes('sgpx')) return 'sgp_plus';
  
  // SGP+ (FanDuel style) → sgp_plus
  if (lower.includes('sgp+') || lower.includes('sgp plus')) return 'sgp_plus';
  
  // Same Game Parlay (basic SGP)
  if (lower.includes('sgp') || lower.includes('same game parlay')) return 'sgp';
  
  // Standard parlay
  if (lower.includes('parlay')) return 'parlay';
  
  return null;
};
