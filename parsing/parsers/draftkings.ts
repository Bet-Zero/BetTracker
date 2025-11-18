import { Bet, BetResult, BetType, BetLeg } from '../../types';
import { classifyBet } from '../../services/classificationService';
import {
  normalizeText,
  parseAmount,
  parseAmericanOdds,
  parseDraftKingsDate,
  parseBetResult,
  inferBetType,
  inferSport,
} from '../utils';

/**
 * Parses raw HTML content from a DraftKings settled bets page.
 * Extracts bet information from the HTML structure and returns normalized Bet objects.
 */
export const parse = (htmlContent: string): Bet[] => {
  console.log("Starting DraftKings parse...");
  const bets: Bet[] = [];

  if (!htmlContent || !htmlContent.trim()) {
    console.warn("DraftKings parser: Empty HTML content provided.");
    return bets;
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

        // Parse bet details from the section
        const bet = parseDraftKingsBetCard(betId, betSection, htmlText);
        if (bet) {
          bets.push(bet);
        }
      } catch (error) {
        console.warn(`DraftKings parser: Failed to parse bet card for bet ID ${match[1]}:`, error);
      }
    }

    console.log(`DraftKings parser: Successfully parsed ${bets.length} bets.`);
  } catch (error) {
    console.error("DraftKings parser: Error parsing HTML:", error);
  }

  return bets;
};

/**
 * Parses a single DraftKings bet card section.
 */
