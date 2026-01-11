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

/**
 * Parses user date input and returns a new ISO string with updated date.
 * Accepts formats: MM/DD/YY, MM/DD/YYYY, M/D/YY, M/D/YYYY, MM/DD, M/D
 * Time is set to 12:00:00 local time to avoid timezone edge cases.
 * @param input - User input string (e.g., "01/15/26", "1/15/2026", or "01/15")
 * @param originalIso - Original ISO string to use as fallback for year when input is MM/DD format
 * @returns New ISO string with updated date, or null if parsing fails
 */
export function parseDateInput(input: string, originalIso: string): string | null {
  if (!input || !input.trim()) return null;

  // Remove whitespace
  const trimmed = input.trim();

  // Try pattern with year first: MM/DD/YY, MM/DD/YYYY, M/D/YY, M/D/YYYY
  const datePatternWithYear = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
  const matchWithYear = trimmed.match(datePatternWithYear);

  if (matchWithYear) {
    const [, monthStr, dayStr, yearStr] = matchWithYear;
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    const yearFull = yearStr.length === 2 
      ? 2000 + parseInt(yearStr, 10)  // Assume 2000s for 2-digit years
      : parseInt(yearStr, 10);

    // Validate month and day ranges
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    try {
      // Create date at 12:00:00 local time to avoid timezone edge cases
      const newDate = new Date(yearFull, month - 1, day, 12, 0, 0);
      
      // Validate the date is actually valid (catches invalid dates like Feb 30)
      if (
        newDate.getFullYear() !== yearFull ||
        newDate.getMonth() !== month - 1 ||
        newDate.getDate() !== day
      ) {
        return null;
      }

      // Return ISO string
      return newDate.toISOString();
    } catch {
      return null;
    }
  }

  // Try pattern without year: MM/DD, M/D (use year from originalIso)
  const datePatternWithoutYear = /^(\d{1,2})\/(\d{1,2})$/;
  const matchWithoutYear = trimmed.match(datePatternWithoutYear);

  if (matchWithoutYear) {
    const [, monthStr, dayStr] = matchWithoutYear;
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    // Validate month and day ranges
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;

    // Extract year from originalIso
    let yearFull: number;
    try {
      const originalDate = new Date(originalIso);
      if (isNaN(originalDate.getTime())) return null;
      yearFull = originalDate.getFullYear();
    } catch {
      return null;
    }

    try {
      // Create date at 12:00:00 local time to avoid timezone edge cases
      const newDate = new Date(yearFull, month - 1, day, 12, 0, 0);
      
      // Validate the date is actually valid (catches invalid dates like Feb 30)
      if (
        newDate.getFullYear() !== yearFull ||
        newDate.getMonth() !== month - 1 ||
        newDate.getDate() !== day
      ) {
        return null;
      }

      // Return ISO string
      return newDate.toISOString();
    } catch {
      return null;
    }
  }

  // No pattern matched
  return null;
}

// =============================================================================
// MMDD INPUT HELPERS (Digits-Only Date Input)
// =============================================================================

/**
 * Auto-formats raw digit input as MM/DD as user types.
 * - 0 → 0
 * - 01 → 01
 * - 011 → 01/1
 * - 0110 → 01/10
 * @param rawDigits - Digits only string (max 4 characters)
 * @returns Formatted string with slash where appropriate
 */
export function formatMMDDInput(rawDigits: string): string {
  // Extract only digits
  const digits = rawDigits.replace(/\D/g, "").slice(0, 4);
  
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  
  // Insert slash after first 2 digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Parses MM/DD formatted string to month and day numbers.
 * @param formatted - String like "01/10" or "0110" or "01/1"
 * @returns { month, day } or null if invalid format
 */
export function parseMMDDInput(formatted: string): { month: number; day: number } | null {
  // Remove non-digits to extract raw digits
  const digits = formatted.replace(/\D/g, "");
  
  // Must have exactly 4 digits for complete MM/DD
  if (digits.length !== 4) return null;
  
  const month = parseInt(digits.slice(0, 2), 10);
  const day = parseInt(digits.slice(2, 4), 10);
  
  if (isNaN(month) || isNaN(day)) return null;
  
  return { month, day };
}

/**
 * Validates if month/day is a valid calendar date (uses current year).
 * @param month - 1-12
 * @param day - 1-31
 * @returns true if valid date for current year
 */
export function isValidMMDD(month: number, day: number): boolean {
  // Basic range check
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  
  // Use current year for calendar validation
  const year = new Date().getFullYear();
  
  // Create date and verify it didn't roll over (catches Feb 30, etc.)
  const testDate = new Date(year, month - 1, day, 12, 0, 0);
  
  return (
    testDate.getFullYear() === year &&
    testDate.getMonth() === month - 1 &&
    testDate.getDate() === day
  );
}

/**
 * Builds an ISO date string from month/day using current year.
 * Time is set to 12:00:00 local to avoid timezone day rollover.
 * @param month - 1-12
 * @param day - 1-31
 * @returns ISO string, or null if invalid
 */
export function buildIsoFromMMDD(month: number, day: number): string | null {
  if (!isValidMMDD(month, day)) return null;
  
  const year = new Date().getFullYear();
  const newDate = new Date(year, month - 1, day, 12, 0, 0);
  
  return newDate.toISOString();
}

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
