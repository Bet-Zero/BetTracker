/**
 * Hook for managing normalization data (teams, stat types, players with aliases)
 *
 * This hook manages user-editable reference data stored in localStorage.
 * After any CRUD operation, it refreshes the unified normalization service
 * to ensure classification immediately reflects UI changes.
 *
 * Phase 3.1: Added resolverVersion to trigger UI re-renders when data changes.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { Sport } from "../data/referenceData";
import {
  refreshLookupMaps,
  getResolverVersion,
  NORMALIZATION_STORAGE_KEYS,
  getBaseSeedTeams,
  getBaseSeedBetTypes,
  getBaseSeedPlayers,
  TeamData,
  BetTypeData,
  PlayerData,
  toLookupKey,
  generateTeamId,
  getPlayerInfo,
  getTeamById,
} from "../services/normalizationService";

/**
 * Phase 3.P1: Deduplicate aliases using toLookupKey().
 * Keeps the first alias for each unique lookup key (preserves original order).
 */
function dedupeAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const alias of aliases) {
    const key = toLookupKey(alias);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(alias);
    }
  }
  return result;
}

// Re-export types from unified service for consumers
export type { TeamData, BetTypeData, PlayerData };
export { getTeamById };

interface NormalizationDataContextType {
  teams: TeamData[];
  betTypes: BetTypeData[];
  players: PlayerData[];
  addTeam: (team: TeamData) => boolean;
  updateTeam: (canonical: string, team: TeamData) => boolean;
  removeTeam: (canonical: string) => void;
  /** Phase 4: Disable a team (excluded from resolution) */
  disableTeam: (canonical: string) => void;
  /** Phase 4: Enable a previously disabled team */
  enableTeam: (canonical: string) => void;
  addBetType: (betType: BetTypeData) => boolean;
  updateBetType: (canonical: string, betType: BetTypeData) => boolean;
  removeBetType: (canonical: string) => void;
  /** Phase 4: Disable a bet type (excluded from resolution) */
  disableBetType: (canonical: string, sport: Sport) => void;
  /** Phase 4: Enable a previously disabled bet type */
  enableBetType: (canonical: string, sport: Sport) => void;
  addPlayer: (player: PlayerData) => boolean;
  updatePlayer: (
    canonical: string,
    sport: Sport,
    player: PlayerData
  ) => boolean;
  removePlayer: (canonical: string, sport: Sport) => void;
  /** Phase 4: Disable a player (excluded from resolution) */
  disablePlayer: (canonical: string, sport: Sport) => void;
  /** Phase 4: Enable a previously disabled player */
  enablePlayer: (canonical: string, sport: Sport) => void;
  loading: boolean;
  /** Phase 3.1: Resolver version counter for UI refresh triggers */
  resolverVersion: number;
  addTeamAlias: (canonical: string, alias: string) => boolean;
  addBetTypeAlias: (canonical: string, alias: string) => boolean;
  addPlayerAlias: (canonical: string, sport: Sport, alias: string) => boolean;
}

const NormalizationDataContext = createContext<
  NormalizationDataContextType | undefined
>(undefined);

// Get default data from normalization service base seed
const defaultTeams: TeamData[] = getBaseSeedTeams();
const defaultBetTypes: BetTypeData[] = getBaseSeedBetTypes();
const defaultPlayers: PlayerData[] = getBaseSeedPlayers();

