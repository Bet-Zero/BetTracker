import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parse } from './fanduel';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('FanDuel Parser - SGP Parsing', () => {
  let fixtureHtml: string;

  beforeAll(() => {
    const fixturePath = join(__dirname, '../fixtures/fanduel_sgp_sample.html');
    fixtureHtml = readFileSync(fixturePath, 'utf-8');
  });

  it('should parse exactly 2 bets from the SGP fixture', () => {
    const bets = parse(fixtureHtml);
    expect(bets).toHaveLength(2);
  });

  it('should parse the first SGP bet correctly', () => {
    const bets = parse(fixtureHtml);
    const bet1 = bets.find(b => b.betId === 'O/0242888/0027999');
    
    expect(bet1).toBeDefined();
    expect(bet1?.betId).toBe('O/0242888/0027999');
    expect(bet1?.book).toBe('FanDuel');
    expect(bet1?.betType).toBe('sgp');
    expect(bet1?.odds).toBe(31607);
    expect(bet1?.stake).toBe(0.50);
    expect(bet1?.payout).toBe(0.00);
    expect(bet1?.result).toBe('loss');
    expect(bet1?.description).toContain('Isaiah Collier');
    expect(bet1?.description).toContain('Ace Bailey');
    expect(bet1?.description).toContain('Patrick Williams');
    expect(bet1?.description).toContain('Jalen Smith');
    
    // Check placedAt date
    expect(bet1?.placedAt).toBeDefined();
    const placedDate = new Date(bet1!.placedAt);
    expect(placedDate.getFullYear()).toBe(2025);
    expect(placedDate.getMonth()).toBe(10); // November (0-indexed)
    expect(placedDate.getDate()).toBe(16);
  });

  it('should parse the second SGP bet correctly', () => {
    const bets = parse(fixtureHtml);
    const bet2 = bets.find(b => b.betId === 'O/0242888/0028000');
    
    expect(bet2).toBeDefined();
    expect(bet2?.betId).toBe('O/0242888/0028000');
    expect(bet2?.book).toBe('FanDuel');
    expect(bet2?.betType).toBe('sgp');
    expect(bet2?.odds).toBe(9116);
    expect(bet2?.stake).toBe(1.00);
    expect(bet2?.payout).toBe(0.00);
    expect(bet2?.result).toBe('loss');
    
    // Check placedAt date
    expect(bet2?.placedAt).toBeDefined();
    const placedDate = new Date(bet2!.placedAt);
    expect(placedDate.getFullYear()).toBe(2025);
    expect(placedDate.getMonth()).toBe(10); // November (0-indexed)
    expect(placedDate.getDate()).toBe(16);
  });

  it('should parse legs correctly for the first SGP bet', () => {
    const bets = parse(fixtureHtml);
    const bet1 = bets.find(b => b.betId === 'O/0242888/0027999');
    
    expect(bet1?.legs).toBeDefined();
    expect(bet1?.legs).toHaveLength(4);
    
    const legs = bet1!.legs!;
    
    // First leg: Isaiah Collier - won
    const leg1 = legs.find(l => l.entities?.includes('Isaiah Collier'));
    expect(leg1).toBeDefined();
    expect(leg1?.market).toBe('Ast'); // TYPE should be stat code
    expect(leg1?.target).toBe('6+'); // LINE should be numeric threshold
    expect(leg1?.result).toBe('win');
    
    // Second leg: Ace Bailey - lost
    const leg2 = legs.find(l => l.entities?.includes('Ace Bailey'));
    expect(leg2).toBeDefined();
    expect(leg2?.market).toBe('3pt'); // TYPE should be stat code
    expect(leg2?.target).toBe('3+'); // LINE should be numeric threshold
    expect(leg2?.result).toBe('loss');
    
    // Third leg: Patrick Williams - lost
    const leg3 = legs.find(l => l.entities?.includes('Patrick Williams'));
    expect(leg3).toBeDefined();
    expect(leg3?.market).toBe('3pt'); // TYPE should be stat code
    expect(leg3?.target).toBe('3+'); // LINE should be numeric threshold
    expect(leg3?.result).toBe('loss');
    
    // Fourth leg: Jalen Smith - won
    const leg4 = legs.find(l => l.entities?.includes('Jalen Smith'));
    expect(leg4).toBeDefined();
    expect(leg4?.market).toBe('3pt'); // TYPE should be stat code
    expect(leg4?.target).toBe('2+'); // LINE should be numeric threshold
    expect(leg4?.result).toBe('win');
  });

  it('should parse legs correctly for the second SGP bet', () => {
    const bets = parse(fixtureHtml);
    const bet2 = bets.find(b => b.betId === 'O/0242888/0028000');
    
    expect(bet2?.legs).toBeDefined();
    expect(bet2?.legs).toHaveLength(3);
    
    const legs = bet2!.legs!;
    
    // First leg: Isaiah Collier - won
    const leg1 = legs.find(l => l.entities?.includes('Isaiah Collier'));
    expect(leg1).toBeDefined();
    expect(leg1?.market).toBe('Ast'); // TYPE should be stat code
    expect(leg1?.target).toBe('6+'); // LINE should be numeric threshold
    expect(leg1?.result).toBe('win');
    
    // Second leg: Ace Bailey - lost
    const leg2 = legs.find(l => l.entities?.includes('Ace Bailey'));
    expect(leg2).toBeDefined();
    expect(leg2?.market).toBe('3pt'); // TYPE should be stat code
    expect(leg2?.target).toBe('3+'); // LINE should be numeric threshold
    expect(leg2?.result).toBe('loss');
    
    // Third leg: Patrick Williams - lost
    const leg3 = legs.find(l => l.entities?.includes('Patrick Williams'));
    expect(leg3).toBeDefined();
    expect(leg3?.market).toBe('3pt'); // TYPE should be stat code
    expect(leg3?.target).toBe('3+'); // LINE should be numeric threshold
    expect(leg3?.result).toBe('loss');
  });

  it('should not create duplicate bets for the same betId', () => {
    const bets = parse(fixtureHtml);
    const betIds = bets.map(b => b.betId);
    const uniqueBetIds = new Set(betIds);
    expect(betIds.length).toBe(uniqueBetIds.size);
  });

  it('should classify bets correctly', () => {
    const bets = parse(fixtureHtml);
    bets.forEach(bet => {
      expect(bet.marketCategory).toBeDefined();
      expect(bet.marketCategory).toBe('SGP/SGP+');
    });
  });

  it('should infer sport correctly', () => {
    const bets = parse(fixtureHtml);
    bets.forEach(bet => {
      expect(bet.sport).toBe('NBA');
    });
  });
});

