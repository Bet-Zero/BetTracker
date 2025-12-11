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

      // Simple heuristic for now:
      const betTypeSubtitles = card.querySelectorAll(
        'span[data-test-id^="bet-details-subtitle-"]'
      );
      let typeText = "";
      if (betTypeSubtitles.length > 0) {
        typeText = betTypeSubtitles[0].textContent?.toLowerCase() || "";
      }

      let isParlay =
        typeText.includes("parlay") ||
        typeText.includes("sgp") ||
        typeText.includes("+");

      const context = { element: card, header, footer };

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
