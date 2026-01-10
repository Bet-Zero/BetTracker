import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { Sportsbook, SportsbookName, Tail } from "../types";

export interface ItemsBySport {
  [sport: string]: string[];
}

interface InputsContextType {
  sportsbooks: Sportsbook[];
  addSportsbook: (book: Sportsbook) => boolean;
  removeSportsbook: (name: SportsbookName) => void;
  tails: Tail[];
  addTail: (tail: Tail) => boolean;
  updateTail: (name: string, tail: Tail) => boolean;
  removeTail: (name: string) => void;
  sports: string[];
  addSport: (sport: string) => boolean;
  removeSport: (sport: string) => void;
  categories: string[];
  addCategory: (category: string) => boolean;
  removeCategory: (category: string) => void;
  betTypes: ItemsBySport;
  addBetType: (sport: string, type: string) => boolean;
  removeBetType: (sport: string, type: string) => void;
  players: ItemsBySport;
  addPlayer: (sport: string, player: string) => void;
  removePlayer: (sport: string, player: string) => void;
  teams: ItemsBySport;
  addTeam: (sport: string, team: string) => void;
  removeTeam: (sport: string, team: string) => void;
  loading: boolean;
}

const InputsContext = createContext<InputsContextType | undefined>(undefined);

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
      // Show error notification for load failures
      if (error instanceof Error && (error.message.includes('QuotaExceededError') || error.message.includes('SecurityError'))) {
        alert(`Failed to load ${key} from storage. Your data may not be saved. Please check browser settings.`);
      }
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);
      // Show error notification for save failures
      if (error instanceof Error) {
        if (error.message.includes('QuotaExceededError') || error.message.includes('quota')) {
          alert(`Storage is full. Failed to save ${key}. Please clear browser storage or export your data.`);
        } else if (error.message.includes('SecurityError') || error.message.includes('disabled')) {
          alert(`Browser storage is disabled. Failed to save ${key}. Please enable localStorage in browser settings.`);
        } else {
          alert(`Failed to save ${key}. Check console for details.`);
        }
      }
    }
  };

  return [storedValue, setValue];
};

const defaultSportsbooks: Sportsbook[] = [
  { name: "FanDuel", abbreviation: "FD", url: "https://www.fanduel.com/" },
  {
    name: "DraftKings",
    abbreviation: "DK",
    url: "https://www.draftkings.com/",
  },
];
const defaultSports: string[] = [
  "NBA",
  "NFL",
  "MLB",
  "NHL",
  "Soccer",
  "Tennis",
];
const defaultCategories: string[] = [
  "Props",
  "Main Markets",
  "Futures",
  "Parlays",
];
const defaultBetTypes: ItemsBySport = {
  NBA: [
    "Player Points",
    "Player Rebounds",
    "Player Assists",
    "Player Threes",
    "First Basket (FB)",
    "Top Scorer (Top Pts)",
    "Double Double (DD)",
    "Triple Double (TD)",
  ],
  NFL: [
    "Passing Yards",
    "Rushing Yards",
    "Receiving Yards",
    "Anytime Touchdown Scorer",
  ],
  MLB: ["Home Runs", "Strikeouts", "Hits"],
  NHL: ["Goals", "Assists", "Shots on Goal"],
  Soccer: ["Goals", "Shots", "Assists"],
};

