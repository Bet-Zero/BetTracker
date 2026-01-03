/**
 * Entity Stats Parlay Invariance Test
 *
 * This test ensures that entity statistics (Player/Team performance tables)
 * are INVARIANT to the presence of parlays in the dataset.
 *
 * INVARIANT: When the same straight bets are present, entity stats
 * (stake, net, wins, losses, tickets) remain identical whether or not
 * parlays are also in the dataset.
 *
 * This prevents future refactors from accidentally leaking parlay money
 * into entity attribution.
 */

import { describe, it, expect } from 'vitest';
import { Bet, BetLeg } from '../../types';
import { computeEntityStatsMap, EntityStats } from '../../services/entityStatsService';

// Helper to create a minimal Bet
function createBet(overrides: Partial<Bet> & Pick<Bet, 'id' | 'result'>): Bet {
  return {
    id: overrides.id,
    book: 'FanDuel',
    betId: overrides.id,
    placedAt: '2025-01-01T12:00:00Z',
    betType: 'single',
    marketCategory: 'Props',
    sport: 'NBA',
    description: 'Test bet',
    stake: 10,
    payout: 0,
    result: overrides.result,
    ...overrides,
  };
}

// Helper to create a BetLeg
function createLeg(overrides: Partial<BetLeg>): BetLeg {
  return {
    market: 'Pts',
    entities: [],
    ...overrides,
  };
}

// Standard key extractor for entities (matches usage in views)
const entityKeyExtractor = (leg: BetLeg, bet: Bet): string[] | null => {
  if (leg.entities && leg.entities.length > 0) {
    return leg.entities;
  }
  return null;
};

/**
 * Test fixtures: 5 straight bets across 3 entities
 */
const STRAIGHT_BETS_FIXTURE: Bet[] = [
  // Entity A: 2 bets (win + loss)
  createBet({
    id: 'STRAIGHT-1',
    result: 'win',
    stake: 10,
    payout: 20,
    legs: [createLeg({ entities: ['Entity A'], entityType: 'player' })],
  }),
  createBet({
    id: 'STRAIGHT-2',
    result: 'loss',
    stake: 15,
    payout: 0,
    legs: [createLeg({ entities: ['Entity A'], entityType: 'player' })],
  }),
  // Entity B: 2 bets (win + push)
  createBet({
    id: 'STRAIGHT-3',
    result: 'win',
    stake: 20,
    payout: 35,
    legs: [createLeg({ entities: ['Entity B'], entityType: 'player' })],
  }),
  createBet({
    id: 'STRAIGHT-4',
    result: 'push',
    stake: 10,
    payout: 10,
    legs: [createLeg({ entities: ['Entity B'], entityType: 'player' })],
  }),
  // Entity C: 1 bet (loss)
  createBet({
    id: 'STRAIGHT-5',
    result: 'loss',
    stake: 25,
    payout: 0,
    legs: [createLeg({ entities: ['Entity C'], entityType: 'player' })],
  }),
];

/**
 * Test fixtures: 3 parlays referencing the same entities
 * These should NOT affect entity stats at all.
 */
const PARLAY_FIXTURE: Bet[] = [
  // Parlay with Entity A + Entity B
  createBet({
    id: 'PARLAY-1',
    result: 'win',
    stake: 10,
    payout: 50,
    betType: 'parlay',
    marketCategory: 'Parlays',
    legs: [
      createLeg({ entities: ['Entity A'], entityType: 'player' }),
      createLeg({ entities: ['Entity B'], entityType: 'player' }),
    ],
  }),
  // SGP with Entity B + Entity C
  createBet({
    id: 'SGP-1',
    result: 'loss',
    stake: 15,
    payout: 0,
    betType: 'sgp',
    marketCategory: 'Parlays',
    legs: [
      createLeg({ entities: ['Entity B'], entityType: 'player' }),
      createLeg({ entities: ['Entity C'], entityType: 'player' }),
    ],
  }),
  // SGP+ with all three entities
  createBet({
    id: 'SGP-PLUS-1',
    result: 'win',
    stake: 5,
    payout: 100,
    betType: 'sgp_plus',
    marketCategory: 'Parlays',
    legs: [
      createLeg({ entities: ['Entity A'], entityType: 'player' }),
      createLeg({ entities: ['Entity B'], entityType: 'player' }),
      createLeg({ entities: ['Entity C'], entityType: 'player' }),
    ],
  }),
];

