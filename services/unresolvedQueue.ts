/**
 * Phase 1: Persistent Unresolved Queue
 * 
 * Stores unresolved entities encountered during import for later resolution.
 * Queue survives page reload and does not accept duplicates from the same import.
 * 
 * Storage key: bettracker-unresolved-queue
 */

import { toLookupKey } from './normalizationService';

// ============================================================================
// STORAGE KEY
// ============================================================================

/**
 * localStorage key for the unresolved queue.
 * This is a NEW key for Phase 1 — does not collide with existing keys.
 */
export const UNRESOLVED_QUEUE_KEY = 'bettracker-unresolved-queue' as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type of unresolved entity.
 */
export type UnresolvedEntityType = 'team' | 'stat' | 'player' | 'unknown';

/**
 * An item in the unresolved queue.
 */
export interface UnresolvedItem {
  /** Unique ID computed from rawValue + betId + legIndex */
  id: string;
  /** The raw entity text that couldn't be resolved */
  rawValue: string;
  /** Type of entity: team, stat, or unknown */
  entityType: UnresolvedEntityType;
  /** When this was first encountered (ISO timestamp) */
  encounteredAt: string;
  /** Sportsbook name */
  book: string;
  /** Bet ID for context */
  betId: string;
  /** Leg index if applicable */
  legIndex?: number;
  /** Raw market text for context */
  market?: string;
  /** Inferred sport if available */
  sport?: string;
  /** Short description/context snippet */
  context?: string;
}

/**
 * Stored queue structure in localStorage.
 */
interface UnresolvedQueueState {
  version: number;
  updatedAt: string;
  items: UnresolvedItem[];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a unique ID for an unresolved item.
 * Uses toLookupKey(rawValue) + betId + legIndex to prevent duplicates.
 * Phase 3.P1: Uses toLookupKey() for consistent key normalization.
 */
export function generateUnresolvedItemId(
  rawValue: string,
  betId: string,
  legIndex?: number
): string {
  const parts = [toLookupKey(rawValue), betId];
  if (legIndex !== undefined) {
    parts.push(String(legIndex));
  }
  // Simple hash: join with separator and create a deterministic ID
  return parts.join('::');
}

/**
 * Validate that an object is a valid UnresolvedItem.
 */
function isValidUnresolvedItem(item: unknown): item is UnresolvedItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.rawValue === 'string' &&
    typeof obj.entityType === 'string' &&
    ['team', 'stat', 'player', 'unknown'].includes(obj.entityType as string) &&
    typeof obj.encounteredAt === 'string' &&
    typeof obj.book === 'string' &&
    typeof obj.betId === 'string'
  );
}

// ============================================================================
// QUEUE OPERATIONS
// ============================================================================

/**
 * Load the unresolved queue from localStorage.
 * Returns empty array if not found or invalid.
 */
export function getUnresolvedQueue(): UnresolvedItem[] {
  try {
    const stored = localStorage.getItem(UNRESOLVED_QUEUE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as unknown;
    
    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn('[unresolvedQueue] Invalid queue structure, returning empty');
      return [];
    }
    
    const state = parsed as Partial<UnresolvedQueueState>;
    if (!Array.isArray(state.items)) {
      console.warn('[unresolvedQueue] Missing items array, returning empty');
      return [];
    }
    
    // Filter to only valid items
    const validItems = state.items.filter(isValidUnresolvedItem);
    if (validItems.length !== state.items.length) {
      console.warn(
        `[unresolvedQueue] Filtered out ${state.items.length - validItems.length} invalid items`
      );
    }
    
    return validItems;
  } catch (error) {
    console.error('[unresolvedQueue] Failed to load queue:', error);
    return [];
  }
}

/**
 * Save the unresolved queue to localStorage.
 */
function saveUnresolvedQueue(items: UnresolvedItem[]): void {
  const state: UnresolvedQueueState = {
    version: 1,
    updatedAt: new Date().toISOString(),
    items,
  };
  
  try {
    localStorage.setItem(UNRESOLVED_QUEUE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('[unresolvedQueue] Failed to save queue:', error);
  }
}

/**
 * Add items to the unresolved queue.
 * Duplicates (same ID) are skipped.
 * 
 * @param newItems - Items to add to the queue
 * @returns Number of items actually added (excluding duplicates)
 */
export function addToUnresolvedQueue(newItems: UnresolvedItem[]): number {
  if (!newItems || newItems.length === 0) return 0;
  
  const existingItems = getUnresolvedQueue();
  const existingIds = new Set(existingItems.map(item => item.id));
  
  // Filter out duplicates
  const itemsToAdd = newItems.filter(item => !existingIds.has(item.id));
  
  if (itemsToAdd.length === 0) {
    // All items were duplicates
    return 0;
  }
  
  // Log for debugging
  if (itemsToAdd.length < newItems.length) {
    console.log(
      `[unresolvedQueue] Skipped ${newItems.length - itemsToAdd.length} duplicate items`
    );
  }
  
  const updatedItems = [...existingItems, ...itemsToAdd];
  saveUnresolvedQueue(updatedItems);
  
  console.log(
    `[unresolvedQueue] Added ${itemsToAdd.length} items, queue now has ${updatedItems.length} total`
  );
  
  return itemsToAdd.length;
}

/**
 * Clear the entire unresolved queue.
 * Mainly used for testing and reset scenarios.
 */
export function clearUnresolvedQueue(): void {
  try {
    localStorage.removeItem(UNRESOLVED_QUEUE_KEY);
    console.log('[unresolvedQueue] Queue cleared');
  } catch (error) {
    console.error('[unresolvedQueue] Failed to clear queue:', error);
  }
}

/**
 * Remove specific items from the queue by ID.
 * Used when items are resolved.
 * 
 * @param ids - Array of item IDs to remove
 * @returns Number of items removed
 */
export function removeFromUnresolvedQueue(ids: string[]): number {
  if (!ids || ids.length === 0) return 0;
  
  const existingItems = getUnresolvedQueue();
  const idsToRemove = new Set(ids);
  const remainingItems = existingItems.filter(item => !idsToRemove.has(item.id));
  
  const removedCount = existingItems.length - remainingItems.length;
  
  if (removedCount > 0) {
    saveUnresolvedQueue(remainingItems);
    console.log(`[unresolvedQueue] Removed ${removedCount} items`);
  }
  
  return removedCount;
}

/**
 * Get the count of items in the unresolved queue.
 */
export function getUnresolvedQueueCount(): number {
  return getUnresolvedQueue().length;
}
