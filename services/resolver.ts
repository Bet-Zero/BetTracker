/**
 * Phase 1: Resolver Chokepoint for Teams and Stat Types
 * Phase 2: Extended for Players
 * 
 * This module provides a single resolver interface that wraps existing normalization logic.
 * All team/stat/player resolution should go through these functions to enforce the chokepoint.
 * 
 * Resolution outcomes:
 * - 'resolved': Canonical reference found
 * - 'unresolved': No match in reference data
 * - 'ambiguous': Multiple matches (collision detected)
 */

import { Sport } from '../data/referenceData';
import {
  normalizeTeamName,
  normalizeTeamNameWithMeta,
  normalizeStatType,
  isKnownTeam,
  isKnownStatType,
  getPlayerInfo,
  getPlayerCollision,
  isKnownPlayer,
  normalizePlayerNameBasic,
} from './normalizationService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Resolution status for an entity.
 */
export type ResolverStatus = 'resolved' | 'unresolved' | 'ambiguous';

/**
 * Result of resolving an entity through the chokepoint.
 */
export interface ResolverResult {
  /** Resolution status */
  status: ResolverStatus;
  /** Canonical value if resolved, raw value if not */
  canonical: string;
  /** Original input value */
  raw: string;
  /** Collision info if ambiguous */
  collision?: {
    input: string;
    candidates: string[];
  };
}

// ============================================================================
// TEAM RESOLUTION
// ============================================================================

/**
 * Phase 1: Resolve a team name through the chokepoint.
 * 
 * Wraps existing normalizeTeamName/normalizeTeamNameWithMeta logic.
 * Returns structured result with resolution status.
 * 
 * @param rawTeamName - The raw team name from sportsbook data
 * @returns ResolverResult with status and canonical value
 */
export function resolveTeam(rawTeamName: string): ResolverResult {
  if (!rawTeamName || rawTeamName.trim() === '') {
    return {
      status: 'unresolved',
      canonical: rawTeamName || '',
      raw: rawTeamName || '',
    };
  }

  const trimmed = rawTeamName.trim();
  
  // Use existing normalizeTeamNameWithMeta for collision detection
  const normResult = normalizeTeamNameWithMeta(trimmed);
  
  // Check for collision (ambiguous case)
  if (normResult.collision && normResult.collision.candidates.length > 1) {
    return {
      status: 'ambiguous',
      canonical: normResult.canonical,
      raw: trimmed,
      collision: normResult.collision,
    };
  }
  
  // Check if this is a known team (resolved case)
  // A team is resolved if:
  // 1. It's in the known teams database, OR
  // 2. The canonical differs from the input (meaning normalization found a match)
  if (isKnownTeam(trimmed) || normResult.canonical !== trimmed) {
    return {
      status: 'resolved',
      canonical: normResult.canonical,
      raw: trimmed,
    };
  }
  
  // No match found (unresolved case)
  return {
    status: 'unresolved',
    canonical: trimmed,
    raw: trimmed,
  };
}

/**
 * Convenience function to check if a team is resolved.
 * 
 * @param rawTeamName - The raw team name
 * @returns true if the team resolves to a known canonical
 */
export function isTeamResolved(rawTeamName: string): boolean {
  const result = resolveTeam(rawTeamName);
  return result.status === 'resolved';
}

/**
 * Get the canonical team name, or a fallback bucket for unresolved.
 * Use this in aggregation contexts where all entities need a key.
 * 
 * @param rawTeamName - The raw team name
 * @param unresolvedBucket - The bucket name for unresolved entities (default: '[Unresolved]')
 * @returns Canonical name or bucket name
 */
export function getTeamAggregationKey(
  rawTeamName: string,
  unresolvedBucket: string = '[Unresolved]'
): string {
  const result = resolveTeam(rawTeamName);
  return result.status === 'resolved' ? result.canonical : unresolvedBucket;
}

// ============================================================================
// STAT TYPE RESOLUTION
// ============================================================================

/**
 * Phase 1: Resolve a stat type through the chokepoint.
 * 
 * Wraps existing normalizeStatType logic.
 * Returns structured result with resolution status.
 * 
 * @param rawStatType - The raw stat type from sportsbook data
 * @param sport - Optional sport context
 * @returns ResolverResult with status and canonical value
 */
