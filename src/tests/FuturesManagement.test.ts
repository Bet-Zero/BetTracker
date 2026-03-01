/**
 * Futures Management View Tests
 *
 * Comprehensive tests for the Futures Management page functionality.
 * Tests position grouping, analytics, hedge calculations, and filtering.
 */

import { describe, it, expect } from 'vitest';
import { Bet } from '../../types';

// ============================================================================
// Helper Functions (mirroring FuturesView.tsx)
// ============================================================================

/**
 * Extract entity name from bet description for futures.
 */
function extractEntityFromDescription(description: string): string {
  if (!description) return '';
  
  const patterns: RegExp[] = [
    /^(.*?)\s+to\s+win/i,
    /^(.*?)\s+win\s+total/i,
    /^(.*?)\s+vs\./i,
    /^(.*?)\s+-\s+/,
    /^(.*?)\s+(?:Over|Under)\s+\d/i,
    /^(.*?)\s+\([+-]\d+\)/,
    /^(.*?)\s+\(/,
    /^(.*?)\s+(?:Finals|Championship)/i,
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const entity = match[1].trim();
      if (entity.length > 1) {
        return entity;
      }
    }
  }
  
  if (description.length > 40) {
    return description.substring(0, 40) + '…';
  }
  return description;
}

/**
 * Extract futures type from description.
 */
function extractFuturesType(description: string, sport: string): string {
  const desc = description.toLowerCase();
  
  if (desc.includes('championship') || desc.includes('to win')) {
    if (desc.includes('nba') || sport.toLowerCase() === 'nba') return 'NBA Championship';
    if (desc.includes('nfl') || desc.includes('super bowl') || sport.toLowerCase() === 'nfl') return 'Super Bowl';
    if (desc.includes('mlb') || desc.includes('world series') || sport.toLowerCase() === 'mlb') return 'World Series';
    if (desc.includes('nhl') || desc.includes('stanley cup') || sport.toLowerCase() === 'nhl') return 'Stanley Cup';
    return 'Championship';
  }
  
  if (desc.includes('win total')) return 'Win Total';
  if (desc.includes('mvp')) return 'MVP';
  if (desc.includes('dpoy')) return 'DPOY';
  if (desc.includes('roy') || desc.includes('rookie')) return 'ROY';
  if (desc.includes('make playoff')) return 'Make Playoffs';
  if (desc.includes('miss playoff')) return 'Miss Playoffs';
  if (desc.includes('division')) return 'Division Winner';
  if (desc.includes('conference')) return 'Conference Winner';
  
  return 'Other';
}

/**
 * Calculate weighted average odds.
 */
function calculateWeightedAverageOdds(bets: Bet[]): number {
  const totalStake = bets.reduce((sum, bet) => sum + bet.stake, 0);
  if (totalStake === 0) return 0;
  
  const weightedSum = bets.reduce((sum, bet) => {
    const odds = bet.odds || 0;
    return sum + (odds * bet.stake);
  }, 0);
  
  return Math.round(weightedSum / totalStake);
}

/**
 * Convert American odds to decimal multiplier.
 */
function americanToDecimal(odds: number): number {
  if (odds > 0) return 1 + (odds / 100);
  if (odds < 0) return 1 + (100 / Math.abs(odds));
  return 1;
}

/**
 * Get position status from bets.
 */
function getPositionStatus(bets: Bet[]): 'pending' | 'won' | 'lost' | 'mixed' {
  const hasWin = bets.some(b => b.result === 'win');
  const hasLoss = bets.some(b => b.result === 'loss');
  const hasPending = bets.some(b => b.result === 'pending');
  
  if (hasPending && !hasWin && !hasLoss) return 'pending';
  if (hasWin && !hasLoss && !hasPending) return 'won';
  if (hasLoss && !hasWin && !hasPending) return 'lost';
  return 'mixed';
}

/**
 * Calculate hedge stake.
 */
