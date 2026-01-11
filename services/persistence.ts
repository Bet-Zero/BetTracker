import { Bet } from '../types';
import { Result, ok, err, createImportError } from './errors';
import { migrateBets } from '../utils/migrations';

/**
 * Persistence Service
 * 
 * Manages localStorage for the BetTracker application.
 * 
 * PRIVACY & SECURITY NOTES:
 * - Only normalized Bet data is persisted; raw HTML is NEVER stored.
 * - The Bet.raw field (if present) contains only extracted text content for debugging,
 *   NOT the full pasted HTML blob.
 * - No account identifiers, passwords, or sensitive PII are stored.
 * - All data is local to the browser; no backend transmission occurs.
 */

// Current version number for the storage schema
export const STORAGE_VERSION = 1;

// Storage key for the unified envelope
export const STORAGE_KEY = 'bettracker-state';

// Legacy key for migration purposes
export const LEGACY_STORAGE_KEY = 'bettracker-bets';

// Backup key prefix for corrupted or cleared data
export const BACKUP_KEY_PREFIX = 'bettracker-backup-';

export interface PersistedState {
  version: number;
  updatedAt: string; // ISO timestamp
  bets: Bet[];
  metadata?: {
    lastMigration?: string; // ISO timestamp of last migration
    previousVersion?: number; // Version before last migration
    _needsLegacyCleanup?: boolean; // Internal flag for deferred legacy key removal
  };
}

/**
 * Validates that an unknown object matches the PersistedState shape
 */
export function validatePersistedStateShape(state: unknown): state is PersistedState {
  if (!state || typeof state !== 'object') return false;
  
  const s = state as Record<string, unknown>;
  
  if (
    typeof s.version !== 'number' ||
    typeof s.updatedAt !== 'string' ||
    !Array.isArray(s.bets)
  ) {
    return false;
  }
  
  // Validate each bet has required shape (at minimum)
  // You may want to import and use a validateBet function here
  return s.bets.every(bet => 
    bet && 
    typeof bet === 'object' &&
    'id' in bet &&
    'stake' in bet
    // Add other required Bet fields
  );
}

/**
 * Creates a default empty state
 */
export function getDefaultState(): PersistedState {
  return {
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    bets: [],
  };
}

/**
 * Creates a backup in localStorage with error recovery.
 * Returns true if backup was created successfully, false otherwise.
 * 
 * On QuotaExceededError, attempts to free space by deleting older backups
 * and retries once.
 */
function createBackupInternal(
  data: string,
  label: string,
  prefix: string = BACKUP_KEY_PREFIX
): boolean {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupKey = `${prefix}${label}-${timestamp}`;
  
  try {
    localStorage.setItem(backupKey, data);
    console.log(`[Persistence] Created backup at ${backupKey}`);
    return true;
  } catch (e) {
    const isQuotaError = e instanceof DOMException && 
      (e.name === 'QuotaExceededError' || e.code === 22);
    
    if (isQuotaError) {
      console.warn('[Persistence] Quota exceeded, attempting cleanup', e);
      // Try to free space by removing older backups
      const backupKeys = Object.keys(localStorage)
        .filter(k => k.startsWith(BACKUP_KEY_PREFIX))
        .sort(); // Oldest first (timestamp in key)
      
      // Delete oldest backups (up to 3) to free space
      const toDelete = backupKeys.slice(0, Math.min(3, backupKeys.length));
      toDelete.forEach(k => {
        localStorage.removeItem(k);
        console.log(`[Persistence] Deleted old backup ${k} to free space`);
      });
      
      // Retry once
      try {
        localStorage.setItem(backupKey, data);
        console.log(`[Persistence] Created backup at ${backupKey} after cleanup`);
        return true;
      } catch (retryError) {
        console.error('[Persistence] Failed to create backup after cleanup', retryError);
        return false;
      }
    }
    
    console.error('[Persistence] Failed to create backup', e);
    return false;
  }
}

/**
 * Creates a backup of corrupted data with a timestamp.
 * Returns true if backup was created successfully, false otherwise.
 */
export function createCorruptedBackup(rawData: string, reason: string = 'corruption'): boolean {
  return createBackupInternal(rawData, reason);
}

/**
 * Migrates data from legacy format or previous versions
 */
export function migrateIfNeeded(raw: unknown): Result<PersistedState> {
  // If raw is null/undefined, check for legacy key
  if (raw === null || raw === undefined) {
    const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyData) {
      try {
        const legacyBets = JSON.parse(legacyData);
        if (Array.isArray(legacyBets)) {
          console.log('[Persistence] Migrating from legacy storage format');
          // Create new envelope with migrated bets
          const newState: PersistedState = {
            version: STORAGE_VERSION,
            updatedAt: new Date().toISOString(),
            bets: migrateBets(legacyBets), // Use existing bet migration utility
            metadata: {
              lastMigration: new Date().toISOString(),
              previousVersion: 0, // 0 indicates legacy/pre-versioning
              _needsLegacyCleanup: true // Defer cleanup until saveState succeeds
            }
          };
          
          return ok(newState);
        }
      } catch (e) {
        console.error('[Persistence] Failed to parse legacy data during migration', e);
        // If legacy data is corrupt, back it up too
        createCorruptedBackup(legacyData, 'legacy-corruption');
      }
    }
    // No legacy data or failed to migrate -> return default empty state
    return ok(getDefaultState());
  }

  // If we have an object, check if it's a valid envelope
  if (validatePersistedStateShape(raw)) {
    // Only return ok for matching versions
    if (raw.version === STORAGE_VERSION) {
      return ok(raw);
    }
    
    // Handle version upgrades
    if (raw.version < STORAGE_VERSION) {
      console.log(`[Persistence] Migrating v${raw.version} -> v${STORAGE_VERSION}`);
      return ok({
        ...raw,
        version: STORAGE_VERSION,
        updatedAt: new Date().toISOString()
      });
    }

    // Reject newer versions (forward compatibility not supported)
    console.error(
      `[Persistence] Version mismatch: found v${raw.version}, expected v${STORAGE_VERSION}`
    );
    return err(createImportError(
      'STORAGE_CORRUPTED',
      `Storage version mismatch: found v${raw.version}, expected v${STORAGE_VERSION}. ` +
      'Please update the app or clear storage.'
    ));
  }

  // If we got here, 'raw' is present but invalid shape - potential corruption logic handling
  console.error('[Persistence] Data found but invalid shape');
  return err(createImportError('STORAGE_CORRUPTED', 'Storage data format is invalid'));
}

