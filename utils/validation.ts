import { Bet, BetResult } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a bet object
 * @param bet - Partial bet object to validate
 * @returns Validation result with valid flag and array of error messages
 */
export const validateBet = (bet: Partial<Bet>): ValidationResult => {
  const errors: string[] = [];

  // Validate stake
  if (bet.stake !== undefined) {
    if (typeof bet.stake !== 'number' || isNaN(bet.stake)) {
      errors.push('Stake must be a valid number');
    } else if (bet.stake <= 0) {
      errors.push('Stake must be greater than 0');
    }
  }

  // Validate odds
  if (bet.odds !== undefined) {
    if (typeof bet.odds !== 'number' || isNaN(bet.odds)) {
      errors.push('Odds must be a valid number');
    } else if (bet.odds === 0) {
      errors.push('Odds cannot be zero');
    } else if (bet.odds < -10000 || bet.odds > 10000) {
      errors.push('Odds must be between -10000 and +10000');
    }
  }

  // Validate dates
  if (bet.placedAt !== undefined) {
    const placedDate = new Date(bet.placedAt);
    if (isNaN(placedDate.getTime())) {
      errors.push('Placed date must be a valid ISO date string');
    }
  }

  if (bet.settledAt !== undefined && bet.settledAt !== null) {
    const settledDate = new Date(bet.settledAt);
    if (isNaN(settledDate.getTime())) {
      errors.push('Settled date must be a valid ISO date string');
    }
  }

  // Validate result
  if (bet.result !== undefined) {
    const validResults: BetResult[] = ['win', 'loss', 'push', 'pending'];
    if (!validResults.includes(bet.result)) {
      errors.push(`Result must be one of: ${validResults.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

