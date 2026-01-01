/**
 * Unified Normalization Service
 *
 * SINGLE SOURCE OF TRUTH for all normalization lookups.
 *
 * This service provides lookup functions that map various aliases and formats to canonical names,
 * ensuring consistent data representation regardless of how different sportsbooks format their data.
 *
 * Architecture:
 * - Base seed data comes from `data/referenceData.ts` (versioned in code)
 * - User-added aliases are stored in localStorage as overlays
 * - Overlays EXTEND base data (user entries take precedence on conflict)
 * - Call `refreshLookupMaps()` after users add/edit aliases via UI
 *
 * ============================================================================
 * localStorage Schema Keys
 * ============================================================================
 *
 * NORMALIZATION_STORAGE_KEYS.TEAMS = 'bettracker-normalization-teams'
 *   - Structure: TeamData[] (see interface below)
 *   - Contains full team data including user additions/edits
 *
 * NORMALIZATION_STORAGE_KEYS.STAT_TYPES = 'bettracker-normalization-stattypes'
 *   - Structure: StatTypeData[] (see interface below)
 *   - Contains full stat type data including user additions/edits
 */

import {
  TEAMS,
  STAT_TYPES,
  MAIN_MARKET_TYPES,
  FUTURE_TYPES,
  PARLAY_TYPES,
  SPORTS,
  TeamInfo,
  StatTypeInfo,
  Sport,
} from "../data/referenceData";
import { PLAYERS, PlayerInfo } from "../data/referencePlayers";

// ============================================================================
// LOOKUP KEY NORMALIZATION
// ============================================================================

/**
 * Phase 3.3: Single shared lookup-key function for consistent normalization.
 *
 * This is the SINGLE SOURCE OF TRUTH for key normalization.
 *
 * Steps (in order):
 * 1. Return "" for null/undefined/empty
 * 2. Apply Unicode NFKC normalization (unifies composed/decomposed forms)
 * 3. Convert smart punctuation to ASCII equivalents
 * 4. Trim leading/trailing whitespace
 * 5. Collapse internal whitespace to single space (\s+ -> " ")
 * 6. Convert to lowercase
 *
 * IMPORTANT - Does NOT:
 * - Strip accents (José → josé, NOT jose — user preference)
 * - Remove punctuation (O'Brien → o'brien, NOT obrien)
 * - Apply fuzzy matching
 *
 * Use everywhere lookup keys are generated or compared:
 * - Map-building (teams/stat types/players)
 * - Resolution (teams/stat types/players)
 * - Unresolved queue ID generation
 * - Unresolved queue grouping keys
 */
export function toLookupKey(raw: string): string {
  if (!raw) return "";

  // Step 1: Unicode NFKC normalization
  // - Converts composed/decomposed variants to canonical form
  // - Converts compatibility characters (e.g., ﬁ → fi)
  let normalized = raw.normalize("NFKC");

  // Step 2: Smart punctuation → ASCII
  normalized = normalized
    // Smart single quotes → ASCII apostrophe
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    // Smart double quotes → ASCII double quote
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    // Dashes (em-dash, en-dash, figure dash, horizontal bar, minus sign) → hyphen-minus
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    // Non-breaking space, narrow no-break space → regular space
    .replace(/[\u00A0\u202F]/g, " ");

  // Step 3: Existing normalization (unchanged)
  return normalized.trim().replace(/\s+/g, " ").toLowerCase();
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to validate if a string is a valid Sport.
 * Checks against the canonical SPORTS array from referenceData.
 */
function isValidSport(value: string): value is Sport {
  return (SPORTS as readonly string[]).includes(value);
}

/**
 * Type guard to validate TeamData shape from localStorage.
 */
function isValidTeamData(item: unknown): item is TeamData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.canonical === "string" &&
    typeof obj.sport === "string" &&
    isValidSport(obj.sport) &&
    Array.isArray(obj.aliases) &&
    obj.aliases.every((a) => typeof a === "string") &&
    Array.isArray(obj.abbreviations) &&
    obj.abbreviations.every((a) => typeof a === "string") &&
    // Phase 4: Optional disabled field
    (obj.disabled === undefined || typeof obj.disabled === "boolean") &&
    // Phase 5: Team ID
    (obj.id === undefined || typeof obj.id === "string")
  );
}

/**
 * Type guard to validate StatTypeData shape from localStorage.
 */
function isValidStatTypeData(item: unknown): item is StatTypeData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.canonical === "string" &&
    typeof obj.sport === "string" &&
    isValidSport(obj.sport) &&
    typeof obj.description === "string" &&
    Array.isArray(obj.aliases) &&
    obj.aliases.every((a) => typeof a === "string") &&
    // Phase 4: Optional disabled field
    (obj.disabled === undefined || typeof obj.disabled === "boolean")
  );
}

/**
 * Type guard to validate PlayerData shape from localStorage.
 */
export function isValidPlayerData(item: unknown): item is PlayerData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.canonical === "string" &&
    typeof obj.sport === "string" &&
    isValidSport(obj.sport) &&
    Array.isArray(obj.aliases) &&
    obj.aliases.every((a) => typeof a === "string") &&
    // Optional fields
    (obj.id === undefined || typeof obj.id === "string") &&
    (obj.team === undefined || typeof obj.team === "string") &&
    // Phase 4: Optional disabled field
    (obj.disabled === undefined || typeof obj.disabled === "boolean") &&
    // Phase 5: Team ID
    (obj.teamId === undefined || typeof obj.teamId === "string")
  );
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

