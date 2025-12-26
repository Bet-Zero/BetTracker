import { Bet, BetResult } from '../types';

/**
 * Import Validation Module
 * 
 * Provides import-time validation with clear blocker vs warning distinction.
 * Blockers prevent import; warnings allow import with notice.
 */

export interface ImportValidationIssue {
  field: string;
  message: string;
  severity: 'blocker' | 'warning';
  /** Optional hint on how to resolve the issue */
  hint?: string;
}

export interface ImportValidationResult {
  /** True if no blockers exist (bet can be imported) */
  valid: boolean;
  /** Issues that MUST prevent import */
  blockers: ImportValidationIssue[];
  /** Issues that should be shown but don't prevent import */
  warnings: ImportValidationIssue[];
}

/**
 * Checks if a date string is valid and parseable
 */
const isValidDate = (dateStr: string | undefined | null): boolean => {
  if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
    return false;
  }
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

/**
 * Checks if a number is valid (not NaN, not undefined/null)
 */
const isValidNumber = (num: number | undefined | null): num is number => {
  return num !== undefined && num !== null && typeof num === 'number' && !isNaN(num);
};

/**
 * Calculates what the net profit would be with given values
 * Returns NaN if calculation is not possible
 */
const calculateExpectedNet = (
  result: BetResult,
  stake: number,
  odds: number | null | undefined
): number => {
  if (result === 'pending') {
    // Pending bets have no net yet - that's valid
    return 0;
  }
  
  if (result === 'push') {
    return 0; // Push = no gain/loss
  }
  
  if (result === 'loss') {
    return -stake; // Loss = negative stake
  }
  
  if (result === 'win') {
    // Win requires valid odds to calculate profit
    if (!isValidNumber(odds) || odds === 0) {
      return NaN;
    }
    
    let profit: number;
    if (odds > 0) {
      profit = stake * (odds / 100);
    } else {
      profit = stake / (Math.abs(odds) / 100);
    }
    return profit;
  }
  
  return NaN; // Unknown result
};

/**
 * Validates a bet for import, returning blockers and warnings.
 * 
 * @param bet - The bet to validate
 * @returns Validation result with valid flag, blockers, and warnings
 */
