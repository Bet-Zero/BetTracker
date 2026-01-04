/**
 * Shared Formatting Utilities
 *
 * Pure functions for consistent date, odds, currency, and percentage formatting
 * across the BetTracker application.
 *
 * This module is the single source of truth for display formatting.
 */

// =============================================================================
// DATE FORMATTERS
// =============================================================================

/**
 * Formats a date for short display (MM/DD) — used in BetTable columns.
 * @param isoOrDateLike - ISO string or Date-like value
 * @returns "MM/DD" format string, or "" for invalid input
 */
export function formatDateShort(isoOrDateLike: string | Date | null | undefined): string {
  if (!isoOrDateLike) return "";

  try {
    const date = typeof isoOrDateLike === "string" ? new Date(isoOrDateLike) : isoOrDateLike;
    if (isNaN(date.getTime())) return "";

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}/${day}`;
  } catch {
    return "";
  }
}

/**
 * Formats a date as chart grouping key (YYYY-MM-DD) — used for chart X-axis.
 * Equivalent to toLocaleDateString('en-CA').
 * @param isoOrDateLike - ISO string or Date-like value
 * @returns "YYYY-MM-DD" format string, or "" for invalid input
 */
export function formatDateChartKey(isoOrDateLike: string | Date | null | undefined): string {
  if (!isoOrDateLike) return "";

  try {
    const date = typeof isoOrDateLike === "string" ? new Date(isoOrDateLike) : isoOrDateLike;
    if (isNaN(date.getTime())) return "";

    // Use en-CA locale which outputs YYYY-MM-DD format
    return date.toLocaleDateString("en-CA");
  } catch {
    return "";
  }
}

/**
 * Formats a date for export (MM/DD/YY) — used in betToFinalRows export.
 * @param isoOrDateLike - ISO string or Date-like value
 * @returns "MM/DD/YY" format string, or "" for invalid input
 */
export function formatDateShortWithYear(isoOrDateLike: string | Date | null | undefined): string {
  if (!isoOrDateLike) return "";

  try {
    const date = typeof isoOrDateLike === "string" ? new Date(isoOrDateLike) : isoOrDateLike;
    if (isNaN(date.getTime())) return "";

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  } catch {
    return "";
  }
}

/**
 * @deprecated Use formatDateShortWithYear instead. Kept for backward compatibility during refactor.
 */
export const formatDateExport = formatDateShortWithYear;

// =============================================================================
// ODDS FORMATTER
// =============================================================================

/**
 * Formats American odds with appropriate sign.
 * @param odds - Odds value (number or string)
 * @returns Formatted string with sign ("+150", "-110") or "" for invalid input
 */
export function formatOdds(odds: number | string | null | undefined): string {
  if (odds === null || odds === undefined || odds === "") return "";

  const numericOdds = typeof odds === "string" ? parseFloat(odds) : odds;
  if (isNaN(numericOdds) || numericOdds === 0) return "";

  // Round to integer for American odds
  const intOdds = Math.round(numericOdds);

  if (intOdds > 0) {
    return `+${intOdds}`;
  }
  return `${intOdds}`; // Negative odds already have "-"
}

// =============================================================================
// CURRENCY/AMOUNT FORMATTER
// =============================================================================

/**
 * Formats a monetary amount to currency style ($1,234.56).
 * @param amount - The amount to format
 * @returns Formatted string (e.g., "$1,234.56") or "" for invalid input
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "";
  }
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}

// =============================================================================
// PERCENTAGE FORMATTER
// =============================================================================

/**
 * Formats a percentage value with % suffix.
 * @param value - The percentage value (e.g., 55.5 for 55.5%)
 * @returns Formatted string (e.g., "65.5%") or "" for invalid input
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "";
  }
  return `${value.toFixed(1)}%`;
}

// =============================================================================
// NET (PROFIT/LOSS) FORMATTER
// =============================================================================

/**
 * Formats net profit/loss to consistent string format.
 * Currently matches existing validation logic (2 decimal places, no currency symbol yet).
 * @param amount - The net amount to format
 * @returns Formatted string (e.g., "100.50", "-50.00") or "" for invalid input
 */
export function formatNet(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "";
  }
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