/**
 * localStorage keys for normalization overlays.
 * Documented here as the single source of truth for schema.
 */
export const NORMALIZATION_STORAGE_KEYS = {
  TEAMS: "bettracker-normalization-teams",
  STAT_TYPES: "bettracker-normalization-stattypes",
  PLAYERS: "bettracker-normalization-players",
} as const;

// ============================================================================
// EXPORTED DATA INTERFACES
// ============================================================================

/**
 * FutureTypeData interface for consistency with other data types.
 *
 * Note: Futures are intentionally immutable and do not support localStorage
 * overlays because they are sport-league defined values (e.g., "NBA Finals",
 * "Super Bowl") that rarely need user customization. Unlike team aliases
 * which vary by sportsbook, future bet types are standardized.
 */
export interface FutureTypeData {
  canonical: string;
  sport?: Sport;
  aliases: string[];
  description: string;
}

/**
 * Team data structure used in localStorage and UI.
 * Matches the shape expected by useNormalizationData hook.
 */

export interface TeamData {
  canonical: string;
  sport: Sport;
  abbreviations: string[];
  aliases: string[];
  /** Phase 4: If true, entity is excluded from resolution */
  disabled?: boolean;
  /** Phase 5: Stable, sport-scoped unique identifier (e.g., "NBA:LAL") */
  id: string;
}

/**
 * Stat type data structure used in localStorage and UI.
 * Matches the shape expected by useNormalizationData hook.
 */
export interface StatTypeData {
  canonical: string;
  sport: Sport;
  description: string;
  aliases: string[];
  /** Phase 4: If true, entity is excluded from resolution */
  disabled?: boolean;
}

/**
 * Player data structure used in localStorage and UI.
 * Sport-scoped to prevent collisions between players in different sports.
 */
export interface PlayerData {
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
  /** Phase 4: If true, entity is excluded from resolution */
  disabled?: boolean;
  /** Phase 5: Link to TeamData.id */
  teamId?: string;
}

/**
 * Result of team normalization with collision metadata.
 */
export interface NormalizationResult {
  canonical: string;
  collision?: {
    input: string;
    candidates: string[]; // All canonical names that matched
  };
}

/**
 * Snapshot of current reference data for consumers.
 * Use this instead of copying arrays directly to prevent drift.
 */
export interface ReferenceDataSnapshot {
  teams: TeamData[];
  statTypes: StatTypeData[];
  players: PlayerData[];
  version: string;
}

// Current version for migration support
const REFERENCE_DATA_VERSION = "1.0.0";

// ============================================================================
// LOOKUP MAPS (Internal State)
// ============================================================================

// Build lookup maps on initialization for O(1) lookups
let teamLookupMap = new Map<string, TeamData>();
let statTypeLookupMap = new Map<string, StatTypeData>();
let initialized = false;

// Track team collisions: key -> array of canonical names that match this key
let teamCollisionMap = new Map<string, string[]>();

// Cache the merged data for getReferenceDataSnapshot
let cachedTeams: TeamData[] = [];
let cachedStatTypes: StatTypeData[] = [];
let cachedPlayers: PlayerData[] = [];
// Map team ID -> TeamData for O(1) resolution in UI
let teamIdMap = new Map<string, TeamData>();

// Player lookup maps (sport-scoped for collision prevention)
let playerLookupMap = new Map<string, PlayerData>();
let playerCollisionMap = new Map<string, string[]>();

// Phase 3.1: Resolver version counter for UI refresh triggers
// Incremented whenever refreshLookupMaps() is called
let resolverVersion = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Converts base TeamInfo from referenceData to TeamData format.
 */
function toTeamData(team: TeamInfo): TeamData {
  return {
    canonical: team.canonical,
    sport: team.sport,
    abbreviations: [...team.abbreviations],
    aliases: [...team.aliases],
    // Generate ID for seed data
    id: generateTeamId(team.sport, team.abbreviations, team.canonical),
  };
}

/**
 * Converts base StatTypeInfo from referenceData to StatTypeData format.
 */
function toStatTypeData(stat: StatTypeInfo): StatTypeData {
  return {
    canonical: stat.canonical,
    sport: stat.sport,
    description: stat.description,
    aliases: [...stat.aliases],
  };
}

/**
 * Loads teams from localStorage, falling back to base seed if not present.
 * Validates the shape of parsed data to prevent runtime errors from malformed data.
 */
function loadTeams(): TeamData[] {
  const baseSeed = TEAMS.map(toTeamData);

  try {
    const stored = localStorage.getItem(NORMALIZATION_STORAGE_KEYS.TEAMS);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Validate parsed data is an array
      if (!Array.isArray(parsed)) {
        console.error(
          "[normalizationService] Invalid teams data in localStorage: expected array, got",
          typeof parsed
        );
        return baseSeed;
      }

      // Validate each item has the correct shape
      const validTeams: TeamData[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (isValidTeamData(item)) {
          validTeams.push(item);
        } else {
          console.error(
            `[normalizationService] Invalid team data at index ${i}:`,
            "expected {canonical: string, sport: Sport, aliases: string[], abbreviations: string[]}, got",
            JSON.stringify(item).slice(0, 100)
          );
        }
      }

      // If all items were invalid, fall back to base seed
      if (validTeams.length === 0 && parsed.length > 0) {
        console.error(
          "[normalizationService] All team entries in localStorage were invalid, falling back to base seed"
        );
        return baseSeed;
      }

      return validTeams.length > 0 ? validTeams : baseSeed;
    }
  } catch (error) {
    console.error(
      "[normalizationService] Failed to load teams from localStorage:",
      error
    );
  }

  return baseSeed;
}

