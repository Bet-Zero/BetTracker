import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { useBets } from "../hooks/useBets";
import { useInputs } from "../hooks/useInputs";
import {
  Bet,
  SportsbookName,
  BetResult,
  MarketCategory,
  BetLeg,
  BetType,
} from "../types";
import { Wifi } from "../components/icons";
import { calculateProfit } from "../utils/betCalculations";
import { betToFinalRows } from "../parsing/shared/betToFinalRows";

// --- Column sizing (deterministic fixed-width layout) ---
// Fixed character-based widths for deterministic, no-wrap spreadsheet behavior.
// Using 'ch' units based on max character budgets for each column.
const COLUMN_WIDTHS: Record<string, string> = {
  date: "5ch",
  site: "4ch",
  sport: "5ch",
  category: "10ch",
  type: "12ch",
  name: "24ch",
  ou: "2ch",
  line: "7ch",
  odds: "8ch",
  bet: "9ch",
  toWin: "9ch",
  result: "7ch",
  net: "10ch",
  isLive: "4ch",
  tail: "10ch",
};

// Legacy column width state for manual resize feature (deprecated)
const COLUMN_WIDTHS_VERSION_KEY = "bettracker-column-widths-version";
const COLUMN_WIDTHS_VERSION = 5;

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  date: 55,
  site: 45,
  sport: 45,
  category: 80,
  type: 90,
  name: 200,
  ou: 35,
  line: 55,
  odds: 65,
  bet: 80,
  toWin: 80,
  result: 75,
  net: 75,
  isLive: 45,
  tail: 95,
};

const MIN_COLUMN_WIDTHS: Record<string, number> = {
  date: 50,
  site: 40,
  sport: 40,
  category: 70,
  type: 80,
  name: 150,
  ou: 30,
  line: 50,
  odds: 60,
  bet: 70,
  toWin: 70,
  result: 70,
  net: 70,
  isLive: 40,
  tail: 85,
};

function clampColumnWidth(columnKey: string, width: unknown): number | null {
  if (typeof width !== "number" || !Number.isFinite(width)) return null;
  const min = MIN_COLUMN_WIDTHS[columnKey] ?? 50;
  return Math.max(min, Math.round(width));
}

function sanitizeSavedColumnWidths(saved: unknown): Record<string, number> {
  if (!saved || typeof saved !== "object") return {};
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(saved as Record<string, unknown>)) {
    const clamped = clampColumnWidth(k, typeof v === "string" ? Number(v) : v);
    if (clamped !== null) next[k] = clamped;
  }
  return next;
}

function migrateSavedColumnWidthsIfNeeded(
  widths: Record<string, number>,
  savedVersion: number
): Record<string, number> {
  if (savedVersion === COLUMN_WIDTHS_VERSION) return widths;

  // We intentionally shrink these "short abbreviation" columns on migration,
  // because older saved widths tend to waste space and make the table feel cramped.
  const compactKeys: Array<keyof typeof DEFAULT_COLUMN_WIDTHS> = [
    "site",
    "sport",
    "category",
    "name",
  ];

  const next = { ...widths };
  for (const key of compactKeys) {
    const def = DEFAULT_COLUMN_WIDTHS[key];
    const current = next[key];
    if (typeof def === "number") {
      const migrated =
        typeof current === "number" ? Math.min(current, def) : def;
      const clamped = clampColumnWidth(String(key), migrated);
      if (clamped !== null) next[key] = clamped;
    }
  }

  return next;
}

// Cell coordinate type
type CellCoordinate = {
  rowIndex: number;
  columnKey: keyof FlatBet;
};

// Selection range type
type SelectionRange = {
  start: CellCoordinate;
  end: CellCoordinate;
} | null;

interface FlatBet {
  id: string; // unique ID for the row, e.g., bet.id or bet.id-leg-index
  betId: string; // original bet ID, for updates
  date: string;
  site: SportsbookName;
  sport: string;
  type: string;
  category: MarketCategory;
  name: string;
  name2?: string; // Second name for totals bets
  ou?: "Over" | "Under";
  line?: string | number;
  odds?: number;
  bet: number;
  toWin: number; // Potential Payout (stake + profit)
  result: BetResult;
  net: number;
  isLive: boolean;
  overallResult: BetResult;
  tail?: string;
  // Parlay metadata
  _parlayGroupId?: string | null;
  _legIndex?: number | null;
  _legCount?: number | null;
  _isParlayHeader?: boolean;
  _isParlayChild?: boolean;
}

// --- Formatting Helpers ---
const formatDate = (isoString: string) => {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Invalid";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  // Compact format without year to save horizontal space
  return `${month}/${day}`;
};

const abbreviateMarket = (market: string): string => {
  if (!market) return "";
  const lowerMarket = market.toLowerCase();

  const abbreviations: { [key: string]: string } = {
    "player points": "Pts",
    points: "Pts",
    "player rebounds": "Reb",
    rebounds: "Reb",
    "player assists": "Ast",
    assists: "Ast",
    "passing touchdowns": "Pass TD",
    "receiving yards": "Rec Yds",
    moneyline: "ML",
    "player threes": "3pt",
    "to record a triple-double": "TD",
    "rushing yards": "Rush Yds",
    "anytime touchdown scorer": "ATTD",
    "home runs": "HR",
    "player home runs": "HR",
    "player strikeouts": "Ks",
    strikeouts: "Ks",
    "player hits": "Hits",
    hits: "Hits",
    "total points": "Total",
    "total goals": "Total",
    "run line": "RL",
    spread: "Sprd",
    "passing yards": "Pass Yds",
    "outright winner": "Future",
    "to win outright": "Future",
  };
  return abbreviations[lowerMarket] || market;
};

// --- Editable Cell Components ---

