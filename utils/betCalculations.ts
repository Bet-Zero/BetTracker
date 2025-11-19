import { BetResult } from '../types';

/**
 * Constants for bet calculations
 */
export const AMERICAN_ODDS_DIVISOR = 100;

/**
 * Converts American odds to decimal odds
 * @param odds - American odds (e.g., +150, -120)
 * @returns Decimal odds multiplier
 */
export const americanOddsToDecimal = (odds: number): number => {
  if (odds > 0) {
    return 1 + (odds / AMERICAN_ODDS_DIVISOR);
  } else if (odds < 0) {
    return 1 + (AMERICAN_ODDS_DIVISOR / Math.abs(odds));
  }
  return 1;
};

/**
 * Calculates profit from American odds
 * @param stake - The bet stake amount
 * @param odds - American odds (e.g., +150, -120)
 * @returns The profit amount
 */
export const calculateProfit = (stake: number, odds: number): number => {
  if (isNaN(stake) || isNaN(odds) || stake <= 0) return 0;
  if (odds > 0) {
    return stake * (odds / AMERICAN_ODDS_DIVISOR);
  } else if (odds < 0) {
    return stake / (Math.abs(odds) / AMERICAN_ODDS_DIVISOR);
  }
  return 0;
};

/**
 * Recalculates payout based on stake, odds, and result
 * @param stake - The bet stake amount
 * @param odds - American odds
 * @param result - The bet result
 * @returns The payout amount
 */
export const recalculatePayout = (
  stake: number,
  odds: number,
  result: BetResult
): number => {
  switch (result) {
    case "win":
      return stake + calculateProfit(stake, odds);
    case "loss":
      return 0;
    case "push":
      return stake;
    case "pending":
      return 0;
    default:
      return 0;
  }
};