export const InputsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [sportsbooks, setSportsbooks] = useLocalStorage<Sportsbook[]>(
    "bettracker-sportsbooks",
    defaultSportsbooks
  );
  const [tails, setTails] = useLocalStorage<Tail[]>(
    "bettracker-tails",
    []
  );
  const [sports, setSports] = useLocalStorage<string[]>(
    "bettracker-sports",
    defaultSports
  );
  const [categories, setCategories] = useLocalStorage<string[]>(
    "bettracker-categories",
    defaultCategories
  );
  const [betTypes, setBetTypes] = useLocalStorage<ItemsBySport>(
    "bettracker-bettypes",
    defaultBetTypes
  );
  const [players, setPlayers] = useLocalStorage<ItemsBySport>(
    "bettracker-players",
    {}
  );
  const [teams, setTeams] = useLocalStorage<ItemsBySport>(
    "bettracker-teams",
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  const addSportsbook = useCallback(
    (book: Sportsbook) => {
      if (
        sportsbooks.some(
          (b) => b.name.toLowerCase() === book.name.toLowerCase()
        )
      ) {
        return false;
      }
      setSportsbooks(
        [...sportsbooks, book].sort((a, b) => a.name.localeCompare(b.name))
      );
      return true;
    },
    [sportsbooks, setSportsbooks]
  );

  const removeSportsbook = useCallback(
    (name: SportsbookName) => {
      setSportsbooks(sportsbooks.filter((b) => b.name !== name));
    },
    [sportsbooks, setSportsbooks]
  );

  const addTail = useCallback(
    (tail: Tail) => {
      if (tails.some((t) => t.name.toLowerCase() === tail.name.toLowerCase())) {
        return false;
      }
      setTails(
        [...tails, tail].sort((a, b) => a.name.localeCompare(b.name))
      );
      return true;
    },
    [tails, setTails]
  );

  const updateTail = useCallback(
    (name: string, updatedTail: Tail) => {
      const index = tails.findIndex((t) => t.name === name);
      if (index === -1) return false;
      const newTails = [...tails];
      newTails[index] = updatedTail;
      setTails(newTails.sort((a, b) => a.name.localeCompare(b.name)));
      return true;
    },
    [tails, setTails]
  );

  const removeTail = useCallback(
    (name: string) => {
      setTails(tails.filter((t) => t.name !== name));
    },
    [tails, setTails]
  );

  const addSport = useCallback(
    (sport: string) => {
      if (sports.some((s) => s.toLowerCase() === sport.toLowerCase())) {
        return false;
      }
      setSports([...sports, sport].sort());
      return true;
    },
    [sports, setSports]
  );

  const removeSport = useCallback(
    (sportToRemove: string) => {
      setSports(sports.filter((s) => s !== sportToRemove));
      // Also remove associated bet types, players, and teams
      const newBetTypes = { ...betTypes };
      delete newBetTypes[sportToRemove];
      setBetTypes(newBetTypes);
      const newPlayers = { ...players };
      delete newPlayers[sportToRemove];
      setPlayers(newPlayers);
      const newTeams = { ...teams };
      delete newTeams[sportToRemove];
      setTeams(newTeams);
    },
    [
      sports,
      setSports,
      betTypes,
      setBetTypes,
      players,
      setPlayers,
      teams,
      setTeams,
    ]
  );

  const addCategory = useCallback(
    (category: string) => {
      if (categories.some((c) => c.toLowerCase() === category.toLowerCase())) {
        return false;
      }
      setCategories([...categories, category].sort());
      return true;
    },
    [categories, setCategories]
  );

  const removeCategory = useCallback(
    (categoryToRemove: string) => {
      setCategories(categories.filter((c) => c !== categoryToRemove));
    },
    [categories, setCategories]
  );

  const addBetType = useCallback(
    (sport: string, type: string) => {
      const sportTypes = betTypes[sport] || [];
      if (sportTypes.some((t) => t.toLowerCase() === type.toLowerCase())) {
        return false;
      }
      const newBetTypes = {
        ...betTypes,
        [sport]: [...sportTypes, type].sort(),
      };
      setBetTypes(newBetTypes);
      return true;
    },
    [betTypes, setBetTypes]
  );

  const removeBetType = useCallback(
    (sport: string, typeToRemove: string) => {
      const sportTypes = betTypes[sport] || [];
      const newSportTypes = sportTypes.filter((t) => t !== typeToRemove);
      const newBetTypes = {
        ...betTypes,
        [sport]: newSportTypes,
      };
      if (newSportTypes.length === 0) {
        delete newBetTypes[sport];
      }
      setBetTypes(newBetTypes);
    },
    [betTypes, setBetTypes]
  );

  const addBySport = useCallback(
    (
      sport: string,
      item: string,
      setter: (
        value: ItemsBySport | ((val: ItemsBySport) => ItemsBySport)
      ) => void
    ) => {
      if (!sport || !item) return;
      setter((prevList) => {
        const sportList = prevList[sport] || [];
        if (!sportList.some((i) => i.toLowerCase() === item.toLowerCase())) {
          const newList = { ...prevList, [sport]: [...sportList, item].sort() };
          return newList;
        }
        return prevList;
      });
    },
    []
  );

  const removeBySport = useCallback(
    (
      sport: string,
      itemToRemove: string,
      setter: (
        value: ItemsBySport | ((val: ItemsBySport) => ItemsBySport)
      ) => void
    ) => {
      setter((prevList) => {
        const sportList = prevList[sport] || [];
        const newSportList = sportList.filter((item) => item !== itemToRemove);
        const newList = { ...prevList, [sport]: newSportList };
        if (newSportList.length === 0) {
          delete newList[sport];
        }
        return newList;
      });
    },
    []
  );

  const addPlayer = useCallback(
    (sport: string, player: string) => addBySport(sport, player, setPlayers),
    [addBySport, setPlayers]
  );
  const removePlayer = useCallback(
    (sport: string, player: string) => removeBySport(sport, player, setPlayers),
    [removeBySport, setPlayers]
  );
  const addTeam = useCallback(
    (sport: string, team: string) => addBySport(sport, team, setTeams),
    [addBySport, setTeams]
  );
  const removeTeam = useCallback(
    (sport: string, team: string) => removeBySport(sport, team, setTeams),
    [removeBySport, setTeams]
  );

  const value = {
    sportsbooks,
    addSportsbook,
    removeSportsbook,
    tails,
    addTail,
    updateTail,
    removeTail,
    sports,
    addSport,
    removeSport,
    categories,
    addCategory,
    removeCategory,
    betTypes,
    addBetType,
    removeBetType,
    players,
    addPlayer,
    removePlayer,
    teams,
    addTeam,
    removeTeam,
    loading,
  };

  return (
    <InputsContext.Provider value={value}>
      {!loading && children}
    </InputsContext.Provider>
  );
};

export const useInputs = (): InputsContextType => {
  const context = useContext(InputsContext);
  if (context === undefined) {
    throw new Error("useInputs must be used within an InputsProvider");
  }
  return context;
};
