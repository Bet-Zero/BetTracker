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
  addStatType: (statType: StatTypeData) => boolean;
  updateStatType: (canonical: string, statType: StatTypeData) => boolean;
  removeStatType: (canonical: string) => void;
  addPlayer: (player: PlayerData) => boolean;
  updatePlayer: (
    canonical: string,
    sport: Sport,
    player: PlayerData
  ) => boolean;
  removePlayer: (canonical: string, sport: Sport) => void;
  loading: boolean;
  /** Phase 3.1: Resolver version counter for UI refresh triggers */
  resolverVersion: number;
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

  const value = {
    teams,
    statTypes,
    players,
    addTeam,
    updateTeam,
    removeTeam,
    addStatType,
    updateStatType,
    removeStatType,
    addPlayer,
    updatePlayer,
    removePlayer,
    loading,
    resolverVersion,
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