/**
 * Loads state from localStorage with safety checks and migration
 */
export function loadState(): Result<PersistedState> {
  try {
    const rawString = localStorage.getItem(STORAGE_KEY);
    
    // Case 1: No data in main key -> try migration from legacy
    if (!rawString) {
      return migrateIfNeeded(null);
    }

    try {
      const parsed = JSON.parse(rawString);
      return migrateIfNeeded(parsed);
    } catch (parseError) {
      console.error('[Persistence] JSON parse failed', parseError);
      
      // Case 2: Corrupted JSON -> Backup and reset
      createCorruptedBackup(rawString, 'json-error');
      
      // Return default state but warn caller via success (app can continue with empty state)
      // or error (app warns user). Let's return error so UI can show a toast.
      // But we also need to return a usable state if possible?
      // The requirement says "Reset to a clean default state so the app can run" AND "Provide a UI message"
      // Result pattern usually implies failure stops things.
      // However, if we return error, the caller (useBets) needs to handle it by setting default state.
      return err(createImportError(
        'STORAGE_CORRUPTED', 
        'Saved data was corrupted and has been reset. A backup was created.'
      ));
    }
  } catch (e) {
    return err(createImportError('STORAGE_FAILED', `Failed to load state: ${e instanceof Error ? e.message : String(e)}`));
  }
}

/**
 * Saves state to localStorage
 */
/**
 * Saves state to localStorage
 */
/**
 * Saves state to localStorage
 */
export function saveState(state: PersistedState): Result<void> {
  // Validate state shape before persisting
  if (!validatePersistedStateShape(state)) {
    console.error('[Persistence] Attempted to save invalid state', state);
    return err(createImportError(
      'STORAGE_FAILED',
      'Cannot save: state has invalid shape'
    ));
  }
  
  try {
    // Capture cleanup flag before any object mutations
    const shouldCleanupLegacy = state.metadata?._needsLegacyCleanup;

    // Always update timestamp on save
    // NOTE: Spread operator does shallow copy, so metadata object is shared!
    // We must be careful not to mutate original state if we want to preserve input
    // But for saving, we construct a new object structure for metadata to be safe
    const stateToSave = {
      ...state,
      updatedAt: new Date().toISOString(),
      metadata: state.metadata ? { ...state.metadata } : undefined
    };
    
    // Remove internal flags before persisting
    if (stateToSave.metadata?._needsLegacyCleanup) {
      delete stateToSave.metadata._needsLegacyCleanup;
    }
    
    const serialized = JSON.stringify(stateToSave);
    localStorage.setItem(STORAGE_KEY, serialized);
    
    // Clean up legacy storage key if migration just completed
    if (shouldCleanupLegacy) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      console.log('[Persistence] Cleaned up legacy storage key after successful save');
    }
    
    return ok(undefined);
  } catch (e) {
    return err(createImportError('STORAGE_FAILED', `Failed to save state: ${e instanceof Error ? e.message : String(e)}`));
  }
}

/**
 * Creates a backup of the current state (e.g., before clearing data).
 * Returns true if backup was created successfully, false otherwise.
 */
// ... existing code ...
export function createManualBackup(state: PersistedState, label: string = 'manual'): boolean {
  try {
    return createBackupInternal(JSON.stringify(state), label);
  } catch (e) {
    console.error('[Persistence] Failed to serialize state for backup', e);
    return false;
  }
}

/**
 * Last Used Date Persistence
 * Stores the most recently used date from creating or editing bets.
 */
export const LAST_USED_DATE_KEY = 'bettracker-last-used-date';

/**
 * Gets the last used date preference (YYYY-MM-DD)
 */
export function getLastUsedDate(): string | null {
  return localStorage.getItem(LAST_USED_DATE_KEY);
}

/**
 * Sets the last used date preference
 * @param dateStr ISO string or YYYY-MM-DD string
 */
export function setLastUsedDate(dateStr: string): void {
  try {
    // If it's a full ISO string (contains 'T'), exact date part
    let dateToStore = dateStr;
    if (dateStr.includes('T')) {
      dateToStore = dateStr.split('T')[0];
    }
    
    localStorage.setItem(LAST_USED_DATE_KEY, dateToStore);
  } catch (e) {
    console.warn('[Persistence] Failed to save last used date:', e);
  }
}
