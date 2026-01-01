
import { describe, it, expect } from 'vitest';
import { getBetTypeCategory } from './betTypeUtils';

describe('betTypeUtils', () => {
  describe('getBetTypeCategory', () => {
    it('categorizes Main Markets correctly', () => {
      expect(getBetTypeCategory('Moneyline')).toBe('main');
      expect(getBetTypeCategory('Spread')).toBe('main');
      expect(getBetTypeCategory('Total')).toBe('main');
      expect(getBetTypeCategory('Over')).toBe('main');
      expect(getBetTypeCategory('Under')).toBe('main');
    });

    it('categorizes Futures correctly', () => {
      expect(getBetTypeCategory('Championship')).toBe('future');
      expect(getBetTypeCategory('NBA Finals')).toBe('future');
      expect(getBetTypeCategory('Win Total')).toBe('future');
      expect(getBetTypeCategory('MVP')).toBe('future');
      expect(getBetTypeCategory('DPOY')).toBe('future');
    });

    it('categorizes Parlays correctly', () => {
      expect(getBetTypeCategory('Parlay')).toBe('parlay');
      expect(getBetTypeCategory('SGP')).toBe('parlay');
      expect(getBetTypeCategory('SGP+')).toBe('parlay');
    });

    it('defaults unknown types to Props', () => {
      expect(getBetTypeCategory('Points')).toBe('props');
      expect(getBetTypeCategory('Rebounds')).toBe('props');
      expect(getBetTypeCategory('Assists')).toBe('props');
      expect(getBetTypeCategory('Unknown Random Bet')).toBe('props');
    });
  });
});
