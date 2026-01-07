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
import { abbreviateMarket, normalizeCategoryForDisplay } from "../services/marketClassification";
import { formatDateShort, formatOdds, formatCurrency } from "../utils/formatters";
import { createBetTableFilterPredicate } from "../utils/filterPredicates";
import { useDebouncedValue } from "../hooks/useDebouncedValue";

// --- Fixed column widths (deterministic spreadsheet layout) ---
const COL_W: Record<string, string> = {
  rowSelector: "1.5ch", // Row selection column (narrow)
  date: "5ch",
  site: "4ch",
  sport: "5ch",
  category: "7ch",
  type: "8ch",
  name: "20ch",
  ou: "3ch",
  line: "7ch",
  odds: "7ch",
  bet: "10ch",
  toWin: "10ch",
  result: "6ch",
  net: "9ch",
  isLive: "4ch",
  tail: "7ch",
};

// Fields that support bulk apply (categorical/text fields)
const BULK_APPLY_COLUMNS: readonly (keyof FlatBet)[] = [
  "site",
  "sport",
  "category",
  "type",
  "isLive",
  "tail",
  "result",
] as const;

// Fields that can be cleared via bulk clear modal
const CLEARABLE_FIELDS: readonly string[] = [
  "site",
  "sport",
  "category",
  "type",
  "name",
  "ou",
  "line",
  "odds",
  "bet",
  "result",
  "isLive",
  "tail",
] as const;

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

// NOTE: formatDate moved to utils/formatters.ts as formatDateShort