function parseDraftKingsBetCard(betId: string, betSection: string, fullHtml: string): Bet | null {
  try {
    // Extract bet title (e.g., "4+" for 4-leg parlay)
    const titleMatch = betSection.match(new RegExp(`data-test-id="bet-details-title-${betId}"[^>]*>([^<]+)`));
    const title = titleMatch ? normalizeText(titleMatch[1]) : '';

    // Extract odds
    const oddsMatch = betSection.match(new RegExp(`data-test-id="bet-details-displayOdds-${betId}"[^>]*>([^<]+)`));
    const odds = oddsMatch ? parseAmericanOdds(oddsMatch[1]) : 0;

    // Extract subtitle (bet description/legs)
    const subtitleMatch = betSection.match(new RegExp(`data-test-id="bet-details-subtitle-${betId}"[^>]*>([^<]+)`));
    const subtitle = subtitleMatch ? normalizeText(subtitleMatch[1]) : '';

    // Extract status (Won/Lost/Pending)
    const statusMatch = betSection.match(new RegExp(`data-test-id="bet-details-status-${betId}"[^>]*>([^<]+)`));
    const statusText = statusMatch ? normalizeText(statusMatch[1]) : '';
    const result = parseBetResult(statusText);

    // Extract stake (Wager)
    const stakeMatch = betSection.match(new RegExp(`data-test-id="bet-stake-${betId}"[^>]*>([^<]+)`));
    const stakeText = stakeMatch ? stakeMatch[1] : '';
    const stake = parseAmount(stakeText.replace(/Wager:\s*/i, ''));

    // Extract payout (Paid)
    const returnsMatch = betSection.match(new RegExp(`data-test-id="bet-returns-${betId}"[^>]*>([^<]+)`));
    const returnsText = returnsMatch ? returnsMatch[1] : '';
    const payout = parseAmount(returnsText.replace(/Paid:\s*/i, ''));

    // Extract team names (for event context)
    const team1Match = betSection.match(/data-test-id="event-team-name-1-(\d+)"[^>]*>([^<]+)/);
    const team2Match = betSection.match(/data-test-id="event-team-name-2-(\d+)"[^>]*>([^<]+)/);
    const team1 = team1Match ? normalizeText(team1Match[2]) : '';
    const team2 = team2Match ? normalizeText(team2Match[2]) : '';

    // Extract date information
    // Look for date patterns like "Nov 8, 2025, 6:05:21 PM"
    const datePattern = /([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}:\d{2}\s+(?:AM|PM))/;
    const dateMatch = betSection.match(datePattern);
    let placedAt = new Date().toISOString();
    if (dateMatch) {
      try {
        const dateStr = dateMatch[1];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          placedAt = parsedDate.toISOString();
        }
      } catch {
        // Keep default
      }
    }

    // Parse legs from subtitle and bet section
    const legs: BetLeg[] = [];
    let description = subtitle || title || `DraftKings Bet ${betId}`;

    // Determine bet type from title (e.g., "4+" means 4-leg parlay)
    const legCountMatch = title.match(/(\d+)\+/);
    const legCount = legCountMatch ? parseInt(legCountMatch[1], 10) : 1;

    // Parse individual legs from subtitle or bet section
    // DraftKings format: "Player Name Market" or "Player Name Market Over/Under X"
    if (subtitle) {
      // Try to parse subtitle as leg(s)
      // Pattern: "Player Name Market" or "Player Name Market Over X"
      const legPatterns = [
        /([A-Z][a-zA-Z\s]+?)\s+([A-Z][a-zA-Z\s]+?)\s+(Over|Under)\s+([\d.]+)/g,
        /([A-Z][a-zA-Z\s]+?)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(\d+)\+)?/g,
      ];

      for (const pattern of legPatterns) {
        let legMatch;
        const seenLegs = new Set<string>();
        while ((legMatch = pattern.exec(subtitle)) !== null) {
          const key = legMatch[0];
          if (seenLegs.has(key)) continue;
          seenLegs.add(key);

          const entity = normalizeText(legMatch[1]);
          const market = normalizeText(legMatch[2]);
          const ou = legMatch[3] === 'Over' || legMatch[3] === 'Under' ? (legMatch[3] as 'Over' | 'Under') : undefined;
          const target = legMatch[4] ? parseFloat(legMatch[4]) : (legMatch[3] && !ou ? parseFloat(legMatch[3]) : undefined);

          legs.push({
            entities: [entity],
            market: market,
            target: target,
            ou: ou,
            result: result,
          });
        }
        if (legs.length > 0) break;
      }

      // If no structured legs found, create one from subtitle
      if (legs.length === 0 && subtitle) {
        // Try to split by common delimiters if multiple legs
        const legTexts = subtitle.split(/[,\/]/).map(t => t.trim()).filter(t => t.length > 0);
        for (const legText of legTexts) {
          // Extract entity and market
          const parts = legText.match(/([A-Z][a-zA-Z\s]+?)\s+(.+)/);
          if (parts) {
            legs.push({
              entities: [normalizeText(parts[1])],
              market: normalizeText(parts[2]),
              result: result,
            });
          } else {
            // Single entity or market
            legs.push({
              entities: [normalizeText(legText)],
              market: 'Unknown',
              result: result,
            });
          }
        }
      }
    }

    // If still no legs and we have teams, create a team-based leg
    if (legs.length === 0 && (team1 || team2)) {
      if (team1 && team2) {
        legs.push({
          entities: [team1, team2],
          market: 'Moneyline',
          result: result,
        });
        if (!description || description === title) {
          description = `${team1} vs ${team2}`;
        }
      } else if (team1) {
        legs.push({
          entities: [team1],
          market: 'Moneyline',
          result: result,
        });
      }
    }

    // Infer bet type
    const betType = inferBetType(description, legCount);

    // Infer sport
    const sport = inferSport(description, legs);

    // Generate unique ID
    const id = `DraftKings-${betId}-${placedAt}`;

    // Create bet object (marketCategory will be set by classifyBet)
    const betData: Omit<Bet, 'marketCategory'> = {
      id,
      book: 'DraftKings',
      betId: `DK${betId}`,
      placedAt,
      settledAt: result !== 'pending' ? placedAt : undefined,
      betType,
      sport,
      description: description || `DraftKings Bet ${betId}`,
      odds: odds || (stake > 0 && payout > stake ? Math.round(((payout - stake) / stake) * 100) : 0),
      stake,
      payout,
      result,
      legs: legs.length > 0 ? legs : undefined,
      raw: betSection.substring(0, 500), // Store first 500 chars for debugging
    };

    // Classify the bet
    const marketCategory = classifyBet(betData);

    return {
      ...betData,
      marketCategory,
    };
  } catch (error) {
    console.warn(`DraftKings parser: Error parsing bet card for ${betId}:`, error);
    return null;
  }
}
