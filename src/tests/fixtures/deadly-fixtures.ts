/**
 * Deadly Fixtures - Phase 2B Test Data
 *
 * A canonical dataset of 15 Bet objects designed to expose edge cases
 * and enforce invariants defined in the Master Doc (Phase 1).
 *
 * Test IDs reference Master Doc items:
 * - PG-1: Pending bets contribute 0 to net, display blank
 * - PG-2: QuickStatCards use global scope
 * - PG-3: Over/Under breakdown excludes parlays
 * - PG-8: Win rate edge cases (pushes excluded from denominator)
 * - PG-9: LiveVsPreMatch uses canonical net
 * - PG-10: Time bucketing uses placedAt, not settledAt
 *
 * INV-10: Timestamps include explicit timezone offsets.
 */

import { Bet, BetLeg } from '../../../types';

// Helper to create a minimal valid Bet
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

// =============================================================================
// DEADLY BETS DATASET (15 bets)
// =============================================================================

/**
 * Single win - basic case
 * PG-1: net = payout - stake = 20 - 10 = 10
 */
export const SINGLE_WIN: Bet = createBet({
  id: 'DEADLY-SINGLE-WIN',
  result: 'win',
  stake: 10,
  payout: 20,
  betType: 'single',
  placedAt: '2025-01-01T10:00:00-05:00', // EST timezone explicit
  legs: [createLeg({ entities: ['LeBron James'], entityType: 'player', result: 'WIN' })],
});

/**
 * Single loss - basic case
 * PG-1: net = payout - stake = 0 - 10 = -10
 */
export const SINGLE_LOSS: Bet = createBet({
  id: 'DEADLY-SINGLE-LOSS',
  result: 'loss',
  stake: 10,
  payout: 0,
  betType: 'single',
  placedAt: '2025-01-02T14:30:00+00:00', // UTC explicit
  legs: [createLeg({ entities: ['Stephen Curry'], entityType: 'player', result: 'LOSS' })],
});

/**
 * Single push - basic case
 * PG-1: net = payout - stake = 10 - 10 = 0
 */
export const SINGLE_PUSH: Bet = createBet({
  id: 'DEADLY-SINGLE-PUSH',
  result: 'push',
  stake: 10,
  payout: 10,
  betType: 'single',
  placedAt: '2025-01-03T08:00:00Z',
  legs: [createLeg({ entities: ['Giannis'], entityType: 'player', result: 'PUSH' })],
});

/**
 * Single pending - critical for PG-1/INV-1/2/3
 * KPI net must be 0, display net must be blank
 */
export const SINGLE_PENDING: Bet = createBet({
  id: 'DEADLY-SINGLE-PENDING',
  result: 'pending',
  stake: 10,
  payout: 0,
  betType: 'single',
  placedAt: '2025-01-04T18:00:00-08:00', // PST timezone explicit
  legs: [createLeg({ entities: ['Jokic'], entityType: 'player', result: 'PENDING' })],
});

/**
 * Parlay win - multiple legs
 * PG-3: Should be excluded from O/U breakdown
 */
export const PARLAY_WIN: Bet = createBet({
  id: 'DEADLY-PARLAY-WIN',
  result: 'win',
  stake: 5,
  payout: 25,
  betType: 'parlay',
  marketCategory: 'Parlays',
  placedAt: '2025-01-05T12:00:00Z',
  legs: [
    createLeg({ entities: ['Player A'], entityType: 'player', result: 'WIN' }),
    createLeg({ entities: ['Player B'], entityType: 'player', result: 'WIN' }),
  ],
});

/**
 * Parlay loss
 * PG-3: Should be excluded from O/U breakdown
 */
export const PARLAY_LOSS: Bet = createBet({
  id: 'DEADLY-PARLAY-LOSS',
  result: 'loss',
  stake: 5,
  payout: 0,
  betType: 'parlay',
  marketCategory: 'Parlays',
  placedAt: '2025-01-06T12:00:00Z',
  legs: [
    createLeg({ entities: ['Player C'], entityType: 'player', result: 'WIN' }),
    createLeg({ entities: ['Player D'], entityType: 'player', result: 'LOSS' }),
  ],
});

/**
 * SGP win
 */
export const SGP_WIN: Bet = createBet({
  id: 'DEADLY-SGP-WIN',
  result: 'win',
  stake: 5,
  payout: 30,
  betType: 'sgp',
  marketCategory: 'Parlays',
  placedAt: '2025-01-07T12:00:00Z',
  legs: [
    createLeg({ entities: ['Player E'], entityType: 'player', result: 'WIN' }),
    createLeg({ entities: ['Player E'], entityType: 'player', result: 'WIN' }),
  ],
});

