/**
 * Verification script to ensure classification consistency
 * Tests that the same market text produces the same classification result
 * across all layers (modal, storage, display)
 */

import { classifyBet, classifyLeg, determineType } from '../services/marketClassification';
import { Bet } from '../types';

// Test cases for classification consistency
const testCases = [
  {
    name: 'NBA Player Points Prop',
    market: 'Player Points',
    sport: 'NBA',
    expectedCategory: 'Props',
    expectedType: 'Pts',
  },
  {
    name: 'NBA Triple Double',
    market: 'Triple Double',
    sport: 'NBA',
    expectedCategory: 'Props',
    expectedType: 'TD',
  },
  {
    name: 'NBA Main Market - Spread',
    market: 'Spread',
    sport: 'NBA',
    expectedCategory: 'Main Markets',
    expectedType: 'Spread',
  },
  {
    name: 'NBA Main Market - Total',
    market: 'Total',
    sport: 'NBA',
    expectedCategory: 'Main Markets',
    expectedType: 'Total',
  },
  {
    name: 'NBA Main Market - Moneyline',
    market: 'Moneyline',
    sport: 'NBA',
    expectedCategory: 'Main Markets',
    expectedType: 'Moneyline',
  },
  {
    name: 'NBA Finals Future',
    market: 'To Win NBA Finals',
    sport: 'NBA',
    expectedCategory: 'Futures',
    expectedType: 'NBA Finals',
  },
  {
    name: 'Win Total Future',
    market: 'Win Total',
    sport: 'NBA',
    expectedCategory: 'Futures',
    expectedType: 'Win Total',
  },
];

console.log('=== Classification Consistency Verification ===\n');

let allPassed = true;

for (const testCase of testCases) {
  const category = classifyLeg(testCase.market, testCase.sport);
  const type = determineType(testCase.market, category, testCase.sport);
  
  const categoryMatch = category === testCase.expectedCategory;
  const typeMatch = type === testCase.expectedType;
  
  const status = categoryMatch && typeMatch ? '✓ PASS' : '✗ FAIL';
  
  console.log(`${status}: ${testCase.name}`);
  console.log(`  Market: ${testCase.market}`);
  console.log(`  Category: ${category} ${categoryMatch ? '✓' : `✗ (expected: ${testCase.expectedCategory})`}`);
  console.log(`  Type: ${type} ${typeMatch ? '✓' : `✗ (expected: ${testCase.expectedType})`}`);
  console.log();
  
  if (!categoryMatch || !typeMatch) {
    allPassed = false;
  }
}

// Test bet-level classification
console.log('=== Bet-Level Classification ===\n');

const testBets: Array<{ name: string; bet: Omit<Bet, 'id' | 'marketCategory' | 'raw' | 'tail'>; expected: string }> = [
  {
    name: 'Single Prop Bet',
    bet: {
      betId: 'test1',
      book: 'FanDuel',
      sport: 'NBA',
      name: 'LeBron James',
      type: 'Pts',
      description: 'LeBron James Points',
      betType: 'single',
      placedAt: '2024-01-01T00:00:00Z',
      stake: 10,
      odds: -110,
      result: 'pending',
      ou: 'Over',
      line: '25.5',
      payout: 0,
      isLive: false,
    },
    expected: 'Props',
  },
  {
    name: 'Single Main Market Bet',
    bet: {
      betId: 'test2',
      book: 'FanDuel',
      sport: 'NBA',
      description: 'Lakers Moneyline',
      betType: 'single',
      placedAt: '2024-01-01T00:00:00Z',
      stake: 10,
      odds: -110,
      result: 'pending',
      payout: 0,
      isLive: false,
    },
    expected: 'Main Markets',
  },
  {
    name: 'Parlay Bet',
    bet: {
      betId: 'test3',
      book: 'FanDuel',
      sport: 'NBA',
      description: 'Multi-leg parlay',
      betType: 'parlay',
      placedAt: '2024-01-01T00:00:00Z',
      stake: 10,
      odds: +300,
      result: 'pending',
      payout: 0,
      isLive: false,
      legs: [
        {
          entities: ['LeBron James'],
          market: 'Points',
          target: '25.5',
          ou: 'Over',
          result: 'pending',
        },
        {
          entities: ['Stephen Curry'],
          market: 'Points',
          target: '30.5',
          ou: 'Over',
          result: 'pending',
        },
      ],
    },
    expected: 'Parlays',
  },
  {
    name: 'SGP Bet',
    bet: {
      betId: 'test4',
      book: 'FanDuel',
      sport: 'NBA',
      description: 'Same Game Parlay',
      betType: 'sgp',
      placedAt: '2024-01-01T00:00:00Z',
      stake: 10,
      odds: +400,
      result: 'pending',
      payout: 0,
      isLive: false,
      legs: [
        {
          entities: ['LeBron James'],
          market: 'Points',
          target: '25.5',
          ou: 'Over',
          result: 'pending',
        },
      ],
    },
    expected: 'SGP/SGP+',
  },
  {
    name: 'Futures Bet',
    bet: {
      betId: 'test5',
      book: 'FanDuel',
      sport: 'NBA',
      description: 'Lakers to win NBA Finals',
      betType: 'single',
      placedAt: '2024-01-01T00:00:00Z',
      stake: 10,
      odds: +500,
      result: 'pending',
      payout: 0,
      isLive: false,
    },
    expected: 'Futures',
  },
];

for (const testBet of testBets) {
  const category = classifyBet(testBet.bet);
  const match = category === testBet.expected;
  const status = match ? '✓ PASS' : '✗ FAIL';
  
  console.log(`${status}: ${testBet.name}`);
  console.log(`  Category: ${category} ${match ? '✓' : `✗ (expected: ${testBet.expected})`}`);
  console.log();
  
  if (!match) {
    allPassed = false;
  }
}

if (allPassed) {
  console.log('✓ All classification tests passed!');
  process.exit(0);
} else {
  console.log('✗ Some classification tests failed!');
  process.exit(1);
}
