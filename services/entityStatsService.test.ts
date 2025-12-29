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

    it('excludes parlays entirely from entity stats (not in map)', () => {
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

      // Parlay-only entities should NOT appear in entity stats at all
      // This is the intentional behavior: entity stats are for straight bets only
      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeUndefined();

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeUndefined();

      // Map should be empty since all bets are parlays
      expect(map.size).toBe(0);
    });

    it('only counts straight bets for entities (parlays ignored)', () => {
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
        // Parlay bet: completely ignored, even though LeBron appears here too
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

      // LeBron: only the single bet counts, parlay is completely excluded
      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeDefined();
      expect(lebronStats!.tickets).toBe(1); // Only from straight bet (parlay ignored)
      expect(lebronStats!.parlays).toBe(0); // Parlays don't increment counters
      expect(lebronStats!.stake).toBe(10); // Only from straight bet
      expect(lebronStats!.net).toBe(15); // Only from straight bet (25 - 10)
      expect(lebronStats!.roi).toBe(150); // (15 / 10) * 100

      // Celtics only appeared in parlay, so they're not in the map at all
      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeUndefined();
    });

    it('excludes SGP and SGP+ bet types entirely (same as parlays)', () => {
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

      // SGP and SGP+ are treated as parlays and completely excluded
      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeUndefined(); // SGP excluded entirely

      const celticsStats = map.get('Celtics');
      expect(celticsStats).toBeUndefined(); // SGP+ excluded entirely

      // Map should be empty since all bets are parlay types
      expect(map.size).toBe(0);
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

    it('excludes multi-leg parlays entirely from entity stats', () => {
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

      // Parlay bets are completely excluded from entity stats regardless of leg count
      const lebronStats = map.get('LeBron');
      expect(lebronStats).toBeUndefined();

      // Map should be empty
      expect(map.size).toBe(0);
    });

    /**
     * INTENT ASSERTION TEST
     * This test explicitly documents and locks in the intended behavior:
     * - Given one single bet + one parlay containing the same entity,
     * - entityStatsService only counts the single bet for that entity.
     * 
     * This prevents future regressions where someone might "fix" the code
     * to include parlays in entity stats.
     */
    it('INTENT: single bets count, parlays do not - regression prevention', () => {
      const bets: Bet[] = [
        // Single bet on Jokic - should count
        createTestBet({
          id: 'single-1',
          betType: 'single',
          stake: 100,
          payout: 200,
          result: 'win',
          legs: [
            createTestLeg({
              entities: ['Jokic'],
              result: 'win',
            }),
          ],
        }),
        // Parlay with Jokic - should NOT count toward Jokic stats
        createTestBet({
          id: 'parlay-1',
          betType: 'parlay',
          stake: 50,
          payout: 0,
          result: 'loss',
          legs: [
            createTestLeg({
              entities: ['Jokic'],
              result: 'win',
            }),
            createTestLeg({
              entities: ['Murray'],
              result: 'loss',
            }),
          ],
        }),
      ];

      const map = computeEntityStatsMap(bets, (leg) => leg.entities || null);

      // === JOKIC: Only single bet counts ===
      const jokicStats = map.get('Jokic');
      expect(jokicStats).toBeDefined();
      expect(jokicStats!.tickets).toBe(1);    // Only from single, NOT 2 (single+parlay)
      expect(jokicStats!.parlays).toBe(0);    // Parlays don't increment counter
      expect(jokicStats!.wins).toBe(1);       // Only from single
      expect(jokicStats!.losses).toBe(0);     // Single was a win
      expect(jokicStats!.stake).toBe(100);    // Only from single (NOT 100+50=150)
      expect(jokicStats!.net).toBe(100);      // Payout(200) - stake(100) = 100
      expect(jokicStats!.roi).toBe(100);      // 100/100 * 100 = 100%

      // === MURRAY: Only in parlay, so NOT in map at all ===
      const murrayStats = map.get('Murray');
      expect(murrayStats).toBeUndefined();    // NOT toBeDefined with stake=0

      // === Map should only contain Jokic ===
      expect(map.size).toBe(1);
      expect(Array.from(map.keys())).toEqual(['Jokic']);
    });
  });
});