/**
 * SGP+ loss
 */
export const SGP_PLUS_LOSS: Bet = createBet({
  id: 'DEADLY-SGP-PLUS-LOSS',
  result: 'loss',
  stake: 5,
  payout: 0,
  betType: 'sgp_plus',
  marketCategory: 'Parlays',
  placedAt: '2025-01-08T12:00:00Z',
  legs: [
    createLeg({ entities: ['Player F'], entityType: 'player', result: 'WIN' }),
    createLeg({ entities: ['Player G'], entityType: 'player', result: 'LOSS' }),
  ],
});

/**
 * Single Over bet - for O/U breakdown tests
 * PG-3: Should be included in O/U breakdown (non-parlay)
 */
export const SINGLE_OVER: Bet = createBet({
  id: 'DEADLY-SINGLE-OVER',
  result: 'win',
  stake: 10,
  payout: 20,
  betType: 'single',
  ou: 'Over',
  placedAt: '2025-01-09T12:00:00Z',
  legs: [createLeg({ entities: ['Player H'], entityType: 'player', ou: 'Over', result: 'WIN' })],
});

/**
 * Single Under bet - for O/U breakdown tests
 * PG-3: Should be included in O/U breakdown (non-parlay)
 */
export const SINGLE_UNDER: Bet = createBet({
  id: 'DEADLY-SINGLE-UNDER',
  result: 'loss',
  stake: 10,
  payout: 0,
  betType: 'single',
  ou: 'Under',
  placedAt: '2025-01-10T12:00:00Z',
  legs: [createLeg({ entities: ['Player I'], entityType: 'player', ou: 'Under', result: 'LOSS' })],
});

/**
 * Parlay Over - MUST be excluded from O/U breakdown
 * PG-3/INV-8: This is the "deadly" case - parlay with O/U leg
 */
export const PARLAY_OVER: Bet = createBet({
  id: 'DEADLY-PARLAY-OVER',
  result: 'win',
  stake: 5,
  payout: 15,
  betType: 'parlay',
  marketCategory: 'Parlays',
  placedAt: '2025-01-11T12:00:00Z',
  legs: [
    createLeg({ entities: ['Player J'], entityType: 'player', ou: 'Over', result: 'WIN' }),
    createLeg({ entities: ['Player K'], entityType: 'player', result: 'WIN' }),
  ],
});

/**
 * Single Live bet - for LiveVsPreMatch tests
 * PG-9: Must use canonical net (getNetNumeric)
 */
export const SINGLE_LIVE: Bet = createBet({
  id: 'DEADLY-SINGLE-LIVE',
  result: 'win',
  stake: 10,
  payout: 25,
  betType: 'single',
  isLive: true,
  placedAt: '2025-01-12T12:00:00Z',
  legs: [createLeg({ entities: ['Player L'], entityType: 'player', result: 'WIN' })],
});

/**
 * Single team entity - for entity type tests
 */
export const SINGLE_TEAM: Bet = createBet({
  id: 'DEADLY-SINGLE-TEAM',
  result: 'win',
  stake: 10,
  payout: 18,
  betType: 'single',
  marketCategory: 'Main Markets',
  placedAt: '2025-01-13T12:00:00Z',
  legs: [createLeg({ entities: ['Lakers'], entityType: 'team', market: 'Spread', result: 'WIN' })],
});

/**
 * Single player entity - for entity type tests
 */
export const SINGLE_PLAYER: Bet = createBet({
  id: 'DEADLY-SINGLE-PLAYER',
  result: 'loss',
  stake: 10,
  payout: 0,
  betType: 'single',
  placedAt: '2025-01-14T12:00:00Z',
  legs: [createLeg({ entities: ['Kevin Durant'], entityType: 'player', result: 'LOSS' })],
});

/**
 * Single unknown entityType - for entity handling tests
 * entityType is undefined to test handling of unknown entities
 */
export const SINGLE_UNKNOWN_ENTITY: Bet = createBet({
  id: 'DEADLY-SINGLE-UNKNOWN',
  result: 'win',
  stake: 10,
  payout: 22,
  betType: 'single',
  placedAt: '2025-01-15T12:00:00Z',
  legs: [createLeg({ entities: ['Unknown Entity'], entityType: 'unknown', result: 'WIN' })],
});

// =============================================================================
// EXPORTED COLLECTIONS
// =============================================================================

/**
 * All 15 deadly bets - the complete test dataset
 */