const useLocalStorage = <T,>(
  key: string,
  initialValue: T,
  migrateFromOldKey?: string
): [T, (value: T | ((val: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      let item = window.localStorage.getItem(key);
      
      // Migration: If new key doesn't exist, check for old key and migrate
      if (!item && migrateFromOldKey) {
        const oldItem = window.localStorage.getItem(migrateFromOldKey);
        if (oldItem) {
          // Migrate old data to new key
          window.localStorage.setItem(key, oldItem);
          window.localStorage.removeItem(migrateFromOldKey);
          item = oldItem;
          console.log(`[useNormalizationData] Migrated data from ${migrateFromOldKey} to ${key}`);
        }
      }
      
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Failed to load ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
      // Refresh normalization service after any localStorage update
      refreshLookupMaps();
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
      if (error instanceof Error) {
        if (
          error.message.includes("QuotaExceededError") ||
          error.message.includes("quota")
        ) {
          alert(`Storage is full. Failed to save ${key}.`);
        }
      }
    }
  };

  return [storedValue, setValue];
};

export const NormalizationDataProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [teams, setTeams] = useLocalStorage<TeamData[]>(
    NORMALIZATION_STORAGE_KEYS.TEAMS,
    defaultTeams
  );
  const [betTypes, setBetTypes] = useLocalStorage<BetTypeData[]>(
    NORMALIZATION_STORAGE_KEYS.BET_TYPES,
    defaultBetTypes,
    "bettracker-normalization-stattypes" // Migrate from old key
  );
  const [players, setPlayers] = useLocalStorage<PlayerData[]>(
    NORMALIZATION_STORAGE_KEYS.PLAYERS,
    defaultPlayers
  );
  const [loading, setLoading] = useState(true);
  // Phase 3.1: Track resolver version for UI refresh triggers
  const [resolverVersion, setResolverVersion] = useState(() =>
    getResolverVersion()
  );

  useEffect(() => {
    // Initialize normalization service with current localStorage data
    refreshLookupMaps();
    setResolverVersion(getResolverVersion());

    // Phase 5: One-time migration for Team IDs and Player Links
    let teamsChanged = false;
    let playersChanged = false;

    // 1. Migrate Teams: Ensure all teams have an ID
    const migratedTeams = teams.map((t) => {
      if (!t.id) {
        teamsChanged = true;
        return {
          ...t,
          id: generateTeamId(t.sport, t.abbreviations, t.canonical),
        };
      }
      return t;
    });

    if (teamsChanged) {
      console.log("[NormalizationData] Migrating teams to include stable IDs...");
      setTeams(migratedTeams);
      // NOTE: setTeams triggers refreshLookupMaps, so we don't need to double call it
      // BUT we need the updated maps for player resolution below immediately?
      // State updates are async, but 'migratedTeams' is available locally.
      // However, link resolution relies on 'services/normalizationService' lookups.
      // We should manually refresh the service with the new structure temporary?
      // Actually, 'refreshLookupMaps' reloads from 'cachedTeams' which are loaded from LS.
      // We just called setTeams (which saves to LS).
      // So calling refreshLookupMaps() manually here is safe if we want immediate lookup availability.
      // BUT setTeams implementation calls refreshLookupMaps().. but maybe not synchronously with this execution flow if it relies on react state?
      // Wait, 'useLocalStorage' setters write to LS immediately.
      // And they call 'refreshLookupMaps()'. So the service IS updated.
    }

    // 2. Migrate Players: Link 'team' string to 'teamId' AND ensure consistent ID
    // We use 'migratedTeams' to ensure we have IDs available
    const migratedPlayers = players.map((p) => {
      let changed = false;
      const updates: Partial<PlayerData> = {};

      // Ensure ID exists
      if (!p.id) {
        updates.id = crypto.randomUUID();
        changed = true;
      }

      // Link team string to teamId if missing
      if (p.team && !p.teamId) {
        // Try to resolve team string to an ID
        const normalizedSearch = p.team.trim().toLowerCase(); // Basic normalization
        
        const matchedTeam = migratedTeams.find((t) => {
             if (t.sport !== p.sport) return false;
             if (t.disabled) return false;
             if (t.canonical.toLowerCase() === normalizedSearch) return true;
             if (t.aliases.some(a => a.toLowerCase() === normalizedSearch)) return true;
             if (t.abbreviations.some(a => a.toLowerCase() === normalizedSearch)) return true;
             return false;
        });

        if (matchedTeam) {
          updates.teamId = matchedTeam.id;
          changed = true;
        }
      }
      
      if (changed) {
        playersChanged = true;
        return { ...p, ...updates };
      }
      return p;
    });

    if (playersChanged) {
       console.log("[NormalizationData] Migrating players (IDs / Links)...");
       setPlayers(migratedPlayers);
    }

    setLoading(false);
  }, []); // Run links migration on mount


  // Team CRUD operations
  const addTeam = useCallback(
    (team: TeamData) => {
      if (
        teams.some(
          (t) => t.canonical.toLowerCase() === team.canonical.toLowerCase()
        )
      ) {
        return false;
      }
      const teamWithId = team.id 
         ? team 
         : { ...team, id: generateTeamId(team.sport, team.abbreviations, team.canonical) };

      setTeams(
        [...teams, teamWithId].sort((a, b) => a.canonical.localeCompare(b.canonical))
      );
      setResolverVersion(getResolverVersion());
      return true;
    },
    [teams, setTeams]
  );

  const updateTeam = useCallback(
    (canonical: string, updatedTeam: TeamData) => {
      const index = teams.findIndex((t) => t.canonical === canonical);
      if (index === -1) return false;

      const newTeams = [...teams];
      // Phase 3.P1: Dedupe aliases to prevent whitespace/casing duplicates
      newTeams[index] = {
        ...updatedTeam,
        aliases: dedupeAliases(updatedTeam.aliases),
      };
      setTeams(newTeams.sort((a, b) => a.canonical.localeCompare(b.canonical)));
      setResolverVersion(getResolverVersion());
      return true;
    },
    [teams, setTeams]
  );

  const removeTeam = useCallback(
    (canonical: string) => {
      setTeams(teams.filter((t) => t.canonical !== canonical));
      setResolverVersion(getResolverVersion());
    },
    [teams, setTeams]
  );

  // Phase 4: Disable/Enable team operations
  const disableTeam = useCallback(
    (canonical: string) => {
      const newTeams = teams.map((t) =>
        t.canonical === canonical ? { ...t, disabled: true } : t
      );
      setTeams(newTeams);
      setResolverVersion(getResolverVersion());
    },
    [teams, setTeams]
  );

  const enableTeam = useCallback(
    (canonical: string) => {
      const newTeams = teams.map((t) =>
        t.canonical === canonical ? { ...t, disabled: false } : t
      );
      setTeams(newTeams);
      setResolverVersion(getResolverVersion());
    },
    [teams, setTeams]
  );

  // Bet Type CRUD operations
  const addBetType = useCallback(
    (betType: BetTypeData) => {
      if (
        betTypes.some(
          (st) =>
            st.canonical.toLowerCase() === betType.canonical.toLowerCase() &&
            st.sport === betType.sport
        )
      ) {
        return false;
      }
      setBetTypes(
        [...betTypes, betType].sort((a, b) =>
          a.canonical.localeCompare(b.canonical)
        )
      );
      setResolverVersion(getResolverVersion());
      return true;
    },
    [betTypes, setBetTypes]
  );

  const updateBetType = useCallback(
    (canonical: string, updatedBetType: BetTypeData) => {
      const index = betTypes.findIndex(
        (st) => st.canonical === canonical && st.sport === updatedBetType.sport
      );
      if (index === -1) return false;

      const newBetTypes = [...betTypes];
      // Phase 3.P1: Dedupe aliases to prevent whitespace/casing duplicates
      newBetTypes[index] = {
        ...updatedBetType,
        aliases: dedupeAliases(updatedBetType.aliases),
      };
      setBetTypes(
        newBetTypes.sort((a, b) => a.canonical.localeCompare(b.canonical))
      );
      setResolverVersion(getResolverVersion());
      return true;
    },
    [betTypes, setBetTypes]
  );

  const removeBetType = useCallback(
    (canonical: string) => {
      setBetTypes(betTypes.filter((st) => st.canonical !== canonical));
      setResolverVersion(getResolverVersion());
    },
    [betTypes, setBetTypes]
  );

  // Phase 4: Disable/Enable bet type operations
  const disableBetType = useCallback(
    (canonical: string, sport: Sport) => {
      const newBetTypes = betTypes.map((st) =>
        st.canonical === canonical && st.sport === sport
          ? { ...st, disabled: true }
          : st
      );
      setBetTypes(newBetTypes);
      setResolverVersion(getResolverVersion());
    },
    [betTypes, setBetTypes]
  );

  const enableBetType = useCallback(
    (canonical: string, sport: Sport) => {
      const newBetTypes = betTypes.map((st) =>
        st.canonical === canonical && st.sport === sport
          ? { ...st, disabled: false }
          : st
      );
      setBetTypes(newBetTypes);
      setResolverVersion(getResolverVersion());
    },
    [betTypes, setBetTypes]
  );

  // Player CRUD operations
  const addPlayer = useCallback(
    (player: PlayerData) => {
      // Players are unique by canonical + sport combination
      if (
        players.some(
          (p) =>
            p.canonical.toLowerCase() === player.canonical.toLowerCase() &&
            p.sport === player.sport
        )
      ) {
        return false;
      }
      
      const playerWithId = player.id ? player : { ...player, id: crypto.randomUUID() };

      setPlayers(
        [...players, playerWithId].sort((a, b) =>
          a.canonical.localeCompare(b.canonical)
        )
      );
      setResolverVersion(getResolverVersion());
      return true;
    },
    [players, setPlayers]
  );

  const updatePlayer = useCallback(
    (canonical: string, sport: Sport, updatedPlayer: PlayerData) => {
      const index = players.findIndex(
        (p) => p.canonical === canonical && p.sport === sport
      );
      if (index === -1) return false;

      const newPlayers = [...players];
      // Phase 3.P1: Dedupe aliases to prevent whitespace/casing duplicates
      newPlayers[index] = {
        ...updatedPlayer,
        aliases: dedupeAliases(updatedPlayer.aliases),
      };
      setPlayers(
        newPlayers.sort((a, b) => a.canonical.localeCompare(b.canonical))
      );
      setResolverVersion(getResolverVersion());
      return true;
    },
    [players, setPlayers]
  );

  const removePlayer = useCallback(
    (canonical: string, sport: Sport) => {
      setPlayers(
        players.filter((p) => !(p.canonical === canonical && p.sport === sport))
      );
      setResolverVersion(getResolverVersion());
    },
    [players, setPlayers]
  );

  // Phase 4: Disable/Enable player operations
  const disablePlayer = useCallback(
    (canonical: string, sport: Sport) => {
      const newPlayers = players.map((p) =>
        p.canonical === canonical && p.sport === sport
          ? { ...p, disabled: true }
          : p
      );
      setPlayers(newPlayers);
      setResolverVersion(getResolverVersion());
    },
    [players, setPlayers]
  );

  const enablePlayer = useCallback(
    (canonical: string, sport: Sport) => {
      const newPlayers = players.map((p) =>
        p.canonical === canonical && p.sport === sport
          ? { ...p, disabled: false }
          : p
      );
      setPlayers(newPlayers);
      setResolverVersion(getResolverVersion());
    },
    [players, setPlayers]
  );

  // Helper: Add Team Alias
  const addTeamAlias = useCallback(
    (canonical: string, alias: string) => {
      const team = teams.find((t) => t.canonical === canonical);
      if (!team) return false;
      if (team.aliases.includes(alias)) return true;
      return updateTeam(canonical, {
        ...team,
        aliases: [...team.aliases, alias],
      });
    },
    [teams, updateTeam]
  );

  // Helper: Add Bet Type Alias
  const addBetTypeAlias = useCallback(
    (canonical: string, alias: string) => {
      const betType = betTypes.find((st) => st.canonical === canonical);
      if (!betType) return false;
      if (betType.aliases.includes(alias)) return true;
      // Note: We don't have the sport here efficiently, but canonical for bet types 
      // is usually unique enough or we rely on the caller to know? 
      // Actually ImportConfirmationModal calls it as (canonical, alias). 
      // But BetTypeData has 'sport'. The find might be ambiguous if duplicates exist across sports?
      // Preflight data shows bet types are keyed by canonical+sport.
      // However, for this helper let's assume canonical is sufficient or find the FIRST one.
      // Better: find returns the first match.
      return updateBetType(canonical, {
        ...betType,
        aliases: [...betType.aliases, alias],
      });
    },
    [betTypes, updateBetType]
  );
  
  // Legacy alias for backward compatibility
  const addStatTypeAlias = addBetTypeAlias;

  // Helper: Add Player Alias
  const addPlayerAlias = useCallback(
    (canonical: string, sport: Sport, alias: string) => {
      const player = players.find(
        (p) => p.canonical === canonical && p.sport === sport
      );
      if (!player) return false;
      if (player.aliases.includes(alias)) return true;
      return updatePlayer(canonical, sport, {
        ...player,
        aliases: [...player.aliases, alias],
      });
    },
    [players, updatePlayer]
  );

  const value = {
    teams,
    betTypes,
    players,
    addTeam,
    updateTeam,
    removeTeam,
    disableTeam,
    enableTeam,
    addBetType,
    updateBetType,
    removeBetType,
    disableBetType,
    enableBetType,
    addPlayer,
    updatePlayer,
    removePlayer,
    disablePlayer,
    enablePlayer,
    loading,
    resolverVersion,
    addTeamAlias,
    addBetTypeAlias,
    addPlayerAlias,
  };

  return (
    <NormalizationDataContext.Provider value={value}>
      {!loading && children}
    </NormalizationDataContext.Provider>
  );
};

export const useNormalizationData = (): NormalizationDataContextType => {
  const context = useContext(NormalizationDataContext);
  if (context === undefined) {
    throw new Error(
      "useNormalizationData must be used within a NormalizationDataProvider"
    );
  }
  return context;
};