function calculateHedgeStake(originalPayout: number, hedgeOdds: number, balanceFactor: number): number {
  const hedgeMultiplier = americanToDecimal(hedgeOdds);
  const fullHedgeStake = originalPayout / hedgeMultiplier;
  return fullHedgeStake * balanceFactor;
}

/**
 * Format currency.
 */
function formatCurrency(amount: number): string {
  if (amount < 0) return `-$${Math.abs(amount).toFixed(2)}`;
  return `$${amount.toFixed(2)}`;
}

/**
 * Estimate resolution date based on futures type and sport.
 * If estimated date is already past, bumps to next year.
 */
function estimateResolutionDate(futuresType: string, sport: string): Date | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  const type = futuresType.toLowerCase();
  const sportLower = sport.toLowerCase();
  
  let date: Date | null = null;
  
  if (type.includes('super bowl') || type === 'nfl championship') {
    date = new Date(currentYear, 1, 9);
  } else if (type.includes('nba championship') || type === 'nba finals') {
    date = new Date(currentYear, 5, 15);
  } else if (type.includes('world series') || type === 'mlb championship') {
    date = new Date(currentYear, 9, 30);
  } else if (type.includes('stanley cup') || type === 'nhl championship') {
    date = new Date(currentYear, 5, 20);
  } else if (type.includes('win total')) {
    if (sportLower === 'nfl' || sportLower === 'football') date = new Date(currentYear, 0, 8);
    else if (sportLower === 'nba' || sportLower === 'basketball') date = new Date(currentYear, 3, 14);
    else if (sportLower === 'mlb' || sportLower === 'baseball') date = new Date(currentYear, 9, 1);
    else if (sportLower === 'nhl' || sportLower === 'hockey') date = new Date(currentYear, 3, 15);
  } else if (type.includes('mvp') || type.includes('dpoy') || type.includes('roy')) {
    if (sportLower === 'nfl') date = new Date(currentYear, 1, 1);
    else if (sportLower === 'nba') date = new Date(currentYear, 4, 15);
    else if (sportLower === 'mlb') date = new Date(currentYear, 10, 15);
    else if (sportLower === 'nhl') date = new Date(currentYear, 5, 1);
  }
  
  // If estimated date is already past, bump to next year
  if (date && date < now) {
    date.setFullYear(date.getFullYear() + 1);
  }
  
  return date;
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestBet(overrides: Partial<Bet> & Pick<Bet, 'id' | 'result'>): Bet {
  return {
    id: overrides.id,
    book: 'FanDuel',
    betId: overrides.id,
    placedAt: '2025-01-01T12:00:00Z',
    betType: 'single',
    marketCategory: 'Futures',
    sport: 'NBA',
    description: 'Test bet',
    stake: 10,
    payout: 100,
    result: overrides.result,
    odds: 900,
    ...overrides,
  };
}

// Multiple bets on same entity for position grouping tests
const CELTICS_CHAMPIONSHIP_BET_1 = createTestBet({
  id: 'celtics-champ-1',
  result: 'pending',
  stake: 50,
  payout: 500,
  odds: 900,
  description: 'Boston Celtics to Win NBA Championship',
  name: 'Boston Celtics',
  placedAt: '2025-01-15T12:00:00Z',
});

const CELTICS_CHAMPIONSHIP_BET_2 = createTestBet({
  id: 'celtics-champ-2',
  result: 'pending',
  stake: 100,
  payout: 800,
  odds: 700,
  description: 'Boston Celtics to Win NBA Championship',
  name: 'Boston Celtics',
  placedAt: '2025-02-01T12:00:00Z',
});

const CELTICS_CHAMPIONSHIP_BET_3 = createTestBet({
  id: 'celtics-champ-3',
  result: 'pending',
  stake: 25,
  payout: 300,
  odds: 1100,
  description: 'Boston Celtics to Win NBA Championship',
  name: 'Boston Celtics',
  placedAt: '2025-02-15T12:00:00Z',
});

