import { Bet, BetResult, BetType } from '../../../types';
// FIX: Import the classification service to automatically determine the market category.
import { classifyBet } from '../../../services/classificationService';

/**
 * Parses raw HTML content from a DraftKings settled bets page.
 * 
 * TODO [CRIT-04][NEEDS_DECISION]: This parser currently returns hardcoded example bets.
 * Decision required: Either implement a real HTML parser (similar to FanDuel parser)
 * or disable DraftKings option in the UI with clear messaging.
 * 
 * This is a placeholder and needs to be implemented with real data.
 */
export const parse = (htmlContent: string): Bet[] => {
  console.log("Starting DraftKings parse...");
  const bets: Bet[] = [];
  
  // Placeholder Example 1
  const betId1 = 'DK638982435218573479';
  const placedAt1 = new Date('2023-11-12T14:00:00Z').toISOString();
  // FIX: Add missing 'marketCategory' property to conform to the Bet type.
  const bet1Data = {
    id: `DraftKings-${betId1}-${placedAt1}`,
    book: 'DraftKings',
    betId: betId1,
    placedAt: placedAt1,
    settledAt: new Date('2023-11-12T17:00:00Z').toISOString(),
    betType: 'parlay' as BetType,
    sport: 'NBA',
    description: "2-Leg Parlay: T. Watford Assists / J. Allen Rebounds",
    odds: 192,
    stake: 2.00,
    payout: 5.84,
    result: 'win' as BetResult,
    legs: [
        // FIX: Explicitly cast 'result' to BetResult to resolve type incompatibility.
        // FIX: The 'BetLeg' type uses 'entities' not 'player'. Corrected the property name.
        { market: "Assists", entities: ["Trendon Watford"], result: 'win' as BetResult },
        // FIX: Explicitly cast 'result' to BetResult to resolve type incompatibility.
        // FIX: The 'BetLeg' type uses 'entities' not 'player'. Corrected the property name.
        { market: "Rebounds", entities: ["Jarrett Allen"], result: 'win' as BetResult }
    ],
    raw: "4++192\nTrendon Watford Assists\nWon\nWager: $2.00 Paid: $5.84\nDK638982435218573479"
  };
  bets.push({ ...bet1Data, marketCategory: classifyBet(bet1Data) });

  // Placeholder Example 2
  const betId2 = 'DK638982435218573485';
  const placedAt2 = new Date('2023-11-13T19:30:00Z').toISOString();
  // FIX: Add missing 'marketCategory' property to conform to the Bet type.
  const bet2Data = {
    id: `DraftKings-${betId2}-${placedAt2}`,
    book: 'DraftKings',
    betId: betId2,
    placedAt: placedAt2,
    settledAt: new Date('2023-11-13T22:30:00Z').toISOString(),
    betType: 'single' as BetType,
    sport: 'NBA',
    description: "New York Knicks Moneyline",
    odds: -150,
    stake: 15.00,
    payout: 0.00,
    result: 'loss' as BetResult,
    raw: "New York Knicks ML\nLost\nWager: $15.00 Paid: $0.00\nDK638982435218573485"
  };
  bets.push({ ...bet2Data, marketCategory: classifyBet(bet2Data) });

  console.log(`DraftKings parser found ${bets.length} placeholder bets.`);
  return bets;
};