/**
 * Loads stat types from localStorage, falling back to base seed if not present.
 * Validates the shape of parsed data to prevent runtime errors from malformed data.
 */
function loadStatTypes(): StatTypeData[] {
  // Combine all stat types for the base seed
  const baseSeed = [
    ...STAT_TYPES.map(toStatTypeData),
    ...MAIN_MARKET_TYPES.map(t => ({
      canonical: t.canonical,
      sport: "Other" as Sport, // Main markets are generic often, but let's default to Other or maybe explicit per type if needed. For now "Other" or generic is fine.
      // Actually MAIN_MARKET_TYPES in referenceData doesn't have sport. Let's use "Other" for generic ones.
      description: t.description,
      aliases: [...t.aliases]
    })),
    ...FUTURE_TYPES.map(t => ({
      canonical: t.canonical,
      sport: (t.sport || "Other") as Sport,
      description: t.description,
      aliases: [...t.aliases]
    })),
    ...PARLAY_TYPES.map(t => ({
      canonical: t.canonical,
      sport: "Other" as Sport,
      description: t.description,
      aliases: [...t.aliases]
    }))
  ];

  try {
    const stored = localStorage.getItem(NORMALIZATION_STORAGE_KEYS.STAT_TYPES);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Validate parsed data is an array
      if (!Array.isArray(parsed)) {
        console.error(
          "[normalizationService] Invalid stat types data in localStorage: expected array, got",
          typeof parsed
        );
        return baseSeed;
      }

      // Validate each item has the correct shape
      const validStatTypes: StatTypeData[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (isValidStatTypeData(item)) {
          validStatTypes.push(item);
        } else {
          console.error(
            `[normalizationService] Invalid stat type data at index ${i}:`,
            "expected {canonical: string, sport: Sport, description: string, aliases: string[]}, got",
            JSON.stringify(item).slice(0, 100)
          );
        }
      }

      // If all items were invalid, fall back to base seed
      if (validStatTypes.length === 0 && parsed.length > 0) {
        console.error(
          "[normalizationService] All stat type entries in localStorage were invalid, falling back to base seed"
        );
        return baseSeed;
      }

      return validStatTypes.length > 0 ? validStatTypes : baseSeed;
    }
  } catch (error) {
    console.error(
      "[normalizationService] Failed to load stat types from localStorage:",
      error
    );
  }

  return baseSeed;
}

/**
 * Converts base PlayerInfo from referencePlayers to PlayerData format.
 */
function toPlayerData(player: PlayerInfo): PlayerData {
  return {
    id: player.id,
    canonical: player.canonical,
    sport: player.sport,
    team: player.team,
    aliases: [...player.aliases],
    // Seed data doesn't have teamId yet, will be resolved at runtime/migration
  };
}

/**
 * Loads players from localStorage, falling back to base seed if not present.
 * Validates the shape of parsed data to prevent runtime errors from malformed data.
 */
function loadPlayers(): PlayerData[] {
  const baseSeed = PLAYERS.map(toPlayerData);

  try {
    const stored = localStorage.getItem(NORMALIZATION_STORAGE_KEYS.PLAYERS);
    if (stored) {
      const parsed = JSON.parse(stored);

      // Validate parsed data is an array
      if (!Array.isArray(parsed)) {
        console.error(
          "[normalizationService] Invalid players data in localStorage: expected array, got",
          typeof parsed
        );
        return baseSeed;
      }

      // Validate each item has the correct shape
      const validPlayers: PlayerData[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (isValidPlayerData(item)) {
          validPlayers.push(item);
        } else {
          console.error(
            `[normalizationService] Invalid player data at index ${i}:`,
            "expected {canonical: string, sport: Sport, aliases: string[]}, got",
            JSON.stringify(item).slice(0, 100)
          );
        }
      }

      // If all items were invalid, fall back to base seed
      if (validPlayers.length === 0 && parsed.length > 0) {
        console.error(
          "[normalizationService] All player entries in localStorage were invalid, falling back to base seed"
        );
        return baseSeed;
      }

      return validPlayers.length > 0 ? validPlayers : baseSeed;
    }
  } catch (error) {
    console.error(
      "[normalizationService] Failed to load players from localStorage:",
      error
    );
  }

  return baseSeed;
}

/**
 * Builds lookup map for teams from the provided data.
 * Detects and logs collisions when multiple teams share the same key.
 * Policy: Keep the first entry, skip subsequent overrides.
 * Also builds collision map to track all candidates for each key.
 * Phase 4: Skips disabled entities (they won't resolve during import).
 */
