import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as persistence from './persistence';
import * as migrations from '../utils/migrations';
import { Bet } from '../types';

describe('persistence service', () => {
  const mockBets: Bet[] = [
    {
      id: 'bet-1',
      book: 'FanDuel',
      betId: '123',
      placedAt: '2025-12-25T12:00:00Z',
      betType: 'single',
      marketCategory: 'Props',
      sport: 'NBA',
      description: 'LeBron James: 20+ Points',
      stake: 10,
      payout: 0,
      result: 'pending'
    },
    {
      id: 'bet-2',
      book: 'DraftKings',
      betId: '456',
      placedAt: '2025-12-24T10:00:00Z',
      betType: 'parlay',
      marketCategory: 'Main Markets',
      sport: 'NFL',
      description: 'Chiefs -3.5',
      stake: 25,
      payout: 50,
      result: 'win'
    }
  ];

  beforeEach(() => {
    // Clear localStorage before each test
    window.localStorage.clear();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validatePersistedStateShape', () => {
    it('validates a correct state object', () => {
      const state = {
        version: 1,
        updatedAt: '2025-12-25T12:00:00Z',
        bets: []
      };
      expect(persistence.validatePersistedStateShape(state)).toBe(true);
    });

    it('rejects null', () => {
      expect(persistence.validatePersistedStateShape(null)).toBe(false);
    });

    it('rejects undefined input', () => {
      expect(persistence.validatePersistedStateShape(undefined)).toBe(false);
    });

    it('rejects non-object primitives (string)', () => {
      expect(persistence.validatePersistedStateShape('invalid')).toBe(false);
    });

    it('rejects non-object primitives (number)', () => {
      expect(persistence.validatePersistedStateShape(42)).toBe(false);
    });

    it('rejects non-object primitives (boolean)', () => {
      expect(persistence.validatePersistedStateShape(true)).toBe(false);
    });

    it('rejects a state with bets not being an array (object instead)', () => {
      const state = {
        version: 1,
        updatedAt: '2025-12-25T12:00:00Z',
        bets: { foo: 'bar' }
      };
      expect(persistence.validatePersistedStateShape(state)).toBe(false);
    });

    it('rejects an empty object', () => {
      expect(persistence.validatePersistedStateShape({})).toBe(false);
    });

    it('rejects missing fields', () => {
      const state = {
        version: 1,
        // Missing updatedAt
        bets: []
      };
      expect(persistence.validatePersistedStateShape(state)).toBe(false);
    });

    it('rejects wrong types', () => {
      const state = {
        version: '1', // Should be number
        updatedAt: '2025-12-25T12:00:00Z',
        bets: []
      };
      expect(persistence.validatePersistedStateShape(state)).toBe(false);
    });
  });

  describe('migrateIfNeeded', () => {
    it('returns default state when no data exists', () => {
      const result = persistence.migrateIfNeeded(null);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.bets).toEqual([]);
        expect(result.value.version).toBe(persistence.STORAGE_VERSION);
      }
    });

    it('migrates legacy stored bets but defers cleanup', () => {
      // Setup legacy data in localStorage
      window.localStorage.setItem(persistence.LEGACY_STORAGE_KEY, JSON.stringify(mockBets));
      
      // Spy on migrateBets to ensure it's called
      const migrateSpy = vi.spyOn(migrations, 'migrateBets');
      
      const result = persistence.migrateIfNeeded(null);
      
      expect(result.ok).toBe(true);
      expect(migrateSpy).toHaveBeenCalled();
      
      // Verify legacy key is NOT removed yet (deferred until save)
      expect(window.localStorage.getItem(persistence.LEGACY_STORAGE_KEY)).not.toBeNull();
      
      // Verify internal flag is set
      if (result.ok) {
        // @ts-ignore - accessing internal flag for testing
        expect(result.value.metadata?._needsLegacyCleanup).toBe(true);
      }
    });

    it('handles corrupted legacy data gracefully', () => {
      // Setup corrupt legacy data
      window.localStorage.setItem(persistence.LEGACY_STORAGE_KEY, '{invalid json');

      const result = persistence.migrateIfNeeded(null);
      
      // Should return clean default
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.bets).toEqual([]);
      }

      // Should have created a backup
      const keys = Object.keys(window.localStorage);
      const backupKey = keys.find(k => k.startsWith(persistence.BACKUP_KEY_PREFIX + 'legacy-corruption-'));
      expect(backupKey).toBeDefined();
      expect(window.localStorage.getItem(backupKey!)).toBe('{invalid json');
    });

    it('returns current state if already valid', () => {
      const validState: persistence.PersistedState = {
        version: persistence.STORAGE_VERSION,
        updatedAt: '2025-12-25T12:00:00Z',
        bets: mockBets
      };
      
      const result = persistence.migrateIfNeeded(validState);
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(validState);
      }
    });

    it('rejects version mismatch', () => {
      const futureState = {
        version: 999, // Future version
        updatedAt: '2025-12-25T12:00:00Z',
        bets: mockBets
      };
      
      const result = persistence.migrateIfNeeded(futureState);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_CORRUPTED');
        expect(result.error.message).toContain('version mismatch');
      }
    });

    it('returns error if passed invalid shaped object', () => {
      const invalidState = {
        version: 1,
        // Missing required fields
      };
      
      const result = persistence.migrateIfNeeded(invalidState);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_CORRUPTED');
      }
    });

    it('migrates state from older storage version and preserves data', () => {
      // Construct a state with an older version (version 0, pre-versioning)
      const oldVersionState = {
        version: 0,
        updatedAt: '2025-12-20T10:00:00Z',
        bets: mockBets
      };
      
      const result = persistence.migrateIfNeeded(oldVersionState);
      
      // Migration should succeed
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Version should be updated to current
        expect(result.value.version).toBe(persistence.STORAGE_VERSION);
        
        // Data fields should be preserved - verify length
        expect(result.value.bets).toBeDefined();
        expect(result.value.bets.length).toBe(mockBets.length);
        
        // Verify bet content is preserved correctly
        expect(result.value.bets[0].id).toBe(mockBets[0].id);
        expect(result.value.bets[0].book).toBe(mockBets[0].book);
        expect(result.value.bets[0].stake).toBe(mockBets[0].stake);
        expect(result.value.bets[1].id).toBe(mockBets[1].id);
        expect(result.value.bets[1].book).toBe(mockBets[1].book);
        expect(result.value.updatedAt).toBeDefined();
      }
    });
  });

  describe('loadState', () => {
    it('loads valid state successfully', () => {
      const validState: persistence.PersistedState = {
        version: persistence.STORAGE_VERSION,
        updatedAt: '2025-12-25T12:00:00Z',
        bets: mockBets
      };
      window.localStorage.setItem(persistence.STORAGE_KEY, JSON.stringify(validState));
      
      const result = persistence.loadState();
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.bets).toHaveLength(2);
      }
    });

    it('handles corrupted JSON by creating backup and returning error', () => {
      // Corrupt JSON
      window.localStorage.setItem(persistence.STORAGE_KEY, '{ invalid json structure');
      
      const result = persistence.loadState();
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_CORRUPTED');
      }
      
      // Verify backup created
      const keys = Object.keys(window.localStorage);
      const backupKey = keys.find(k => k.startsWith(persistence.BACKUP_KEY_PREFIX + 'json-error-'));
      expect(backupKey).toBeDefined();
      expect(window.localStorage.getItem(backupKey!)).toBe('{ invalid json structure');
    });

    it('returns default state when storage key is missing', () => {
      // localStorage is cleared in beforeEach, so storage key is missing
      const result = persistence.loadState();
      
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.bets).toEqual([]);
        expect(result.value.version).toBe(persistence.STORAGE_VERSION);
      }
    });

    it('returns error for valid JSON with invalid shape', () => {
      // Valid JSON but invalid shape (missing required fields)
      window.localStorage.setItem(persistence.STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
      
      const result = persistence.loadState();
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_CORRUPTED');
      }
    });
  });

  describe('saveState', () => {
    it('saves state correctly', () => {
      const state = persistence.getDefaultState();
      state.bets = mockBets;
      
      const result = persistence.saveState(state);
      expect(result.ok).toBe(true);
      
      const saved = window.localStorage.getItem(persistence.STORAGE_KEY);
      expect(saved).not.toBeNull();
      const parsed = JSON.parse(saved!);
      expect(parsed.bets).toHaveLength(2);
      expect(parsed.updatedAt).toBeDefined(); // Should have updated timestamp
    });

    it('cleans up legacy key after successful save if flagged', () => {
      // Setup legacy key
      window.localStorage.setItem(persistence.LEGACY_STORAGE_KEY, 'exists');
      
      const state = persistence.getDefaultState();
      state.metadata = { _needsLegacyCleanup: true };
      
      const result = persistence.saveState(state);
      expect(result.ok).toBe(true);
      
      // Legacy key should be gone
      expect(window.localStorage.getItem(persistence.LEGACY_STORAGE_KEY)).toBeNull();
      
      // cleanup flag should accept not persist
      const saved = JSON.parse(window.localStorage.getItem(persistence.STORAGE_KEY)!);
      expect(saved.metadata?._needsLegacyCleanup).toBeUndefined();
    });

    it('validates state before saving', () => {
      const invalidState = {
        version: 1,
        // Missing required fields
      } as unknown as persistence.PersistedState;
      
      const result = persistence.saveState(invalidState);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_FAILED');
        expect(result.error.message).toContain('invalid shape');
      }
      
      // Should not have written anything
      expect(window.localStorage.getItem(persistence.STORAGE_KEY)).toBeNull();
    });

    it('preserves the version number in saved JSON', () => {
      const state = persistence.getDefaultState();
      state.bets = [];
      
      const result = persistence.saveState(state);
      expect(result.ok).toBe(true);
      
      const saved = window.localStorage.getItem(persistence.STORAGE_KEY);
      expect(saved).not.toBeNull();
      const parsed = JSON.parse(saved!);
      expect(parsed.version).toBe(persistence.STORAGE_VERSION);
    });

    it('returns error when localStorage quota is exceeded', () => {
      const state = persistence.getDefaultState();
      state.bets = mockBets;
      
      // Spy on Storage.prototype.setItem to throw error
      // Note: In JSDOM/Vitest, direct assignment to window.localStorage.setItem might be wrapped,
      // so spyOn works better.
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      setItemSpy.mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });
      
      const result = persistence.saveState(state);
      
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('STORAGE_FAILED');
        expect(result.error.message).toContain('QuotaExceededError');
      }
      
      setItemSpy.mockRestore();
    });

    it('saves state with empty bets array successfully', () => {
      const state = persistence.getDefaultState();
      state.bets = [];
      
      const result = persistence.saveState(state);
      expect(result.ok).toBe(true);
      
      const saved = window.localStorage.getItem(persistence.STORAGE_KEY);
      expect(saved).not.toBeNull();
      const parsed = JSON.parse(saved!);
      expect(parsed.bets).toEqual([]);
    });
  });

  describe('createManualBackup (and helper)', () => {
    it('creates backup successfully', () => {
      const state = persistence.getDefaultState();
      const spy = vi.spyOn(console, 'log');
      
      persistence.createManualBackup(state, 'test');
      
      const keys = Object.keys(window.localStorage);
      const backupKey = keys.find(k => k.startsWith(persistence.BACKUP_KEY_PREFIX + 'test-'));
      expect(backupKey).toBeDefined();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Created backup'));
    });

    it('handles QuotaExceededError by cleaning up old backups', () => {
      const state = persistence.getDefaultState();
      
      // Setup some old backups
      // Use real setItem for setup
      window.localStorage.setItem(persistence.BACKUP_KEY_PREFIX + 'old1-2025-01-01', 'data');
      window.localStorage.setItem(persistence.BACKUP_KEY_PREFIX + 'old2-2025-01-02', 'data');
      window.localStorage.setItem(persistence.BACKUP_KEY_PREFIX + 'old3-2025-01-03', 'data');
      
      // Spy on setItem to simulate failure then success
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      
      let attempts = 0;
      setItemSpy.mockImplementation((key, value) => {
        if (key.includes('quota-test')) {
             attempts++;
             if (attempts === 1) {
                  const err = new DOMException('QuotaExceededError', 'QuotaExceededError');
                  throw err;
             }
        }
        return undefined; 
      });

      // HOWEVER, if we return undefined, we mock the SET action, so verify logic needs to check arguments
      // or assume success. But we want to verify 'old1' is deleted.
      // Deletion checks removeItem. We should mock removeItem too?
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

      const success = persistence.createManualBackup(state, 'quota-test');
      
      expect(success).toBe(true);
      
      // Verify cleanup happened: removeItem should have been called for oldest backup
      expect(removeItemSpy).toHaveBeenCalledWith(persistence.BACKUP_KEY_PREFIX + 'old1-2025-01-01');
      
      setItemSpy.mockRestore();
      removeItemSpy.mockRestore();
    });
  });
});