export const validateBetForImport = (bet: Bet): ImportValidationResult => {
  const blockers: ImportValidationIssue[] = [];
  const warnings: ImportValidationIssue[] = [];
  
  // ============================================
  // BLOCKERS - Must prevent import
  // ============================================
  
  // 1. Missing or empty bet.id (dedupe key)
  if (!bet.id || typeof bet.id !== 'string' || bet.id.trim() === '') {
    blockers.push({
      field: 'id',
      message: 'Missing bet ID (required for storage)',
      severity: 'blocker',
    });
  }
  
  // 2. Missing or invalid placedAt date
  if (!isValidDate(bet.placedAt)) {
    blockers.push({
      field: 'placedAt',
      message: 'Missing or invalid placement date',
      severity: 'blocker',
    });
  }
  
  // 3. Missing or invalid stake
  // Note: stake === 0 is allowed for free bet scenarios
  if (!isValidNumber(bet.stake)) {
    blockers.push({
      field: 'stake',
      message: 'Missing or invalid stake amount',
      severity: 'blocker',
    });
  } else if (bet.stake < 0) {
    blockers.push({
      field: 'stake',
      message: 'Stake cannot be negative',
      severity: 'blocker',
    });
  }
  
  // 4. Missing result
  const validResults: BetResult[] = ['win', 'loss', 'push', 'pending'];
  if (!bet.result) {
    blockers.push({
      field: 'result',
      message: 'Missing result',
      severity: 'blocker',
    });
  } else if (!validResults.includes(bet.result)) {
    blockers.push({
      field: 'result',
      message: `Invalid result "${bet.result}" (must be win, loss, push, or pending)`,
      severity: 'blocker',
    });
  }
  
  // 5. Missing odds for settled (non-pending) bets that need calculation
  // For win/loss, we need odds to calculate net profit
  if (bet.result === 'win') {
    if (!isValidNumber(bet.odds)) {
      blockers.push({
        field: 'odds',
        message: 'Missing odds (required for win calculation)',
        severity: 'blocker',
      });
    } else if (bet.odds === 0) {
      blockers.push({
        field: 'odds',
        message: 'Odds cannot be zero',
        severity: 'blocker',
      });
    }
  }
  
  // 6. Check if calculated Net would be NaN
  // Only check if we have enough data to calculate
  if (
    isValidNumber(bet.stake) && 
    bet.stake > 0 && 
    bet.result && 
    validResults.includes(bet.result)
  ) {
    const expectedNet = calculateExpectedNet(bet.result, bet.stake, bet.odds);
    if (isNaN(expectedNet)) {
      blockers.push({
        field: 'calculation',
        message: 'Cannot calculate Net profit (would be NaN)',
        severity: 'blocker',
      });
    }
  }
  
  // ============================================
  // WARNINGS - Allow import with notice
  // ============================================
  
  // 1. Missing sport
  if (!bet.sport || bet.sport.trim() === '') {
    warnings.push({
      field: 'sport',
      message: 'Sport is missing (can edit after import)',
      severity: 'warning',
      hint: 'Set sport to enable filtering by sport on the dashboard.',
    });
  }
  
  // 2. Missing type for props
  if (
    bet.marketCategory?.toLowerCase().includes('prop') &&
    !bet.type
  ) {
    warnings.push({
      field: 'type',
      message: 'Stat type is missing for prop bet',
      severity: 'warning',
      hint: 'Add stat type (e.g., Pts, Reb, Ast) for accurate prop analysis.',
    });
  }
  
  // 3. Missing marketCategory (will use default)
  if (!bet.marketCategory) {
    warnings.push({
      field: 'marketCategory',
      message: 'Market category is missing (will use default)',
      severity: 'warning',
      hint: 'Category will be auto-classified based on bet type.',
    });
  }
  
  // 4. Check legs for parlays/SGP - at least structure exists
  if (
    (bet.betType === 'parlay' || bet.betType === 'sgp' || bet.betType === 'sgp_plus') &&
    (!bet.legs || bet.legs.length === 0)
  ) {
    warnings.push({
      field: 'legs',
      message: 'Parlay/SGP has no leg details',
      severity: 'warning',
      hint: 'Leg breakdown may not be available for this bet.',
    });
  }
  
  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
  };
};

/**
 * Validates multiple bets and returns aggregate results
 */
export const validateBetsForImport = (bets: Bet[]): {
  totalBlockers: number;
  totalWarnings: number;
  betsWithBlockers: number;
  betsWithWarnings: number;
  validBets: Bet[];
  invalidBets: Bet[];
  validationResults: Map<string, ImportValidationResult>;
} => {
  let totalBlockers = 0;
  let totalWarnings = 0;
  let betsWithBlockers = 0;
  let betsWithWarnings = 0;
  const validBets: Bet[] = [];
  const invalidBets: Bet[] = [];
  const validationResults = new Map<string, ImportValidationResult>();
  
  for (const [i, bet] of bets.entries()) {
    const result = validateBetForImport(bet);
    validationResults.set(bet.id || `unknown-${i}`, result);
    
    totalBlockers += result.blockers.length;
    totalWarnings += result.warnings.length;
    
    if (result.blockers.length > 0) {
      betsWithBlockers++;
      invalidBets.push(bet);
    } else {
      validBets.push(bet);
    }
    
    if (result.warnings.length > 0) {
      betsWithWarnings++;
    }
  }
  
  return {
    totalBlockers,
    totalWarnings,
    betsWithBlockers,
    betsWithWarnings,
    validBets,
    invalidBets,
    validationResults,
  };
};