const LAKERS_CHAMPIONSHIP_BET = createTestBet({
  id: 'lakers-champ-1',
  result: 'pending',
  stake: 75,
  payout: 1500,
  odds: 1900,
  description: 'Los Angeles Lakers to Win NBA Championship',
  name: 'Los Angeles Lakers',
  sport: 'NBA',
});

const MAHOMES_MVP_BET = createTestBet({
  id: 'mahomes-mvp-1',
  result: 'pending',
  stake: 30,
  payout: 180,
  odds: 500,
  description: 'Patrick Mahomes - NFL MVP',
  name: 'Patrick Mahomes',
  sport: 'NFL',
});

const CHIEFS_WIN_TOTAL_BET = createTestBet({
  id: 'chiefs-wt-1',
  result: 'pending',
  stake: 50,
  payout: 95,
  odds: -110,
  description: 'Kansas City Chiefs Win Total Over 11.5',
  name: 'Kansas City Chiefs',
  sport: 'NFL',
});

const SETTLED_WIN_BET = createTestBet({
  id: 'settled-win-1',
  result: 'win',
  stake: 40,
  payout: 400,
  odds: 900,
  description: 'Denver Nuggets to Win NBA Championship',
  name: 'Denver Nuggets',
  sport: 'NBA',
});

const SETTLED_LOSS_BET = createTestBet({
  id: 'settled-loss-1',
  result: 'loss',
  stake: 25,
  payout: 0,
  odds: 1500,
  description: 'Phoenix Suns to Win NBA Championship',
  name: 'Phoenix Suns',
  sport: 'NBA',
});

// ============================================================================
// Tests
// ============================================================================

