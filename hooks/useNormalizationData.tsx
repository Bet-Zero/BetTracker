/**
 * Hook for managing normalization data (teams, stat types with aliases)
 * This replaces hardcoded referenceData.ts with user-manageable data in localStorage
 */

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { TEAMS, STAT_TYPES, TeamInfo, StatTypeInfo, Sport } from '../data/referenceData';

export interface TeamData {
  canonical: string;
  sport: string;
  abbreviations: string[];
  aliases: string[];
}

export interface StatTypeData {
  canonical: string;
  sport: string;
  description: string;
  aliases: string[];
}

interface NormalizationDataContextType {
  teams: TeamData[];
  statTypes: StatTypeData[];
  addTeam: (team: TeamData) => boolean;
  updateTeam: (canonical: string, team: TeamData) => boolean;
  removeTeam: (canonical: string) => void;
  addStatType: (statType: StatTypeData) => boolean;
  updateStatType: (canonical: string, statType: StatTypeData) => boolean;
  removeStatType: (canonical: string) => void;
  loading: boolean;
}

const NormalizationDataContext = createContext<NormalizationDataContextType | undefined>(undefined);

// Convert reference data to TeamData format
const defaultTeams: TeamData[] = TEAMS.map(team => ({
  canonical: team.canonical,
  sport: team.sport,
  abbreviations: [...team.abbreviations],
  aliases: [...team.aliases]
}));

// Convert reference data to StatTypeData format
const defaultStatTypes: StatTypeData[] = STAT_TYPES.map(stat => ({
  canonical: stat.canonical,
  sport: stat.sport,
  description: stat.description,
  aliases: [...stat.aliases]
}));

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
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
      if (error instanceof Error) {
        if (error.message.includes('QuotaExceededError') || error.message.includes('quota')) {
          alert(`Storage is full. Failed to save ${key}.`);
        }
      }
    }
  };

  return [storedValue, setValue];
};

export const NormalizationDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [teams, setTeams] = useLocalStorage<TeamData[]>('bettracker-normalization-teams', defaultTeams);
  const [statTypes, setStatTypes] = useLocalStorage<StatTypeData[]>('bettracker-normalization-stattypes', defaultStatTypes);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const addTeam = useCallback((team: TeamData) => {
    if (teams.some(t => t.canonical.toLowerCase() === team.canonical.toLowerCase())) {
      return false;
    }
    setTeams([...teams, team].sort((a, b) => a.canonical.localeCompare(b.canonical)));
    return true;
  }, [teams, setTeams]);

  const updateTeam = useCallback((canonical: string, updatedTeam: TeamData) => {
    const index = teams.findIndex(t => t.canonical === canonical);
    if (index === -1) return false;
    
    const newTeams = [...teams];
    newTeams[index] = updatedTeam;
    setTeams(newTeams.sort((a, b) => a.canonical.localeCompare(b.canonical)));
    return true;
  }, [teams, setTeams]);

  const removeTeam = useCallback((canonical: string) => {
    setTeams(teams.filter(t => t.canonical !== canonical));
  }, [teams, setTeams]);

  const addStatType = useCallback((statType: StatTypeData) => {
    if (statTypes.some(st => st.canonical.toLowerCase() === statType.canonical.toLowerCase() && st.sport === statType.sport)) {
      return false;
    }
    setStatTypes([...statTypes, statType].sort((a, b) => a.canonical.localeCompare(b.canonical)));
    return true;
  }, [statTypes, setStatTypes]);

  const updateStatType = useCallback((canonical: string, updatedStatType: StatTypeData) => {
    const index = statTypes.findIndex(st => st.canonical === canonical && st.sport === updatedStatType.sport);
    if (index === -1) return false;
    
    const newStatTypes = [...statTypes];
    newStatTypes[index] = updatedStatType;
    setStatTypes(newStatTypes.sort((a, b) => a.canonical.localeCompare(b.canonical)));
    return true;
  }, [statTypes, setStatTypes]);

  const removeStatType = useCallback((canonical: string) => {
    setStatTypes(statTypes.filter(st => st.canonical !== canonical));
  }, [statTypes, setStatTypes]);

  const value = {
    teams,
    statTypes,
    addTeam,
    updateTeam,
    removeTeam,
    addStatType,
    updateStatType,
    removeStatType,
    loading
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
    throw new Error('useNormalizationData must be used within a NormalizationDataProvider');
  }
  return context;
};
