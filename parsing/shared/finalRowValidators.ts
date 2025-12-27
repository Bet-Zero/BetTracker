/**
 * Runtime validators and parsers for FinalRow typed fields.
 * These ensure type safety at runtime and provide conversion utilities.
 */

import {
  BetResult,
  FinalResult,
  OverUnderFlag,
  SingleFlag,
  FormattedOdds,
  FormattedAmount,
  FormattedNet,
} from "../../types";
import { createLogger } from "./logger";
import {
  formatOdds as formatOddsShared,
  formatCurrency,
  formatNet as formatNetShared,
} from "../../utils/formatters";

const logger = createLogger("finalRowValidators");

/**
 * Validates and converts BetResult (lowercase) to FinalResult (title-case).
 */
export function toFinalResult(result: BetResult | string): FinalResult {
  const normalized = result.toLowerCase().trim();

  if (normalized === "win") return "Win";
  if (normalized === "loss") return "Loss";
  if (normalized === "push") return "Push";
  if (normalized === "pending") return "Pending";

  // Try to handle variations from CSV/user input
  if (normalized.startsWith("won")) return "Win";
  if (normalized.startsWith("lost") || normalized.startsWith("lose"))
    return "Loss";
  if (normalized.startsWith("push")) return "Push";

  // Default to pending for unknown values
  logger.warn('Unknown result value, defaulting to "Pending"', { result });
  return "Pending";
}

/**
 * Validates a FinalResult value.
 */
export function isValidFinalResult(value: string): value is FinalResult {
  return (
    value === "Win" ||
    value === "Loss" ||
    value === "Push" ||
    value === "Pending"
  );
}

/**
 * Parses a FinalResult from a string, with fallback to "Pending".
 */
export function parseFinalResult(
  value: string | undefined | null
): FinalResult {
  if (!value) return "Pending";
  return toFinalResult(value);
}

/**
 * Validates and creates an OverUnderFlag.
 */
export function toOverUnderFlag(
  value: boolean | string | undefined | null
): OverUnderFlag {
  if (value === undefined || value === null || value === "") return "";
  if (value === true || value === "1" || value === "true") return "1";
  if (value === false || value === "0" || value === "false") return "0";
  return "";
}

/**
 * Validates an OverUnderFlag value.
 */
export function isValidOverUnderFlag(value: string): value is OverUnderFlag {
  return value === "1" || value === "0" || value === "";
}

/**
 * Validates and creates a SingleFlag.
 */
export function toSingleFlag(
  value: boolean | string | undefined | null
): SingleFlag {
  if (value === true || value === "1" || value === "true") return "1";
  return "";
}

/**
 * Validates a SingleFlag value.
 */
export function isValidSingleFlag(value: string): value is SingleFlag {
  return value === "1" || value === "";
}

/**
 * Formats American odds to FormattedOdds string.
 * @param odds - American odds number (positive or negative integer)
 * @returns Formatted string with sign (e.g., "+360", "-120") or empty string
 */
export function formatOdds(odds: number | undefined | null): FormattedOdds {
  const formatted = formatOddsShared(odds);
  if (isValidFormattedOdds(formatted)) {
    return formatted;
  }
  logger.warn("formatOdds produced invalid output", { odds, formatted });
  return "" as FormattedOdds;
}

/**
 * Validates a FormattedOdds string.
 * Accepts: empty string, "+NNN", "-NNN", or "NNN" (unsigned) where NNN is an integer.
 */
export function isValidFormattedOdds(value: string): value is FormattedOdds {
  if (value === "") return true;
  // Match: optional + or -, then digits (allows unsigned positive numbers)
  const oddsPattern = /^[+-]?\d+$/;
  return oddsPattern.test(value);
}

/**
 * Parses FormattedOdds from a string, normalizing common formats.
 * Note: unsigned numeric strings (e.g. "120") are normalized to "+120".
 */
export function parseFormattedOdds(
  value: string | undefined | null
): FormattedOdds {
  if (!value || value.trim() === "") return "" as FormattedOdds;

  const trimmed = value.trim();
  if (isValidFormattedOdds(trimmed)) {
    // Normalize unsigned positive numbers by prefixing '+'
    if (/^\d+$/.test(trimmed)) {
      return `+${trimmed}` as FormattedOdds;
    }
    return trimmed as FormattedOdds;
  }

  logger.warn("Invalid formatted odds, defaulting to empty string", {
    value,
  });
  return "" as FormattedOdds;
}

/**
 * Formats a monetary amount to FormattedAmount (2 decimal places, no currency symbol).
 * @param amount - The amount to format
 * @returns Formatted string (e.g., "1.00", "3.60") or empty string
 */