describe('Futures Management View', () => {
  // ===========================================================================
  // Entity Extraction Tests
  // ===========================================================================
  describe('Entity Extraction', () => {
    it('extracts entity from "X to win" pattern', () => {
      expect(extractEntityFromDescription('Boston Celtics to Win NBA Championship')).toBe('Boston Celtics');
    });
    
    it('extracts entity from "X - Y" pattern', () => {
      expect(extractEntityFromDescription('Patrick Mahomes - NFL MVP')).toBe('Patrick Mahomes');
    });
    
    it('extracts entity from "X Win Total" pattern', () => {
      expect(extractEntityFromDescription('Kansas City Chiefs Win Total Over 11.5')).toBe('Kansas City Chiefs');
    });
    
    it('extracts entity from "X Over N" pattern', () => {
      expect(extractEntityFromDescription('Lamar Jackson Over 35.5 Passing TDs')).toBe('Lamar Jackson');
    });
    
    it('handles empty description', () => {
      expect(extractEntityFromDescription('')).toBe('');
    });
    
    it('truncates long unmatched descriptions', () => {
      const longDesc = 'This is a very long description that does not match any pattern';
      const result = extractEntityFromDescription(longDesc);
      expect(result.length).toBeLessThanOrEqual(41);
      expect(result.endsWith('…')).toBe(true);
    });
  });
  
  // ===========================================================================
  // Futures Type Extraction Tests
  // ===========================================================================
  describe('Futures Type Extraction', () => {
    it('identifies NBA Championship', () => {
      expect(extractFuturesType('Celtics to Win NBA Championship', 'NBA')).toBe('NBA Championship');
    });
    
    it('identifies Super Bowl', () => {
      expect(extractFuturesType('Chiefs to Win Super Bowl', 'NFL')).toBe('Super Bowl');
    });
    
    it('identifies World Series', () => {
      expect(extractFuturesType('Dodgers to Win World Series', 'MLB')).toBe('World Series');
    });
    
    it('identifies Stanley Cup', () => {
      expect(extractFuturesType('Oilers to Win Stanley Cup', 'NHL')).toBe('Stanley Cup');
    });
    
    it('identifies Win Total', () => {
      expect(extractFuturesType('Chiefs Win Total Over 11.5', 'NFL')).toBe('Win Total');
    });
    
    it('identifies MVP', () => {
      expect(extractFuturesType('Mahomes MVP', 'NFL')).toBe('MVP');
    });
    
    it('identifies DPOY', () => {
      expect(extractFuturesType('TJ Watt DPOY', 'NFL')).toBe('DPOY');
    });
    
    it('identifies ROY', () => {
      expect(extractFuturesType('Caleb Williams ROY', 'NFL')).toBe('ROY');
    });
    
    it('returns Other for unrecognized types', () => {
      expect(extractFuturesType('Some unknown futures bet', 'NBA')).toBe('Other');
    });
  });
  
  // ===========================================================================
  // Position Grouping Tests
  // ===========================================================================
  describe('Position Grouping', () => {
    it('groups multiple bets on same entity into one position', () => {
      const bets = [
        CELTICS_CHAMPIONSHIP_BET_1,
        CELTICS_CHAMPIONSHIP_BET_2,
        CELTICS_CHAMPIONSHIP_BET_3,
      ];
      
      // Group by entity + type + sport
      const positionMap = new Map<string, Bet[]>();
      for (const bet of bets) {
        const entity = bet.name || extractEntityFromDescription(bet.description);
        const futuresType = extractFuturesType(bet.description, bet.sport || '');
        const key = `${entity}__${futuresType}__${bet.sport || 'Unknown'}`;
        
        if (!positionMap.has(key)) {
          positionMap.set(key, []);
        }
        positionMap.get(key)!.push(bet);
      }
      
      expect(positionMap.size).toBe(1);
      expect(positionMap.get('Boston Celtics__NBA Championship__NBA')).toHaveLength(3);
    });
    
    it('separates different entities into different positions', () => {
      const bets = [
        CELTICS_CHAMPIONSHIP_BET_1,
        LAKERS_CHAMPIONSHIP_BET,
      ];
      
      const positionMap = new Map<string, Bet[]>();
      for (const bet of bets) {
        const entity = bet.name || extractEntityFromDescription(bet.description);
        const futuresType = extractFuturesType(bet.description, bet.sport || '');
        const key = `${entity}__${futuresType}__${bet.sport || 'Unknown'}`;
        
        if (!positionMap.has(key)) {
          positionMap.set(key, []);
        }
        positionMap.get(key)!.push(bet);
      }
      
      expect(positionMap.size).toBe(2);
    });
    
    it('separates same entity with different futures types', () => {
      const mvpBet = createTestBet({
        id: 'celtics-mvp',
        result: 'pending',
        stake: 20,
        payout: 200,
        odds: 900,
        description: 'Jayson Tatum MVP',
        name: 'Jayson Tatum',
        sport: 'NBA',
      });
      
      const championshipBet = createTestBet({
        id: 'celtics-champ',
        result: 'pending',
        stake: 30,
        payout: 300,
        odds: 900,
        description: 'Jayson Tatum - Championship MVP',
        name: 'Jayson Tatum',
        sport: 'NBA',
      });
      
      const bets = [mvpBet, championshipBet];
      
      const positionMap = new Map<string, Bet[]>();
      for (const bet of bets) {
        const entity = bet.name || extractEntityFromDescription(bet.description);
        const futuresType = extractFuturesType(bet.description, bet.sport || '');
        const key = `${entity}__${futuresType}__${bet.sport || 'Unknown'}`;
        
        if (!positionMap.has(key)) {
          positionMap.set(key, []);
        }
        positionMap.get(key)!.push(bet);
      }
      
      expect(positionMap.size).toBe(2);
    });
  });
  
  // ===========================================================================
  // Position Analytics Tests
  // ===========================================================================
  describe('Position Analytics', () => {
    const celticsBets = [
      CELTICS_CHAMPIONSHIP_BET_1,
      CELTICS_CHAMPIONSHIP_BET_2,
      CELTICS_CHAMPIONSHIP_BET_3,
    ];
    
    it('calculates total stake correctly', () => {
      const totalStake = celticsBets.reduce((sum, b) => sum + b.stake, 0);
      expect(totalStake).toBe(175); // 50 + 100 + 25
    });
    
    it('calculates total potential payout correctly', () => {
      const totalPotentialPayout = celticsBets.reduce((sum, b) => sum + b.payout, 0);
      expect(totalPotentialPayout).toBe(1600); // 500 + 800 + 300
    });
    
    it('calculates max profit correctly', () => {
      const totalStake = celticsBets.reduce((sum, b) => sum + b.stake, 0);
      const totalPotentialPayout = celticsBets.reduce((sum, b) => sum + b.payout, 0);
      const maxProfit = totalPotentialPayout - totalStake;
      expect(maxProfit).toBe(1425); // 1600 - 175
    });
    
    it('calculates weighted average odds correctly', () => {
      // Weighted by stake:
      // Bet 1: $50 at +900 = 50 * 900 = 45000
      // Bet 2: $100 at +700 = 100 * 700 = 70000
      // Bet 3: $25 at +1100 = 25 * 1100 = 27500
      // Total weight = 45000 + 70000 + 27500 = 142500
      // Total stake = 175
      // Weighted average = 142500 / 175 = 814.29 ≈ 814
      const avgOdds = calculateWeightedAverageOdds(celticsBets);
      expect(avgOdds).toBe(814);
    });
    
    it('calculates average stake correctly', () => {
      const totalStake = celticsBets.reduce((sum, b) => sum + b.stake, 0);
      const avgStake = totalStake / celticsBets.length;
      expect(avgStake).toBeCloseTo(58.33, 1); // 175 / 3
    });
  });
  
  // ===========================================================================
  // Position Status Tests
  // ===========================================================================
  describe('Position Status', () => {
    it('returns pending for all pending bets', () => {
      const bets = [CELTICS_CHAMPIONSHIP_BET_1, CELTICS_CHAMPIONSHIP_BET_2];
      expect(getPositionStatus(bets)).toBe('pending');
    });
    
    it('returns won for all won bets', () => {
      const bets = [
        createTestBet({ id: '1', result: 'win' }),
        createTestBet({ id: '2', result: 'win' }),
      ];
      expect(getPositionStatus(bets)).toBe('won');
    });
    
    it('returns lost for all lost bets', () => {
      const bets = [
        createTestBet({ id: '1', result: 'loss' }),
        createTestBet({ id: '2', result: 'loss' }),
      ];
      expect(getPositionStatus(bets)).toBe('lost');
    });
    
    it('returns mixed for win + loss', () => {
      const bets = [
        createTestBet({ id: '1', result: 'win' }),
        createTestBet({ id: '2', result: 'loss' }),
      ];
      expect(getPositionStatus(bets)).toBe('mixed');
    });
    
    it('returns mixed for pending + win', () => {
      const bets = [
        createTestBet({ id: '1', result: 'pending' }),
        createTestBet({ id: '2', result: 'win' }),
      ];
      expect(getPositionStatus(bets)).toBe('mixed');
    });
    
    it('returns mixed for pending + loss', () => {
      const bets = [
        createTestBet({ id: '1', result: 'pending' }),
        createTestBet({ id: '2', result: 'loss' }),
      ];
      expect(getPositionStatus(bets)).toBe('mixed');
    });
  });
  
  // ===========================================================================
  // Hedge Calculator Tests
  // ===========================================================================
  describe('Hedge Calculator', () => {
    it('converts positive American odds to decimal', () => {
      expect(americanToDecimal(100)).toBe(2);
      expect(americanToDecimal(200)).toBe(3);
      expect(americanToDecimal(500)).toBe(6);
    });
    
    it('converts negative American odds to decimal', () => {
      expect(americanToDecimal(-100)).toBe(2);
      expect(americanToDecimal(-110)).toBeCloseTo(1.909, 2);
      expect(americanToDecimal(-200)).toBe(1.5);
    });
    
    it('calculates full hedge stake correctly', () => {
      const originalPayout = 1000;
      const hedgeOdds = -110;
      const balanceFactor = 1; // Full hedge
      
      const hedgeMultiplier = americanToDecimal(hedgeOdds);
      const expectedHedgeStake = originalPayout / hedgeMultiplier;
      
      const actualHedgeStake = calculateHedgeStake(originalPayout, hedgeOdds, balanceFactor);
      expect(actualHedgeStake).toBeCloseTo(expectedHedgeStake, 2);
    });
    
    it('calculates partial hedge stake correctly', () => {
      const originalPayout = 1000;
      const hedgeOdds = -110;
      const balanceFactor = 0.5; // 50% hedge
      
      const hedgeMultiplier = americanToDecimal(hedgeOdds);
      const fullHedgeStake = originalPayout / hedgeMultiplier;
      const expectedHedgeStake = fullHedgeStake * balanceFactor;
      
      const actualHedgeStake = calculateHedgeStake(originalPayout, hedgeOdds, balanceFactor);
      expect(actualHedgeStake).toBeCloseTo(expectedHedgeStake, 2);
    });
    
    it('returns zero hedge stake for zero balance', () => {
      const originalPayout = 1000;
      const hedgeOdds = -110;
      const balanceFactor = 0;
      
      const actualHedgeStake = calculateHedgeStake(originalPayout, hedgeOdds, balanceFactor);
      expect(actualHedgeStake).toBe(0);
    });
    
    it('calculates guaranteed profit scenario', () => {
      const originalStake = 100;
      const originalPayout = 1000;
      const hedgeOdds = -110;
      
      const hedgeMultiplier = americanToDecimal(hedgeOdds);
      const hedgeStake = originalPayout / hedgeMultiplier;
      
      // If original wins: profit = originalPayout - originalStake - hedgeStake
      const originalWinProfit = originalPayout - originalStake - hedgeStake;
      
      // If hedge wins: profit = (hedgeStake * hedgeMultiplier) - hedgeStake - originalStake
      const hedgeWinProfit = (hedgeStake * hedgeMultiplier) - hedgeStake - originalStake;
      
      // Guaranteed profit = min of both scenarios
      const guaranteedProfit = Math.min(originalWinProfit, hedgeWinProfit);
      
      // With full hedge, both scenarios should be approximately equal
      expect(Math.abs(originalWinProfit - hedgeWinProfit)).toBeLessThan(1);
      expect(guaranteedProfit).toBeGreaterThan(0);
    });
  });
  
  // ===========================================================================
  // Filtering Tests
  // ===========================================================================
  describe('Filtering', () => {
    const allBets = [
      CELTICS_CHAMPIONSHIP_BET_1,
      LAKERS_CHAMPIONSHIP_BET,
      MAHOMES_MVP_BET,
      CHIEFS_WIN_TOTAL_BET,
      SETTLED_WIN_BET,
      SETTLED_LOSS_BET,
    ];
    
    it('filters pending bets correctly', () => {
      const pendingBets = allBets.filter(b => b.result === 'pending');
      expect(pendingBets).toHaveLength(4);
    });
    
    it('filters settled bets correctly', () => {
      const settledBets = allBets.filter(b => b.result !== 'pending');
      expect(settledBets).toHaveLength(2);
    });
    
    it('filters by sport correctly', () => {
      const nbaBets = allBets.filter(b => b.sport === 'NBA');
      expect(nbaBets).toHaveLength(4); // Celtics, Lakers, Nuggets, Suns
      
      const nflBets = allBets.filter(b => b.sport === 'NFL');
      expect(nflBets).toHaveLength(2); // Mahomes, Chiefs
    });
    
    it('filters by futures type correctly', () => {
      const championshipBets = allBets.filter(b => 
        extractFuturesType(b.description, b.sport || '') === 'NBA Championship'
      );
      expect(championshipBets).toHaveLength(4);
      
      const mvpBets = allBets.filter(b => 
        extractFuturesType(b.description, b.sport || '') === 'MVP'
      );
      expect(mvpBets).toHaveLength(1);
      
      const winTotalBets = allBets.filter(b => 
        extractFuturesType(b.description, b.sport || '') === 'Win Total'
      );
      expect(winTotalBets).toHaveLength(1);
    });
  });
  
  // ===========================================================================
  // Totals and KPI Calculations
  // ===========================================================================
  describe('KPI Calculations', () => {
    const pendingBets = [
      CELTICS_CHAMPIONSHIP_BET_1,
      LAKERS_CHAMPIONSHIP_BET,
      MAHOMES_MVP_BET,
      CHIEFS_WIN_TOTAL_BET,
    ];
    
    it('calculates total exposure across all positions', () => {
      const totalExposure = pendingBets.reduce((sum, b) => sum + b.stake, 0);
      expect(totalExposure).toBe(205); // 50 + 75 + 30 + 50
    });
    
    it('calculates total potential payout', () => {
      const totalPotential = pendingBets.reduce((sum, b) => sum + b.payout, 0);
      expect(totalPotential).toBe(2275); // 500 + 1500 + 180 + 95
    });
    
    it('calculates max profit correctly', () => {
      const totalExposure = pendingBets.reduce((sum, b) => sum + b.stake, 0);
      const totalPotential = pendingBets.reduce((sum, b) => sum + b.payout, 0);
      const maxProfit = totalPotential - totalExposure;
      expect(maxProfit).toBe(2070); // 2275 - 205
    });
    
    it('calculates settled stats correctly', () => {
      const settledBets = [SETTLED_WIN_BET, SETTLED_LOSS_BET];
      
      const wins = settledBets.filter(b => b.result === 'win');
      const losses = settledBets.filter(b => b.result === 'loss');
      
      expect(wins).toHaveLength(1);
      expect(losses).toHaveLength(1);
      
      const netProfit = settledBets.reduce((sum, b) => {
        if (b.result === 'win') return sum + (b.payout - b.stake);
        if (b.result === 'loss') return sum - b.stake;
        return sum;
      }, 0);
      
      // Win: 400 - 40 = 360
      // Loss: -25
      // Net: 360 - 25 = 335
      expect(netProfit).toBe(335);
    });
  });
  
  // ===========================================================================
  // Currency Formatting Tests
  // ===========================================================================
  describe('Currency Formatting', () => {
    it('formats positive amounts correctly', () => {
      expect(formatCurrency(100)).toBe('$100.00');
      expect(formatCurrency(0.5)).toBe('$0.50');
      expect(formatCurrency(1234.56)).toBe('$1234.56');
    });
    
    it('formats zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });
    
    it('formats negative amounts with sign before dollar sign', () => {
      expect(formatCurrency(-25)).toBe('-$25.00');
      expect(formatCurrency(-100.5)).toBe('-$100.50');
      expect(formatCurrency(-0.01)).toBe('-$0.01');
    });
  });
  
  // ===========================================================================
  // Resolution Date Estimation Tests
  // ===========================================================================
  describe('Resolution Date Estimation', () => {
    it('returns a date for known futures types', () => {
      const date = estimateResolutionDate('Super Bowl', 'NFL');
      expect(date).not.toBeNull();
    });
    
    it('returns null for unknown futures types', () => {
      const date = estimateResolutionDate('Other', 'NBA');
      expect(date).toBeNull();
    });
    
    it('returns a future date (never a past date)', () => {
      const now = new Date();
      const types = [
        ['Super Bowl', 'NFL'],
        ['NBA Championship', 'NBA'],
        ['World Series', 'MLB'],
        ['Stanley Cup', 'NHL'],
        ['Win Total', 'NFL'],
        ['MVP', 'NBA'],
      ];
      
      for (const [futuresType, sport] of types) {
        const date = estimateResolutionDate(futuresType, sport);
        if (date) {
          expect(date.getTime()).toBeGreaterThan(now.getTime());
        }
      }
    });
  });
});
