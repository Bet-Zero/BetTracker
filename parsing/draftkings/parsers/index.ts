import { Bet } from "../../../types";
import {
  extractFooterMeta,
  extractHeaderInfo,
  normalizeBetType,
} from "./common";
import { parseSingleBet } from "./single";
import { parseParlayBet } from "./parlay";

/**
 * Parses DraftKings HTML into Bet objects.
 * 
 * SECURITY NOTE:
 * - DOMParser creates an in-memory document only; scripts are NOT executed.
 * - The parsed document is used solely for data extraction via querySelector.
 * - Raw HTML is never stored or rendered; only extracted bet data is returned.
 */
export const parseDraftKingsHTML = (html: string): Bet[] => {
  // SECURITY: DOMParser safely parses HTML into an in-memory document.
  // Scripts embedded in HTML are NOT executed by DOMParser.
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const bets: Bet[] = [];

  const betCards = doc.querySelectorAll('div[data-test-id^="bet-card-"]');

  betCards.forEach((card) => {
    try {
      const header = extractHeaderInfo(card);
      const footer = extractFooterMeta(card);

      // Determine bet type more accurately
      const betTypeSubtitles = card.querySelectorAll(
        'span[data-test-id^="bet-details-subtitle-"]'
      );
      let typeText = "";
      if (betTypeSubtitles.length > 0) {
        typeText = betTypeSubtitles[0].textContent || "";
      }

      // Check card text content for SGPx or parlay indicators
      const cardText = card.textContent || "";

      // Check for SGP indicator in data-test-id (most reliable)
      const hasSGPTestId =
        card.querySelector('[data-test-id^="sgp-"]') !== null;

      // Use normalizeBetType to reuse terminology logic
      let betType: "parlay" | "sgp" | "sgp_plus" | null = null;

      // Priority 1: Check for SGPx explicitly
      if (cardText.toLowerCase().includes("sgpx")) {
        betType = "sgp_plus";
      }
      // Priority 2: Check for SGP test-id
      else if (hasSGPTestId) {
        betType = "sgp";
      }
      // Priority 3: Use normalizeBetType for subtitle and card text
      else {
        betType = normalizeBetType(typeText) ?? normalizeBetType(cardText);
      }

      const isParlay = betType !== null;

      const context = {
        element: card,
        header,
        footer,
        betType: betType || undefined,
      };

      const bet = isParlay ? parseParlayBet(context) : parseSingleBet(context);

      if (bet) {
        bets.push(bet);
      }
    } catch (e) {
      console.error("Error parsing DK bet card", e);
    }
  });

  return bets;
};

// Export as 'parse' for consistency with pageProcessor
export const parse = parseDraftKingsHTML;
