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
    it('attributes single bet money correctly to entity', () => {
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
      expect(lebronStats!.singles).toBe(1);
      expect(lebronStats!.parlays).toBe(0);
      expect(lebronStats!.stakeSingles).toBe(10);
      expect(lebronStats!.netSingles).toBe(15); // 25 - 10
      expect(lebronStats!.legs).toBe(1);
      expect(lebronStats!.legWins).toBe(1);
      expect(lebronStats!.legLosses).toBe(0);
      expect(lebronStats!.legWinRate).toBe(100); // 1 win / 1 decided
      expect(lebronStats!.roiSingles).toBe(150); // (15 / 10) * 100
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
      expect(lebronStats!.singles).toBe(0);
      expect(lebronStats!.parlays).toBe(1);
      expect(lebronStats!.stakeSingles).toBe(0); // Parlay excluded
      expect(lebronStats!.netSingles).toBe(0); // Parlay excluded
      expect(lebronStats!.legs).toBe(1);
      expect(lebronStats!.legWins).toBe(1); // Leg won even though ticket lost
      expect(lebronStats!.legLosses).toBe(0);
      expect(lebronStats!.legWinRate).toBe(100); // 1 win / 1 decided

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeDefined();
      expect(celticsStats!.tickets).toBe(1);
      expect(celticsStats!.singles).toBe(0);
      expect(celticsStats!.parlays).toBe(1);
      expect(celticsStats!.stakeSingles).toBe(0); // Parlay excluded
      expect(celticsStats!.netSingles).toBe(0); // Parlay excluded
      expect(celticsStats!.legs).toBe(1);
      expect(celticsStats!.legWins).toBe(0);
      expect(celticsStats!.legLosses).toBe(1);
      expect(celticsStats!.legWinRate).toBe(0); // 0 wins / 1 decided
    });

    it('combines single and parlay contributions correctly', () => {
      const bets: Bet[] = [
        // Single bet: $10 win, LeBron
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
      expect(lebronStats!.tickets).toBe(2); // Single + parlay
      expect(lebronStats!.singles).toBe(1);
      expect(lebronStats!.parlays).toBe(1);
      expect(lebronStats!.stakeSingles).toBe(10); // Only from single
      expect(lebronStats!.netSingles).toBe(15); // Only from single (25 - 10)
      expect(lebronStats!.legs).toBe(2); // 1 from single + 1 from parlay
      expect(lebronStats!.legWins).toBe(2); // Both legs won
      expect(lebronStats!.legLosses).toBe(0);
      expect(lebronStats!.legWinRate).toBe(100); // 2 wins / 2 decided
      expect(lebronStats!.roiSingles).toBe(150); // (15 / 10) * 100

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeDefined();
      expect(celticsStats!.tickets).toBe(1); // Only parlay
      expect(celticsStats!.singles).toBe(0);
      expect(celticsStats!.parlays).toBe(1);
      expect(celticsStats!.stakeSingles).toBe(0); // No singles
      expect(celticsStats!.netSingles).toBe(0); // No singles
      expect(celticsStats!.legs).toBe(1); // Only from parlay
      expect(celticsStats!.legWins).toBe(0);
      expect(celticsStats!.legLosses).toBe(1);
      expect(celticsStats!.legWinRate).toBe(0); // 0 wins / 1 decided
    });

    it('excludes unknown leg outcomes from win% denominator', () => {
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
              // No result field = unknown
            }),
          ],
        }),
      ];

      const map = computeEntityStatsMap(bets, (leg) => leg.entities || null);

      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeDefined();
      expect(lebronStats!.legs).toBe(1);
      expect(lebronStats!.legWins).toBe(1);
      expect(lebronStats!.legLosses).toBe(0);
      expect(lebronStats!.legUnknown).toBe(0); // Not on this leg
      expect(lebronStats!.legWinRate).toBe(100); // 1 win / 1 decided (unknown excluded)

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeDefined();
      expect(celticsStats!.legs).toBe(1);
      expect(celticsStats!.legWins).toBe(0);
      expect(celticsStats!.legLosses).toBe(0);
      expect(celticsStats!.legUnknown).toBe(1);
      expect(celticsStats!.legWinRate).toBe(0); // 0 wins / 0 decided (unknown excluded)
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
      expect(lebronStats!.stakeSingles).toBe(0); // SGP excluded
      expect(lebronStats!.parlays).toBe(1);

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeDefined();
      expect(celticsStats!.stakeSingles).toBe(0); // SGP+ excluded
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
      expect(lebronStats!.singles).toBe(1);
      expect(lebronStats!.stakeSingles).toBe(10);
      expect(lebronStats!.netSingles).toBe(15);
      // Legs won't be tracked for bets without legs array
      expect(lebronStats!.legs).toBe(0);
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
      expect(lebronStats!.stakeSingles).toBe(10);
      expect(lebronStats!.legs).toBe(1);

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeDefined();
      expect(celticsStats!.tickets).toBe(1);
      expect(celticsStats!.stakeSingles).toBe(10);
      expect(celticsStats!.legs).toBe(1);
    });
  });
});