const EditableCell: React.FC<{
  value: string | number;
  onSave: (newValue: string) => void;
  type?: "text" | "number";
  formatAsOdds?: boolean;
  suggestions?: string[];
  className?: string;
  isFocused?: boolean;
  onFocus?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}> = ({
  value,
  onSave,
  type = "text",
  formatAsOdds = false,
  suggestions = [],
  className = "",
  isFocused = false,
  onFocus,
  inputRef,
  onKeyDown,
}) => {
  const [text, setText] = useState(value?.toString() || "");
  const listId = useMemo(() => `suggestions-${Math.random()}`, []);
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef || internalRef;

  // Update internal state if the external value prop changes
  React.useEffect(() => {
    setText(value?.toString() || "");
  }, [value]);

  // Focus input when isFocused becomes true
  React.useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [isFocused, ref]);

  const handleBlur = () => {
    let formattedText = text;

    // Auto-format odds to add '+' for positive numbers if it's not there
    if (
      formatAsOdds &&
      type === "number" &&
      formattedText.match(/^[0-9]+(\.[0-9]+)?$/)
    ) {
      // It's a positive number without a sign
      formattedText = `+${formattedText}`;
    }

    // Always update the visual state to the formatted version
    setText(formattedText);

    // Only call onSave if the final formatted value is different from the original prop
    if (value?.toString() !== formattedText) {
      onSave(formattedText);
    }
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Don't handle navigation keys when editing - let parent handle them
    if (e.key === "Enter" || e.key === "Escape") {
      if (e.key === "Escape") {
        setText(value?.toString() || "");
      }
      (e.target as HTMLInputElement).blur();
      e.preventDefault();
      return;
    }

    // Call parent's onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <>
      <input
        ref={ref}
        type={type === "number" ? "text" : "text"} // Use text to allow for '+' sign
        inputMode={type === "number" ? "decimal" : "text"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onFocus={onFocus}
        onKeyDown={handleKeyDownInternal}
        className={`bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800 rounded text-sm max-w-full ${className}`}
        style={{ boxSizing: "border-box", maxWidth: "100%" }}
        placeholder=""
        list={suggestions.length > 0 ? listId : undefined}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
};

const ResultCell: React.FC<{
  value: BetResult;
  onSave: (newValue: BetResult) => void;
}> = ({ value, onSave }) => {
  return (
    <select
      value={value}
      onChange={(e) => onSave(e.target.value as BetResult)}
      className="bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none capitalize font-semibold rounded max-w-full"
      style={{ boxSizing: "border-box", maxWidth: "100%" }}
    >
      <option value="win">Win</option>
      <option value="loss">Loss</option>
      <option value="push">Push</option>
      <option value="pending">Pending</option>
    </select>
  );
};

// Typable Dropdown Component (Combobox)
const TypableDropdown: React.FC<{
  value: string;
  onSave: (newValue: string) => void;
  options: string[];
  className?: string;
  isFocused?: boolean;
  onFocus?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  allowCustom?: boolean; // Allow typing values not in the list
}> = ({
  value,
  onSave,
  options,
  className = "",
  isFocused = false,
  onFocus,
  inputRef,
  onKeyDown,
  placeholder = "",
  allowCustom = true,
}) => {
  const [text, setText] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [filterText, setFilterText] = useState(""); // Separate filter text from display text
  const internalRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const ref = inputRef || internalRef;

  // Update internal state if the external value prop changes
  React.useEffect(() => {
    setText(value || "");
    setFilterText(""); // Reset filter when value changes externally
  }, [value]);

  // Focus input when isFocused becomes true
  React.useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
      ref.current.select();
      setIsOpen(true); // Open dropdown when focused
      setFilterText(""); // Show all options when first focused
    }
  }, [isFocused, ref]);

  // Filter options based on typed text
  const filteredOptions = useMemo(() => {
    if (!filterText) return options; // Show all options when filter is empty
    const lowerFilter = filterText.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lowerFilter));
  }, [filterText, options]);

  const handleBlur = () => {
    // Close dropdown on blur (with delay to allow click events)
    setTimeout(() => {
      setIsOpen(false);
      setHighlightedIndex(-1);

      // Save the value
      if (text !== value) {
        if (allowCustom || options.includes(text) || !text) {
          onSave(text);
        } else {
          // If not allowing custom and value not in options, revert
          setText(value || "");
        }
      }
    }, 150);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);
    setFilterText(newText); // Update filter text for dropdown filtering
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (selectedValue: string) => {
    setText(selectedValue);
    setFilterText(""); // Clear filter when selecting
    onSave(selectedValue);
    setIsOpen(false);
    setHighlightedIndex(-1);
    ref.current?.blur();
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setText(value || "");
      setFilterText(""); // Reset filter on escape
      setIsOpen(false);
      setHighlightedIndex(-1);
      ref.current?.blur();
      e.preventDefault();
      return;
    }

    if (e.key === "Enter") {
      if (
        isOpen &&
        highlightedIndex >= 0 &&
        filteredOptions[highlightedIndex]
      ) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else {
        // Save current text
        if (allowCustom || options.includes(text) || !text) {
          onSave(text);
        }
        setIsOpen(false);
        ref.current?.blur();
      }
      e.preventDefault();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
      return;
    }

    // Open dropdown when typing
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
      setIsOpen(true);
    }

    // Call parent's onKeyDown if provided
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className="relative w-full min-w-0">
      <input
        ref={ref}
        type="text"
        value={text}
        onChange={handleChange}
        onFocus={() => {
          setIsOpen(true);
          setFilterText(""); // Show all options when focusing
          if (onFocus) onFocus();
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDownInternal}
        className={`bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800 rounded text-sm max-w-full ${className}`}
        style={{ boxSizing: "border-box", maxWidth: "100%" }}
        placeholder={placeholder}
      />
      {isOpen && filteredOptions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 max-h-60 overflow-y-auto"
          style={{ top: "100%", left: 0 }}
        >
          {filteredOptions.map((option, index) => (
            <div
              key={option}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                handleSelect(option);
              }}
              className={`px-2 py-1 cursor-pointer text-sm ${
                index === highlightedIndex
                  ? "bg-blue-100 dark:bg-blue-900/50"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-700"
              }`}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const OUCell: React.FC<{
  value?: "Over" | "Under";
  onSave: (newValue: "Over" | "Under" | undefined) => void;
  isFocused?: boolean;
  onFocus?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}> = ({ value, onSave, isFocused, onFocus, inputRef, onKeyDown }) => {
  const handleSave = (val: string) => {
    if (val === "Over" || val === "Under") {
      onSave(val);
    } else if (!val || val === "") {
      onSave(undefined);
    }
  };

  return (
    <TypableDropdown
      value={value || ""}
      onSave={handleSave}
      options={["Over", "Under"]}
      className="text-center capitalize font-semibold"
      isFocused={isFocused}
      onFocus={onFocus}
      inputRef={inputRef}
      onKeyDown={onKeyDown}
      allowCustom={false}
    />
  );
};

const BetTableView: React.FC = () => {
  const { bets, loading, updateBet } = useBets();
  const {
    sportsbooks,
    sports,
    categories,
    betTypes,
    players,
    teams,
    addSport,
    addCategory,
    addBetType,
    addPlayer,
    addTeam,
  } = useInputs();
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{
    sport: string | "all";
    type: string | "all";
    result: BetResult | "all";
    category: MarketCategory | "all";
  }>({
    sport: "all",
    type: "all",
    result: "all",
    category: "all",
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof FlatBet;
    direction: "asc" | "desc";
  } | null>({ key: "date", direction: "desc" });

  // Spreadsheet state management
  const [focusedCell, setFocusedCell] = useState<CellCoordinate | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<CellCoordinate | null>(
    null
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    () => {
      const saved = localStorage.getItem("bettracker-column-widths");
      if (!saved) return {};
      try {
        const savedVersionRaw = localStorage.getItem(COLUMN_WIDTHS_VERSION_KEY);
        const savedVersion = savedVersionRaw ? Number(savedVersionRaw) : 0;
        const sanitized = sanitizeSavedColumnWidths(JSON.parse(saved));
        return migrateSavedColumnWidthsIfNeeded(sanitized, savedVersion);
      } catch {
        return {};
      }
    }
  );
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [dragFillData, setDragFillData] = useState<{
    start: CellCoordinate;
    end: CellCoordinate;
  } | null>(null);
  const [expandedParlays, setExpandedParlays] = useState<Set<string>>(() => {
    // Load from localStorage or default to all expanded
    const saved = localStorage.getItem("bettracker-expanded-parlays");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const tableRef = useRef<HTMLTableElement>(null);
  const cellRefs = useRef<Map<string, React.RefObject<HTMLInputElement>>>(
    new Map()
  );

  // Save column widths to localStorage
  useEffect(() => {
    localStorage.setItem(
      "bettracker-column-widths",
      JSON.stringify(columnWidths)
    );
    localStorage.setItem(
      COLUMN_WIDTHS_VERSION_KEY,
      String(COLUMN_WIDTHS_VERSION)
    );
  }, [columnWidths]);

  // Save expanded parlays to localStorage
  useEffect(() => {
    localStorage.setItem(
      "bettracker-expanded-parlays",
      JSON.stringify(Array.from(expandedParlays))
    );
  }, [expandedParlays]);

  // Toggle parlay expansion
  const toggleParlayExpansion = useCallback((parlayGroupId: string | null) => {
    if (!parlayGroupId) return;
    setExpandedParlays((prev) => {
      const next = new Set(prev);
      if (next.has(parlayGroupId)) {
        next.delete(parlayGroupId);
      } else {
        next.add(parlayGroupId);
      }
      return next;
    });
  }, []);

  const siteShortNameMap = useMemo(() => {
    return sportsbooks.reduce((acc, book) => {
      acc[book.name] = book.abbreviation;
      return acc;
    }, {} as Record<SportsbookName, string>);
  }, [sportsbooks]);

  const flattenedBets = useMemo(() => {
    const flatBets: FlatBet[] = [];
    bets.forEach((bet) => {
      // Use betToFinalRows to get properly formatted rows with parlay metadata
      const finalRows = betToFinalRows(bet);

      finalRows.forEach((finalRow, index) => {
        // Convert FinalRow to FlatBet format
        const isLive = bet.isLive || false;

        // Parse monetary values (empty string means child row, should be 0)
        const betAmount = finalRow.Bet ? parseFloat(finalRow.Bet) : 0;
        const toWinAmount = finalRow["To Win"]
          ? parseFloat(finalRow["To Win"])
          : 0;
        const netAmount = finalRow.Net ? parseFloat(finalRow.Net) : 0;
        const oddsValue = finalRow.Odds
          ? parseFloat(finalRow.Odds.replace("+", ""))
          : undefined;

        // Parse Over/Under
        const ou =
          finalRow.Over === "1"
            ? ("Over" as const)
            : finalRow.Under === "1"
            ? ("Under" as const)
            : undefined;

        // Parse Result
        const result = finalRow.Result.toLowerCase() as BetResult;

        // Generate unique ID
        const id =
          finalRow._isParlayChild && finalRow._legIndex
            ? `${bet.id}-leg-${finalRow._legIndex - 1}`
            : bet.id;

        flatBets.push({
          id,
          betId: bet.id,
          date: bet.placedAt,
          site: bet.book as SportsbookName,
          sport: finalRow.Sport,
          bet: betAmount,
          toWin: toWinAmount,
          net: netAmount,
          overallResult: bet.result,
          type: finalRow.Type,
          category: finalRow.Category as MarketCategory,
          name: finalRow.Name,
          name2: finalRow.Name2,
          ou,
          line: finalRow.Line || undefined,
          odds: oddsValue,
          result,
          isLive,
          tail: finalRow.Tail === "1" ? bet.tail : undefined,
          _parlayGroupId: finalRow._parlayGroupId,
          _legIndex: finalRow._legIndex,
          _legCount: finalRow._legCount,
          _isParlayHeader: finalRow._isParlayHeader,
          _isParlayChild: finalRow._isParlayChild,
        });
      });
    });
    return flatBets;
  }, [bets]);

  const handleLegUpdate = useCallback(
    (betId: string, legIndex: number, updates: Partial<BetLeg>) => {
      const originalBet = bets.find((b) => b.id === betId);
      if (
        !originalBet ||
        !originalBet.legs ||
        legIndex >= originalBet.legs.length
      )
        return;

      const newLegs = originalBet.legs.map((leg, index) => {
        if (index === legIndex) {
          return { ...leg, ...updates };
        }
        return leg;
      });

      updateBet(betId, { legs: newLegs });
    },
    [bets, updateBet]
  );

  // Very basic entity detection for auto-add
  const autoAddEntity = (sport: string, entity: string, market: string) => {
    const lowerMarket = market.toLowerCase();
    const teamMarketKeywords = [
      "moneyline",
      "ml",
      "spread",
      "total",
      "run line",
      "money line",
      "outright winner",
      "to win",
    ];
    const playerMarketKeywords = [
      "player",
      "prop",
      "yards",
      "points",
      "rebounds",
      "assists",
      "touchdown",
      "strikeouts",
      "hits",
      "goals",
      "scorer",
      "triple-double",
      "triple double",
      "double double",
      "first basket",
      "first field goal",
      "first fg",
      "top scorer",
      "top points",
      "top pts",
      "threes",
    ];
    const isTeamMarket = teamMarketKeywords.some((keyword) =>
      lowerMarket.includes(keyword)
    );
    const isPlayerMarket = playerMarketKeywords.some((keyword) =>
      lowerMarket.includes(keyword)
    );

    if (isPlayerMarket && !isTeamMarket) {
      addPlayer(sport, entity);
    } else if (isTeamMarket && !isPlayerMarket) {
      addTeam(sport, entity);
    } else {
      const teamSports = ["NFL", "NBA", "MLB", "NHL", "Soccer"];
      if (teamSports.includes(sport)) {
        addTeam(sport, entity);
      } else {
        addPlayer(sport, entity);
      }
    }
  };

  const availableTypes = useMemo(() => {
    if (filters.sport === "all") {
      return Array.from(new Set(Object.values(betTypes).flat())).sort();
    }
    return (betTypes[filters.sport] || []).sort();
  }, [betTypes, filters.sport]);

  const availableSites = useMemo(
    () => sportsbooks.map((b) => b.name).sort(),
    [sportsbooks]
  );
  const suggestionLists = useMemo(
    () => ({
      sports: sports,
      sites: availableSites,
      categories: categories,
      types: (sport: string) => betTypes[sport] || [],
      players: (sport: string) => players[sport] || [],
      teams: (sport: string) => teams[sport] || [],
    }),
    [sports, availableSites, categories, betTypes, players, teams]
  );

  const filteredBets = useMemo(() => {
    return flattenedBets.filter(
      (bet) =>
        (filters.sport === "all" || bet.sport === filters.sport) &&
        (filters.type === "all" || bet.type === filters.type) &&
        (filters.result === "all" ||
          bet.result === filters.result ||
          bet.overallResult === filters.result) &&
        (filters.category === "all" || bet.category === filters.category) &&
        (searchTerm === "" ||
          bet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bet.name2?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bet.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bet.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bet.tail?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [flattenedBets, filters, searchTerm]);

  const sortedBets = useMemo(() => {
    let sortableBets = [...filteredBets];
    if (sortConfig !== null) {
      sortableBets.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (sortConfig.key === "date") {
          return sortConfig.direction === "asc"
            ? new Date(aValue as string).getTime() -
                new Date(bValue as string).getTime()
            : new Date(bValue as string).getTime() -
                new Date(aValue as string).getTime();
        }

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableBets;
  }, [filteredBets, sortConfig]);

  // Filter out collapsed parlay children
  const visibleBets = useMemo(() => {
    return sortedBets.filter((bet) => {
      // Always show header rows
      if (bet._isParlayHeader) return true;
      // Show child rows only if their parent parlay is expanded
      if (bet._isParlayChild && bet._parlayGroupId) {
        return expandedParlays.has(bet._parlayGroupId);
      }
      // Show all non-parlay bets
      return true;
    });
  }, [sortedBets, expandedParlays]);

  // Calculate stripe index for each row:
  // - Alternate every visible top-level row (non-parlay or parlay header)
  // - Keep expanded parlay legs the same color as their header
  const rowStripeIndex = useMemo(() => {
    const stripeMap = new Map<number, number>();
    const parlayStripe = new Map<string, number>();
    let stripeIndex = -1; // start at -1 so first increment yields 0

    visibleBets.forEach((row, index) => {
      // Parlay header: new stripe, record for its group
      if (row._isParlayHeader) {
        stripeIndex += 1;
        stripeMap.set(index, stripeIndex);
        if (row._parlayGroupId) {
          parlayStripe.set(row._parlayGroupId, stripeIndex);
        }
        return;
      }

      // Parlay child: share header stripe when expanded
      if (
        row._isParlayChild &&
        row._parlayGroupId &&
        expandedParlays.has(row._parlayGroupId)
      ) {
        const headerStripe = parlayStripe.get(row._parlayGroupId);
        stripeMap.set(index, headerStripe ?? stripeIndex);
        return;
      }

      // Non-parlay (or collapsed child rows, which aren't visible): new stripe
      stripeIndex += 1;
      stripeMap.set(index, stripeIndex);
    });

    return stripeMap;
  }, [visibleBets, expandedParlays]);

  const requestSort = (key: keyof FlatBet) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const FilterControl: React.FC<{
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
  }> = ({ label, value, onChange, options }) => (
    <div>
      <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mr-2">
        {label}:
      </label>
      <select
        value={value}
        onChange={onChange}
        className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md p-1 text-sm"
      >
        <option value="all">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );

  const headers: {
    key: keyof FlatBet;
    label: string;
    style: React.CSSProperties;
  }[] = [
    { key: "date", label: "Date", style: {} },
    { key: "site", label: "Site", style: {} },
    { key: "sport", label: "Sport", style: {} },
    { key: "category", label: "Cat", style: {} }, // Abbreviated header
    { key: "type", label: "Type", style: {} },
    { key: "name", label: "Name", style: {} }, // Flexible width - fills remaining space
    {
      key: "ou",
      label: "O/U",
      style: { textAlign: "center", whiteSpace: "nowrap" },
    },
    { key: "line", label: "Line", style: { textAlign: "right" } },
    { key: "odds", label: "Odds", style: { textAlign: "right" } },
    { key: "bet", label: "Bet", style: { textAlign: "right" } },
    { key: "toWin", label: "Win", style: { textAlign: "right" } }, // Shortened from "To Win"
    { key: "result", label: "Result", style: { textAlign: "center" } },
    { key: "net", label: "Net", style: { textAlign: "right" } },
    { key: "isLive", label: "Live", style: { textAlign: "center" } },
    { key: "tail", label: "Tail", style: {} },
  ];

  const getColumnWidthPx = useCallback(
    (columnKey: string, fallback?: React.CSSProperties["width"]): string => {
      // Name column is flexible - fills remaining space with auto width
      if (columnKey === "name") {
        const minWidth = MIN_COLUMN_WIDTHS[columnKey] ?? 200;
        // If user has manually resized it, use that value
        const fromState = clampColumnWidth(columnKey, columnWidths[columnKey]);
        if (fromState !== null && fromState >= minWidth) {
          // For auto layout, we can set a min-width via style on the col element
          // but the width itself should be auto to allow flexibility
          return "auto";
        }
        // Default: auto width with min-width enforced via CSS
        return "auto";
      }

      const fromState = clampColumnWidth(columnKey, columnWidths[columnKey]);
      if (fromState !== null) return `${fromState}px`;

      const fromDefault = DEFAULT_COLUMN_WIDTHS[columnKey];
      if (typeof fromDefault === "number") return `${fromDefault}px`;

      if (typeof fallback === "number") return `${fallback}px`;
      if (typeof fallback === "string" && fallback.trim().length > 0)
        return fallback;
      return "auto";
    },
    [columnWidths]
  );

  const formatOdds = (odds: number | undefined): string => {
    if (odds === undefined) return "";
    if (odds > 0) return `+${odds}`;
    return odds.toString();
  };

  // Helper: Get editable columns (exclude readonly columns)
  const editableColumns = useMemo(() => {
    return headers
      .filter(
        (h) =>
          h.key !== "date" &&
          h.key !== "toWin" &&
          h.key !== "net" &&
          h.key !== "isLive"
      )
      .map((h) => h.key);
  }, []);

  // Helper: Check if a cell is editable
  const isCellEditable = useCallback(
    (columnKey: keyof FlatBet): boolean => {
      return editableColumns.includes(columnKey);
    },
    [editableColumns]
  );

  // Helper: Get cell ref key
  const getCellKey = useCallback(
    (rowIndex: number, columnKey: keyof FlatBet): string => {
      return `${rowIndex}-${columnKey}`;
    },
    []
  );

  // Helper: Get or create cell ref
  const getCellRef = useCallback(
    (
      rowIndex: number,
      columnKey: keyof FlatBet
    ): React.RefObject<HTMLInputElement> => {
      const key = getCellKey(rowIndex, columnKey);
      if (!cellRefs.current.has(key)) {
        cellRefs.current.set(key, React.createRef<HTMLInputElement>());
      }
      return cellRefs.current.get(key)!;
    },
    [getCellKey]
  );

  // Helper: Navigate to next editable cell
  const navigateToCell = useCallback(
    (
      rowIndex: number,
      columnKey: keyof FlatBet,
      direction: "up" | "down" | "left" | "right"
    ) => {
      const currentColIndex = editableColumns.indexOf(columnKey);

      if (direction === "left" || direction === "right") {
        const newColIndex =
          direction === "left" ? currentColIndex - 1 : currentColIndex + 1;
        if (newColIndex >= 0 && newColIndex < editableColumns.length) {
          const newColumnKey = editableColumns[newColIndex];
          setFocusedCell({ rowIndex, columnKey: newColumnKey });
          setSelectionRange(null);
          return;
        }
      } else if (direction === "up" || direction === "down") {
        const newRowIndex = direction === "up" ? rowIndex - 1 : rowIndex + 1;
        if (newRowIndex >= 0 && newRowIndex < visibleBets.length) {
          setFocusedCell({ rowIndex: newRowIndex, columnKey });
          setSelectionRange(null);
          return;
        }
      }
    },
    [editableColumns, visibleBets.length]
  );

  // Helper: Check if cell is in selection range
  const isCellSelected = useCallback(
    (rowIndex: number, columnKey: keyof FlatBet): boolean => {
      if (!selectionRange) return false;
      const { start, end } = selectionRange;
      const minRow = Math.min(start.rowIndex, end.rowIndex);
      const maxRow = Math.max(start.rowIndex, end.rowIndex);
      const minCol = Math.min(
        editableColumns.indexOf(start.columnKey),
        editableColumns.indexOf(end.columnKey)
      );
      const maxCol = Math.max(
        editableColumns.indexOf(start.columnKey),
        editableColumns.indexOf(end.columnKey)
      );

      const cellRow = rowIndex;
      const cellCol = editableColumns.indexOf(columnKey);

      return (
        cellRow >= minRow &&
        cellRow <= maxRow &&
        cellCol >= minCol &&
        cellCol <= maxCol
      );
    },
    [selectionRange, editableColumns]
  );

  // Helper: Check if cell is focused
  const isCellFocused = useCallback(
    (rowIndex: number, columnKey: keyof FlatBet): boolean => {
      return (
        focusedCell?.rowIndex === rowIndex &&
        focusedCell?.columnKey === columnKey
      );
    },
    [focusedCell]
  );

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        // Only handle navigation keys if not actively editing (no text selected)
        if (
          target instanceof HTMLInputElement &&
          target.selectionStart !== target.selectionEnd
        ) {
          return;
        }
        // Handle Tab, Enter, Arrow keys even when in input
        if (
          ![
            "Tab",
            "Enter",
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
            "Escape",
          ].includes(e.key)
        ) {
          return;
        }
      }

      if (!focusedCell) return;

      const { rowIndex, columnKey } = focusedCell;

      // Handle copy (Ctrl+C or Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Handle paste (Ctrl+V or Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Navigation keys
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          navigateToCell(rowIndex, columnKey, "up");
          break;
        case "ArrowDown":
          e.preventDefault();
          navigateToCell(rowIndex, columnKey, "down");
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigateToCell(rowIndex, columnKey, "left");
          break;
        case "ArrowRight":
          e.preventDefault();
          navigateToCell(rowIndex, columnKey, "right");
          break;
        case "Tab":
          e.preventDefault();
          if (e.shiftKey) {
            navigateToCell(rowIndex, columnKey, "left");
          } else {
            navigateToCell(rowIndex, columnKey, "right");
          }
          break;
        case "Enter":
          if (!(target instanceof HTMLInputElement)) {
            e.preventDefault();
            navigateToCell(rowIndex, columnKey, "down");
          }
          break;
        case "Home":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            // Go to first row
            setFocusedCell({ rowIndex: 0, columnKey });
          } else {
            // Go to first column
            setFocusedCell({ rowIndex, columnKey: editableColumns[0] });
          }
          break;
        case "End":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            // Go to last row
            setFocusedCell({ rowIndex: visibleBets.length - 1, columnKey });
          } else {
            // Go to last column
            setFocusedCell({
              rowIndex,
              columnKey: editableColumns[editableColumns.length - 1],
            });
          }
          break;
      }
    },
    [focusedCell, navigateToCell, editableColumns, visibleBets.length]
  );

  // Helper: Get cell value as string
  const getCellValue = useCallback(
    (row: FlatBet, columnKey: keyof FlatBet): string => {
      const value = row[columnKey];
      if (value === undefined || value === null) return "";
      if (columnKey === "odds") return formatOdds(value as number);
      if (columnKey === "bet") return (value as number).toFixed(2);
      if (columnKey === "ou") return (value as string) || "";
      return String(value);
    },
    []
  );

  // Attach keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Copy handler
  const handleCopy = useCallback(() => {
    if (!selectionRange && !focusedCell) return;

    let cellsToCopy: Array<{
      rowIndex: number;
      columnKey: keyof FlatBet;
      value: string;
    }> = [];

    if (selectionRange) {
      const { start, end } = selectionRange;
      const minRow = Math.min(start.rowIndex, end.rowIndex);
      const maxRow = Math.max(start.rowIndex, end.rowIndex);
      const minCol = Math.min(
        editableColumns.indexOf(start.columnKey),
        editableColumns.indexOf(end.columnKey)
      );
      const maxCol = Math.max(
        editableColumns.indexOf(start.columnKey),
        editableColumns.indexOf(end.columnKey)
      );

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const row = visibleBets[r];
          const colKey = editableColumns[c];
          if (row && colKey) {
            const value = getCellValue(row, colKey);
            cellsToCopy.push({ rowIndex: r, columnKey: colKey, value });
          }
        }
      }
    } else if (focusedCell) {
      const row = visibleBets[focusedCell.rowIndex];
      if (row) {
        const value = getCellValue(row, focusedCell.columnKey);
        cellsToCopy.push({
          rowIndex: focusedCell.rowIndex,
          columnKey: focusedCell.columnKey,
          value,
        });
      }
    }

    // Format as tab-separated values
    const rows: string[] = [];
    let currentRow = cellsToCopy[0]?.rowIndex;
    let currentRowData: string[] = [];

    cellsToCopy.forEach((cell, index) => {
      if (cell.rowIndex !== currentRow) {
        rows.push(currentRowData.join("\t"));
        currentRowData = [];
        currentRow = cell.rowIndex;
      }
      currentRowData.push(cell.value);
    });
    if (currentRowData.length > 0) {
      rows.push(currentRowData.join("\t"));
    }

    const text = rows.join("\n");
    navigator.clipboard.writeText(text);
  }, [selectionRange, focusedCell, editableColumns, sortedBets, getCellValue]);

  // Paste handler
  const handlePaste = useCallback(async () => {
    if (!focusedCell) return;

    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split("\n").filter((r) => r.trim());
      const pasteData = rows.map((row) => row.split("\t"));

      const startRow = selectionRange
        ? Math.min(selectionRange.start.rowIndex, selectionRange.end.rowIndex)
        : focusedCell.rowIndex;
      const startCol = selectionRange
        ? Math.min(
            editableColumns.indexOf(selectionRange.start.columnKey),
            editableColumns.indexOf(selectionRange.end.columnKey)
          )
        : editableColumns.indexOf(focusedCell.columnKey);

      pasteData.forEach((rowData, rowOffset) => {
        rowData.forEach((cellValue, colOffset) => {
          const targetRowIndex = startRow + rowOffset;
          const targetColIndex = startCol + colOffset;

          if (
            targetRowIndex < visibleBets.length &&
            targetColIndex < editableColumns.length
          ) {
            const targetRow = visibleBets[targetRowIndex];
            const targetColumnKey = editableColumns[targetColIndex];

            if (targetRow && isCellEditable(targetColumnKey)) {
              handleCellPaste(targetRow, targetColumnKey, cellValue);
            }
          }
        });
      });
    } catch (err) {
      console.error("Failed to paste:", err);
    }
  }, [
    focusedCell,
    selectionRange,
    editableColumns,
    visibleBets,
    isCellEditable,
  ]);

  // Helper: Handle cell paste
  const handleCellPaste = useCallback(
    (row: FlatBet, columnKey: keyof FlatBet, value: string) => {
      const isLeg = row.id.includes("-leg-");
      const legIndex = isLeg ? parseInt(row.id.split("-leg-").pop()!, 10) : -1;

      switch (columnKey) {
        case "site":
          const book = sportsbooks.find(
            (b) =>
              b.name.toLowerCase() === value.toLowerCase() ||
              b.abbreviation.toLowerCase() === value.toLowerCase()
          );
          updateBet(row.betId, { book: book ? book.name : value });
          break;
        case "sport":
          addSport(value);
          updateBet(row.betId, { sport: value });
          break;
        case "category":
          addCategory(value);
          updateBet(row.betId, { marketCategory: value as MarketCategory });
          break;
        case "type":
          if (isLeg) {
            addBetType(row.sport, value);
            handleLegUpdate(row.betId, legIndex, { market: value });
          } else {
            // Update bet.type (stat type), NOT betType (bet form)
            addBetType(row.sport, value);
            updateBet(row.betId, { type: value });
          }
          break;
        case "name":
          if (isLeg) {
            autoAddEntity(row.sport, value, row.type);
            handleLegUpdate(row.betId, legIndex, { entities: [value] });
          } else {
            // Update bet.name (player/team name only), NOT description
            autoAddEntity(row.sport, value, row.type);
            updateBet(row.betId, { name: value });
          }
          break;
        case "line":
          if (isLeg) {
            handleLegUpdate(row.betId, legIndex, { target: value });
          }
          break;
        case "odds":
          const numVal = parseInt(value.replace("+", ""), 10);
          if (!isNaN(numVal)) {
            updateBet(row.betId, { odds: numVal });
          }
          break;
        case "bet":
          const stakeVal = parseFloat(value);
          if (!isNaN(stakeVal)) {
            updateBet(row.betId, { stake: stakeVal });
          }
          break;
        case "result":
          if (isLeg) {
            handleLegUpdate(row.betId, legIndex, {
              result: value as BetResult,
            });
          } else {
            updateBet(row.betId, { result: value as BetResult });
          }
          break;
        case "tail":
          updateBet(row.betId, { tail: value });
          break;
      }
    },
    [
      sportsbooks,
      addSport,
      updateBet,
      handleLegUpdate,
      addBetType,
      autoAddEntity,
    ]
  );

  // Column resize handlers
  const handleResizeStart = useCallback(
    (columnKey: string, e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(columnKey);
      setResizeStartX(e.clientX);
      const currentWidth =
        columnWidths[columnKey] ??
        DEFAULT_COLUMN_WIDTHS[columnKey] ??
        headers.find((h) => h.key === (columnKey as any))?.style.width;
      if (typeof currentWidth === "string" && currentWidth.endsWith("%")) {
        const table = tableRef.current;
        if (table) {
          const percent = parseFloat(currentWidth);
          const tableWidth = table.offsetWidth;
          setResizeStartWidth((tableWidth * percent) / 100);
        } else {
          setResizeStartWidth(100);
        }
      } else if (typeof currentWidth === "number") {
        setResizeStartWidth(currentWidth);
      } else {
        setResizeStartWidth(100);
      }
    },
    [columnWidths, headers]
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const deltaX = e.clientX - resizeStartX;
      const min = MIN_COLUMN_WIDTHS[isResizing] ?? 50;
      const newWidth = Math.max(min, resizeStartWidth + deltaX);
      setColumnWidths((prev) => ({ ...prev, [isResizing!]: newWidth }));
    },
    [isResizing, resizeStartX, resizeStartWidth]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
      return () => {
        window.removeEventListener("mousemove", handleResizeMove);
        window.removeEventListener("mouseup", handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Cell click handler
  const handleCellClick = useCallback(
    (rowIndex: number, columnKey: keyof FlatBet, e: React.MouseEvent) => {
      if (!isCellEditable(columnKey)) return;

      if (e.shiftKey && selectionAnchor) {
        // Shift+Click: extend selection
        setSelectionRange({
          start: selectionAnchor,
          end: { rowIndex, columnKey },
        });
        setFocusedCell({ rowIndex, columnKey });
      } else if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+Click: add to selection (multi-select)
        if (selectionRange) {
          // For simplicity, just extend the range
          setSelectionRange({
            start: selectionRange.start,
            end: { rowIndex, columnKey },
          });
        } else {
          setSelectionRange({
            start: { rowIndex, columnKey },
            end: { rowIndex, columnKey },
          });
        }
        setFocusedCell({ rowIndex, columnKey });
      } else {
        // Regular click: single selection
        setFocusedCell({ rowIndex, columnKey });
        setSelectionAnchor({ rowIndex, columnKey });
        setSelectionRange({
          start: { rowIndex, columnKey },
          end: { rowIndex, columnKey },
        });
      }
    },
    [isCellEditable, selectionAnchor, selectionRange]
  );

  // Drag-to-fill handlers
  const handleDragFillStart = useCallback(
    (rowIndex: number, columnKey: keyof FlatBet, e: React.MouseEvent) => {
      e.preventDefault();
      if (
        !focusedCell ||
        focusedCell.rowIndex !== rowIndex ||
        focusedCell.columnKey !== columnKey
      ) {
        return;
      }
      setDragFillData({
        start: { rowIndex, columnKey },
        end: { rowIndex, columnKey },
      });
    },
    [focusedCell]
  );

  const handleDragFillMove = useCallback(
    (e: MouseEvent) => {
      if (!dragFillData) return;

      const table = tableRef.current;
      if (!table) return;

      const tbody = table.querySelector("tbody");
      if (!tbody) return;

      const rect = tbody.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const x = e.clientX - rect.left;

      // Find which cell we're over
      const rows = Array.from(tbody.querySelectorAll("tr"));
      let targetRowIndex = -1;
      let targetColIndex = -1;

      let currentY = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as HTMLTableRowElement;
        if (y >= currentY && y < currentY + row.offsetHeight) {
          targetRowIndex = i;
          break;
        }
        currentY += row.offsetHeight;
      }

      if (targetRowIndex >= 0) {
        const targetRow = rows[targetRowIndex] as HTMLTableRowElement;
        const cells = Array.from(targetRow.querySelectorAll("td"));
        let currentX = 0;
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i] as HTMLTableCellElement;
          if (x >= currentX && x < currentX + cell.offsetWidth) {
            targetColIndex = i;
            break;
          }
          currentX += cell.offsetWidth;
        }
      }

      if (
        targetRowIndex >= 0 &&
        targetColIndex >= 0 &&
        targetColIndex < editableColumns.length
      ) {
        const targetColumnKey = editableColumns[targetColIndex];
        setDragFillData({
          start: dragFillData.start,
          end: { rowIndex: targetRowIndex, columnKey: targetColumnKey },
        });
      }
    },
    [dragFillData, editableColumns]
  );

  const handleDragFillEnd = useCallback(() => {
    if (!dragFillData) return;

    const { start, end } = dragFillData;
    const startRow = sortedBets[start.rowIndex];
    if (!startRow) {
      setDragFillData(null);
      return;
    }

    const startValue = getCellValue(startRow, start.columnKey);
    const minRow = Math.min(start.rowIndex, end.rowIndex);
    const maxRow = Math.max(start.rowIndex, end.rowIndex);
    const minCol = Math.min(
      editableColumns.indexOf(start.columnKey),
      editableColumns.indexOf(end.columnKey)
    );
    const maxCol = Math.max(
      editableColumns.indexOf(start.columnKey),
      editableColumns.indexOf(end.columnKey)
    );

    // Fill cells
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (
          r === start.rowIndex &&
          c === editableColumns.indexOf(start.columnKey)
        )
          continue;

        const row = sortedBets[r];
        const colKey = editableColumns[c];
        if (row && colKey && isCellEditable(colKey)) {
          // Simple fill: copy the value
          // Could be enhanced to detect patterns (incrementing numbers, etc.)
          handleCellPaste(row, colKey, startValue);
        }
      }
    }

    setDragFillData(null);
  }, [
    dragFillData,
    sortedBets,
    editableColumns,
    getCellValue,
    isCellEditable,
    handleCellPaste,
  ]);

  useEffect(() => {
    if (dragFillData) {
      window.addEventListener("mousemove", handleDragFillMove);
      window.addEventListener("mouseup", handleDragFillEnd);
      return () => {
        window.removeEventListener("mousemove", handleDragFillMove);
        window.removeEventListener("mouseup", handleDragFillEnd);
      };
    }
  }, [dragFillData, handleDragFillMove, handleDragFillEnd]);

  return (
    <div className="p-4 h-full flex flex-col space-y-2 bg-neutral-100 dark:bg-neutral-950">
      <header>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
          Bet Table
        </h1>
      </header>

      <div className="p-2 bg-white dark:bg-neutral-900 rounded-lg shadow-md flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full lg:grow lg:min-w-[280px] p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 placeholder-neutral-400 dark:placeholder-neutral-500"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterControl
            label="Sport"
            value={filters.sport}
            onChange={(e) =>
              setFilters({
                ...filters,
                sport: e.target.value as any,
                type: "all",
              })
            }
            options={sports}
          />
          <FilterControl
            label="Category"
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value as any })
            }
            options={categories}
          />
          <FilterControl
            label="Type"
            value={filters.type}
            onChange={(e) =>
              setFilters({ ...filters, type: e.target.value as any })
            }
            options={availableTypes}
          />
          <FilterControl
            label="Result"
            value={filters.result}
            onChange={(e) =>
              setFilters({ ...filters, result: e.target.value as any })
            }
            options={["win", "loss", "push", "pending"]}
          />
        </div>
      </div>

      <div className="grow bg-white dark:bg-neutral-900 rounded-lg shadow-md overflow-hidden flex flex-col">
        <div
          className="flex-1 overflow-y-auto min-w-0"
          style={{ width: "100%" }}
        >
          <table
            ref={tableRef}
            className="w-full text-sm text-left text-neutral-500 dark:text-neutral-400 border-collapse"
            style={{ tableLayout: "fixed", width: "100%" }}
          >
            <colgroup>
              {headers.map((header) => (
                <col key={header.key} style={{ width: COLUMN_WIDTHS[header.key] }} />
              ))}
            </colgroup>
            <thead className="text-xs font-semibold tracking-wide text-neutral-700 uppercase bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-400 sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-700">
              <tr className="leading-tight">
                {headers.map((header) => {
                  const headerPaddingX = "px-1";
                  const numericRightAligned = new Set<keyof FlatBet>([
                    "line",
                    "odds",
                    "bet",
                    "toWin",
                    "net",
                  ]);
                  const centerAligned = new Set<keyof FlatBet>([
                    "ou",
                    "isLive",
                    "result",
                  ]);
                  const alignmentClass = numericRightAligned.has(header.key)
                    ? " text-right tabular-nums"
                    : centerAligned.has(header.key)
                    ? " text-center"
                    : "";
                  const isMoneyBlockStart = header.key === "bet";
                  return (
                    <th
                      key={header.key}
                      scope="col"
                      className={`${headerPaddingX} py-1 relative whitespace-nowrap${alignmentClass}${
                        isMoneyBlockStart
                          ? " border-l border-neutral-200 dark:border-neutral-700"
                          : ""
                      }`}
                      style={{
                        ...header.style,
                        // Width is controlled via <colgroup> to keep header/body aligned
                        ...(header.key === "bet"
                          ? { paddingRight: "calc(1ch + 0.125rem)" }
                          : {}),
                      }}
                    >
                      {header.label}
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary-500 opacity-0 hover:opacity-100 transition-opacity"
                        onMouseDown={(e) => handleResizeStart(header.key, e)}
                        style={{ userSelect: "none" }}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={headers.length} className="text-center p-8">
                    Loading bets...
                  </td>
                </tr>
              ) : visibleBets.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="text-center p-8">
                    No bets found matching your criteria.
                  </td>
                </tr>
              ) : (
                visibleBets.map((row, rowIndex) => {
                  const isLeg = row.id.includes("-leg-");
                  const legIndex = isLeg
                    ? parseInt(row.id.split("-leg-").pop()!, 10)
                    : -1;
                  const net = row.net;
                  const displayResult = isLeg ? row.result : row.overallResult;
                  const resultBgClass =
                    displayResult === "win"
                      ? "bg-green-500/10"
                      : displayResult === "loss"
                      ? "bg-red-500/10"
                      : displayResult === "push"
                      ? "bg-neutral-500/10"
                      : "";
                  const resultTextClass =
                    displayResult === "win"
                      ? "text-green-600 dark:text-green-400"
                      : displayResult === "loss"
                      ? "text-red-600 dark:text-red-400"
                      : "";
                  const netBgClass =
                    net > 0
                      ? "bg-green-500/10"
                      : net < 0
                      ? "bg-red-500/10"
                      : "";
                  const netColorClass =
                    net > 0 ? "text-green-500" : net < 0 ? "text-red-500" : "";

                  // Helper to check if cell is in drag fill range
                  const isInDragFillRange = (
                    rowIndex: number,
                    columnKey: keyof FlatBet
                  ): boolean => {
                    if (!dragFillData) return false;
                    const { start, end } = dragFillData;
                    const minRow = Math.min(start.rowIndex, end.rowIndex);
                    const maxRow = Math.max(start.rowIndex, end.rowIndex);
                    const minCol = Math.min(
                      editableColumns.indexOf(start.columnKey),
                      editableColumns.indexOf(end.columnKey)
                    );
                    const maxCol = Math.max(
                      editableColumns.indexOf(start.columnKey),
                      editableColumns.indexOf(end.columnKey)
                    );

                    const cellRow = rowIndex;
                    const cellCol = editableColumns.indexOf(columnKey);

                    return (
                      cellRow >= minRow &&
                      cellRow <= maxRow &&
                      cellCol >= minCol &&
                      cellCol <= maxCol
                    );
                  };

                  // Helper to get cell classes
                  const getCellClasses = (columnKey: keyof FlatBet) => {
                    // Use minimal padding to maximize content space
                    const paddingX = columnKey === "name" ? "px-1" : "px-1";
                    const baseClasses = `${paddingX} py-0.5 relative box-border`;
                    const isSelected = isCellSelected(rowIndex, columnKey);
                    const isFocused = isCellFocused(rowIndex, columnKey);
                    const isEditable = isCellEditable(columnKey);
                    const inDragFill = isInDragFillRange(rowIndex, columnKey);

                    let classes = baseClasses;
                    if (inDragFill) {
                      classes += " bg-blue-200 dark:bg-blue-800/50";
                    } else if (isSelected) {
                      classes += " bg-blue-100 dark:bg-blue-900/30";
                    }
                    if (isFocused && isEditable) {
                      classes += " ring-2 ring-blue-500 dark:ring-blue-400";
                    }
                    return classes;
                  };

                  // Get stripe index for this row
                  const stripeIdx = rowStripeIndex.get(rowIndex) || 0;
                  const isEvenStripe = stripeIdx % 2 === 0;
                  const bgClass = isEvenStripe
                    ? "bg-white dark:bg-neutral-900"
                    : "bg-neutral-50 dark:bg-neutral-800/50";

                  return (
                    <tr
                      key={row.id}
                      className={`border-b dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 ${bgClass} ${
                        row._isParlayHeader ? "font-semibold" : ""
                      }`}
                    >
                      <td
                        className={
                          getCellClasses("date") + " whitespace-nowrap"
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {row._isParlayChild && !row._isParlayHeader && (
                            <span className="text-neutral-400 dark:text-neutral-500">
                              ↳
                            </span>
                          )}
                          <span>{formatDate(row.date)}</span>
                        </div>
                      </td>
                      <td
                        className={
                          getCellClasses("site") +
                          " font-bold whitespace-nowrap"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "site", e)}
                      >
                        {isCellFocused(rowIndex, "site") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "site", e)
                            }
                          />
                        )}
                        <EditableCell
                          value={siteShortNameMap[row.site] || row.site}
                          isFocused={isCellFocused(rowIndex, "site")}
                          onFocus={() =>
                            setFocusedCell({ rowIndex, columnKey: "site" })
                          }
                          inputRef={getCellRef(rowIndex, "site")}
                          onSave={(val) => {
                            const book = sportsbooks.find(
                              (b) =>
                                b.name.toLowerCase() === val.toLowerCase() ||
                                b.abbreviation.toLowerCase() ===
                                  val.toLowerCase()
                            );
                            updateBet(row.betId, {
                              book: book ? book.name : val,
                            });
                          }}
                          suggestions={suggestionLists.sites}
                        />
                      </td>
                      <td
                        className={
                          getCellClasses("sport") + " whitespace-nowrap"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "sport", e)}
                      >
                        {isCellFocused(rowIndex, "sport") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "sport", e)
                            }
                          />
                        )}
                        <TypableDropdown
                          value={row.sport}
                          onSave={(val) => {
                            addSport(val);
                            updateBet(row.betId, { sport: val });
                          }}
                          options={suggestionLists.sports}
                          isFocused={isCellFocused(rowIndex, "sport")}
                          onFocus={() =>
                            setFocusedCell({ rowIndex, columnKey: "sport" })
                          }
                          inputRef={getCellRef(rowIndex, "sport")}
                          allowCustom={true}
                        />
                      </td>
                      <td
                        className={getCellClasses("category") + " whitespace-nowrap"}
                        onClick={(e) =>
                          handleCellClick(rowIndex, "category", e)
                        }
                      >
                        {isCellFocused(rowIndex, "category") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "category", e)
                            }
                          />
                        )}
                        <TypableDropdown
                          value={row.category}
                          onSave={(val) => {
                            addCategory(val);
                            updateBet(row.betId, {
                              marketCategory: val as MarketCategory,
                            });
                          }}
                          options={suggestionLists.categories}
                          isFocused={isCellFocused(rowIndex, "category")}
                          onFocus={() =>
                            setFocusedCell({ rowIndex, columnKey: "category" })
                          }
                          inputRef={getCellRef(rowIndex, "category")}
                          allowCustom={true}
                        />
                      </td>
                      <td
                        className={
                          getCellClasses("type") + " capitalize whitespace-nowrap"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "type", e)}
                      >
                        {isCellFocused(rowIndex, "type") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "type", e)
                            }
                          />
                        )}
                        <TypableDropdown
                          value={row.type}
                          onSave={(val) => {
                            if (isLeg) {
                              addBetType(row.sport, val);
                              handleLegUpdate(row.betId, legIndex, {
                                market: val,
                              });
                            } else {
                              // Update bet.type (stat type), NOT betType (bet form)
                              addBetType(row.sport, val);
                              updateBet(row.betId, { type: val });
                            }
                          }}
                          options={
                            isLeg
                              ? suggestionLists.types(row.sport)
                              : suggestionLists.types(row.sport) // Use stat types for single bets too
                          }
                          isFocused={isCellFocused(rowIndex, "type")}
                          onFocus={() =>
                            setFocusedCell({ rowIndex, columnKey: "type" })
                          }
                          inputRef={getCellRef(rowIndex, "type")}
                          allowCustom={true}
                        />
                      </td>
                      <td
                        className={
                          getCellClasses("name") +
                          " font-medium text-neutral-900 dark:text-white pl-2 whitespace-nowrap"
                        }
                        onClick={(e) => {
                          // Parlay header rows toggle expand/collapse (no inline editing)
                          if (row._isParlayHeader && row._parlayGroupId) return;
                          handleCellClick(rowIndex, "name", e);
                        }}
                      >
                        {isCellFocused(rowIndex, "name") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "name", e)
                            }
                          />
                        )}
                        {row._isParlayHeader && row._parlayGroupId ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 text-left w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleParlayExpansion(row._parlayGroupId!);
                            }}
                            title={
                              expandedParlays.has(row._parlayGroupId)
                                ? "Collapse"
                                : "Expand"
                            }
                          >
                            <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                              {row.name}
                            </span>
                            <span className="text-neutral-500 dark:text-neutral-400 select-none">
                              {expandedParlays.has(row._parlayGroupId)
                                ? "▾"
                                : "▸"}
                            </span>
                          </button>
                        ) : row.category === "Main Markets" &&
                          row.type === "Total" ? (
                          // Two side-by-side inputs for totals bets
                          <div className="flex gap-1 min-w-0">
                            <div className="flex-1 min-w-0">
                              <EditableCell
                                value={row.name}
                                isFocused={isCellFocused(rowIndex, "name")}
                                onFocus={() =>
                                  setFocusedCell({
                                    rowIndex,
                                    columnKey: "name",
                                  })
                                }
                                inputRef={getCellRef(rowIndex, "name")}
                                onSave={(val) => {
                                  if (isLeg) {
                                    autoAddEntity(row.sport, val, row.type);
                                    const name2 = row.name2 || "";
                                    handleLegUpdate(row.betId, legIndex, {
                                      entities: name2 ? [val, name2] : [val],
                                    });
                                  } else {
                                    autoAddEntity(row.sport, val, row.type);
                                    const bet = bets.find(
                                      (b) => b.id === row.betId
                                    );
                                    const name2 =
                                      bet?.legs?.[0]?.entities?.[1] ||
                                      row.name2 ||
                                      "";
                                    updateBet(row.betId, {
                                      name: val,
                                      legs: bet?.legs
                                        ? bet.legs.map((leg, idx) =>
                                            idx === 0
                                              ? {
                                                  ...leg,
                                                  entities: name2
                                                    ? [val, name2]
                                                    : [val],
                                                }
                                              : leg
                                          )
                                        : [
                                            {
                                              entities: name2
                                                ? [val, name2]
                                                : [val],
                                              market: bet?.type || "",
                                              result: bet?.result || "pending",
                                            },
                                          ],
                                    });
                                  }
                                }}
                                suggestions={[
                                  ...suggestionLists.players(row.sport),
                                  ...suggestionLists.teams(row.sport),
                                ]}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <EditableCell
                                value={row.name2 || ""}
                                isFocused={isCellFocused(rowIndex, "name2")}
                                onFocus={() =>
                                  setFocusedCell({
                                    rowIndex,
                                    columnKey: "name2",
                                  })
                                }
                                inputRef={getCellRef(rowIndex, "name2")}
                                onSave={(val) => {
                                  if (isLeg) {
                                    autoAddEntity(row.sport, val, row.type);
                                    const name1 = row.name || "";
                                    handleLegUpdate(row.betId, legIndex, {
                                      entities: name1 ? [name1, val] : [val],
                                    });
                                  } else {
                                    autoAddEntity(row.sport, val, row.type);
                                    const bet = bets.find(
                                      (b) => b.id === row.betId
                                    );
                                    const name1 = bet?.name || row.name || "";
                                    updateBet(row.betId, {
                                      legs: bet?.legs
                                        ? bet.legs.map((leg, idx) =>
                                            idx === 0
                                              ? {
                                                  ...leg,
                                                  entities: name1
                                                    ? [name1, val]
                                                    : [val],
                                                }
                                              : leg
                                          )
                                        : [
                                            {
                                              entities: name1
                                                ? [name1, val]
                                                : [val],
                                              market: bet?.type || "",
                                              result: bet?.result || "pending",
                                            },
                                          ],
                                    });
                                  }
                                }}
                                suggestions={[
                                  ...suggestionLists.players(row.sport),
                                  ...suggestionLists.teams(row.sport),
                                ]}
                              />
                            </div>
                          </div>
                        ) : (
                          // Single input for non-totals bets
                          <EditableCell
                            value={row.name}
                            isFocused={isCellFocused(rowIndex, "name")}
                            onFocus={() =>
                              setFocusedCell({ rowIndex, columnKey: "name" })
                            }
                            inputRef={getCellRef(rowIndex, "name")}
                            onSave={(val) => {
                              if (isLeg) {
                                autoAddEntity(row.sport, val, row.type);
                                handleLegUpdate(row.betId, legIndex, {
                                  entities: [val],
                                });
                              } else {
                                // Update bet.name (player/team name), NOT description
                                autoAddEntity(row.sport, val, row.type);
                                updateBet(row.betId, { name: val });
                              }
                            }}
                            suggestions={[
                              ...suggestionLists.players(row.sport),
                              ...suggestionLists.teams(row.sport),
                            ]}
                          />
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("ou") +
                          " text-center whitespace-nowrap"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "ou", e)}
                      >
                        {isCellFocused(rowIndex, "ou") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "ou", e)
                            }
                          />
                        )}
                        <TypableDropdown
                          value={
                            row.ou === "Over"
                              ? "O"
                              : row.ou === "Under"
                              ? "U"
                              : ""
                          }
                          onSave={(val) => {
                            let ouValue: "Over" | "Under" | undefined;
                            if (val === "O" || val.toLowerCase() === "over") {
                              ouValue = "Over";
                            } else if (
                              val === "U" ||
                              val.toLowerCase() === "under"
                            ) {
                              ouValue = "Under";
                            } else {
                              ouValue = undefined;
                            }
                            if (isLeg) {
                              handleLegUpdate(row.betId, legIndex, {
                                ou: ouValue,
                              });
                            } else {
                              updateBet(row.betId, { ou: ouValue });
                            }
                          }}
                          options={["O", "U"]}
                          isFocused={isCellFocused(rowIndex, "ou")}
                          onFocus={() =>
                            setFocusedCell({ rowIndex, columnKey: "ou" })
                          }
                          inputRef={getCellRef(rowIndex, "ou")}
                          allowCustom={false}
                          className="text-center font-semibold"
                        />
                      </td>
                      <td
                        className={
                          getCellClasses("line") +
                          " whitespace-nowrap text-right tabular-nums"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "line", e)}
                      >
                        {isCellFocused(rowIndex, "line") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "line", e)
                            }
                          />
                        )}
                        <EditableCell
                          value={row.line || ""}
                          type="text"
                          isFocused={isCellFocused(rowIndex, "line")}
                          onFocus={() =>
                            setFocusedCell({ rowIndex, columnKey: "line" })
                          }
                          inputRef={getCellRef(rowIndex, "line")}
                          onSave={(val) => {
                            if (isLeg) {
                              handleLegUpdate(row.betId, legIndex, {
                                target: val,
                              });
                            }
                          }}
                          className="text-right tabular-nums"
                        />
                      </td>
                      <td
                        className={
                          getCellClasses("odds") +
                          " whitespace-nowrap text-right tabular-nums"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "odds", e)}
                      >
                        {isCellFocused(rowIndex, "odds") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "odds", e)
                            }
                          />
                        )}
                        {row._isParlayChild && !row._isParlayHeader ? (
                          row.odds !== undefined ? (
                            <EditableCell
                              value={formatOdds(row.odds)}
                              type="number"
                              formatAsOdds={true}
                              isFocused={isCellFocused(rowIndex, "odds")}
                              onFocus={() =>
                                setFocusedCell({ rowIndex, columnKey: "odds" })
                              }
                              inputRef={getCellRef(rowIndex, "odds")}
                              onSave={(val) => {
                                const numVal = parseInt(
                                  val.replace("+", ""),
                                  10
                                );
                                if (!isNaN(numVal) && row._legIndex != null) {
                                  // Update leg odds if this is a parlay child
                                  handleLegUpdate(
                                    row.betId,
                                    row._legIndex - 1,
                                    {
                                      odds: numVal,
                                    }
                                  );
                                }
                              }}
                              className="text-right tabular-nums"
                            />
                          ) : (
                            <span className="text-neutral-300 dark:text-neutral-600">
                              ↳
                            </span>
                          )
                        ) : (
                          <EditableCell
                            value={formatOdds(row.odds)}
                            type="number"
                            formatAsOdds={true}
                            isFocused={isCellFocused(rowIndex, "odds")}
                            onFocus={() =>
                              setFocusedCell({ rowIndex, columnKey: "odds" })
                            }
                            inputRef={getCellRef(rowIndex, "odds")}
                            onSave={(val) => {
                              const numVal = parseInt(val.replace("+", ""), 10);
                              if (!isNaN(numVal)) {
                                // Always update the main bet's odds, which drives the "To Win" calculation.
                                updateBet(row.betId, { odds: numVal });
                              }
                            }}
                            className="text-right tabular-nums"
                          />
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("bet") +
                          " whitespace-nowrap text-right tabular-nums border-l border-neutral-200 dark:border-neutral-700"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "bet", e)}
                      >
                        {isCellFocused(rowIndex, "bet") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "bet", e)
                            }
                          />
                        )}
                        {row._isParlayChild && !row._isParlayHeader ? (
                          <span className="text-neutral-300 dark:text-neutral-600">
                            ↳
                          </span>
                        ) : (
                          <div className="min-w-0">
                            <span className="text-neutral-400">$</span>
                            <span
                              className="inline-block ml-0.5 min-w-0"
                              style={{ width: "6ch" }}
                            >
                              <EditableCell
                                value={row.bet.toFixed(2)}
                                type="number"
                                isFocused={isCellFocused(rowIndex, "bet")}
                                onFocus={() =>
                                  setFocusedCell({ rowIndex, columnKey: "bet" })
                                }
                                inputRef={getCellRef(rowIndex, "bet")}
                                onSave={(val) => {
                                  const numVal = parseFloat(val);
                                  if (!isNaN(numVal))
                                    updateBet(row.betId, { stake: numVal });
                                }}
                                className="text-right tabular-nums"
                              />
                            </span>
                          </div>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("toWin") +
                          " whitespace-nowrap text-right tabular-nums"
                        }
                      >
                        {row._isParlayChild && !row._isParlayHeader ? (
                          <span className="text-neutral-300 dark:text-neutral-600">
                            ↳
                          </span>
                        ) : (
                          `$${row.toWin.toFixed(2)}`
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("result") +
                          " capitalize whitespace-nowrap text-center " +
                          resultBgClass
                        }
                        onClick={(e) => handleCellClick(rowIndex, "result", e)}
                      >
                        <div className={resultTextClass}>
                          <ResultCell
                            value={displayResult}
                            onSave={(val) => {
                              if (isLeg) {
                                handleLegUpdate(row.betId, legIndex, {
                                  result: val,
                                });
                              } else {
                                updateBet(row.betId, { result: val });
                              }
                            }}
                          />
                        </div>
                      </td>
                      <td
                        className={
                          getCellClasses("net") +
                          ` font-bold whitespace-nowrap text-right tabular-nums ${netBgClass} ${netColorClass}`
                        }
                      >
                        {row._isParlayChild && !row._isParlayHeader ? (
                          <span className="text-neutral-300 dark:text-neutral-600">
                            ↳
                          </span>
                        ) : (
                          `${net < 0 ? "-" : ""}$${Math.abs(net).toFixed(2)}`
                        )}
                      </td>
                      <td className={getCellClasses("isLive") + " text-center"}>
                        {row.isLive && (
                          <Wifi
                            className="w-5 h-5 text-primary-500 mx-auto"
                            title="Live Bet"
                          />
                        )}
                      </td>
                      <td
                        className={getCellClasses("tail") + " whitespace-nowrap"}
                        onClick={(e) => handleCellClick(rowIndex, "tail", e)}
                      >
                        {isCellFocused(rowIndex, "tail") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "tail", e)
                            }
                          />
                        )}
                        <EditableCell
                          value={row.tail || ""}
                          isFocused={isCellFocused(rowIndex, "tail")}
                          onFocus={() =>
                            setFocusedCell({ rowIndex, columnKey: "tail" })
                          }
                          inputRef={getCellRef(rowIndex, "tail")}
                          onSave={(newValue) => {
                            updateBet(row.betId, { tail: newValue });
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BetTableView;