function buildTeamLookupMap(teams: TeamData[]): Map<string, TeamData> {
  const map = new Map<string, TeamData>();
  const collisionMap = new Map<string, string[]>();

  const addEntry = (key: string, team: TeamData, keyType: string) => {
    const lowerKey = toLookupKey(key);
    const existing = map.get(lowerKey);
    if (existing && existing.canonical !== team.canonical) {
      // Collision detected - track all candidates
      if (!collisionMap.has(lowerKey)) {
        collisionMap.set(lowerKey, [existing.canonical]);
      }
      const candidates = collisionMap.get(lowerKey)!;
      if (!candidates.includes(team.canonical)) {
        candidates.push(team.canonical);
      }
      console.warn(
        `[normalizationService] Team lookup collision: key "${key}" (${keyType}) ` +
          `maps to both "${existing.canonical}" and "${team.canonical}". ` +
          `Keeping first entry: "${existing.canonical}".`
      );
      return; // Skip override, keep first entry
    }
    map.set(lowerKey, team);
  };

  for (const team of teams) {
    // Phase 4: Skip disabled entities - they shouldn't resolve
    if (team.disabled === true) continue;

    addEntry(team.canonical, team, "canonical");
    for (const alias of team.aliases) {
      addEntry(alias, team, "alias");
    }
    for (const abbr of team.abbreviations) {
      addEntry(abbr, team, "abbreviation");
    }
  }

  // Store collision map in module-level variable
  teamCollisionMap = collisionMap;

  // Phase 5: Populate ID map
  teamIdMap.clear();
  for (const team of teams) {
    if (team.id) {
       teamIdMap.set(team.id, team);
    }
  }

  return map;
}

/**
 * Builds lookup map for stat types from the provided data.
 * Detects and logs collisions when multiple stat types share the same key.
 * Policy: Keep the first entry, skip subsequent overrides.
 * Phase 4: Skips disabled entities (they won't resolve during import).
 */
function buildStatTypeLookupMap(
  statTypes: StatTypeData[]
): Map<string, StatTypeData> {
  const map = new Map<string, StatTypeData>();

  const addEntry = (key: string, stat: StatTypeData, keyType: string) => {
    const lowerKey = toLookupKey(key);
    const existing = map.get(lowerKey);
    if (existing && existing.canonical !== stat.canonical) {
      console.warn(
        `[normalizationService] Stat type lookup collision: key "${key}" (${keyType}) ` +
          `maps to both "${existing.canonical}" (${existing.sport}) and "${stat.canonical}" (${stat.sport}). ` +
          `Keeping first entry: "${existing.canonical}".`
      );
      return; // Skip override, keep first entry
    }
    map.set(lowerKey, stat);
  };

  for (const stat of statTypes) {
    // Phase 4: Skip disabled entities - they shouldn't resolve
    if (stat.disabled === true) continue;

    addEntry(stat.canonical, stat, "canonical");
    for (const alias of stat.aliases) {
      addEntry(alias, stat, "alias");
    }
  }

  return map;
}

/**
 * Builds lookup map for players from the provided data.
 * Uses sport-scoped keys to prevent collisions between players in different sports.
 * Detects and logs collisions when multiple players share the same key within a sport.
 * Policy: Keep the first entry, skip subsequent overrides.
 * Phase 4: Skips disabled entities (they won't resolve during import).
 */
function buildPlayerLookupMap(players: PlayerData[]): Map<string, PlayerData> {
  const map = new Map<string, PlayerData>();
  const collisionMap = new Map<string, string[]>();

  /**
   * Create a sport-scoped key for player lookups.
   * Format: "sport::normalizedname" to prevent cross-sport collisions.
   */
  const makeKey = (name: string, sport: Sport): string => {
    return `${sport}::${toLookupKey(name)}`;
  };

  /**
   * Also index by name-only key for lookups without sport context.
   */
  const makeGenericKey = (name: string): string => {
    return toLookupKey(name);
  };

  const addEntry = (key: string, player: PlayerData, keyType: string) => {
    const existing = map.get(key);
    if (existing && existing.canonical !== player.canonical) {
      // Collision detected - track all candidates
      if (!collisionMap.has(key)) {
        collisionMap.set(key, [existing.canonical]);
      }
      const candidates = collisionMap.get(key)!;
      if (!candidates.includes(player.canonical)) {
        candidates.push(player.canonical);
      }
      console.warn(
        `[normalizationService] Player lookup collision: key "${key}" (${keyType}) ` +
          `maps to both "${existing.canonical}" and "${player.canonical}". ` +
          `Keeping first entry: "${existing.canonical}".`
      );
      return; // Skip override, keep first entry
    }
    map.set(key, player);
  };

  for (const player of players) {
    // Phase 4: Skip disabled entities - they shouldn't resolve
    if (player.disabled === true) continue;

    // Add sport-scoped keys (primary)
    addEntry(makeKey(player.canonical, player.sport), player, "canonical");
    for (const alias of player.aliases) {
      addEntry(makeKey(alias, player.sport), player, "alias");
    }

    // Also add generic (non-sport-scoped) keys for lookups without context
    addEntry(makeGenericKey(player.canonical), player, "canonical-generic");
    for (const alias of player.aliases) {
      addEntry(makeGenericKey(alias), player, "alias-generic");
    }
  }

  // Store collision map in module-level variable
  playerCollisionMap = collisionMap;

  return map;
}

/**
 * Initialize or refresh lookup maps from localStorage.
 * Called automatically on first use, and should be called after UI edits.
 */
export function initializeLookupMaps(): void {
  cachedTeams = loadTeams();
  cachedStatTypes = loadStatTypes();
  cachedPlayers = loadPlayers();

  teamLookupMap = buildTeamLookupMap(cachedTeams);
  statTypeLookupMap = buildStatTypeLookupMap(cachedStatTypes);
  playerLookupMap = buildPlayerLookupMap(cachedPlayers);

  initialized = true;
}

/**
 * Alias for initializeLookupMaps for semantic clarity.
 * Call this after user adds/edits aliases via UI.
 * Phase 3.1: Increments resolver version for UI refresh triggers.
 */
