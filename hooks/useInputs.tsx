import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { Sportsbook, SportsbookName, Tail } from "../types";

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
    },
    [sports, setSports]
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