/**
 * Formats a monetary amount to FormattedAmount.
 * Now uses shared formatCurrency which adds currency symbol and commas.
 * @param amount - The amount to format
 * @returns Formatted string (e.g., "$1,234.56") or empty string
 */
export function formatAmount(
  amount: number | undefined | null
): FormattedAmount {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return "" as FormattedAmount;
  }
  // Use shared formatter which adds $ and commas
  return formatCurrency(amount) as FormattedAmount;
}

/**
 * Validates a FormattedAmount string.
 * Accepts: empty string, or a decimal number with exactly 2 decimal places (e.g., "1.00", "3.60").
 */
export function isValidFormattedAmount(
  value: string
): value is FormattedAmount {
  if (value === "") return true;
  // Match: optional negative sign, digits, optional decimal point with exactly 2 decimal places
  const amountPattern = /^-?\d+\.\d{2}$/;
  return amountPattern.test(value);
}

/**
 * Parses FormattedAmount from a string, removing currency symbols and formatting to 2 decimals.
 */
export function parseFormattedAmount(
  value: string | undefined | null
): FormattedAmount {
  if (!value || value.trim() === "") return "" as FormattedAmount;

  // Remove currency symbols and commas
  const cleaned = value.trim().replace(/[$,\s]/g, "");

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    logger.warn("Invalid formatted amount, defaulting to empty string", {
      value,
    });
    return "" as FormattedAmount;
  }

  return formatAmount(parsed);
}

/**
 * Formats net profit/loss to FormattedNet (2 decimal places, can be negative or zero).
 * @param net - The net amount to format
 * @returns Formatted string (e.g., "-1.00", "0.00", "3.60") or empty string
 */
export function formatNet(net: number | undefined | null): FormattedNet {
  const formatted = formatNetShared(net);
  if (isValidFormattedNet(formatted)) {
    return formatted;
  }
  logger.warn("formatNet produced invalid output", { net, formatted });
  return "" as FormattedNet;
}

/**
 * Calculates and formats net profit/loss from result, stake, odds, and payout.
 */
export function calculateFormattedNet(
  result: BetResult | FinalResult | string,
  stake: number,
  odds: number | undefined | null,
  payout?: number
): FormattedNet {
  // Validate inputs
  if (isNaN(stake) || stake < 0) {
    logger.warn("Invalid stake for net calculation", {
      stake,
      odds,
    });
    return "" as FormattedNet;
  }

  const resultLower = (result || "").toLowerCase();

  if (resultLower === "pending") {
    return "" as FormattedNet;
  }

  if (resultLower === "win") {
    // Use payout if available, otherwise calculate from odds
    if (payout !== undefined && payout > 0) {
      const net = payout - stake;
      return formatNet(net);
    }

    // Calculate from odds
    const numericOdds = Number(odds);
    if (odds === undefined || odds === null || Number.isNaN(numericOdds)) {
      logger.warn("Missing or invalid odds for net calculation", {
        stake,
        odds,
        payout,
        result,
      });
      return "" as FormattedNet;
    }

    let profit = 0;
    if (numericOdds > 0) {
      // Positive odds: profit = stake * (odds/100)
      // e.g., $100 at +200 odds = $200 profit
      profit = stake * (numericOdds / 100);
    } else if (numericOdds < 0) {
      // Negative odds: profit = stake / (|odds|/100)
      // e.g., $110 at -110 odds = $100 profit
      profit = stake / (Math.abs(numericOdds) / 100);
    }
    return formatNet(profit);
  }

  if (resultLower === "loss") {
    return formatNet(-stake);
  }

  if (resultLower === "push") {
    return formatNet(0);
  }

  // Default for pending or unknown
  return "" as FormattedNet;
}

/**
 * Validates a FormattedNet string.
 * Accepts: empty string, or a decimal number with exactly 2 decimal places (can be negative).
 */
export function isValidFormattedNet(value: string): value is FormattedNet {
  if (value === "") return true;
  // Match: optional negative sign, digits, required decimal point with exactly 2 decimal places
  const netPattern = /^-?\d+\.\d{2}$/;
  return netPattern.test(value);
}

/**
 * Parses FormattedNet from a string, removing currency symbols and formatting to 2 decimals.
 */
export function parseFormattedNet(
  value: string | undefined | null
): FormattedNet {
  if (!value || value.trim() === "") return "" as FormattedNet;

  // Remove currency symbols and commas
  const cleaned = value.trim().replace(/[$,\s]/g, "");

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) {
    logger.warn("Invalid formatted net, defaulting to empty string", { value });
    return "" as FormattedNet;
  }

  return formatNet(parsed);
}
