import { Bet } from "../../../types";
import { extractFooterMeta, extractHeaderInfo } from "./common";
import { parseSingleBet } from "./single";
import { parseParlayBet } from "./parlay";

export const parseDraftKingsHTML = (html: string): Bet[] => {
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
        typeText = betTypeSubtitles[0].textContent?.toLowerCase() || "";
      }

      // Check card text content for SGPx or parlay indicators
      const cardText = (card.textContent || "").toLowerCase();
      
      // Detect bet type: single, parlay, sgp, or sgp_plus (SGPx)
      let betType: 'single' | 'parlay' | 'sgp' | 'sgp_plus' | null = null;
      
      // Check for SGP indicator in data-test-id (most reliable)
      const hasSGPTestId = card.querySelector('[data-test-id^="sgp-"]') !== null;
      
      // Check for SGPx (DraftKings' term for SGP+)
      if (cardText.includes('sgpx')) {
        betType = 'sgp_plus';
      }
      // Check for regular SGP (from test-id or text)
      else if (hasSGPTestId || typeText.includes('sgp') || cardText.includes('same game parlay')) {
        betType = 'sgp';
      }
      // Check for regular parlay
      else if (typeText.includes('parlay') || cardText.includes('parlay')) {
        betType = 'parlay';
      }

      const isParlay = betType !== null && betType !== 'single';

      const context = { element: card, header, footer, betType: betType || undefined };

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
