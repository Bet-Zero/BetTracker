/**
 * Reference data for player canonicalization and alias resolution.
 * 
 * This provides canonical player names and alias mappings to handle variations
 * in how different sportsbooks format player names.
 * 
 * Architecture:
 * - Base seed data is in this file (versioned in code)
 * - User-added players are stored in localStorage as overlays
 * - Overlays EXTEND base data (user entries take precedence on conflict)
 * - Import from normalizationService.ts to access unified lookup functions
 * 
 * Keep this seed list small. The system is designed for "add as we go" via UI.
 */

import { Sport } from './referenceData';

// ============================================================================
// PLAYER INFO INTERFACE
// ============================================================================

/**
 * Represents a player with canonical name and aliases.
 * Sport-scoped to prevent collisions between players in different sports.
 */
export interface PlayerInfo {
  /** Optional unique identifier for future use */
  id?: string;
  /** The canonical display name for this player */
  canonical: string;
  /** Sport this player belongs to */
  sport: Sport;
  /** Team affiliation (optional, for context) */
  team?: string;
  /** Alternative names/spellings for this player */
  aliases: string[];
}

// ============================================================================
// BASE SEED DATA
// ============================================================================

/**
 * Base player seed data.
 * 
 * Keep this list minimal - the system is designed for user-driven additions.
 * Only include players with known common alias variations.
 */
export const PLAYERS: PlayerInfo[] = [
  // Empty seed - users will add players via import flow or future UI
  // Example entry for reference:
  // {
  //   canonical: 'LeBron James',
  //   sport: 'NBA',
  //   team: 'Los Angeles Lakers',
  //   aliases: ['LeBron', 'King James', 'L. James'],
  // },
];
