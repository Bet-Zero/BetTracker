/**
 * DraftKings Parser - Stage A: Raw Extraction Only
 * 
 * This parser ONLY extracts raw data from HTML.
 * No interpretation, no mapping, no logic.
 * All logic happens in normalizeBet.ts
 */

import { FinalRow } from '../../types';
import { RawBet } from '../rawBetTypes';
import { normalizeBet } from '../normalizeBet';
import { normalizeText } from '../utils';

/**
 * Parses raw HTML content from a DraftKings settled bets page.
 * Extracts RawBet objects and normalizes them to FinalRow[].
 */
export const parse = (htmlContent: string): FinalRow[] => {
  console.log("Starting DraftKings parse...");
  const rows: FinalRow[] = [];

  if (!htmlContent || !htmlContent.trim()) {
    console.warn("DraftKings parser: Empty HTML content provided.");
    return rows;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // DraftKings bet cards have data-test-id="bet-card-{betId}" attributes
    const betCardPattern = /data-test-id="bet-card-(\d+)"/g;
    const htmlText = doc.documentElement.innerHTML;
    const betCardMatches = Array.from(htmlText.matchAll(betCardPattern));

    console.log(`DraftKings parser: Found ${betCardMatches.length} bet cards.`);

    for (const match of betCardMatches) {
      try {
        const betId = match[1];
        const matchIndex = match.index!;
        
        // Extract the bet card section around this bet ID
        const startIndex = Math.max(0, matchIndex - 1000);
        const endIndex = Math.min(htmlText.length, matchIndex + 20000);
        const betSection = htmlText.substring(startIndex, endIndex);

        // Create a temporary element to parse the section
        const tempDiv = doc.createElement('div');
        tempDiv.innerHTML = betSection;
        const betCard = tempDiv.querySelector(`[data-test-id="bet-card-${betId}"]`);

        if (!betCard) {
          console.warn(`DraftKings parser: Could not find bet card element for ${betId}`);
          continue;
        }

        // Extract RawBet from the bet card
        const rawBet = extractRawBet(betId, betCard, betSection);
        if (rawBet) {
          // Normalize the raw bet
          const finalRow = normalizeBet(rawBet);
          if (finalRow) {
            rows.push(finalRow);
            console.log(`DraftKings parser: Successfully parsed bet ${betId}`);
          } else {
            console.log(`DraftKings parser: Skipped multi-leg bet ${betId}`);
          }
        } else {
          console.warn(`DraftKings parser: Failed to extract raw bet ${betId}`);
        }
      } catch (error) {
        console.warn(`DraftKings parser: Failed to parse bet card for bet ID ${match[1]}:`, error);
      }
    }

    console.log(`DraftKings parser: Successfully parsed ${rows.length} bets.`);
  } catch (error) {
    console.error("DraftKings parser: Error parsing HTML:", error);
  }

  return rows;
};

/**
 * Extracts raw bet data from a DraftKings bet card element.
 * NO interpretation, NO mapping, just raw text extraction.
 */
function extractRawBet(betId: string, betCard: Element, betSection: string): RawBet | null {
  try {
    const cardText = betCard.textContent || '';
    const cardHtml = betCard.innerHTML || '';

    // Extract bet title (e.g., "4+" for 4-leg parlay)
    const titleMatch = betSection.match(new RegExp(`data-test-id="bet-details-title-${betId}"[^>]*>([^<]+)`));
    const title = titleMatch ? normalizeText(titleMatch[1]) : '';

    // Extract odds - raw string
    const oddsMatch = betSection.match(new RegExp(`data-test-id="bet-details-displayOdds-${betId}"[^>]*>([^<]+)`));
    const odds = oddsMatch ? normalizeText(oddsMatch[1]) : '';

    // Extract subtitle (bet description/legs) - this is the raw market text
    const subtitleMatch = betSection.match(new RegExp(`data-test-id="bet-details-subtitle-${betId}"[^>]*>([^<]+)`));
    const subtitle = subtitleMatch ? normalizeText(subtitleMatch[1]) : '';
    const rawMarketText = subtitle || title || '';

    // Extract status (Won/Lost/Pending) - not used in RawBet, but check for result context
    const statusMatch = betSection.match(new RegExp(`data-test-id="bet-details-status-${betId}"[^>]*>([^<]+)`));
    const statusText = statusMatch ? normalizeText(statusMatch[1]) : '';

    // Extract stake (Wager) - raw string
    const stakeMatch = betSection.match(new RegExp(`data-test-id="bet-stake-${betId}"[^>]*>([^<]+)`));
    const stakeText = stakeMatch ? stakeMatch[1] : '';
    const wager = stakeText.replace(/Wager:\s*/i, '').trim();

    // Extract payout (Paid) - raw string
    const returnsMatch = betSection.match(new RegExp(`data-test-id="bet-returns-${betId}"[^>]*>([^<]+)`));
    const returnsText = returnsMatch ? returnsMatch[1] : '';
    const returned = returnsText.replace(/Paid:\s*/i, '').trim();

    // Extract team names (for event context)
    const team1Match = betSection.match(/data-test-id="event-team-name-1-(\d+)"[^>]*>([^<]+)/);
    const team2Match = betSection.match(/data-test-id="event-team-name-2-(\d+)"[^>]*>([^<]+)/);
    const team1 = team1Match ? normalizeText(team1Match[2]) : '';
    const team2 = team2Match ? normalizeText(team2Match[2]) : '';
    const teamNames: string[] = [];
    if (team1) teamNames.push(team1);
    if (team2) teamNames.push(team2);
    const game = team1 && team2 ? `${team1} vs ${team2}` : '';

    // Extract date information - raw string
    const datePattern = /([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM))/;
    const dateMatch = betSection.match(datePattern);
    const placedAt = dateMatch ? dateMatch[1] : '';

    // Extract player name from subtitle if present
    let playerName = '';
    if (subtitle) {
      // Pattern: "Player Name Market" or "Player Name Market Over X"
      const playerMatch = subtitle.match(/^([A-Z][a-zA-Z\s]+?)\s+([A-Z])/);
      if (playerMatch && playerMatch[1]) {
        playerName = playerMatch[1].trim();
      }
    }

    // Check for multi-leg (parlay/SGP)
    const legCountMatch = title.match(/(\d+)\+/);
    const legCount = legCountMatch ? parseInt(legCountMatch[1], 10) : 1;
    const isMultiLeg = legCount > 1 || cardText.toLowerCase().includes('parlay') || cardText.toLowerCase().includes('sgp');

    // Check for live bet
    const isLive = cardText.toLowerCase().includes('live') || cardText.toLowerCase().includes('in-game');

    // Check for tail
    const isTail = false; // TODO: detect tailing if needed

    return {
      site: 'DraftKings',
      rawMarketText: rawMarketText,
      playerName: playerName || undefined,
      teamNames: teamNames.length > 0 ? teamNames : undefined,
      game: game || undefined,
      eventDateTime: undefined,
      placedAt: placedAt || undefined,
      odds: odds || undefined,
      wager: wager || undefined,
      returned: returned || undefined,
      betId: `DK${betId}`,
      isMultiLeg,
      isLive,
      isTail,
    };
  } catch (error) {
    console.warn(`DraftKings parser: Error extracting raw bet for ${betId}:`, error);
    return null;
  }
}