export function refreshLookupMaps(): void {
  initializeLookupMaps();
  resolverVersion++;
}

/**
 * Phase 3.1: Get the current resolver version.
 * Use this as a dependency to trigger UI re-renders when normalization data changes.
 * @returns The current resolver version counter
 */
export function getResolverVersion(): number {
  return resolverVersion;
}

/**
 * Ensures lookup maps are initialized (lazy initialization).
 */
function ensureInitialized(): void {
  if (!initialized) {
    initializeLookupMaps();
  }
}

// ============================================================================
// REFERENCE DATA SNAPSHOT
// ============================================================================

/**
 * Returns a snapshot of current reference data.
 * Use this for consumers that need the full dataset.
 */
export function getReferenceDataSnapshot(): ReferenceDataSnapshot {
  ensureInitialized();
  return {
    teams: [...cachedTeams],
    statTypes: [...cachedStatTypes],
    players: [...cachedPlayers],
    version: REFERENCE_DATA_VERSION,
  };
}

/**
 * Returns the base seed teams (without user overlays).
 * Useful for reset functionality.
 */
export function getBaseSeedTeams(): TeamData[] {
  return TEAMS.map(toTeamData);
}

/**
 * Returns the base seed stat types (without user overlays).
 * Useful for reset functionality.
 */
export function getBaseSeedStatTypes(): StatTypeData[] {
  return [
    ...STAT_TYPES.map(toStatTypeData),
    ...MAIN_MARKET_TYPES.map(t => ({
      canonical: t.canonical,
      sport: "Other" as Sport,
      description: t.description,
      aliases: [...t.aliases]
    })),
    ...FUTURE_TYPES.map(t => ({
      canonical: t.canonical,
      sport: (t.sport || "Other") as Sport,
      description: t.description,
      aliases: [...t.aliases]
    })),
    ...PARLAY_TYPES.map(t => ({
      canonical: t.canonical,
      sport: "Other" as Sport,
      description: t.description,
      aliases: [...t.aliases]
    }))
  ];
}

/**
 * Returns the base seed players (without user overlays).
 * Useful for reset functionality.
 */
export function getBaseSeedPlayers(): PlayerData[] {
  return PLAYERS.map(toPlayerData);
}

// ============================================================================
// PLAYER NORMALIZATION
// ============================================================================

/**
 * Basic player name normalization (conservative approach).
 * Only trims and collapses whitespace - does NOT change casing to avoid
 * breaking names like "McDonald", "O'Brien", etc.
 *
 * @param raw - The raw player name string
 * @returns Normalized string (trimmed, collapsed spaces)
 */
export function normalizePlayerNameBasic(raw: string): string {
  if (!raw) return raw;
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Gets player information for a given player name.
 * Uses sport-scoped lookup when sport context is provided.
 *
 * @param playerName - The player name (can be in any format)
 * @param context - Optional context with sport for scoped lookup
 * @returns The player info object, or undefined if not found
 */
export function getPlayerInfo(
  playerName: string,
  context?: { sport?: Sport; team?: string }
): PlayerData | undefined {
  if (!playerName) return undefined;

  ensureInitialized();

  const lowerSearch = toLookupKey(playerName);

  // Try sport-scoped lookup first (most accurate)
  if (context?.sport) {
    const sportKey = `${context.sport}::${lowerSearch}`;
    const sportMatch = playerLookupMap.get(sportKey);
    if (sportMatch) {
      return sportMatch;
    }
  }

  // Fall back to generic lookup (name only)
  return playerLookupMap.get(lowerSearch);
}

// ============================================================================
// PHASE 5: TEAM ID HELPERS
// ============================================================================

/**
 * Generates a stable ID for a team.
 * Format: "${sport}:${primaryAbbr}"
 *
 * @param sport - Team's sport
 * @param abbreviations - List of abbreviations
 * @param canonical - Canonical name (fallback for abbr)
 * @returns Stable ID string
 */
export function generateTeamId(
  sport: Sport,
  abbreviations: string[],
  canonical: string
): string {
  let primaryAbbr = abbreviations.length > 0 ? abbreviations[0] : null;

  if (!primaryAbbr) {
    // safe fallback derived from canonical
    // Remove non-alphanumeric, uppercase, take first 6 chars
    primaryAbbr = canonical
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6);
  }

  return `${sport}:${primaryAbbr}`;
}

/**
 * Gets a team by its stable ID.
 * O(1) lookup using the internal map.
 *
 * @param id - The team ID (e.g., "NBA:LAL")
 * @returns The TeamData object or undefined
 */
export function getTeamById(id: string): TeamData | undefined {
  ensureInitialized();
  return teamIdMap.get(id);
}

/**
 * Gets collision candidates for an ambiguous player name.
 * Returns all players that match the name if there's a collision.
 *
 * @param playerName - The player name to check
 * @param context - Optional context with sport for scoped lookup
 * @returns Array of collision candidates, or undefined if no collision
 */
