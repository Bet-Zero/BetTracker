import { describe, it, expect, beforeEach } from 'vitest';
import { 
  resolveTeam, 
  resolveStatType,
  resolvePlayer,
  isTeamResolved, 
  isStatTypeResolved,
  getTeamAggregationKey 
} from './resolver';

describe('resolver', () => {
  describe('resolveTeam', () => {
    it('returns resolved for known team canonical name', () => {
      const result = resolveTeam('Phoenix Suns');
      expect(result.status).toBe('resolved');
      expect(result.canonical).toBe('Phoenix Suns');
      expect(result.raw).toBe('Phoenix Suns');
    });

    it('returns resolved for known team alias', () => {
      const result = resolveTeam('PHO Suns');
      expect(result.status).toBe('resolved');
      expect(result.canonical).toBe('Phoenix Suns');
      expect(result.raw).toBe('PHO Suns');
    });

    it('returns resolved for team abbreviation', () => {
      const result = resolveTeam('LAL');
      expect(result.status).toBe('resolved');
      expect(result.canonical).toBe('Los Angeles Lakers');
      expect(result.raw).toBe('LAL');
    });

    it('returns unresolved for unknown team', () => {
      const result = resolveTeam('Unknown Team XYZ');
      expect(result.status).toBe('unresolved');
      expect(result.canonical).toBe('Unknown Team XYZ');
      expect(result.raw).toBe('Unknown Team XYZ');
    });

    it('returns unresolved for empty string', () => {
      const result = resolveTeam('');
      expect(result.status).toBe('unresolved');
      expect(result.canonical).toBe('');
    });

    it('returns unresolved for null/undefined', () => {
      const result = resolveTeam(null as unknown as string);
      expect(result.status).toBe('unresolved');
    });

    it('handles team name with different casing', () => {
      const result = resolveTeam('phoenix suns');
      expect(result.status).toBe('resolved');
      expect(result.canonical).toBe('Phoenix Suns');
    });

    it('trims whitespace from input', () => {
      const result = resolveTeam('  Lakers  ');
      expect(result.status).toBe('resolved');
    });
  });

  describe('resolveStatType', () => {
    it('returns resolved for known stat type', () => {
      const result = resolveStatType('Points');
      expect(result.status).toBe('resolved');
      expect(result.canonical).toBe('Pts');
    });

    it('returns resolved for stat type alias', () => {
      const result = resolveStatType('Rebounds');
      expect(result.status).toBe('resolved');
      expect(result.canonical).toBe('Reb');
    });

    it('returns unresolved for unknown stat type', () => {
      const result = resolveStatType('Unknown Stat XYZ');
      expect(result.status).toBe('unresolved');
      expect(result.canonical).toBe('Unknown Stat XYZ');
    });

    it('returns unresolved for empty string', () => {
      const result = resolveStatType('');
      expect(result.status).toBe('unresolved');
    });
  });

  describe('isTeamResolved', () => {
    it('returns true for known team', () => {
      expect(isTeamResolved('Lakers')).toBe(true);
      expect(isTeamResolved('Phoenix Suns')).toBe(true);
    });

    it('returns false for unknown team', () => {
      expect(isTeamResolved('Unknown XYZ')).toBe(false);
    });
  });

  describe('isStatTypeResolved', () => {
    it('returns true for known stat type', () => {
      expect(isStatTypeResolved('Points')).toBe(true);
      expect(isStatTypeResolved('Reb')).toBe(true);
    });

    it('returns false for unknown stat type', () => {
      expect(isStatTypeResolved('Unknown Stat')).toBe(false);
    });
  });

  describe('getTeamAggregationKey', () => {
    it('returns canonical for resolved team', () => {
      expect(getTeamAggregationKey('Lakers')).toBe('Los Angeles Lakers');
      expect(getTeamAggregationKey('Phoenix Suns')).toBe('Phoenix Suns');
    });

    it('returns default bucket for unresolved team', () => {
      expect(getTeamAggregationKey('Unknown XYZ')).toBe('[Unresolved]');
    });

    it('allows custom unresolved bucket name', () => {
      expect(getTeamAggregationKey('Unknown XYZ', '[Unknown]')).toBe('[Unknown]');
    });
  });

  // Phase 3.P1: Whitespace handling regression tests
  describe('whitespace handling', () => {
    describe('resolveTeam with whitespace variants', () => {
      it('resolves team with leading/trailing whitespace', () => {
        const result = resolveTeam('  Lakers  ');
        expect(result.status).toBe('resolved');
        expect(result.canonical).toBe('Los Angeles Lakers');
      });

      it('resolves team with internal double spaces', () => {
        const result = resolveTeam('Los  Angeles  Lakers');
        expect(result.status).toBe('resolved');
        expect(result.canonical).toBe('Los Angeles Lakers');
      });

      it('resolves team with tabs and newlines', () => {
        const result = resolveTeam('Phoenix\t\nSuns');
        expect(result.status).toBe('resolved');
        expect(result.canonical).toBe('Phoenix Suns');
      });

      it('produces stable canonical regardless of whitespace', () => {
        const variants = [
          'Phoenix Suns',
          '  Phoenix Suns  ',
          'Phoenix  Suns',
          'Phoenix\tSuns',
          '  Phoenix   Suns  ',
        ];
        
        const canonicals = variants.map(v => resolveTeam(v).canonical);
        expect(new Set(canonicals).size).toBe(1);
        expect(canonicals[0]).toBe('Phoenix Suns');
      });
    });

    describe('resolveStatType with whitespace variants', () => {
      it('resolves stat type with leading/trailing whitespace', () => {
        const result = resolveStatType('  Points  ');
        expect(result.status).toBe('resolved');
        expect(result.canonical).toBe('Pts');
      });

      it('resolves stat type with internal double spaces', () => {
        const result = resolveStatType('Passing  Yards');
        expect(result.status).toBe('resolved');
        expect(result.canonical).toBe('Pass Yds');
      });
    });

    describe('resolvePlayer with whitespace variants', () => {
      it('produces stable result for whitespace variants', () => {
        const variants = [
          'LeBron James',
          '  LeBron James  ',
          'LeBron  James',
        ];
        
        // All variants should produce the same result
        const results = variants.map(v => resolvePlayer(v, { sport: 'NBA' }));
        const statuses = results.map(r => r.status);
        const canonicals = results.map(r => r.canonical);
        
        // All should have the same status
        expect(new Set(statuses).size).toBe(1);
        // All should have the same canonical (with collapsed whitespace)
        expect(new Set(canonicals).size).toBe(1);
      });
    });
  });
});
