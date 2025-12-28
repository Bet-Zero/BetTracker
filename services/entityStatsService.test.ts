import { describe, it, expect } from 'vitest';
import { computeEntityStatsMap } from './entityStatsService';
import { Bet, BetLeg } from '../types';

// Helper to create a minimal Bet object for testing
function createTestBet(overrides: Partial<Bet>): Bet {
  return {
    id: 'test-1',
    book: 'FanDuel',
    betId: 'test-1',
    placedAt: '2024-01-01T12:00:00Z',
    betType: 'single',
    marketCategory: 'Props',
    sport: 'NBA',
    description: 'Test bet',
    stake: 10,
    payout: 0,
    result: 'pending',
    ...overrides,
  };
}

// Helper to create a BetLeg
function createTestLeg(overrides: Partial<BetLeg>): BetLeg {
  return {
    market: 'Points',
    entities: [],
    ...overrides,
  };
}

describe('entityStatsService', () => {
  describe('computeEntityStatsMap', () => {
    it('attributes non-parlay bet money correctly to entity', () => {
      const bets: Bet[] = [
        createTestBet({
          betType: 'single',
          stake: 10,
          payout: 25,
          result: 'win',
          legs: [
            createTestLeg({
              entities: ['LeBron'],
              result: 'win',
            }),
          ],
        }),
      ];

      const map = computeEntityStatsMap(bets, (leg) => leg.entities || null);

      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeDefined();
      expect(lebronStats!.tickets).toBe(1);
      expect(lebronStats!.parlays).toBe(0);
      expect(lebronStats!.stake).toBe(10);
      expect(lebronStats!.net).toBe(15); // 25 - 10
      expect(lebronStats!.roi).toBe(150); // (15 / 10) * 100
    });

    it('excludes parlay stake/net from entity money attribution', () => {
      const bets: Bet[] = [
        createTestBet({
          betType: 'parlay',
          stake: 10,
          payout: 0,
          result: 'loss',
          legs: [
            createTestLeg({
              entities: ['LeBron'],
              result: 'win',
            }),
            createTestLeg({
              entities: ['Celtics'],
              result: 'loss',
            }),
          ],
        }),
      ];

      const map = computeEntityStatsMap(bets, (leg) => leg.entities || null);

      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeDefined();
      expect(lebronStats!.tickets).toBe(1);
      expect(lebronStats!.parlays).toBe(1);
      expect(lebronStats!.stake).toBe(0); // Parlay excluded
      expect(lebronStats!.net).toBe(0); // Parlay excluded

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeDefined();
      expect(celticsStats!.tickets).toBe(1);
      expect(celticsStats!.parlays).toBe(1);
      expect(celticsStats!.stake).toBe(0); // Parlay excluded
      expect(celticsStats!.net).toBe(0); // Parlay excluded
    });

    it('combines non-parlay and parlay contributions correctly', () => {
      const bets: Bet[] = [
        // Non-parlay bet: $10 win, LeBron
        createTestBet({
          betType: 'single',
          stake: 10,
          payout: 25,
          result: 'win',
          legs: [
            createTestLeg({
              entities: ['LeBron'],
              result: 'win',
            }),
          ],
        }),
        // Parlay bet: $10 ticket loss, LeBron leg wins, Celtics leg loses
        createTestBet({
          betType: 'parlay',
          stake: 10,
          payout: 0,
          result: 'loss',
          legs: [
            createTestLeg({
              entities: ['LeBron'],
              result: 'win',
            }),
            createTestLeg({
              entities: ['Celtics'],
              result: 'loss',
            }),
          ],
        }),
      ];

      const map = computeEntityStatsMap(bets, (leg) => leg.entities || null);

      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeDefined();
      expect(lebronStats!.tickets).toBe(2); // Non-parlay + parlay
      expect(lebronStats!.parlays).toBe(1);
      expect(lebronStats!.stake).toBe(10); // Only from non-parlay
      expect(lebronStats!.net).toBe(15); // Only from non-parlay (25 - 10)
      expect(lebronStats!.roi).toBe(150); // (15 / 10) * 100

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeDefined();
      expect(celticsStats!.tickets).toBe(1); // Only parlay
      expect(celticsStats!.parlays).toBe(1);
      expect(celticsStats!.stake).toBe(0); // No non-parlays
      expect(celticsStats!.net).toBe(0); // No non-parlays
    });

    it('handles SGP and SGP+ bet types as parlays', () => {
      const bets: Bet[] = [
        createTestBet({
          betType: 'sgp',
          stake: 10,
          payout: 0,
          result: 'loss',
          legs: [
            createTestLeg({
              entities: ['LeBron'],
              result: 'win',
            }),
          ],
        }),
        createTestBet({
          betType: 'sgp_plus',
          stake: 10,
          payout: 0,
          result: 'loss',
          legs: [
            createTestLeg({
              entities: ['Celtics'],
              result: 'loss',
            }),
          ],
        }),
      ];

      const map = computeEntityStatsMap(bets, (leg) => leg.entities || null);

      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeDefined();
      expect(lebronStats!.stake).toBe(0); // SGP excluded
      expect(lebronStats!.parlays).toBe(1);

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeDefined();
      expect(celticsStats!.stake).toBe(0); // SGP+ excluded
      expect(celticsStats!.parlays).toBe(1);
    });

    it('handles bets without legs array (legacy format)', () => {
      const bets: Bet[] = [
        createTestBet({
          betType: 'single',
          stake: 10,
          payout: 25,
          result: 'win',
          name: 'LeBron',
          // No legs array
        }),
      ];

      const map = computeEntityStatsMap(bets, (leg) => leg.entities || null);

      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeDefined();
      expect(lebronStats!.tickets).toBe(1);
      expect(lebronStats!.parlays).toBe(0);
      expect(lebronStats!.stake).toBe(10);
      expect(lebronStats!.net).toBe(15);
    });

    it('handles multiple entities per leg', () => {
      const bets: Bet[] = [
        createTestBet({
          betType: 'single',
          stake: 10,
          payout: 25,
          result: 'win',
          legs: [
            createTestLeg({
              entities: ['LeBron', 'Celtics'],
              result: 'win',
            }),
          ],
        }),
      ];

      const map = computeEntityStatsMap(bets, (leg) => leg.entities || null);

      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeDefined();
      expect(lebronStats!.tickets).toBe(1);
      expect(lebronStats!.stake).toBe(10);

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeDefined();
      expect(celticsStats!.tickets).toBe(1);
      expect(celticsStats!.stake).toBe(10);
    });

    it('counts parlay as one bet regardless of leg count', () => {
      const bets: Bet[] = [
        createTestBet({
          betType: 'parlay',
          stake: 20,
          payout: 0,
          result: 'loss',
          legs: [
            createTestLeg({ entities: ['LeBron'], result: 'win' }),
            createTestLeg({ entities: ['LeBron'], result: 'loss' }),
            createTestLeg({ entities: ['LeBron'], result: 'win' }),
          ],
        }),
      ];

      const map = computeEntityStatsMap(bets, (leg) => leg.entities || null);

      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeDefined();
      // Even though LeBron appears in 3 legs, it's still just 1 bet
      expect(lebronStats!.tickets).toBe(1);
      expect(lebronStats!.parlays).toBe(1);
      // Parlay money is excluded
      expect(lebronStats!.stake).toBe(0);
      expect(lebronStats!.net).toBe(0);
    });
  });
});
