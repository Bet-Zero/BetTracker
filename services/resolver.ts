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
  normalizeBetType,
  isKnownTeam,
  isKnownBetType,
  getPlayerInfo,
  getPlayerCollision,
  isKnownPlayer,
  normalizePlayerNameBasic,
  getTeamInfo,
  getSportForTeam,
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
 * Resolve a team name through the chokepoint with sport filtering.
 * 
 * This prevents cross-sport alias collisions (e.g., "Hawks" in NBA context
 * should not match NFL Seahawks aliases).
 * 
 * Resolution order:
 * 1. If sport provided and team resolves with matching sport → resolved
 * 2. If sport provided and team resolves but different sport → unresolved (cross-sport collision)
 * 3. If no sport provided, falls back to standard resolveTeam behavior
 * 
 * @param rawTeamName - The raw team name from sportsbook data
 * @param sport - The sport context to scope the resolution to
 * @returns ResolverResult with status and canonical value
 */
export function resolveTeamForSport(
  rawTeamName: string, 
  sport?: Sport
): ResolverResult {
  if (!rawTeamName || rawTeamName.trim() === '') {
    return {
      status: 'unresolved',
      canonical: rawTeamName || '',
      raw: rawTeamName || '',
    };
  }

  const trimmed = rawTeamName.trim();
  
  // If no sport context provided, use standard resolution
  if (!sport) {
    return resolveTeam(rawTeamName);
  }
  
  // Use existing normalizeTeamNameWithMeta for collision detection
  const normResult = normalizeTeamNameWithMeta(trimmed);
  
  // Get the matched team info to check its sport
  const teamInfo = getTeamInfo(trimmed);
  
  // Check for collision (ambiguous case) - filter to only same-sport candidates
  if (normResult.collision && normResult.collision.candidates.length > 1) {
    // Filter candidates by sport - get teams that match this sport
    const sportsForCandidates = normResult.collision.candidates
      .filter(candidate => {
        const candidateSport = getSportForTeam(candidate);
        return candidateSport === sport;
      });
    
    if (sportsForCandidates.length > 1) {
      // Multiple same-sport candidates - still ambiguous
      return {
        status: 'ambiguous',
        canonical: normResult.canonical,
        raw: trimmed,
        collision: {
          input: normResult.collision.input,
          candidates: sportsForCandidates,
        },
      };
    } else if (sportsForCandidates.length === 1) {
      // Exactly one same-sport candidate - resolved
      return {
        status: 'resolved',
        canonical: sportsForCandidates[0],
        raw: trimmed,
      };
    }
    // No same-sport candidates - fall through to unresolved
  }
  
  // Check if this is a known team with matching sport (resolved case)
  if (teamInfo) {
    // Check if the team's sport matches the context sport
    if (teamInfo.sport === sport) {
      return {
        status: 'resolved',
        canonical: teamInfo.canonical,
        raw: trimmed,
      };
    }
    // Team found but different sport - treat as unresolved in this context
    // This prevents "Hawks" in NBA from matching NFL Seahawks
  }
  
  // Check if normalization found a match with correct sport
  if (normResult.canonical !== trimmed) {
    const normalizedSport = getSportForTeam(normResult.canonical);
    if (normalizedSport === sport) {
      return {
        status: 'resolved',
        canonical: normResult.canonical,
        raw: trimmed,
      };
    }
  }
  
  // No match found for this sport (unresolved case)
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
 * Phase 1: Resolve a bet type through the chokepoint.
 * 
 * Wraps existing normalizeBetType logic.
 * Returns structured result with resolution status.
 * 
 * @param rawBetType - The raw bet type from sportsbook data
 * @param sport - Optional sport context
 * @returns ResolverResult with status and canonical value
 */
export function resolveBetType(rawBetType: string, sport?: Sport): ResolverResult {
  if (!rawBetType || rawBetType.trim() === '') {
    return {
      status: 'unresolved',
      canonical: rawBetType || '',
      raw: rawBetType || '',
    };
  }

  const trimmed = rawBetType.trim();
  
  // Use existing normalizeBetType
  const canonical = normalizeBetType(trimmed, sport);
  
  // Check if this is a known bet type (resolved case)
  // A bet type is resolved if:
  // 1. It's in the known bet types database, OR
  // 2. The canonical differs from the input (meaning normalization found a match)
  if (isKnownBetType(trimmed) || canonical !== trimmed) {
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
 * Convenience function to check if a bet type is resolved.
 * 
 * @param rawBetType - The raw bet type
 * @param sport - Optional sport context
 * @returns true if the bet type resolves to a known canonical
 */
export function isBetTypeResolved(rawBetType: string, sport?: Sport): boolean {
  const result = resolveBetType(rawBetType, sport);
  return result.status === 'resolved';
}

// Backward compatibility alias
export const resolveStatType = resolveBetType;
export const isStatTypeResolved = isBetTypeResolved;

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