export function getPlayerCollision(
  playerName: string,
  context?: { sport?: Sport }
): PlayerData[] | undefined {
  if (!playerName) return undefined;

  ensureInitialized();

  const lowerSearch = toLookupKey(playerName);

  // Check sport-scoped collision first
  if (context?.sport) {
    const sportKey = `${context.sport}::${lowerSearch}`;
    const collisions = playerCollisionMap.get(sportKey);
    if (collisions && collisions.length > 1) {
      // Return full PlayerData for each collision candidate
      return collisions
        .map((canonical) => {
          const key = `${context.sport}::${canonical.toLowerCase()}`;
          return playerLookupMap.get(key);
        })
        .filter((p): p is PlayerData => p !== undefined);
    }
  }

  // Check generic collision
  const collisions = playerCollisionMap.get(lowerSearch);
  if (collisions && collisions.length > 1) {
    return collisions
      .map((canonical) => playerLookupMap.get(canonical.toLowerCase()))
      .filter((p): p is PlayerData => p !== undefined);
  }

  return undefined;
}

/**
 * Checks if a player name is recognized in the system.
 *
 * @param playerName - The player name to check
 * @param context - Optional context with sport for scoped lookup
 * @returns True if the player is recognized
 */
export function isKnownPlayer(
  playerName: string,
  context?: { sport?: Sport }
): boolean {
  return getPlayerInfo(playerName, context) !== undefined;
}

// ============================================================================
// TEAM NORMALIZATION
// ============================================================================

/**
 * Normalizes a team name to its canonical form.
 * Handles various formats like "PHO Suns", "Phoenix Suns", "Suns", "PHX" → "Phoenix Suns"
 *
 * @param teamName - The team name as it appears in the sportsbook data
 * @returns The canonical team name, or the original if no match found
 */
export function normalizeTeamName(teamName: string): string {
  if (!teamName) return teamName;

  ensureInitialized();

  const normalized = teamName.trim();
  const lowerSearch = toLookupKey(teamName);

  // Try exact match using lookup map (O(1) performance)
  const teamInfo = teamLookupMap.get(lowerSearch);
  if (teamInfo) {
    return teamInfo.canonical;
  }

  // If no exact match, try partial matching for compound names
  // e.g., "PHO Suns" should match "Phoenix Suns"
  const uniqueTeams = Array.from(
    new Map(
      Array.from(teamLookupMap.values()).map((t) => [t.canonical, t])
    ).values()
  );

  for (const team of uniqueTeams) {
    // Check if the input contains a team abbreviation + nickname pattern
    for (const abbr of team.abbreviations) {
      const pattern1 = new RegExp(`^${abbr}\\s+`, "i"); // "PHO Suns"
      const pattern2 = new RegExp(`\\s+${abbr}$`, "i"); // "Suns PHO"

      if (pattern1.test(normalized) || pattern2.test(normalized)) {
        // Extract the nickname part
        const parts = normalized.split(/\s+/);
        for (const part of parts) {
          if (part.toLowerCase() !== abbr.toLowerCase()) {
            // Check if this part matches one of the team's aliases
            for (const alias of team.aliases) {
              if (
                alias.toLowerCase().includes(part.toLowerCase()) ||
                part.toLowerCase().includes(alias.toLowerCase())
              ) {
                return team.canonical;
              }
            }
          }
        }
      }
    }
  }

  // Return original if no match found
  return normalized;
}

/**
 * Normalizes a team name to its canonical form with collision metadata.
 * Returns information about ambiguous matches (multiple teams with same alias/abbreviation).
 *
 * @param teamName - The team name as it appears in the sportsbook data
 * @returns NormalizationResult with canonical name and optional collision info
 */
export function normalizeTeamNameWithMeta(
  teamName: string
): NormalizationResult {
  if (!teamName) {
    return { canonical: teamName };
  }

  ensureInitialized();

  const normalized = teamName.trim();
  const lowerSearch = toLookupKey(teamName);

  // Try exact match using lookup map (O(1) performance)
  const teamInfo = teamLookupMap.get(lowerSearch);
  if (teamInfo) {
    const canonical = teamInfo.canonical;
    // Check if there's a collision for this key
    const collisions = teamCollisionMap.get(lowerSearch);
    if (collisions && collisions.length > 1) {
      return {
        canonical,
        collision: {
          input: normalized,
          candidates: collisions,
        },
      };
    }
    return { canonical };
  }

  // If no exact match, try partial matching for compound names
  // e.g., "PHO Suns" should match "Phoenix Suns"
  const uniqueTeams = Array.from(
    new Map(
      Array.from(teamLookupMap.values()).map((t) => [t.canonical, t])
    ).values()
  );

  for (const team of uniqueTeams) {
    // Check if the input contains a team abbreviation + nickname pattern
    for (const abbr of team.abbreviations) {
      const pattern1 = new RegExp(`^${abbr}\\s+`, "i"); // "PHO Suns"
      const pattern2 = new RegExp(`\\s+${abbr}$`, "i"); // "Suns PHO"

      if (pattern1.test(normalized) || pattern2.test(normalized)) {
        // Extract the nickname part
        const parts = normalized.split(/\s+/);
        for (const part of parts) {
          if (part.toLowerCase() !== abbr.toLowerCase()) {
            // Check if this part matches one of the team's aliases
            for (const alias of team.aliases) {
              if (
                alias.toLowerCase().includes(part.toLowerCase()) ||
                part.toLowerCase().includes(alias.toLowerCase())
              ) {
                // Check for collisions on the abbreviation
                const abbrLower = abbr.toLowerCase();
                const collisions = teamCollisionMap.get(abbrLower);
                if (collisions && collisions.length > 1) {
                  return {
                    canonical: team.canonical,
                    collision: {
                      input: normalized,
                      candidates: collisions,
                    },
                  };
                }
                return { canonical: team.canonical };
              }
            }
          }
        }
      }
    }
  }

  // Return original if no match found
  return { canonical: normalized };
}