describe('FanDuel Parser - Single Bet Parsing', () => {
  let fixtureHtml: string;

  beforeAll(() => {
    const fixturePath = join(__dirname, '../fixtures/fanduel_single_example.html');
    fixtureHtml = readFileSync(fixturePath, 'utf-8');
  });

  it('should parse exactly 1 bet from the single fixture', () => {
    const bets = parse(fixtureHtml);
    expect(bets).toHaveLength(1);
  });

  it('should parse the single bet correctly', () => {
    const bets = parse(fixtureHtml);
    const bet = bets.find(b => b.betId === 'O/0242888/0027982');
    
    expect(bet).toBeDefined();
    expect(bet?.betId).toBe('O/0242888/0027982');
    expect(bet?.book).toBe('FanDuel');
    expect(bet?.betType).toBe('single');
    expect(bet?.odds).toBe(360);
    expect(bet?.stake).toBe(1.00);
    expect(bet?.payout).toBe(4.60);
    expect(bet?.result).toBe('win');
    expect(bet?.description).toContain('Will Richard');
    // Description may contain parsed stat code or raw text
    expect(bet?.description).toMatch(/3\+.*MADE.*THREES|3pt/i);
    
    // Check placedAt date
    expect(bet?.placedAt).toBeDefined();
    const placedDate = new Date(bet!.placedAt);
    expect(placedDate.getFullYear()).toBe(2025);
    expect(placedDate.getMonth()).toBe(10); // November (0-indexed)
    expect(placedDate.getDate()).toBe(16);
  });

  it('should parse leg correctly for the single bet', () => {
    const bets = parse(fixtureHtml);
    const bet = bets.find(b => b.betId === 'O/0242888/0027982');
    
    expect(bet?.legs).toBeDefined();
    expect(bet?.legs).toHaveLength(1);
    
    const leg = bet!.legs![0];
    
    expect(leg.entities).toBeDefined();
    expect(leg.entities).toContain('Will Richard');
    expect(leg.market).toBe('3pt'); // TYPE should be stat code
    expect(leg.target).toBe('3+'); // LINE should be numeric threshold
    expect(leg.result).toBe('win');
  });

  it('should classify single bet correctly', () => {
    const bets = parse(fixtureHtml);
    bets.forEach(bet => {
      expect(bet.marketCategory).toBeDefined();
      // Single prop bets might be classified as 'Props' or similar
      expect(bet.marketCategory).toBeTruthy();
    });
  });

  it('should infer sport correctly for single bet', () => {
    const bets = parse(fixtureHtml);
    bets.forEach(bet => {
      expect(bet.sport).toBe('NBA');
    });
  });
});

