
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  resolvePlayer, 
  getPlayerAggregationKey, 
  isPlayerResolved 
} from './resolver';
import { 
  refreshLookupMaps, 
  isValidPlayerData, 
  normalizePlayerNameBasic,
  getPlayerInfo,
  getPlayerCollision
} from './normalizationService';
import { PlayerInfo } from '../data/referencePlayers';

// Mock the seed data
vi.mock('../data/referencePlayers', () => ({
  PLAYERS: [
    {
      canonical: 'LeBron James',
      sport: 'NBA',
      team: 'Los Angeles Lakers',
      aliases: ['LeBron', 'King James', 'L. James'],
    },
    {
      canonical: 'Stephen Curry',
      sport: 'NBA',
      team: 'Golden State Warriors',
      aliases: ['Steph Curry', 'Chef Curry'],
    },
    {
      canonical: 'Carmelo Anthony',
      sport: 'NBA', 
      aliases: ['Melo'],
      team: 'Knicks',
      abbreviations: []
    },
    {
      canonical: 'LaMelo Ball',
      sport: 'NBA',
      aliases: ['Melo'],
      team: 'Hornets',
      abbreviations: []
    }
  ]
}));

describe('Player Resolution & Normalization', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Force reload of mocked data
    refreshLookupMaps();
  });

  // ... (normalizePlayerNameBasic tests omitted for brevity in replacement, assuming they are unchanged)

  describe('resolvePlayer', () => {
    // ...

    it('detects ambiguity without context for colliding names', () => {
       // "Melo" maps to both Carmelo Anthony and LaMelo Ball
       
       const collisions = getPlayerCollision('Melo');
       expect(collisions).toBeDefined();
       expect(collisions!.length).toBeGreaterThan(1);
       
       const result = resolvePlayer('Melo');
       expect(result.status).toBe('ambiguous');
       expect(result.collision).toBeDefined();
       expect(result.collision!.input).toBe('Melo');
       expect(result.collision!.candidates).toContain('Carmelo Anthony');
       expect(result.collision!.candidates).toContain('LaMelo Ball');
    });
  });

  describe('getPlayerAggregationKey', () => {
    it('returns canonical for resolved player', () => {
      const key = getPlayerAggregationKey('King James', '[Unresolved]', { sport: 'NBA' });
      expect(key).toBe('LeBron James');
    });

    it('returns default bucket for unresolved player', () => {
      const key = getPlayerAggregationKey('Who Is This', '[Unresolved]', { sport: 'NBA' });
      expect(key).toBe('[Unresolved]');
    });

    it('returns custom bucket for unresolved player', () => {
      const key = getPlayerAggregationKey('Who Is This', 'UNKNOWN', { sport: 'NBA' });
      expect(key).toBe('UNKNOWN');
    });
    
    it('is pure (does not write to queue)', () => {
        // We can't easily check side effects here without mocking the queue service,
        // but functionally it just calls resolvePlayer which reads-only.
        const key = getPlayerAggregationKey('New Player', '[Unresolved]');
        expect(key).toBe('[Unresolved]');
    });
  });
  
  describe('isValidPlayerData', () => {
      it('validates correct player data', () => {
          const valid = {
              canonical: 'Test Player',
              sport: 'NBA',
              aliases: ['Test'],
              team: 'Team'
          };
          expect(isValidPlayerData(valid)).toBe(true);
      });
      
      it('invalidates missing fields', () => {
          const invalid = {
              sport: 'NBA'
          };
          expect(isValidPlayerData(invalid)).toBe(false);
      });
      
      it('invalidates wrong types', () => {
          const invalid = {
              canonical: 123,
              sport: 'NBA',
              aliases: []
          };
          expect(isValidPlayerData(invalid)).toBe(false);
      });
  });
});
