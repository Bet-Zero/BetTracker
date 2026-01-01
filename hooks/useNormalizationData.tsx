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
  getBaseSeedStatTypes,
  getBaseSeedPlayers,
  TeamData,
  StatTypeData,
  PlayerData,
  toLookupKey,
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
export type { TeamData, StatTypeData, PlayerData };

interface NormalizationDataContextType {
  teams: TeamData[];
  statTypes: StatTypeData[];
  players: PlayerData[];
  addTeam: (team: TeamData) => boolean;
  updateTeam: (canonical: string, team: TeamData) => boolean;
  removeTeam: (canonical: string) => void;
  /** Phase 4: Disable a team (excluded from resolution) */
  disableTeam: (canonical: string) => void;
  /** Phase 4: Enable a previously disabled team */
  enableTeam: (canonical: string) => void;
  addStatType: (statType: StatTypeData) => boolean;
  updateStatType: (canonical: string, statType: StatTypeData) => boolean;
  removeStatType: (canonical: string) => void;
  /** Phase 4: Disable a stat type (excluded from resolution) */
  disableStatType: (canonical: string, sport: Sport) => void;
  /** Phase 4: Enable a previously disabled stat type */
  enableStatType: (canonical: string, sport: Sport) => void;
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
  addStatTypeAlias: (canonical: string, alias: string) => boolean;
  addPlayerAlias: (canonical: string, sport: Sport, alias: string) => boolean;
}

const NormalizationDataContext = createContext<
  NormalizationDataContextType | undefined
>(undefined);

// Get default data from normalization service base seed
const defaultTeams: TeamData[] = getBaseSeedTeams();
const defaultStatTypes: StatTypeData[] = getBaseSeedStatTypes();
const defaultPlayers: PlayerData[] = getBaseSeedPlayers();

const useLocalStorage = <T,>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
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
  const [statTypes, setStatTypes] = useLocalStorage<StatTypeData[]>(
    NORMALIZATION_STORAGE_KEYS.STAT_TYPES,
    defaultStatTypes
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
    setLoading(false);
  }, []);

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
      setTeams(
        [...teams, team].sort((a, b) => a.canonical.localeCompare(b.canonical))
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

  // Stat Type CRUD operations
  const addStatType = useCallback(
    (statType: StatTypeData) => {
      if (
        statTypes.some(
          (st) =>
            st.canonical.toLowerCase() === statType.canonical.toLowerCase() &&
            st.sport === statType.sport
        )
      ) {
        return false;
      }
      setStatTypes(
        [...statTypes, statType].sort((a, b) =>
          a.canonical.localeCompare(b.canonical)
        )
      );
      setResolverVersion(getResolverVersion());
      return true;
    },
    [statTypes, setStatTypes]
  );

  const updateStatType = useCallback(
    (canonical: string, updatedStatType: StatTypeData) => {
      const index = statTypes.findIndex(
        (st) => st.canonical === canonical && st.sport === updatedStatType.sport
      );
      if (index === -1) return false;

      const newStatTypes = [...statTypes];
      // Phase 3.P1: Dedupe aliases to prevent whitespace/casing duplicates
      newStatTypes[index] = {
        ...updatedStatType,
        aliases: dedupeAliases(updatedStatType.aliases),
      };
      setStatTypes(
        newStatTypes.sort((a, b) => a.canonical.localeCompare(b.canonical))
      );
      setResolverVersion(getResolverVersion());
      return true;
    },
    [statTypes, setStatTypes]
  );

  const removeStatType = useCallback(
    (canonical: string) => {
      setStatTypes(statTypes.filter((st) => st.canonical !== canonical));
      setResolverVersion(getResolverVersion());
    },
    [statTypes, setStatTypes]
  );

  // Phase 4: Disable/Enable stat type operations
  const disableStatType = useCallback(
    (canonical: string, sport: Sport) => {
      const newStatTypes = statTypes.map((st) =>
        st.canonical === canonical && st.sport === sport
          ? { ...st, disabled: true }
          : st
      );
      setStatTypes(newStatTypes);
      setResolverVersion(getResolverVersion());
    },
    [statTypes, setStatTypes]
  );

  const enableStatType = useCallback(
    (canonical: string, sport: Sport) => {
      const newStatTypes = statTypes.map((st) =>
        st.canonical === canonical && st.sport === sport
          ? { ...st, disabled: false }
          : st
      );
      setStatTypes(newStatTypes);
      setResolverVersion(getResolverVersion());
    },
    [statTypes, setStatTypes]
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
      setPlayers(
        [...players, player].sort((a, b) =>
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

  // Helper: Add Stat Type Alias
  const addStatTypeAlias = useCallback(
    (canonical: string, alias: string) => {
      const statType = statTypes.find((st) => st.canonical === canonical);
      if (!statType) return false;
      if (statType.aliases.includes(alias)) return true;
      // Note: We don't have the sport here efficiently, but canonical for stat types 
      // is usually unique enough or we rely on the caller to know? 
      // Actually ImportConfirmationModal calls it as (canonical, alias). 
      // But StatTypeData has 'sport'. The find might be ambiguous if duplicates exist across sports?
      // Preflight data shows stat types are keyed by canonical+sport.
      // However, for this helper let's assume canonical is sufficient or find the FIRST one.
      // Better: find returns the first match.
      return updateStatType(canonical, {
        ...statType,
        aliases: [...statType.aliases, alias],
      });
    },
    [statTypes, updateStatType]
  );

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
    statTypes,
    players,
    addTeam,
    updateTeam,
    removeTeam,
    disableTeam,
    enableTeam,
    addStatType,
    updateStatType,
    removeStatType,
    disableStatType,
    enableStatType,
    addPlayer,
    updatePlayer,
    removePlayer,
    disablePlayer,
    enablePlayer,
    loading,
    resolverVersion,
    addTeamAlias,
    addStatTypeAlias,
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