// NOTE: abbreviateMarket and normalizeCategoryForDisplay have been moved to 
// services/marketClassification.ts for centralization.
// Import normalizeCategoryForDisplay and abbreviateMarket from there instead.

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
        className={`bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800 rounded text-sm max-w-full min-w-0 ${className}`}
        style={{ boxSizing: "border-box", maxWidth: "100%", minWidth: 0 }}
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
      className="bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none capitalize font-semibold rounded max-w-full min-w-0"
      style={{ boxSizing: "border-box", maxWidth: "100%", minWidth: 0 }}
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
        className={`bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800 rounded text-sm max-w-full min-w-0 ${className}`}
        style={{ boxSizing: "border-box", maxWidth: "100%", minWidth: 0 }}
        placeholder={placeholder}
      />
      {isOpen && filteredOptions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-max min-w-full mt-1 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 max-h-60 overflow-y-auto"
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
  const { bets, loading, updateBet, createManualBet, batchCreateManualBets, insertBetAt, duplicateBets, batchDuplicateBets, bulkUpdateBets, deleteBets, undoLastAction, canUndo, lastUndoLabel, pushUndoSnapshot } = useBets();
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
    tails,
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
  } | null>({ key: "date", direction: "asc" });

  // Consolidate categories for display: remove SGP/SGP+ as they are covered by Parlays
  // Consolidate categories for display: remove SGP/SGP+ as they are covered by Parlays
  const displayCategories = useMemo(() => {
    return categories.filter((c) => {
      const lower = c.toLowerCase();
      // "Parlays" is the canonical category for all these
      return (
        lower !== "sgp" &&
        lower !== "sgp+" &&
        lower !== "sgp_plus" &&
        lower !== "sgp/sgp+"
      );
    });
  }, [categories]);

  // Spreadsheet state management
  const [focusedCell, setFocusedCell] = useState<CellCoordinate | null>(null);
  const [selectionRange, setSelectionRange] = useState<SelectionRange>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<CellCoordinate | null>(
    null
  );
  const [dragFillData, setDragFillData] = useState<{
    start: CellCoordinate;
    end: CellCoordinate;
  } | null>(null);
  const [expandedParlays, setExpandedParlays] = useState<Set<string>>(() => {
    // Load from localStorage or default to all expanded
    const saved = localStorage.getItem("bettracker-expanded-parlays");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Row selection state (Phase 1)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [rowSelectionAnchorId, setRowSelectionAnchorId] = useState<string | null>(null);
  const [showClearFieldsModal, setShowClearFieldsModal] = useState(false);
  const [fieldsToToggle, setFieldsToToggle] = useState<Set<string>>(new Set());

  // Phase 1.1: Batch count for Add and Duplicate
  const [batchCount, setBatchCount] = useState<number>(1);

  // Phase 1.1: Delete confirmation state
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);
  const cellRefs = useRef<Map<string, React.RefObject<HTMLInputElement>>>(
    new Map()
  );

  // Debounce search term (200ms delay) - P2-4
  const debouncedSearchTerm = useDebouncedValue(searchTerm, 200);

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

        // Use raw numeric values when available, fall back to string parsing for backwards compatibility
        const betAmount =
          finalRow._rawBet !== undefined
            ? finalRow._rawBet
            : finalRow.Bet
            ? (parseFloat(finalRow.Bet) || 0)
            : 0;
        const toWinAmount =
          finalRow._rawToWin !== undefined
            ? finalRow._rawToWin
            : finalRow["To Win"]
            ? (parseFloat(finalRow["To Win"]) || 0)
            : 0;
        const netAmount =
          finalRow._rawNet !== undefined
            ? finalRow._rawNet
            : finalRow.Net
            ? (parseFloat(finalRow.Net) || 0)
            : 0;
        const oddsValue =
          finalRow._rawOdds !== undefined
            ? finalRow._rawOdds
            : finalRow.Odds
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

  // Abbreviated types for display in dropdown
  const abbreviatedTypes = useMemo(() => {
    const types = availableTypes.map((type) => abbreviateMarket(type));
    return types;
  }, [availableTypes]);

  // Abbreviated types by sport for dropdown options
  const getAbbreviatedTypesForSport = useCallback(
    (sport: string) => {
      const types = betTypes[sport] || [];
      return types.map((type) => abbreviateMarket(type));
    },
    [betTypes]
  );

  const availableSites = useMemo(
    () => sportsbooks.map((b) => b.abbreviation).sort(),
    [sportsbooks]
  );
  // Create a reverse map from abbreviation to full name for saving
  const typeAbbreviationToFull = useMemo(() => {
    const map: Record<string, string> = {};
    Object.values(betTypes)
      .flat()
      .forEach((type) => {
        const abbrev = abbreviateMarket(type);
        map[abbrev.toLowerCase()] = type;
      });
    return map;
  }, [betTypes]);

  const suggestionLists = useMemo(
    () => ({
      sports: sports,
      sites: availableSites,
      categories: displayCategories,
      types: (sport: string) => {
        const types = betTypes[sport] || [];
        return types.map((type) => abbreviateMarket(type));
      },
      players: (sport: string) => players[sport] || [],
      teams: (sport: string) => teams[sport] || [],
    }),
    [sports, availableSites, displayCategories, betTypes, players, teams]
  );

  const tailOptions = useMemo(() => {
    return tails.map((t) => t.displayName).sort();
  }, [tails]);

  const filteredBets = useMemo(() => {
    const tablePredicate = createBetTableFilterPredicate(filters, debouncedSearchTerm, ['name', 'name2', 'sport', 'type', 'category', 'tail']);
    return flattenedBets.filter(tablePredicate);
  }, [flattenedBets, filters, debouncedSearchTerm]);

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
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded p-1 py-0.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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
      style: { whiteSpace: "nowrap" },
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

  // NOTE: formatOdds is now imported from utils/formatters.ts

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

  // Helper: Check if a row is selected
  const isRowSelected = useCallback(
    (rowId: string): boolean => {
      return selectedRowIds.has(rowId);
    },
    [selectedRowIds]
  );

  // Row selector click handler
  const handleRowSelectorClick = useCallback(
    (betId: string, rowIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.shiftKey && rowSelectionAnchorId) {
        // Shift-click: select range between anchor and current
        const anchorIndex = visibleBets.findIndex(
          (b) => b.betId === rowSelectionAnchorId
        );
        if (anchorIndex !== -1) {
          const minIdx = Math.min(anchorIndex, rowIndex);
          const maxIdx = Math.max(anchorIndex, rowIndex);
          const newSelection = new Set<string>();
          for (let i = minIdx; i <= maxIdx; i++) {
            newSelection.add(visibleBets[i].betId);
          }
          setSelectedRowIds(newSelection);
        }
      } else if (e.metaKey || e.ctrlKey) {
        // Cmd/Ctrl-click: toggle row selection
        setSelectedRowIds((prev) => {
          const newSelection = new Set(prev);
          if (newSelection.has(betId)) {
            newSelection.delete(betId);
          } else {
            newSelection.add(betId);
          }
          return newSelection;
        });
        setRowSelectionAnchorId(betId);
      } else {
        // Regular click: toggle if already selected, otherwise select
        if (selectedRowIds.has(betId) && selectedRowIds.size === 1) {
          // Clicking on the only selected row deselects it
          setSelectedRowIds(new Set());
          setRowSelectionAnchorId(null);
        } else {
          // Select only this row
          setSelectedRowIds(new Set([betId]));
          setRowSelectionAnchorId(betId);
        }
      }
    },
    [rowSelectionAnchorId, visibleBets, selectedRowIds]
  );

  // Handle duplicate rows (Cmd/Ctrl+D)
  const handleDuplicateRows = useCallback((multiplier: number = 1) => {
    const idsToClone = selectedRowIds.size > 0 
      ? Array.from(selectedRowIds) 
      : focusedCell ? [visibleBets[focusedCell.rowIndex]?.betId].filter(Boolean) 
      : [];
    
    if (idsToClone.length === 0) return;
    
    const newIds = multiplier === 1
      ? duplicateBets(idsToClone)
      : batchDuplicateBets(idsToClone, multiplier);
    
    setSelectedRowIds(new Set(newIds));
    setTimeout(() => {
      const idx = visibleBets.findIndex(b => b.betId === newIds[0]);
      setFocusedCell({ rowIndex: idx >= 0 ? idx : 0, columnKey: "site" });
    }, 50);
  }, [selectedRowIds, focusedCell, visibleBets, duplicateBets, batchDuplicateBets]);

  // Handle bulk apply value (Cmd/Ctrl+Enter)
  const handleBulkApplyValue = useCallback(() => {
    if (selectedRowIds.size === 0 || !focusedCell) return;

    const row = visibleBets[focusedCell.rowIndex];
    if (!row) return;

    const columnKey = focusedCell.columnKey;
    const value = row[columnKey];

    // Only allow bulk apply for safe categorical/text fields
    if (!BULK_APPLY_COLUMNS.includes(columnKey)) {
      console.warn(`Bulk apply not supported for column: ${columnKey}`);
      return;
    }

    // Build updates for all selected rows
    const updatesById: Record<string, Partial<Bet>> = {};

    selectedRowIds.forEach((betId) => {
      switch (columnKey) {
        case "site":
          const book = sportsbooks.find(
            (b) =>
              b.name.toLowerCase() === String(value).toLowerCase() ||
              b.abbreviation.toLowerCase() === String(value).toLowerCase()
          );
          updatesById[betId] = { book: book ? book.name : String(value) };
          break;
        case "sport":
          updatesById[betId] = { sport: String(value) };
          break;
        case "category":
          updatesById[betId] = { marketCategory: value as MarketCategory };
          break;
        case "type":
          updatesById[betId] = { type: String(value) };
          break;
        case "isLive":
          updatesById[betId] = { isLive: Boolean(value) };
          break;
        case "tail":
          updatesById[betId] = { tail: String(value) || undefined };
          break;
        case "result":
          updatesById[betId] = { result: value as BetResult };
          break;
      }
    });

    bulkUpdateBets(updatesById, "Bulk Apply");
  }, [selectedRowIds, focusedCell, visibleBets, sportsbooks, bulkUpdateBets]);

  // Handle bulk clear fields
  const handleBulkClearFields = useCallback(() => {
    if (selectedRowIds.size === 0 || fieldsToToggle.size === 0) return;

    const updatesById: Record<string, Partial<Bet>> = {};

    selectedRowIds.forEach((betId) => {
      const updates: Partial<Bet> = {};

      fieldsToToggle.forEach((field) => {
        switch (field) {
          case "site":
            updates.book = "";
            break;
          case "sport":
            updates.sport = "";
            break;
          case "category":
            updates.marketCategory = "Props";
            break;
          case "type":
            updates.type = "";
            break;
          case "name":
            updates.name = "";
            updates.description = "";
            break;
          case "ou":
            updates.ou = undefined;
            break;
          case "line":
            updates.line = "";
            break;
          case "odds":
            updates.odds = null;
            break;
          case "bet":
            updates.stake = 0;
            break;
          case "result":
            updates.result = "pending";
            break;
          case "isLive":
            updates.isLive = false;
            break;
          case "tail":
            updates.tail = "";
            break;
        }
      });

      updatesById[betId] = updates;
    });

    bulkUpdateBets(updatesById, `Clear Fields (${selectedRowIds.size})`);
    setShowClearFieldsModal(false);
    setFieldsToToggle(new Set());
  }, [selectedRowIds, fieldsToToggle, bulkUpdateBets]);

  // Handle delete selected rows
  const handleDeleteRows = useCallback(() => {
    let betIdsToDelete: string[] = [];

    if (selectedRowIds.size > 0) {
      betIdsToDelete = Array.from(selectedRowIds);
    } else if (focusedCell) {
      // Delete the row containing the focused cell
      const row = visibleBets[focusedCell.rowIndex];
      if (row) {
        betIdsToDelete = [row.betId];
      }
    }

    if (betIdsToDelete.length > 0) {
      // Set up confirmation
      setPendingDeleteIds(betIdsToDelete);
      setShowDeleteConfirm(true);
    }
  }, [selectedRowIds, focusedCell, visibleBets]);

  // Confirm delete
  const handleConfirmDelete = useCallback(() => {
    if (!pendingDeleteIds || pendingDeleteIds.length === 0) return;
    
    // Build a Set for O(1) lookup of delete IDs
    const deleteIdSet = new Set(pendingDeleteIds);
    
    // Find next row to focus after deletion
    let nextFocusRowIndex = -1;
    if (focusedCell) {
      const currentRowBetId = visibleBets[focusedCell.rowIndex]?.betId;
      if (currentRowBetId && deleteIdSet.has(currentRowBetId)) {
        // Count deletions before each index for offset calculation
        let deletedBefore = 0;
        
        // Find next row that won't be deleted
        for (let i = focusedCell.rowIndex + 1; i < visibleBets.length; i++) {
          if (deleteIdSet.has(visibleBets[i].betId)) {
            deletedBefore++;
          } else {
            // Calculate adjusted index by subtracting deleted rows before this point
            nextFocusRowIndex = i - deletedBefore - 1; // -1 for the current row being deleted
            break;
          }
        }
        // If no next row, try previous
        if (nextFocusRowIndex === -1) {
          for (let i = focusedCell.rowIndex - 1; i >= 0; i--) {
            if (!deleteIdSet.has(visibleBets[i].betId)) {
              nextFocusRowIndex = i;
              break;
            }
          }
        }
      }
    }
    
    deleteBets(pendingDeleteIds);
    setSelectedRowIds(new Set());
    setPendingDeleteIds(null);
    setShowDeleteConfirm(false);
    
    // Focus nearby row
    if (nextFocusRowIndex >= 0) {
      setTimeout(() => {
        setFocusedCell({ rowIndex: nextFocusRowIndex, columnKey: "site" });
      }, 50);
    } else {
      setFocusedCell(null);
    }
  }, [pendingDeleteIds, focusedCell, visibleBets, deleteBets]);

  // Cancel delete
  const handleCancelDelete = useCallback(() => {
    setPendingDeleteIds(null);
    setShowDeleteConfirm(false);
  }, []);

  // Handle add manual bet
  const handleAddManualBet = useCallback((count: number = 1) => {
    const newIds = count === 1 
      ? [createManualBet()]
      : batchCreateManualBets(count);
    
    setSelectedRowIds(new Set(newIds));
    setTimeout(() => {
      const idx = visibleBets.findIndex(b => b.betId === newIds[0]);
      setFocusedCell({ rowIndex: idx >= 0 ? idx : visibleBets.length - count, columnKey: "site" });
    }, 50);
  }, [createManualBet, batchCreateManualBets, visibleBets]);

  // Handle insert row above selected/focused row
  const handleInsertRowAbove = useCallback(() => {
    // Get reference bet ID from selection or focused cell
    let referenceBetId: string | null = null;
    
    if (selectedRowIds.size > 0) {
      // Use first selected row
      referenceBetId = Array.from(selectedRowIds)[0];
    } else if (focusedCell) {
      const row = visibleBets[focusedCell.rowIndex];
      if (row) referenceBetId = row.betId;
    }
    
    if (!referenceBetId) return;
    
    const newId = insertBetAt(referenceBetId, 'above');
    if (newId) {
      setSelectedRowIds(new Set([newId]));
      setTimeout(() => {
        const idx = visibleBets.findIndex(b => b.betId === newId);
        // New row should appear at the current focused row's position (pushing old row down)
        setFocusedCell({ rowIndex: idx >= 0 ? idx : 0, columnKey: "site" });
      }, 50);
    }
  }, [selectedRowIds, focusedCell, visibleBets, insertBetAt]);

  // Handle insert row below selected/focused row
  const handleInsertRowBelow = useCallback(() => {
    // Get reference bet ID from selection or focused cell
    let referenceBetId: string | null = null;
    
    if (selectedRowIds.size > 0) {
      // Use last selected row (to insert after the selection)
      const selectedArray = Array.from(selectedRowIds);
      referenceBetId = selectedArray[selectedArray.length - 1];
    } else if (focusedCell) {
      const row = visibleBets[focusedCell.rowIndex];
      if (row) referenceBetId = row.betId;
    }
    
    if (!referenceBetId) return;
    
    const newId = insertBetAt(referenceBetId, 'below');
    if (newId) {
      setSelectedRowIds(new Set([newId]));
      setTimeout(() => {
        const idx = visibleBets.findIndex(b => b.betId === newId);
        // Focus the newly inserted row
        setFocusedCell({ rowIndex: idx >= 0 ? idx : 0, columnKey: "site" });
      }, 50);
    }
  }, [selectedRowIds, focusedCell, visibleBets, insertBetAt]);

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

      // Handle duplicate (Ctrl+D or Cmd+D)
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handleDuplicateRows(batchCount);
        return;
      }

      // Handle undo (Ctrl+Z or Cmd+Z)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoLastAction();
        return;
      }

      // Handle insert row below (Ctrl+I or Cmd+I) - default insert action
      if ((e.ctrlKey || e.metaKey) && e.key === "i" && !e.shiftKey) {
        e.preventDefault();
        handleInsertRowAbove();
        return;
      }

      // Handle insert row above (Ctrl+Shift+I or Cmd+Shift+I)
      if ((e.ctrlKey || e.metaKey) && e.key === "I" && e.shiftKey) {
        e.preventDefault();
        handleInsertRowBelow();
        return;
      }

      // Handle bulk apply value (Ctrl+Enter or Cmd+Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleBulkApplyValue();
        return;
      }

      // Handle delete (Delete or Backspace when not typing in an input)
      if ((e.key === "Delete" || e.key === "Backspace") && !(target instanceof HTMLInputElement)) {
        e.preventDefault();
        handleDeleteRows();
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
    [focusedCell, navigateToCell, editableColumns, visibleBets.length, handleDuplicateRows, handleBulkApplyValue, handleDeleteRows, undoLastAction, batchCount, handleInsertRowAbove, handleInsertRowBelow]
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
          const stakeVal = parseFloat(value.replace(/[$,]/g, ""));
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
    <div className="p-4 h-full flex flex-col space-y-3 bg-neutral-100 dark:bg-neutral-950">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <h1 className="text-lg font-bold text-neutral-900 dark:text-white whitespace-nowrap shrink-0">
          Bet Table
        </h1>

        <div className="flex-grow flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-neutral-900 p-1.5 px-3 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-800">
          <div className="relative flex-grow w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-sm placeholder-neutral-400 p-0"
            />
          </div>

          <div className="hidden sm:block w-px h-5 bg-neutral-200 dark:bg-neutral-700"></div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar">
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
              label="Cat"
              value={filters.category}
              onChange={(e) =>
                setFilters({ ...filters, category: e.target.value as any })
              }
              options={displayCategories}
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
      </div>

      {/* Actions row: Add Bet button + Batch count + Selected row actions + Undo */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Add Bet with batch count */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleAddManualBet(batchCount)}
            className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors flex items-center gap-1"
          >
            <span className="text-lg leading-none">+</span>
            <span>Add Bet</span>
          </button>
          <input
            type="number"
            min={1}
            max={100}
            value={batchCount}
            onChange={(e) => setBatchCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
            className="w-12 px-1 py-1 text-xs text-center bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            title="Number of rows to add/duplicate"
          />
        </div>

        {/* Undo button */}
        {canUndo && (
          <button
            type="button"
            onClick={undoLastAction}
            className="px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded border border-neutral-300 dark:border-neutral-600 transition-colors"
            title={`Undo: ${lastUndoLabel || 'Last action'} (Cmd/Ctrl+Z)`}
          >
            ↩ Undo{lastUndoLabel ? ` (${lastUndoLabel})` : ''}
          </button>
        )}

        {selectedRowIds.size > 0 && (
          <>
            <div className="h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {selectedRowIds.size} row{selectedRowIds.size !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={handleInsertRowAbove}
              className="px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded border border-neutral-300 dark:border-neutral-600 transition-colors"
              title="Insert row above (Cmd/Ctrl+Shift+I)"
            >
              ↑ Insert Above
            </button>
            <button
              type="button"
              onClick={handleInsertRowBelow}
              className="px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded border border-neutral-300 dark:border-neutral-600 transition-colors"
              title="Insert row below (Cmd/Ctrl+I)"
            >
              ↓ Insert Below
            </button>
            <button
              type="button"
              onClick={() => handleDuplicateRows(batchCount)}
              className="px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded border border-neutral-300 dark:border-neutral-600 transition-colors"
              title={`Duplicate selected rows ×${batchCount} (Cmd/Ctrl+D)`}
            >
              Duplicate{batchCount > 1 ? ` ×${batchCount}` : ''}
            </button>
            <button
              type="button"
              onClick={() => setShowClearFieldsModal(true)}
              className="px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded border border-neutral-300 dark:border-neutral-600 transition-colors"
              title="Clear selected fields"
            >
              Clear Fields…
            </button>
            <button
              type="button"
              onClick={handleDeleteRows}
              className="px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded border border-red-300 dark:border-red-700 transition-colors"
              title="Delete selected rows (Delete/Backspace)"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedRowIds(new Set())}
              className="px-2 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              title="Deselect all"
            >
              ✕ Clear selection
            </button>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && pendingDeleteIds && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 border border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-semibold mb-3 text-neutral-900 dark:text-white">
              Delete {pendingDeleteIds.length} bet{pendingDeleteIds.length !== 1 ? "s" : ""}?
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
              This action can be undone with Cmd/Ctrl+Z.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Fields Modal */}
      {showClearFieldsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl p-4 max-w-sm w-full mx-4 border border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-semibold mb-3 text-neutral-900 dark:text-white">
              Clear Fields
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
              Select fields to clear for {selectedRowIds.size} selected row{selectedRowIds.size !== 1 ? "s" : ""}:
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {CLEARABLE_FIELDS.map(
                (field) => (
                  <label
                    key={field}
                    className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300"
                  >
                    <input
                      type="checkbox"
                      checked={fieldsToToggle.has(field)}
                      onChange={(e) => {
                        const newFields = new Set(fieldsToToggle);
                        if (e.target.checked) {
                          newFields.add(field);
                        } else {
                          newFields.delete(field);
                        }
                        setFieldsToToggle(newFields);
                      }}
                      className="rounded border-neutral-300 dark:border-neutral-600"
                    />
                    <span className="capitalize">{field === "ou" ? "O/U" : field}</span>
                  </label>
                )
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowClearFieldsModal(false);
                  setFieldsToToggle(new Set());
                }}
                className="px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkClearFields}
                disabled={fieldsToToggle.size === 0}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-neutral-400 disabled:cursor-not-allowed rounded transition-colors"
              >
                Clear Selected
              </button>
            </div>
          </div>
        </div>
      )}

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
              <col style={{ width: COL_W.rowSelector }} />
              {headers.map((header) => (
                <col
                  key={header.key}
                  style={{ width: COL_W[header.key] || "10ch" }}
                />
              ))}
            </colgroup>
            <thead className="text-xs font-semibold tracking-wide text-neutral-700 uppercase bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 sticky top-0 z-10 border-b border-neutral-300 dark:border-neutral-700">
              <tr className="leading-tight">
                <th
                  scope="col"
                  className="px-0.5 py-1 border-r border-neutral-300 dark:border-neutral-700 text-center"
                  style={{ width: COL_W.rowSelector }}
                >
                  {/* Empty header for row selector */}
                </th>
                {headers.map((header, index) => {
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
                  const isLastColumn = index === headers.length - 1;
                  return (
                    <th
                      key={header.key}
                      scope="col"
                      className={`${headerPaddingX} py-1 relative whitespace-nowrap${alignmentClass}${
                        isMoneyBlockStart
                          ? " border-l border-neutral-300 dark:border-neutral-700"
                          : ""
                      }${
                        !isLastColumn
                          ? " border-r border-neutral-300 dark:border-neutral-700"
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
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={headers.length + 1} className="text-center p-8">
                    Loading bets...
                  </td>
                </tr>
              ) : visibleBets.length === 0 ? (
                <tr>
                  <td colSpan={headers.length + 1} className="text-center p-8">
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
                    const isLastColumn =
                      headers[headers.length - 1]?.key === columnKey;

                    let classes = baseClasses;
                    if (inDragFill) {
                      classes += " bg-blue-200 dark:bg-blue-800/50";
                    } else if (isSelected) {
                      classes += " bg-blue-100 dark:bg-blue-900/30";
                    }
                    if (isFocused && isEditable) {
                      classes += " ring-2 ring-blue-500 dark:ring-blue-400";
                    }
                    if (!isLastColumn) {
                      classes +=
                        " border-r border-neutral-300 dark:border-neutral-700";
                    }
                    return classes;
                  };

                  // Get stripe index for this row
                  const stripeIdx = rowStripeIndex.get(rowIndex) || 0;
                  const isEvenStripe = stripeIdx % 2 === 0;
                  const bgClass = isEvenStripe
                    ? "bg-white dark:bg-neutral-900"
                    : "bg-neutral-200 dark:bg-neutral-800/50";

                  // Check if this row is selected
                  const rowIsSelected = isRowSelected(row.betId);

                  return (
                    <tr
                      key={row.id}
                      className={`border-b dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 ${bgClass} ${
                        row._isParlayHeader ? "font-semibold" : ""
                      } ${rowIsSelected ? "!bg-blue-100 dark:!bg-blue-900/30" : ""}`}
                    >
                      {/* Row selector cell */}
                      <td
                        className="px-0.5 py-0.5 text-center border-r border-neutral-300 dark:border-neutral-700 cursor-pointer select-none hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={(e) => handleRowSelectorClick(row.betId, rowIndex, e)}
                        title={rowIsSelected ? "Click to deselect (Cmd/Ctrl+click to toggle)" : "Click to select (Shift+click for range)"}
                      >
                        {rowIsSelected ? (
                          <span className="text-blue-600 dark:text-blue-400 text-xs">✓</span>
                        ) : (
                          <span className="text-neutral-300 dark:text-neutral-600 text-xs opacity-0 group-hover:opacity-100">◦</span>
                        )}
                        {/* Insert buttons - appear on hover when row is selected */}
                        {rowIsSelected && (
                          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInsertRowBelow();
                              }}
                              className="w-5 h-4 flex items-center justify-center text-[10px] font-bold text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 rounded border border-neutral-300 dark:border-neutral-600 shadow-sm transition-colors"
                              title="Insert row above (⌘/Ctrl+Shift+I)"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInsertRowAbove();
                              }}
                              className="w-5 h-4 flex items-center justify-center text-[10px] font-bold text-neutral-600 dark:text-neutral-400 bg-white dark:bg-neutral-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-600 dark:hover:text-blue-400 rounded border border-neutral-300 dark:border-neutral-600 shadow-sm transition-colors"
                              title="Insert row below (⌘/Ctrl+I)"
                            >
                              ↓
                            </button>
                          </div>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("date") + " whitespace-nowrap min-w-0"
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {row._isParlayChild && !row._isParlayHeader && (
                            <span className="text-neutral-400 dark:text-neutral-500">
                              ↳
                            </span>
                          )}
                          <span className="min-w-0">
                            {!row._isParlayChild || row._isParlayHeader
                              ? formatDateShort(row.date)
                              : ""}
                          </span>
                        </div>
                      </td>
                      <td
                        className={
                          getCellClasses("site") +
                          " font-bold whitespace-nowrap min-w-0"
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
                        <TypableDropdown
                          value={
                            !row._isParlayChild || row._isParlayHeader
                              ? siteShortNameMap[row.site] || row.site
                              : ""
                          }
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
                          options={suggestionLists.sites}
                          allowCustom={true}
                        />
                      </td>
                      <td
                        className={
                          getCellClasses("sport") + " whitespace-nowrap min-w-0"
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
                        className={
                          getCellClasses("category") +
                          " whitespace-nowrap min-w-0"
                        }
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
                          value={normalizeCategoryForDisplay(row.category)}
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
                          getCellClasses("type") +
                          " capitalize whitespace-nowrap min-w-0"
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
                          value={abbreviateMarket(row.type)}
                          onSave={(val) => {
                            // Convert abbreviation back to full name if it exists
                            const fullName =
                              typeAbbreviationToFull[val.toLowerCase()] || val;
                            if (isLeg) {
                              addBetType(row.sport, fullName);
                              handleLegUpdate(row.betId, legIndex, {
                                market: fullName,
                              });
                            } else {
                              // Update bet.type (stat type), NOT betType (bet form)
                              addBetType(row.sport, fullName);
                              updateBet(row.betId, { type: fullName });
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
                          " font-medium text-neutral-900 dark:text-white pl-2 whitespace-nowrap min-w-0"
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
                            className="flex items-center gap-1 text-left w-full min-w-0"
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
                            <span className="whitespace-nowrap min-w-0">
                              {row.name}
                            </span>
                            <span className="text-neutral-500 dark:text-neutral-400 select-none">
                              {expandedParlays.has(row._parlayGroupId)
                                ? "▾"
                                : "▸"}
                            </span>
                          </button>
                        ) : (row.category === "Main Markets" ||
                            row.category === "Main") &&
                          row.type === "Total" ? (
                          // Compact inline display for totals bets: "Team1 / Team2"
                          <span
                            className="whitespace-nowrap cursor-text hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded"
                            onClick={() =>
                              setFocusedCell({
                                rowIndex,
                                columnKey: "name",
                              })
                            }
                          >
                            {isCellFocused(rowIndex, "name") ||
                            isCellFocused(rowIndex, "name2") ? (
                              // Edit mode: show two inline inputs
                              <span className="inline-flex items-center gap-0.5">
                                <input
                                  ref={getCellRef(rowIndex, "name")}
                                  type="text"
                                  defaultValue={row.name || ""}
                                  className="bg-neutral-100 dark:bg-neutral-800 border-none focus:ring-0 focus:outline-none rounded text-sm p-0"
                                  style={{
                                    width: `${Math.max(
                                      (row.name?.length || 4) + 1,
                                      4
                                    )}ch`,
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val !== row.name) {
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
                                                result:
                                                  bet?.result || "pending",
                                              },
                                            ],
                                      });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" ||
                                      e.key === "Escape"
                                    ) {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  autoFocus={isCellFocused(rowIndex, "name")}
                                />
                                <span className="text-neutral-400 dark:text-neutral-500">
                                  /
                                </span>
                                <input
                                  ref={getCellRef(rowIndex, "name2")}
                                  type="text"
                                  defaultValue={row.name2 || ""}
                                  className="bg-neutral-100 dark:bg-neutral-800 border-none focus:ring-0 focus:outline-none rounded text-sm p-0"
                                  style={{
                                    width: `${Math.max(
                                      (row.name2?.length || 4) + 1,
                                      4
                                    )}ch`,
                                  }}
                                  onBlur={(e) => {
                                    const val = e.target.value;
                                    if (val !== row.name2) {
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
                                                result:
                                                  bet?.result || "pending",
                                              },
                                            ],
                                      });
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (
                                      e.key === "Enter" ||
                                      e.key === "Escape"
                                    ) {
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                  autoFocus={isCellFocused(rowIndex, "name2")}
                                />
                              </span>
                            ) : (
                              // Display mode: "Team1 / Team2"
                              <>
                                {row.name || "—"}
                                <span className="text-neutral-400 dark:text-neutral-500 mx-0.5">
                                  /
                                </span>
                                {row.name2 || "—"}
                              </>
                            )}
                          </span>
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
                          " text-center whitespace-nowrap min-w-0"
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
                          " whitespace-nowrap text-right tabular-nums min-w-0"
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
                          " whitespace-nowrap text-right tabular-nums min-w-0"
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
                          " whitespace-nowrap text-right tabular-nums border-l border-neutral-200 dark:border-neutral-700 min-w-0"
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
                          <EditableCell
                            value={formatCurrency(row.bet)}
                            type="number"
                            isFocused={isCellFocused(rowIndex, "bet")}
                            onFocus={() =>
                              setFocusedCell({
                                rowIndex,
                                columnKey: "bet",
                              })
                            }
                            inputRef={getCellRef(rowIndex, "bet")}
                            onSave={(val) => {
                              const numVal = parseFloat(val.replace(/[$,]/g, ""));
                              if (!isNaN(numVal))
                                updateBet(row.betId, { stake: numVal });
                            }}
                            className="text-right tabular-nums"
                          />
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("toWin") +
                          " whitespace-nowrap text-right tabular-nums min-w-0"
                        }
                      >
                        {row._isParlayChild && !row._isParlayHeader ? (
                          <span className="text-neutral-300 dark:text-neutral-600">
                            ↳
                          </span>
                        ) : (
                           formatCurrency(row.toWin)
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("result") +
                          " capitalize whitespace-nowrap text-center min-w-0 " +
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
                          ` font-bold whitespace-nowrap text-right tabular-nums min-w-0 ${netBgClass} ${netColorClass}`
                        }
                      >
                        {row._isParlayChild && !row._isParlayHeader ? (
                          <span className="text-neutral-300 dark:text-neutral-600">
                            ↳
                          </span>
                        ) : (
                           formatCurrency(net)
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("isLive") +
                          " text-center whitespace-nowrap min-w-0 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        }
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent row selection if needed
                          // Toggle isLive
                          updateBet(row.betId, { isLive: !row.isLive });
                        }}
                      >
                        {row.isLive ? (
                          <Wifi
                            className="w-5 h-5 text-primary-500 mx-auto"
                            title="Live Bet"
                          />
                        ) : (
                          // Empty placeholder to maintain cell height/clickability
                          <div className="w-5 h-5 mx-auto" />
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("tail") + " whitespace-nowrap min-w-0"
                        }
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
                        <TypableDropdown
                          value={row.tail || ""}
                          isFocused={isCellFocused(rowIndex, "tail")}
                          onFocus={() =>
                            setFocusedCell({ rowIndex, columnKey: "tail" })
                          }
                          inputRef={getCellRef(rowIndex, "tail")}
                          onSave={(newValue) => {
                            updateBet(row.betId, { tail: newValue });
                          }}
                          options={tailOptions}
                          allowCustom={true}
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
