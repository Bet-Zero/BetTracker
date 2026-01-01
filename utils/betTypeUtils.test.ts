
import { describe, it, expect } from 'vitest';
import { getBetTypeCategory } from './betTypeUtils';

describe('betTypeUtils', () => {
  describe('getBetTypeCategory', () => {
    it('categorizes Main Markets correctly', () => {
      expect(getBetTypeCategory('Moneyline')).toBe('main');
      expect(getBetTypeCategory('Spread')).toBe('main');
      expect(getBetTypeCategory('Total')).toBe('main');
    });

    it('categorizes Futures correctly', () => {
      expect(getBetTypeCategory('NBA Championship')).toBe('future');
      expect(getBetTypeCategory('NBA MVP')).toBe('future');
      expect(getBetTypeCategory('NFL MVP')).toBe('future');
      expect(getBetTypeCategory('Cy Young')).toBe('future');
      expect(getBetTypeCategory('Hart Trophy')).toBe('future');
      expect(getBetTypeCategory('Win Total')).toBe('future');
    });

    it('categorizes Parlays correctly', () => {
      expect(getBetTypeCategory('Parlay')).toBe('parlay');
      expect(getBetTypeCategory('SGP')).toBe('parlay');
    });

    it('defaults unknown types to Props', () => {
      expect(getBetTypeCategory('Points')).toBe('props');
      expect(getBetTypeCategory('Rebounds')).toBe('props');
      expect(getBetTypeCategory('Unknown Random Bet')).toBe('props');
    });
  });
});
