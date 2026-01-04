
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeLookupMaps,
  TeamData,
  PlayerData,
  BetTypeData,
  NORMALIZATION_STORAGE_KEYS,
  toLookupKey
} from './normalizationService';
import {
  resolveTeam,
  resolvePlayer,
  resolveBetType
} from './resolver';

// Check if resolveBetType is exported, if not we might need to use getBetTypeInfo directly from normalizationService
// But for now let's assume it follows the pattern. If not, I'll need to check resolver.ts content.

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('Normalization Service - Disabled Entity Enforcement', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('Disabled Teams', () => {
    it('should not resolve disabled teams', () => {
      const teams: TeamData[] = [
        {
          canonical: 'Active Team',
          sport: 'NBA',
          aliases: ['Active Alias'],
          abbreviations: ['ACT'],
          disabled: false
        },
        {
          canonical: 'Disabled Team',
          sport: 'NBA',
          aliases: ['Disabled Alias'],
          abbreviations: ['DIS'],
          disabled: true
        }
      ];

      window.localStorage.setItem(NORMALIZATION_STORAGE_KEYS.TEAMS, JSON.stringify(teams));
      initializeLookupMaps();

      // Active team should resolve
      expect(resolveTeam('Active Team').status).toBe('resolved');
      expect(resolveTeam('Active Alias').status).toBe('resolved');

      // Disabled team should NOT resolve
      expect(resolveTeam('Disabled Team').status).toBe('unresolved');
      expect(resolveTeam('Disabled Alias').status).toBe('unresolved');
    });
  });

  describe('Disabled Players', () => {
    it('should not resolve disabled players', () => {
      const players: PlayerData[] = [
        {
          canonical: 'Active Player',
          sport: 'NBA',
          aliases: ['AP'],
          disabled: false
        },
        {
          canonical: 'Disabled Player',
          sport: 'NBA',
          aliases: ['DP'],
          disabled: true
        }
      ];

      window.localStorage.setItem(NORMALIZATION_STORAGE_KEYS.PLAYERS, JSON.stringify(players));
      initializeLookupMaps();

      // Active player should resolve (checked with NBA context)
      expect(resolvePlayer('Active Player', { sport: 'NBA' }).status).toBe('resolved');
      expect(resolvePlayer('AP', { sport: 'NBA' }).status).toBe('resolved');

      // Disabled player should NOT resolve
      expect(resolvePlayer('Disabled Player', { sport: 'NBA' }).status).toBe('unresolved');
      expect(resolvePlayer('DP', { sport: 'NBA' }).status).toBe('unresolved');
    });
  });
});
