import { describe, it, expect } from 'vitest';
import { toLookupKey } from './normalizationService';

describe('toLookupKey', () => {
  describe('basic normalization', () => {
    it('trims leading and trailing whitespace', () => {
      expect(toLookupKey('  Phoenix Suns  ')).toBe('phoenix suns');
    });

    it('collapses internal double spaces', () => {
      expect(toLookupKey('LeBron  James')).toBe('lebron james');
    });

    it('collapses tabs and newlines', () => {
      expect(toLookupKey('LeBron\t\nJames')).toBe('lebron james');
    });

    it('collapses mixed whitespace characters', () => {
      expect(toLookupKey('Los  \t Angeles   Lakers')).toBe('los angeles lakers');
    });

    it('lowercases all characters', () => {
      expect(toLookupKey('PHOENIX SUNS')).toBe('phoenix suns');
      expect(toLookupKey('Phoenix Suns')).toBe('phoenix suns');
      expect(toLookupKey('phoenix suns')).toBe('phoenix suns');
    });
  });

  describe('punctuation preservation', () => {
    it("preserves apostrophes in names", () => {
      expect(toLookupKey("O'Brien")).toBe("o'brien");
      expect(toLookupKey("O'Neal")).toBe("o'neal");
    });

    it('preserves periods', () => {
      expect(toLookupKey('St. Louis Cardinals')).toBe('st. louis cardinals');
      expect(toLookupKey('Jr.')).toBe('jr.');
    });

    it('preserves hyphens', () => {
      expect(toLookupKey('Saint-Étienne')).toBe('saint-étienne');
      expect(toLookupKey('Three-Pointers')).toBe('three-pointers');
    });

    it('preserves other punctuation', () => {
      expect(toLookupKey('A&M')).toBe('a&m');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for empty input', () => {
      expect(toLookupKey('')).toBe('');
    });

    it('returns empty string for null-ish input', () => {
      expect(toLookupKey(null as unknown as string)).toBe('');
      expect(toLookupKey(undefined as unknown as string)).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(toLookupKey('   ')).toBe('');
      expect(toLookupKey('\t\n')).toBe('');
      expect(toLookupKey('  \t  \n  ')).toBe('');
    });

    it('handles single character input', () => {
      expect(toLookupKey('A')).toBe('a');
      expect(toLookupKey(' A ')).toBe('a');
    });
  });

  describe('real-world examples', () => {
    it('normalizes team names with extra whitespace', () => {
      expect(toLookupKey('  Phoenix Suns  ')).toBe('phoenix suns');
      expect(toLookupKey('Los Angeles  Lakers')).toBe('los angeles lakers');
      expect(toLookupKey(' KC Chiefs ')).toBe('kc chiefs');
    });

    it('normalizes player names with extra whitespace', () => {
      expect(toLookupKey('  LeBron James  ')).toBe('lebron james');
      expect(toLookupKey('LeBron  James')).toBe('lebron james');
      expect(toLookupKey("Shaquille  O'Neal")).toBe("shaquille o'neal");
    });

    it('normalizes stat types with extra whitespace', () => {
      expect(toLookupKey('  Points  ')).toBe('points');
      expect(toLookupKey('Pass  Yds')).toBe('pass yds');
      expect(toLookupKey(' 3-Pointers ')).toBe('3-pointers');
    });
  });
});