export const DEADLY_BETS: Bet[] = [
  SINGLE_WIN,
  SINGLE_LOSS,
  SINGLE_PUSH,
  SINGLE_PENDING,
  PARLAY_WIN,
  PARLAY_LOSS,
  SGP_WIN,
  SGP_PLUS_LOSS,
  SINGLE_OVER,
  SINGLE_UNDER,
  PARLAY_OVER,
  SINGLE_LIVE,
  SINGLE_TEAM,
  SINGLE_PLAYER,
  SINGLE_UNKNOWN_ENTITY,
];

/**
 * Only non-parlay (single) bets
 */
export const DEADLY_BETS_NON_PARLAY: Bet[] = DEADLY_BETS.filter(
  (bet) => bet.betType !== 'parlay' && bet.betType !== 'sgp' && bet.betType !== 'sgp_plus'
);

/**
 * Only parlay-type bets (parlay, sgp, sgp_plus)
 */
export const DEADLY_BETS_PARLAYS: Bet[] = DEADLY_BETS.filter(
  (bet) => bet.betType === 'parlay' || bet.betType === 'sgp' || bet.betType === 'sgp_plus'
);

/**
 * Only settled bets (excludes pending)
 */
export const DEADLY_BETS_SETTLED: Bet[] = DEADLY_BETS.filter(
  (bet) => bet.result !== 'pending'
);

/**
 * Only O/U single bets (for O/U breakdown testing)
 */
export const DEADLY_BETS_OU_SINGLES: Bet[] = [SINGLE_OVER, SINGLE_UNDER];

// =============================================================================
// TIME WINDOW TEST DATA (PG-10/INV-9/INV-10)
// =============================================================================

/**
 * Bets for time bucketing tests
 * Critical: placedAt is in window, settledAt is outside (and vice versa)
 */
export const TIME_BUCKET_BET_PLACED_IN_SETTLED_OUT: Bet = createBet({
  id: 'TIME-PLACED-IN-SETTLED-OUT',
  result: 'win',
  stake: 10,
  payout: 20,
  placedAt: '2025-01-15T12:00:00Z', // IN the time window
  settledAt: '2025-01-20T12:00:00Z', // OUT of the time window
});

export const TIME_BUCKET_BET_PLACED_OUT_SETTLED_IN: Bet = createBet({
  id: 'TIME-PLACED-OUT-SETTLED-IN',
  result: 'win',
  stake: 10,
  payout: 20,
  placedAt: '2025-01-10T12:00:00Z', // OUT of the time window
  settledAt: '2025-01-15T12:00:00Z', // IN the time window
});

/**
 * Time window for tests: 2025-01-14 to 2025-01-16
 */
export const DEADLY_TIME_WINDOW = {
  start: '2025-01-14',
  end: '2025-01-16',
};

// =============================================================================
// EXPECTED VALUES (for test assertions)
// =============================================================================

/**
 * Expected canonical net values for DEADLY_BETS
 * Calculated as: payout - stake (pending = 0)
 */
export const DEADLY_EXPECTED_NETS: Record<string, number> = {
  'DEADLY-SINGLE-WIN': 10, // 20 - 10
  'DEADLY-SINGLE-LOSS': -10, // 0 - 10
  'DEADLY-SINGLE-PUSH': 0, // 10 - 10
  'DEADLY-SINGLE-PENDING': 0, // pending = 0 for KPI (INV-1)
  'DEADLY-PARLAY-WIN': 20, // 25 - 5
  'DEADLY-PARLAY-LOSS': -5, // 0 - 5
  'DEADLY-SGP-WIN': 25, // 30 - 5
  'DEADLY-SGP-PLUS-LOSS': -5, // 0 - 5
  'DEADLY-SINGLE-OVER': 10, // 20 - 10
  'DEADLY-SINGLE-UNDER': -10, // 0 - 10
  'DEADLY-PARLAY-OVER': 10, // 15 - 5
  'DEADLY-SINGLE-LIVE': 15, // 25 - 10
  'DEADLY-SINGLE-TEAM': 8, // 18 - 10
  'DEADLY-SINGLE-PLAYER': -10, // 0 - 10
  'DEADLY-SINGLE-UNKNOWN': 12, // 22 - 10
};

/**
 * Expected total net for all DEADLY_BETS
 * Sum of all DEADLY_EXPECTED_NETS values
 */
export const DEADLY_EXPECTED_TOTAL_NET: number = Object.values(DEADLY_EXPECTED_NETS).reduce(
  (sum, net) => sum + net,
  0
);

/**
 * Expected total stake for all DEADLY_BETS
 */
export const DEADLY_EXPECTED_TOTAL_STAKE: number = DEADLY_BETS.reduce(
  (sum, bet) => sum + bet.stake,
  0
);