export function resolveStatType(rawStatType: string, sport?: Sport): ResolverResult {
  if (!rawStatType || rawStatType.trim() === '') {
    return {
      status: 'unresolved',
      canonical: rawStatType || '',
      raw: rawStatType || '',
    };
  }

  const trimmed = rawStatType.trim();
  
  // Use existing normalizeStatType
  const canonical = normalizeStatType(trimmed, sport);
  
  // Check if this is a known stat type (resolved case)
  // A stat is resolved if:
  // 1. It's in the known stat types database, OR
  // 2. The canonical differs from the input (meaning normalization found a match)
  if (isKnownStatType(trimmed) || canonical !== trimmed) {
    return {
      status: 'resolved',
      canonical: canonical,
      raw: trimmed,
    };
  }
  
  // No match found (unresolved case)
  return {
    status: 'unresolved',
    canonical: trimmed,
    raw: trimmed,
  };
}

/**
 * Convenience function to check if a stat type is resolved.
 * 
 * @param rawStatType - The raw stat type
 * @param sport - Optional sport context
 * @returns true if the stat type resolves to a known canonical
 */
export function isStatTypeResolved(rawStatType: string, sport?: Sport): boolean {
  const result = resolveStatType(rawStatType, sport);
  return result.status === 'resolved';
}

// ============================================================================
// PLAYER RESOLUTION (Phase 2)
// ============================================================================

/**
 * Phase 2: Resolve a player name through the chokepoint.
 * 
 * Uses sport-scoped lookups for accurate resolution.
 * Returns structured result with resolution status.
 * 
 * @param rawPlayerName - The raw player name from sportsbook data
 * @param context - Optional context with sport/team for scoped lookup
 * @returns ResolverResult with status and canonical value
 */
export function resolvePlayer(
  rawPlayerName: string,
  context?: { sport?: Sport; team?: string }
): ResolverResult {
  if (!rawPlayerName || rawPlayerName.trim() === '') {
    return {
      status: 'unresolved',
      canonical: rawPlayerName || '',
      raw: rawPlayerName || '',
    };
  }

  const trimmed = normalizePlayerNameBasic(rawPlayerName);
  
  // Check for collision (ambiguous case)
  const collisions = getPlayerCollision(trimmed, context);
  if (collisions && collisions.length > 1) {
    // Get the first match as the canonical (policy: keep first entry)
    const playerInfo = getPlayerInfo(trimmed, context);
    return {
      status: 'ambiguous',
      canonical: playerInfo?.canonical || trimmed,
      raw: trimmed,
      collision: {
        input: trimmed,
        candidates: collisions.map(p => p.canonical),
      },
    };
  }
  
  // Check if this is a known player (resolved case)
  const playerInfo = getPlayerInfo(trimmed, context);
  if (playerInfo) {
    return {
      status: 'resolved',
      canonical: playerInfo.canonical,
      raw: trimmed,
    };
  }
  
  // No match found (unresolved case)
  return {
    status: 'unresolved',
    canonical: trimmed,
    raw: trimmed,
  };
}

/**
 * Convenience function to check if a player is resolved.
 * 
 * @param rawPlayerName - The raw player name
 * @param context - Optional context with sport/team for scoped lookup
 * @returns true if the player resolves to a known canonical
 */
export function isPlayerResolved(
  rawPlayerName: string,
  context?: { sport?: Sport; team?: string }
): boolean {
  const result = resolvePlayer(rawPlayerName, context);
  return result.status === 'resolved';
}

/**
 * Get the canonical player name, or a fallback bucket for unresolved.
 * Use this in aggregation contexts where all entities need a key.
 * 
 * IMPORTANT: This function is PURE - it does NOT write to the queue
 * or have any side effects. Safe to call from render paths.
 * 
 * @param rawPlayerName - The raw player name
 * @param unresolvedBucket - The bucket name for unresolved entities (default: '[Unresolved]')
 * @param context - Optional context with sport/team for scoped lookup
 * @returns Canonical name or bucket name
 */
export function getPlayerAggregationKey(
  rawPlayerName: string,
  unresolvedBucket: string = '[Unresolved]',
  context?: { sport?: Sport; team?: string }
): string {
  const result = resolvePlayer(rawPlayerName, context);
  return result.status === 'resolved' ? result.canonical : unresolvedBucket;
}