/**
 * Gets the sport for a given team name.
 *
 * @param teamName - The team name (can be in any format)
 * @returns The sport the team belongs to, or undefined if not found
 */
export function getSportForTeam(teamName: string): Sport | undefined {
  if (!teamName) return undefined;

  ensureInitialized();

  const lowerSearch = toLookupKey(teamName);
  const teamInfo = teamLookupMap.get(lowerSearch);

  if (teamInfo && isValidSport(teamInfo.sport)) {
    return teamInfo.sport;
  }

  // Fallback to full normalization if not found in lookup
  const canonical = normalizeTeamName(teamName);
  const canonicalInfo = teamLookupMap.get(toLookupKey(canonical));

  if (canonicalInfo && isValidSport(canonicalInfo.sport)) {
    return canonicalInfo.sport;
  }

  return undefined;
}

/**
 * Gets team information for a given team name.
 *
 * @param teamName - The team name (can be in any format)
 * @returns The team info object, or undefined if not found
 */
export function getTeamInfo(teamName: string): TeamData | undefined {
  if (!teamName) return undefined;

  ensureInitialized();

  const lowerSearch = toLookupKey(teamName);
  const teamInfo = teamLookupMap.get(lowerSearch);

  if (teamInfo) {
    return teamInfo;
  }

  // Fallback to full normalization if not found in lookup
  const canonical = normalizeTeamName(teamName);
  return teamLookupMap.get(toLookupKey(canonical));
}

// ============================================================================
// STAT TYPE NORMALIZATION
// ============================================================================

/**
 * Normalizes a stat type to its canonical form.
 * Handles various formats like "Reb", "Rebs", "Rebounds" → "Reb"
 *
 * @param statType - The stat type as it appears in the sportsbook data
 * @param sport - Optional sport context to help with ambiguous cases
 * @returns The canonical stat type code, or the original if no match found
 */
export function normalizeStatType(statType: string, sport?: Sport): string {
  if (!statType) return statType;

  ensureInitialized();

  const lowerSearch = toLookupKey(statType);

  // Try exact match using lookup map (O(1) performance)
  const statInfo = statTypeLookupMap.get(lowerSearch);

  // If sport context provided, verify the stat matches the sport
  if (statInfo) {
    if (sport && statInfo.sport !== sport) {
      // Look for a sport-specific match
      const uniqueStats = Array.from(
        new Map(
          Array.from(statTypeLookupMap.values()).map((st) => [
            st.canonical + st.sport,
            st,
          ])
        ).values()
      );

      for (const stat of uniqueStats) {
        if (stat.sport === sport) {
          if (
            stat.canonical.toLowerCase() === lowerSearch ||
            stat.aliases.some((a) => a.toLowerCase() === lowerSearch)
          ) {
            return stat.canonical;
          }
        }
      }
    }
    return statInfo.canonical;
  }

  // Return original if no match found
  return statType.trim();
}

/**
 * Gets stat type information for a given stat type.
 *
 * @param statType - The stat type (can be in any format)
 * @param sport - Optional sport context
 * @returns The stat type info object, or undefined if not found
 */
export function getStatTypeInfo(
  statType: string,
  sport?: Sport
): StatTypeData | undefined {
  if (!statType) return undefined;

  ensureInitialized();

  const lowerSearch = toLookupKey(statType);
  const statInfo = statTypeLookupMap.get(lowerSearch);

  // If sport context provided, verify the stat matches the sport
  if (statInfo) {
    if (sport && statInfo.sport !== sport) {
      // Look for a sport-specific match
      const uniqueStats = Array.from(
        new Map(
          Array.from(statTypeLookupMap.values()).map((st) => [
            st.canonical + st.sport,
            st,
          ])
        ).values()
      );

      for (const stat of uniqueStats) {
        if (
          stat.sport === sport &&
          stat.canonical.toLowerCase() === lowerSearch
        ) {
          return stat;
        }
      }
    }
    return statInfo;
  }

  // Fallback to normalization
  const canonical = normalizeStatType(statType, sport);
  return statTypeLookupMap.get(canonical.toLowerCase());
}

/**
 * Gets the sport(s) associated with a stat type.
 *
 * @param statType - The stat type (can be in any format)
 * @returns Array of sports that use this stat type
 */
export function getSportsForStatType(statType: string): Sport[] {
  if (!statType) return [];

  ensureInitialized();

  const canonical = normalizeStatType(statType);
  const sports: Sport[] = [];

  const uniqueStats = Array.from(
    new Map(
      Array.from(statTypeLookupMap.values()).map((st) => [
        st.canonical + st.sport,
        st,
      ])
    ).values()
  );

  for (const stat of uniqueStats) {
    if (
      stat.canonical === canonical &&
      isValidSport(stat.sport) &&
      !sports.includes(stat.sport)
    ) {
      sports.push(stat.sport);
    }
  }

  return sports;
}

// ============================================================================
// MAIN MARKET TYPE NORMALIZATION
// ============================================================================

/**
 * Normalizes a main market type to its canonical form.
 * Handles various formats like "ML", "Money Line", "moneyline" → "Moneyline"
 *
 * @param marketType - The market type as it appears in the sportsbook data
 * @returns The canonical market type, or the original if no match found
 */
