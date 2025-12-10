/**
 * FanDuel-specific utilities for HTML parsing.
 */

/**
 * Parses a FanDuel date string (e.g., "11/16/2025 9:14PM ET") to ISO timestamp.
 */
export function parseFanDuelDate(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString();

  try {
    // Format: "11/16/2025 9:14PM ET"
    const cleaned = dateStr.trim();
    const match = cleaned.match(
      /(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(AM|PM)\s+ET/
    );
    if (!match) return new Date().toISOString();

    const [, month, day, year, hour, minute, ampm] = match;
    let hour24 = parseInt(hour, 10);
    if (ampm === "PM" && hour24 !== 12) hour24 += 12;
    if (ampm === "AM" && hour24 === 12) hour24 = 0;

    const date = new Date(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour24
        .toString()
        .padStart(2, "0")}:${minute}:00-05:00`
    );
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

