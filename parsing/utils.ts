/**
 * Shared utilities for HTML parsing across different sportsbook parsers.
 */

import { Bet, StrictBetRow } from "../types";

/**
 * Normalizes whitespace in text content.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Parses a dollar amount string (e.g., "$25.50", "$1,234.56") to a number.
 */
export function parseAmount(text: string | null | undefined): number {
  if (!text) return 0;
  const cleaned = text.replace(/[$,]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parses American odds (e.g., "+150", "-110", "+192") to a number.
 */
export function parseAmericanOdds(text: string | null | undefined): number {
  if (!text) return 0;
  const cleaned = text.replace(/[+\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

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

/**
 * Determines bet result from text (won, lost, push, pending).
 */
export function parseBetResult(
  text: string | null | undefined
): "win" | "loss" | "push" | "pending" {
  if (!text) return "pending";
  const lower = text.toLowerCase();
  if (lower.includes("won") || lower.includes("win")) return "win";
  if (lower.includes("lost") || lower.includes("loss")) return "loss";
  if (lower.includes("push")) return "push";
  return "pending";
}

/**
 * Determines bet type from description and structure.
 */
export function inferBetType(
  description: string,
  legCount: number
): "single" | "parlay" | "sgp" | "live" | "other" {
  const lower = description.toLowerCase();
  if (lower.includes("sgp") || lower.includes("same game parlay")) return "sgp";
  if (lower.includes("live")) return "live";
  if (legCount > 1) {
    // Check if it's a same-game parlay (all legs same game) vs regular parlay
    if (lower.includes("parlay")) return "parlay";
    return "sgp"; // Default multi-leg to SGP if unclear
  }
  return "single";
}

/**
 * Extracts sport from description or other context.
 */
export function inferSport(
  description: string,
  legs?: Array<{ market?: string; entities?: string[] }>
): string {
  const lower = description.toLowerCase();

  // Check description for sport keywords
  const sportKeywords: { [key: string]: string[] } = {
    NBA: ["nba", "basketball", "points", "rebounds", "assists", "threes"],
    NFL: [
      "nfl",
      "football",
      "touchdown",
      "yards",
      "passing",
      "rushing",
      "receiving",
    ],
    MLB: ["mlb", "baseball", "hits", "strikeouts", "home runs", "runs"],
    NHL: ["nhl", "hockey", "goals", "assists", "shots"],
    Soccer: ["soccer", "football", "goals", "premier league", "mls"],
    Tennis: ["tennis", "wimbledon", "us open"],
  };

  for (const [sport, keywords] of Object.entries(sportKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return sport;
    }
  }

  // Default fallback
  return "Other";
}

/**
 * Parses market text to extract TYPE (stat code) and LINE (numeric threshold).
 * Handles various formats like "3+ MADE THREES", "To Record 6+ Assists", "Over 24.5 Points".
 */
export function parseMarketText(
  marketText: string
): { type: string; line: string | number; ou?: "Over" | "Under" } {
  if (!marketText) {
    return { type: "", line: "" };
  }

  const normalized = normalizeText(marketText);
  const lower = normalized.toLowerCase();

  // Remove "To Record" prefix if present
  let cleaned = normalized.replace(/^to\s+record\s+/i, "").trim();

  // Extract numeric threshold (e.g., "3+", "6.5", "24.5", "6+")
  // Patterns: "3+", "6.5", "24.5", "10+", etc.
  const lineMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*\+/);
  let line: string | number = "";
  if (lineMatch) {
    // Found "X+" pattern
    line = lineMatch[1] + "+";
  } else {
    // Try to find just a number (for "Over 24.5 Points" style)
    const numMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      line = numMatch[1];
    }
  }

  // Detect Over/Under
  let ou: "Over" | "Under" | undefined = undefined;
  if (/over\s+\d+/i.test(cleaned)) {
    ou = "Over";
  } else if (/under\s+\d+/i.test(cleaned)) {
    ou = "Under";
  }

  // Remove the numeric part and clean up for stat type detection
  const statText = cleaned
    .replace(/\d+(?:\.\d+)?\s*\+?/g, "")
    .replace(/over\s+/gi, "")
    .replace(/under\s+/gi, "")
    .replace(/to\s+record\s+/gi, "")
    .replace(/to\s+score\s+/gi, "")
    .trim();

  // Normalize stat text to stat code
  const statLower = statText.toLowerCase();

  // Special props without numeric thresholds
  if (
    statLower.includes("first basket") ||
    statLower.includes("first field goal") ||
    statLower.includes("first fg")
  ) {
    return { type: "FB", line, ou };
  }

  if (
    statLower.includes("top scorer") ||
    statLower.includes("top points") ||
    statLower.includes("top pts")
  ) {
    return { type: "Top Pts", line, ou };
  }

  if (statLower.includes("triple double")) {
    return { type: "TD", line, ou };
  }

  if (statLower.includes("double double")) {
    return { type: "DD", line, ou };
  }

  // Map stat phrases to stat codes (case-insensitive)
  // IMPORTANT: Check combined stats BEFORE individual stats to avoid early matches
  
  // Combined stats (order matters - check longer combinations first)
  // Check for PRA (Points + Rebounds + Assists) first
  if (
    (statLower.includes("points") || statLower.includes("pts")) &&
    (statLower.includes("rebounds") || statLower.includes("reb")) &&
    (statLower.includes("assists") || statLower.includes("ast"))
  ) {
    return { type: "PRA", line, ou };
  }

  // Check for PR (Points + Rebounds)
  if (
    (statLower.includes("points") || statLower.includes("pts")) &&
    (statLower.includes("rebounds") || statLower.includes("reb"))
  ) {
    return { type: "PR", line, ou };
  }

  // Check for RA (Rebounds + Assists)
  if (
    (statLower.includes("rebounds") || statLower.includes("reb")) &&
    (statLower.includes("assists") || statLower.includes("ast"))
  ) {
    return { type: "RA", line, ou };
  }

  // Check for PA (Points + Assists)
  if (
    (statLower.includes("points") || statLower.includes("pts")) &&
    (statLower.includes("assists") || statLower.includes("ast"))
  ) {
    return { type: "PA", line, ou };
  }

  // Steals + Blocks (Stocks) - check before individual steals/blocks
  if (
    (statLower.includes("steals") || statLower.includes("stl")) &&
    (statLower.includes("blocks") || statLower.includes("blk"))
  ) {
    return { type: "Stocks", line, ou };
  }

  // Individual stats (check after combined stats)
  if (
    statLower.includes("made threes") ||
    statLower.includes("3-pointers") ||
    statLower.includes("3 pointers") ||
    statLower.includes("threes")
  ) {
    return { type: "3pt", line, ou };
  }

  if (
    statLower.includes("points") ||
    statLower.includes("pts") ||
    statLower.includes("total points")
  ) {
    return { type: "Pts", line, ou };
  }

  if (statLower.includes("assists") || statLower.includes("ast")) {
    return { type: "Ast", line, ou };
  }

  if (
    statLower.includes("rebounds") ||
    statLower.includes("reb") ||
    statLower.includes("total rebounds")
  ) {
    return { type: "Reb", line, ou };
  }

  // Steals
  if (statLower.includes("steals") || statLower.includes("stl")) {
    return { type: "Stl", line, ou };
  }

  // Blocks
  if (statLower.includes("blocks") || statLower.includes("blk")) {
    return { type: "Blk", line, ou };
  }

  // Turnovers
  if (statLower.includes("turnovers") || statLower.includes("to")) {
    return { type: "TO", line, ou };
  }

  // Fallback: return cleaned stat text if no match
  return { type: statText || normalized, line, ou };
}

/**
 * Formats an ISO date string to YYYY-MM-DD format.
 */
export function formatDateToYYYYMMDD(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
}

/**
 * Formats American odds number to string with +/- sign.
 */
export function formatAmericanOdds(odds: number): string {
  if (odds === 0) return "";
  return odds > 0 ? `+${odds}` : `${odds}`;
}