export function normalizeMainMarketType(marketType: string): string {
  if (!marketType) return marketType;

  const normalized = marketType.trim();
  const lowerSearch = normalized.toLowerCase();

  for (const market of MAIN_MARKET_TYPES) {
    if (market.canonical.toLowerCase() === lowerSearch) {
      return market.canonical;
    }

    for (const alias of market.aliases) {
      if (alias.toLowerCase() === lowerSearch) {
        return market.canonical;
      }
    }
  }

  return normalized;
}

// ============================================================================
// FUTURE TYPE NORMALIZATION
// ============================================================================

/**
 * Future type lookup maps are initialized eagerly at module load.
 *
 * Design Decision: Futures are intentionally immutable and do not support
 * localStorage overlays because they represent sport-league defined values
 * (e.g., "NBA Finals", "Super Bowl") that are standardized across all
 * sportsbooks. Unlike team aliases which vary by sportsbook presentation,
 * future bet types have canonical names that don't need user customization.
 */
const futureTypeLookupMap = new Map<string, FutureTypeData>();
const sportSpecificFutureLookupMaps = new Map<
  Sport,
  Map<string, FutureTypeData>
>();

// Initialize future type lookup maps
for (const future of FUTURE_TYPES) {
  // Add to general map
  futureTypeLookupMap.set(future.canonical.toLowerCase(), future);
  for (const alias of future.aliases) {
    futureTypeLookupMap.set(alias.toLowerCase(), future);
  }

  // Add to sport-specific maps using explicit get-after-set pattern
  if (future.sport && isValidSport(future.sport)) {
    let sportMap = sportSpecificFutureLookupMaps.get(future.sport);
    if (!sportMap) {
      sportMap = new Map();
      sportSpecificFutureLookupMaps.set(future.sport, sportMap);
    }
    // sportMap is now guaranteed to exist, no need for non-null assertion
    sportMap.set(future.canonical.toLowerCase(), future);
    for (const alias of future.aliases) {
      sportMap.set(alias.toLowerCase(), future);
    }
  }
}

/**
 * Normalizes a future type to its canonical form.
 * Handles various formats like "To Win NBA Finals", "NBA Championship" → "NBA Finals"
 *
 * @param futureType - The future type as it appears in the sportsbook data
 * @param sport - Optional sport context
 * @returns The canonical future type, or the original if no match found
 */
export function normalizeFutureType(futureType: string, sport?: Sport): string {
  if (!futureType) return futureType;

  const normalized = futureType.trim();
  const lowerSearch = normalized.toLowerCase();

  // If sport provided, check sport-specific map first
  if (sport) {
    const sportMap = sportSpecificFutureLookupMaps.get(sport);
    if (sportMap) {
      const futureInfo = sportMap.get(lowerSearch);
      if (futureInfo) {
        return futureInfo.canonical;
      }
    }
  }

  // Check general future type map
  const futureInfo = futureTypeLookupMap.get(lowerSearch);
  if (futureInfo) {
    // If sport context provided, prefer sport-specific futures
    if (sport && futureInfo.sport && futureInfo.sport !== sport) {
      // Look for a better match in the sport-specific map
      const sportMap = sportSpecificFutureLookupMaps.get(sport);
      if (sportMap) {
        // Check if there's a more specific match
        for (const [key, value] of sportMap.entries()) {
          if (key === lowerSearch) {
            return value.canonical;
          }
        }
      }
    }
    return futureInfo.canonical;
  }

  return normalized;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Attempts to infer the sport from various context clues.
 * Checks team names, stat types, and description keywords.
 *
 * @param context - Object with optional team, statType, and description fields
 * @returns The inferred sport, or undefined if unable to determine
 */
export function inferSportFromContext(context: {
  team?: string;
  statType?: string;
  description?: string;
}): Sport | undefined {
  ensureInitialized();

  // Try team name first (most reliable)
  if (context.team) {
    const sport = getSportForTeam(context.team);
    if (sport) return sport;
  }

  // Try stat type
  if (context.statType) {
    const sports = getSportsForStatType(context.statType);
    if (sports.length === 1) {
      return sports[0];
    }
    // If multiple sports use this stat, can't be certain
  }

  // Try description keywords as last resort
  if (context.description) {
    const lower = context.description.toLowerCase();

    // Sport-specific keywords - using Map for type safety
    const sportKeywords = new Map<Sport, string[]>([
      ["NBA", ["nba", "basketball"]],
      ["NFL", ["nfl", "football"]],
      ["MLB", ["mlb", "baseball"]],
      ["NHL", ["nhl", "hockey"]],
      ["NCAAB", ["ncaab", "college basketball", "march madness"]],
      ["NCAAF", ["ncaaf", "college football"]],
      ["UFC", ["ufc", "mma", "mixed martial arts"]],
      [
        "Soccer",
        ["soccer", "football", "premier league", "champions league", "mls"],
      ],
      [
        "Tennis",
        ["tennis", "wimbledon", "us open", "french open", "australian open"],
      ],
    ]);

    for (const [sport, keywords] of sportKeywords.entries()) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return sport;
      }
    }
  }

  return undefined;
}

/**
 * Checks if a team name is recognized in the system.
 *
 * @param teamName - The team name to check
 * @returns True if the team is recognized
 */
export function isKnownTeam(teamName: string): boolean {
  return getTeamInfo(teamName) !== undefined;
}

/**
 * Checks if a stat type is recognized in the system.
 *
 * @param statType - The stat type to check
 * @returns True if the stat type is recognized
 */
export function isKnownStatType(statType: string): boolean {
  return getStatTypeInfo(statType) !== undefined;
}