describe('Entity Stats Parlay Invariance', () => {
  it('entity stats are invariant to parlay presence in dataset', () => {
    // Step 1: Compute entity stats from straight bets only
    const straightOnlyStats = computeEntityStatsMap(STRAIGHT_BETS_FIXTURE, entityKeyExtractor);

    // Step 2: Compute entity stats from straight bets + parlays
    const mixedDataset = [...STRAIGHT_BETS_FIXTURE, ...PARLAY_FIXTURE];
    const mixedStats = computeEntityStatsMap(mixedDataset, entityKeyExtractor);

    // Step 3: Assert all entity stats are IDENTICAL

    // Verify same entities are present
    expect(mixedStats.size).toBe(straightOnlyStats.size);
    expect(Array.from(mixedStats.keys()).sort()).toEqual(
      Array.from(straightOnlyStats.keys()).sort()
    );

    // Verify each entity's stats match exactly
    for (const entity of ['Entity A', 'Entity B', 'Entity C']) {
      const straightStats = straightOnlyStats.get(entity)!;
      const mixedEntityStats = mixedStats.get(entity)!;

      expect(mixedEntityStats.stake).toBe(straightStats.stake);
      expect(mixedEntityStats.net).toBe(straightStats.net);
      expect(mixedEntityStats.tickets).toBe(straightStats.tickets);
      expect(mixedEntityStats.wins).toBe(straightStats.wins);
      expect(mixedEntityStats.losses).toBe(straightStats.losses);
      expect(mixedEntityStats.roi).toBe(straightStats.roi);
    }
  });

  it('parlay-only dataset produces empty entity stats map', () => {
    const parlayOnlyStats = computeEntityStatsMap(PARLAY_FIXTURE, entityKeyExtractor);

    // Parlays should not create any entity entries
    expect(parlayOnlyStats.size).toBe(0);
  });

  it('entity stats values are correct for straight bets', () => {
    const stats = computeEntityStatsMap(STRAIGHT_BETS_FIXTURE, entityKeyExtractor);

    // Entity A: 2 bets, 1 win, 1 loss, stake=25, net=10-15=-5
    const entityA = stats.get('Entity A')!;
    expect(entityA.tickets).toBe(2);
    expect(entityA.wins).toBe(1);
    expect(entityA.losses).toBe(1);
    expect(entityA.stake).toBe(25); // 10 + 15
    expect(entityA.net).toBe(-5); // (20-10) + (0-15) = 10 + (-15) = -5

    // Entity B: 2 bets, 1 win, 0 loss (push doesn't count), stake=30, net=15+0=15
    const entityB = stats.get('Entity B')!;
    expect(entityB.tickets).toBe(2);
    expect(entityB.wins).toBe(1);
    expect(entityB.losses).toBe(0); // push doesn't count as loss
    expect(entityB.stake).toBe(30); // 20 + 10
    expect(entityB.net).toBe(15); // (35-20) + (10-10) = 15 + 0 = 15

    // Entity C: 1 bet, 0 wins, 1 loss, stake=25, net=-25
    const entityC = stats.get('Entity C')!;
    expect(entityC.tickets).toBe(1);
    expect(entityC.wins).toBe(0);
    expect(entityC.losses).toBe(1);
    expect(entityC.stake).toBe(25);
    expect(entityC.net).toBe(-25); // 0 - 25
  });

  it('adding parlay with new entity does not create entity entry', () => {
    // Create a parlay with a new entity not in straight bets
    const parlayWithNewEntity = createBet({
      id: 'PARLAY-NEW-ENTITY',
      result: 'win',
      stake: 20,
      payout: 60,
      betType: 'parlay',
      marketCategory: 'Parlays',
      legs: [
        createLeg({ entities: ['Entity A'], entityType: 'player' }),
        createLeg({ entities: ['Brand New Entity'], entityType: 'player' }),
      ],
    });

    const mixedDataset = [...STRAIGHT_BETS_FIXTURE, parlayWithNewEntity];
    const stats = computeEntityStatsMap(mixedDataset, entityKeyExtractor);

    // Brand New Entity should NOT appear because it only exists in a parlay
    expect(stats.has('Brand New Entity')).toBe(false);

    // Original entities should still have same count
    expect(stats.size).toBe(3);
  });

  it('mixed dataset with varied parlay types maintains invariance', () => {
    // Test with all parlay types: parlay, sgp, sgp_plus
    const allParlayTypes: Bet[] = [
      createBet({
        id: 'TYPE-PARLAY',
        result: 'win',
        stake: 100,
        payout: 500,
        betType: 'parlay',
        legs: [createLeg({ entities: ['Entity A'] })],
      }),
      createBet({
        id: 'TYPE-SGP',
        result: 'loss',
        stake: 100,
        payout: 0,
        betType: 'sgp',
        legs: [createLeg({ entities: ['Entity B'] })],
      }),
      createBet({
        id: 'TYPE-SGP-PLUS',
        result: 'win',
        stake: 100,
        payout: 1000,
        betType: 'sgp_plus',
        legs: [createLeg({ entities: ['Entity C'] })],
      }),
    ];

    const straightOnlyStats = computeEntityStatsMap(STRAIGHT_BETS_FIXTURE, entityKeyExtractor);
    const withAllParlayTypes = computeEntityStatsMap(
      [...STRAIGHT_BETS_FIXTURE, ...allParlayTypes],
      entityKeyExtractor
    );

    // Stats must remain identical regardless of parlay types present
    for (const entity of ['Entity A', 'Entity B', 'Entity C']) {
      expect(withAllParlayTypes.get(entity)).toEqual(straightOnlyStats.get(entity));
    }
  });
});
