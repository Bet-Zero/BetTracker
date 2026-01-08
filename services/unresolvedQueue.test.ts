import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  addToUnresolvedQueue,
  getUnresolvedQueue,
  clearUnresolvedQueue,
  generateUnresolvedItemId,
  UNRESOLVED_QUEUE_KEY,
  UnresolvedItem,
} from './unresolvedQueue';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('unresolvedQueue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('generateUnresolvedItemId', () => {
    it('generates deterministic ID from rawValue and betId', () => {
      const id1 = generateUnresolvedItemId('LeBron', 'bet-123');
      const id2 = generateUnresolvedItemId('LeBron', 'bet-123');
      expect(id1).toBe(id2);
    });

    it('includes legIndex when provided', () => {
      const withIndex = generateUnresolvedItemId('LeBron', 'bet-123', 0);
      const withoutIndex = generateUnresolvedItemId('LeBron', 'bet-123');
      expect(withIndex).not.toBe(withoutIndex);
    });

    it('normalizes rawValue to lowercase', () => {
      const id1 = generateUnresolvedItemId('LEBRON', 'bet-123');
      const id2 = generateUnresolvedItemId('lebron', 'bet-123');
      expect(id1).toBe(id2);
    });

    it('generates different IDs for different legIndex values', () => {
      const leg0 = generateUnresolvedItemId('Points', 'bet-123', 0);
      const leg1 = generateUnresolvedItemId('Points', 'bet-123', 1);
      expect(leg0).not.toBe(leg1);
    });
  });

  describe('getUnresolvedQueue', () => {
    it('returns empty array when no queue exists', () => {
      expect(getUnresolvedQueue()).toEqual([]);
    });

    it('returns stored items', () => {
      const item: UnresolvedItem = {
        id: 'test-id',
        rawValue: 'Unknown Team',
        entityType: 'team',
        encounteredAt: '2024-01-01T00:00:00Z',
        book: 'FanDuel',
        betId: 'bet-123',
      };
      localStorage.setItem(UNRESOLVED_QUEUE_KEY, JSON.stringify({ version: 1, items: [item] }));
      
      const queue = getUnresolvedQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].rawValue).toBe('Unknown Team');
    });

    it('handles corrupted JSON gracefully', () => {
      localStorage.setItem(UNRESOLVED_QUEUE_KEY, 'not-valid-json');
      expect(getUnresolvedQueue()).toEqual([]);
    });
  });

  describe('addToUnresolvedQueue', () => {
    it('adds items to empty queue', () => {
      const item: UnresolvedItem = {
        id: 'test-id-1',
        rawValue: 'Unknown Team',
        entityType: 'team',
        encounteredAt: '2024-01-01T00:00:00Z',
        book: 'FanDuel',
        betId: 'bet-123',
      };
      
      const added = addToUnresolvedQueue([item]);
      expect(added).toBe(1);
      expect(getUnresolvedQueue()).toHaveLength(1);
    });

    it('prevents duplicate entries by ID', () => {
      const item: UnresolvedItem = {
        id: 'duplicate-id',
        rawValue: 'Unknown Team',
        entityType: 'team',
        encounteredAt: '2024-01-01T00:00:00Z',
        book: 'FanDuel',
        betId: 'bet-123',
      };
      
      addToUnresolvedQueue([item]);
      const added = addToUnresolvedQueue([item]);
      
      expect(added).toBe(0);
      expect(getUnresolvedQueue()).toHaveLength(1);
    });

    it('adds multiple unique items', () => {
      const items: UnresolvedItem[] = [
        {
          id: 'id-1',
          rawValue: 'Team A',
          entityType: 'team',
          encounteredAt: '2024-01-01T00:00:00Z',
          book: 'FanDuel',
          betId: 'bet-1',
        },
        {
          id: 'id-2',
          rawValue: 'Team B',
          entityType: 'team',
          encounteredAt: '2024-01-01T00:00:00Z',
          book: 'FanDuel',
          betId: 'bet-2',
        },
      ];
      
      const added = addToUnresolvedQueue(items);
      expect(added).toBe(2);
      expect(getUnresolvedQueue()).toHaveLength(2);
    });

    it('accepts betType as a valid entityType', () => {
      const item: UnresolvedItem = {
        id: 'bettype-test',
        rawValue: 'Points',
        entityType: 'betType',
        encounteredAt: '2024-01-01T00:00:00Z',
        book: 'DraftKings',
        betId: 'bet-456',
        legIndex: 0,
      };
      
      const added = addToUnresolvedQueue([item]);
      expect(added).toBe(1);
      const queue = getUnresolvedQueue();
      expect(queue[0].entityType).toBe('betType');
    });
  });

  describe('clearUnresolvedQueue', () => {
    it('removes all items from queue', () => {
      const item: UnresolvedItem = {
        id: 'test-id',
        rawValue: 'Unknown',
        entityType: 'team',
        encounteredAt: '2024-01-01T00:00:00Z',
        book: 'FanDuel',
        betId: 'bet-123',
      };
      
      addToUnresolvedQueue([item]);
      expect(getUnresolvedQueue()).toHaveLength(1);
      
      clearUnresolvedQueue();
      expect(getUnresolvedQueue()).toEqual([]);
    });
  });
});
