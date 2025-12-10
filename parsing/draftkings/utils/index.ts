/**
 * DraftKings-specific utilities for HTML parsing.
 */

/**
 * Parses a DraftKings date string to ISO timestamp.
 * DraftKings dates are typically in ISO format already, but we handle various formats.
 */
export function parseDraftKingsDate(
  dateStr: string | null | undefined
): string {
  if (!dateStr) return new Date().toISOString();

  try {
    // Try ISO format first
    const isoDate = new Date(dateStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate.toISOString();
    }
    // Fallback to current date
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

