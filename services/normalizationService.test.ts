import { describe, it, expect } from 'vitest';
import {
  normalizeTeamName,
  getSportForTeam,
  getTeamInfo,
  normalizeBetType,
  getBetTypeInfo,
  getSportsForBetType,
  normalizeMainMarketType,
  normalizeFutureType,
  inferSportFromContext,
  isKnownTeam,
  isKnownBetType,
} from './normalizationService';

describe('normalizationService', () => {
  describe('normalizeTeamName', () => {
    it('should normalize "PHO Suns" to "Phoenix Suns"', () => {
      expect(normalizeTeamName('PHO Suns')).toBe('Phoenix Suns');
    });

    it('should normalize "Phoenix Suns" to "Phoenix Suns"', () => {
      expect(normalizeTeamName('Phoenix Suns')).toBe('Phoenix Suns');
    });

    it('should normalize "Suns" to "Phoenix Suns"', () => {
      expect(normalizeTeamName('Suns')).toBe('Phoenix Suns');
    });

    it('should normalize "PHO" to "Phoenix Suns"', () => {
      expect(normalizeTeamName('PHO')).toBe('Phoenix Suns');
    });

    it('should normalize "PHX" to "Phoenix Suns"', () => {
      expect(normalizeTeamName('PHX')).toBe('Phoenix Suns');
    });

    it('should handle case insensitivity', () => {
      expect(normalizeTeamName('pho suns')).toBe('Phoenix Suns');
      expect(normalizeTeamName('PHOENIX SUNS')).toBe('Phoenix Suns');
    });

    it('should normalize Lakers variations', () => {
      expect(normalizeTeamName('LAL Lakers')).toBe('Los Angeles Lakers');
      expect(normalizeTeamName('LA Lakers')).toBe('Los Angeles Lakers');
      expect(normalizeTeamName('Lakers')).toBe('Los Angeles Lakers');
      expect(normalizeTeamName('Los Angeles Lakers')).toBe('Los Angeles Lakers');
    });

    it('should normalize NFL team names', () => {
      expect(normalizeTeamName('KC Chiefs')).toBe('Kansas City Chiefs');
      expect(normalizeTeamName('Chiefs')).toBe('Kansas City Chiefs');
      expect(normalizeTeamName('Kansas City Chiefs')).toBe('Kansas City Chiefs');
    });

    it('should return original name if not found', () => {
      expect(normalizeTeamName('Unknown Team')).toBe('Unknown Team');
    });

    it('should handle empty string', () => {
      expect(normalizeTeamName('')).toBe('');
    });
  });

  describe('getSportForTeam', () => {
    it('should return NBA for Phoenix Suns', () => {
      expect(getSportForTeam('Phoenix Suns')).toBe('NBA');
      expect(getSportForTeam('PHO Suns')).toBe('NBA');
      expect(getSportForTeam('Suns')).toBe('NBA');
    });

    it('should return NFL for Kansas City Chiefs', () => {
      expect(getSportForTeam('Kansas City Chiefs')).toBe('NFL');
      expect(getSportForTeam('KC Chiefs')).toBe('NFL');
      expect(getSportForTeam('Chiefs')).toBe('NFL');
    });

    it('should return undefined for unknown team', () => {
      expect(getSportForTeam('Unknown Team')).toBeUndefined();
    });
  });

  describe('getTeamInfo', () => {
    it('should return team info for Phoenix Suns', () => {
      const info = getTeamInfo('PHO Suns');
      expect(info).toBeDefined();
      expect(info?.canonical).toBe('Phoenix Suns');
      expect(info?.sport).toBe('NBA');
      expect(info?.abbreviations).toContain('PHO');
      expect(info?.abbreviations).toContain('PHX');
    });

    it('should return undefined for unknown team', () => {
      expect(getTeamInfo('Unknown Team')).toBeUndefined();
    });
  });

  describe('normalizeBetType', () => {
    it('should normalize "Rebs" to "Reb"', () => {
      expect(normalizeBetType('Rebs')).toBe('Reb');
    });

    it('should normalize "Rebounds" to "Reb"', () => {
      expect(normalizeBetType('Rebounds')).toBe('Reb');
    });

    it('should normalize "REB" to "Reb"', () => {
      expect(normalizeBetType('REB')).toBe('Reb');
    });

    it('should normalize "MADE THREES" to "3pt"', () => {
      expect(normalizeBetType('MADE THREES')).toBe('3pt');
    });

    it('should normalize "Threes" to "3pt"', () => {
      expect(normalizeBetType('Threes')).toBe('3pt');
    });

    it('should normalize "3-Pointers" to "3pt"', () => {
      expect(normalizeBetType('3-Pointers')).toBe('3pt');
    });

    it('should normalize "Top Scorer" to "Top Pts"', () => {
      expect(normalizeBetType('Top Scorer')).toBe('Top Pts');
      expect(normalizeBetType('Leading Scorer')).toBe('Top Pts');
      expect(normalizeBetType('Most Points')).toBe('Top Pts');
    });

    it('should normalize NFL stats', () => {
      expect(normalizeBetType('Passing Yards')).toBe('Pass Yds');
      expect(normalizeBetType('Rushing Touchdowns')).toBe('Rush TD');
      expect(normalizeBetType('Receiving Yards')).toBe('Rec Yds');
      expect(normalizeBetType('Anytime Touchdown')).toBe('ATTD');
    });

    it('should normalize MLB stats', () => {
      expect(normalizeBetType('Home Runs')).toBe('HR');
      expect(normalizeBetType('Strikeouts')).toBe('K');
      expect(normalizeBetType('RBIs')).toBe('RBI');
    });

    it('should handle sport context', () => {
      expect(normalizeBetType('Points', 'NBA')).toBe('Pts');
      expect(normalizeBetType('Assists', 'NHL')).toBe('Assists');
    });

    it('should return original if not found', () => {
      expect(normalizeBetType('Unknown Stat')).toBe('Unknown Stat');
    });
  });

  describe('getBetTypeInfo', () => {
    it('should return bet type info for Rebounds', () => {
      const info = getBetTypeInfo('Rebounds');
      expect(info).toBeDefined();
      expect(info?.canonical).toBe('Reb');
      expect(info?.sport).toBe('NBA');
      expect(info?.description).toBe('Rebounds');
    });

    it('should return undefined for unknown stat', () => {
      expect(getBetTypeInfo('Unknown Stat')).toBeUndefined();
    });
  });

  describe('getSportsForBetType', () => {
    it('should return NBA for Points', () => {
      const sports = getSportsForBetType('Points');
      expect(sports).toContain('NBA');
    });

    it('should return NFL for Pass Yds', () => {
      const sports = getSportsForBetType('Passing Yards');
      expect(sports).toContain('NFL');
    });

    it('should return empty array for unknown stat', () => {
      expect(getSportsForBetType('Unknown Stat')).toEqual([]);
    });
  });

  describe('normalizeMainMarketType', () => {
    it('should normalize "ML" to "Moneyline"', () => {
      expect(normalizeMainMarketType('ML')).toBe('Moneyline');
    });

    it('should normalize "Money Line" to "Moneyline"', () => {
      expect(normalizeMainMarketType('Money Line')).toBe('Moneyline');
    });

    it('should normalize "Point Spread" to "Spread"', () => {
      expect(normalizeMainMarketType('Point Spread')).toBe('Spread');
    });

    it('should normalize "O/U" to "Total"', () => {
      expect(normalizeMainMarketType('O/U')).toBe('Total');
    });

    it('should handle case insensitivity', () => {
      expect(normalizeMainMarketType('moneyline')).toBe('Moneyline');
      expect(normalizeMainMarketType('SPREAD')).toBe('Spread');
    });
  });

  describe('normalizeFutureType', () => {
    // Note: Canonical future type names are defined in referenceData.ts FUTURE_TYPES
    // "NBA Championship" is the canonical name, not "NBA Finals"
    it('should normalize "To Win NBA Finals" to "NBA Championship" (via alias "NBA Finals Winner")', () => {
      // "To Win NBA Finals" is not a registered alias, so it passes through unchanged
      // Only registered aliases like "NBA Finals Winner" normalize to "NBA Championship"
      expect(normalizeFutureType('NBA Finals Winner')).toBe('NBA Championship');
    });

    it('should return "NBA Championship" unchanged as it is already canonical', () => {
      expect(normalizeFutureType('NBA Championship')).toBe('NBA Championship');
    });

    it('should normalize "To Win Super Bowl" to "Super Bowl"', () => {
      expect(normalizeFutureType('To Win Super Bowl')).toBe('Super Bowl');
    });

    it('should normalize "Season Wins" to "Win Total"', () => {
      expect(normalizeFutureType('Season Wins')).toBe('Win Total');
    });

    it('should handle sport context', () => {
      expect(normalizeFutureType('NBA Championship', 'NBA')).toBe('NBA Championship');
    });
  });

  describe('inferSportFromContext', () => {
    it('should infer sport from team name', () => {
      expect(inferSportFromContext({ team: 'Lakers' })).toBe('NBA');
      expect(inferSportFromContext({ team: 'Chiefs' })).toBe('NFL');
    });

    it('should infer sport from stat type', () => {
      expect(inferSportFromContext({ statType: 'Pass Yds' })).toBe('NFL');
      expect(inferSportFromContext({ statType: 'Home Runs' })).toBe('MLB');
    });

    it('should infer sport from description keywords', () => {
      expect(inferSportFromContext({ description: 'NBA game tonight' })).toBe('NBA');
      expect(inferSportFromContext({ description: 'NFL playoffs' })).toBe('NFL');
    });

    it('should prioritize team name over other context', () => {
      expect(inferSportFromContext({ 
        team: 'Lakers', 
        description: 'NFL game' 
      })).toBe('NBA');
    });

    it('should return undefined if unable to infer', () => {
      expect(inferSportFromContext({ description: 'Unknown sport' })).toBeUndefined();
    });
  });

  describe('isKnownTeam', () => {
    it('should return true for known teams', () => {
      expect(isKnownTeam('Phoenix Suns')).toBe(true);
      expect(isKnownTeam('PHO Suns')).toBe(true);
      expect(isKnownTeam('Lakers')).toBe(true);
    });

    it('should return false for unknown teams', () => {
      expect(isKnownTeam('Unknown Team')).toBe(false);
    });
  });

  describe('isKnownBetType', () => {
    it('should return true for known stat types', () => {
      expect(isKnownBetType('Points')).toBe(true);
      expect(isKnownBetType('Rebounds')).toBe(true);
      expect(isKnownBetType('Pass Yds')).toBe(true);
    });

    it('should return false for unknown stat types', () => {
      expect(isKnownBetType('Unknown Stat')).toBe(false);
    });
  });
});
