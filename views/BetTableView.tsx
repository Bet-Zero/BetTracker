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
import { Wifi, AlertTriangle, HelpCircle } from "../components/icons";
import { calculateProfit } from "../utils/betCalculations";
import { betToFinalRows } from "../parsing/shared/betToFinalRows";
import {
  abbreviateMarket,
  normalizeCategoryForDisplay,
} from "../services/marketClassification";
import {
  MAIN_MARKET_TYPES,
  FUTURES_TYPES,
} from "../services/marketClassification.config";
import {
  formatDateShort,
  formatOdds,
  formatCurrency,
  parseDateInput,
} from "../utils/formatters";
import { createBetTableFilterPredicate } from "../utils/filterPredicates";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  addToUnresolvedQueue,
  generateUnresolvedItemId,
  removeFromUnresolvedQueue,
} from "../services/unresolvedQueue";
import { resolvePlayer, resolveTeamForSport, resolveBetType } from "../services/resolver";
import { getReferenceDataSnapshot } from "../services/normalizationService";
import type {
  UnresolvedEntityType,
  UnresolvedItem,
} from "../services/unresolvedQueue";
import MapToExistingModal from "../components/MapToExistingModal";
import CreateCanonicalModal from "../components/CreateCanonicalModal";
import AddTailModal from "../components/AddTailModal";
import {
  useNormalizationData,
  TeamData,
  PlayerData,
  BetTypeData,
} from "../hooks/useNormalizationData";
import { Sport } from "../data/referenceData";

// --- Fixed column widths (deterministic spreadsheet layout) ---
const COL_W: Record<string, string> = {
  rowSelector: "1ch", // Row selection column (narrow)
  date: "5ch",
  site: "4ch",
  sport: "5ch",
  category: "7ch",
  type: "8ch",
  name: "20ch",
  ou: "3ch",
  line: "6ch", // -1ch (was 7ch)
  odds: "7ch",
  bet: "10ch",
  toWin: "10ch",
  result: "6ch",
  net: "10ch", // +1ch (was 9ch) - to accommodate large currency values
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
  initialValue?: string; // Initial character(s) for type-to-edit (replaces current value)
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
  initialValue,
}) => {
  // If initialValue is provided, use it (overwrite mode for spreadsheet feel)
  const [text, setText] = useState(initialValue ?? (value?.toString() || ""));
  const listId = useMemo(() => `suggestions-${Math.random()}`, []);
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef || internalRef;

  // Update internal state if the external value prop changes (skip if we have initialValue)
  React.useEffect(() => {
    if (initialValue === undefined) {
      setText(value?.toString() || "");
    }
  }, [value, initialValue]);

  // Focus input when isFocused becomes true
  React.useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
      // If initialValue provided, place cursor at end; otherwise select all
      if (initialValue !== undefined) {
        ref.current.setSelectionRange(text.length, text.length);
      } else {
        ref.current.select();
      }
    }
  }, [isFocused, ref, initialValue, text.length]);

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
        autoFocus={isFocused}
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

// Result Cell - uses TypableDropdown for typeahead support
// Forward declare, actual component defined after TypableDropdown

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
  initialQuery?: string; // Initial character(s) for type-to-edit (replaces current value)
  getOptionClassName?: (option: string) => string;
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
  initialQuery,
  getOptionClassName,
}) => {
  // If initialQuery is provided, start with it as text (overwrite mode for spreadsheet feel)
  const [text, setText] = useState(initialQuery || value || "");
  const [isOpen, setIsOpen] = useState(!!initialQuery); // Open immediately if type-to-edit
  const [highlightedIndex, setHighlightedIndex] = useState(
    initialQuery ? 0 : -1
  ); // Pre-highlight first match
  const [filterText, setFilterText] = useState(initialQuery || ""); // Start filtering if type-to-edit
  const internalRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const ref = inputRef || internalRef;

  // Update internal state if the external value prop changes
  // Update internal state if the external value prop changes
  // REMOVED: This causes a race condition where addBetType triggers a re-render
  // with the old 'value' before the new bet data is propagated, resetting 'text'
  // to the old value, which is then saved back by handleBlur/onSave.
  // Since TypableDropdown is unmounted/remounted when editing starts/ends,
  // initialization via useState(value || "") is sufficient.
  /*
  React.useEffect(() => {
    setText(value || "");
    setFilterText(""); // Reset filter when value changes externally
  }, [value]);
  */

  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    minWidth: number;
    maxHeight: number;
    isFlipped: boolean;
  } | null>(null);
  const selectionDone = useRef(false);

  // Focus input when isFocused becomes true
  React.useEffect(() => {
    if (isFocused && ref.current && !selectionDone.current) {
      ref.current.focus();
      if (initialQuery !== undefined) {
        // If typing started edit, place cursor at end
        ref.current.setSelectionRange(text.length, text.length);
      } else {
        // Otherwise (click/enter), select all to allow overwrite
        ref.current.select();
      }
      selectionDone.current = true;
    }
    if (!isFocused) {
      selectionDone.current = false;
    }
  }, [isFocused, initialQuery, ref]);

  // Update dropdown position when input position changes
  React.useEffect(() => {
    if (ref.current && isOpen) {
      const rect = ref.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const showAbove = spaceBelow < 220; // Threshold for flipping up

      setDropdownPosition({
        top: showAbove ? undefined : rect.bottom,
        bottom: showAbove ? viewportHeight - rect.top : undefined,
        left: rect.left,
        minWidth: rect.width,
        maxHeight: showAbove ? rect.top - 10 : spaceBelow - 10,
        isFlipped: showAbove,
      });
    }
  }, [isOpen, ref]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        ref.current &&
        !ref.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, ref]);

  // Dedupe options locally to ensure UI cleanliness
  const uniqueOptions = useMemo(() => {
    return Array.from(new Set(options)).sort();
  }, [options]);

  // Filter options based on typed text
  const filteredOptions = useMemo(() => {
    if (!filterText) return uniqueOptions; // Show all options when filter is empty
    const lowerFilter = filterText.toLowerCase();
    return uniqueOptions.filter((opt) => opt && opt.toLowerCase().includes(lowerFilter));
  }, [filterText, uniqueOptions]);

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
    // Auto-highlight first match when typing (for better typeahead UX)
    setHighlightedIndex(0);
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
      e.preventDefault();

      // If there's a highlighted option, select it
      if (
        isOpen &&
        highlightedIndex >= 0 &&
        filteredOptions[highlightedIndex]
      ) {
        handleSelect(filteredOptions[highlightedIndex]);
        return;
      }

      // If no highlighted option but there are filtered options, select the first one
      if (isOpen && filteredOptions.length > 0 && filterText) {
        handleSelect(filteredOptions[0]);
        return;
      }

      // If allowCustom is true, or text matches an option exactly, or text is empty
      if (allowCustom || options.includes(text) || !text) {
        onSave(text);
        setIsOpen(false);
        ref.current?.blur();
      } else {
        // Not allowed to create custom values - don't save, just close
        // Revert to original value
        setText(value || "");
        setFilterText("");
        setIsOpen(false);
        ref.current?.blur();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation(); // Prevent table navigation while in dropdown
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
      e.stopPropagation(); // Prevent table navigation while in dropdown
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
          // Only reset filter if not type-to-edit (initialQuery preserves the typed character)
          if (!initialQuery) {
            setFilterText(""); // Show all options when focusing normally
          }
          if (onFocus) onFocus();
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDownInternal}
        className={`bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800 rounded text-sm max-w-full min-w-0 !cursor-default ${className}`}
        style={{ boxSizing: "border-box", maxWidth: "100%", minWidth: 0, cursor: "default" }}
        placeholder={placeholder}
        autoFocus={isFocused}
      />
      {isOpen && filteredOptions.length > 0 && dropdownPosition && (
        <div
          ref={dropdownRef}
          className={`fixed z-50 mt-1 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-y-auto max-w-sm flex flex-col ${
            dropdownPosition.isFlipped ? "flex-col-reverse" : ""
          }`}
          style={{
            top: dropdownPosition.top,
            bottom: dropdownPosition.bottom,
            left: dropdownPosition.left,
            minWidth: dropdownPosition.minWidth,
            maxHeight: dropdownPosition.maxHeight,
          }}
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
              } ${getOptionClassName ? getOptionClassName(option) : ""}`}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Result Cell - uses TypableDropdown for typeahead support
const ResultCell: React.FC<{
  value: BetResult;
  onSave: (newValue: BetResult) => void;
  isFocused?: boolean;
  onFocus?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  initialQuery?: string;
}> = ({ value, onSave, isFocused, onFocus, inputRef, initialQuery }) => {
  // Map result values to display labels
  const resultLabels: Record<string, string> = {
    win: "Win",
    loss: "Loss",
    push: "Push",
    pending: "Pend",
  };

  const handleSave = (val: string) => {
    // Map back from display labels to actual result values
    const lowerVal = val.toLowerCase();
    if (lowerVal === "win" || lowerVal === "w") {
      onSave("win");
    } else if (lowerVal === "loss" || lowerVal === "l") {
      onSave("loss");
    } else if (lowerVal === "push" || lowerVal.startsWith("pu")) {
      onSave("push");
    } else if (lowerVal === "pending" || lowerVal.startsWith("pe")) {
      onSave("pending");
    }
  };

  return (
    <TypableDropdown
      value={resultLabels[value] || value}
      onSave={handleSave}
      options={["Win", "Loss", "Push", "Pending"]}
      className="text-center capitalize font-semibold"
      isFocused={isFocused}
      onFocus={onFocus}
      inputRef={inputRef}
      allowCustom={false}
      initialQuery={initialQuery}
    />
  );
};

const OUCell: React.FC<{
  value?: "Over" | "Under";
  onSave: (newValue: "Over" | "Under" | undefined) => void;
  isFocused?: boolean;
  onFocus?: () => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  initialQuery?: string;
}> = ({
  value,
  onSave,
  isFocused,
  onFocus,
  inputRef,
  onKeyDown,
  initialQuery,
}) => {
  const handleSave = (val: string) => {
    if (val === "Over" || val === "Under") {
      onSave(val);
    } else if (val.toLowerCase() === "o" || val.toLowerCase() === "over") {
      onSave("Over");
    } else if (val.toLowerCase() === "u" || val.toLowerCase() === "under") {
      onSave("Under");
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
      initialQuery={initialQuery}
    />
  );
};

const BetTableView: React.FC = () => {
  const {
    bets,
    loading,
    updateBet,
    createManualBet,
    batchCreateManualBets,
    insertBetAt,
    duplicateBets,
    batchDuplicateBets,
    bulkUpdateBets,
    deleteBets,
    undoLastAction,
    canUndo,
    lastUndoLabel,
    pushUndoSnapshot,
  } = useBets();
  const {
    sportsbooks,
    sports,
    categories,
    betTypes,
    players,
    teams,
    addBetType,
    addPlayer,
    addTeam,
    tails,
    addTail,
  } = useInputs();
  const {
    teams: normalizationTeams,
    players: normalizationPlayers,
    betTypes: normalizationBetTypes,
    addTeam: addNormalizationTeam,
    addPlayer: addNormalizationPlayer,
    addTeamAlias,
    addPlayerAlias,
    resolverVersion,
  } = useNormalizationData();
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
  // Consolidate categories for display: source from Input Manager (extensible)
  // Note: This allows custom user categories but requires manual cleanup of junk like "Poop"
  // Consolidate categories for display: remove SGP/SGP+ as they are covered by Parlays
  const displayCategories = useMemo(() => {
    return categories
      .filter((c) => {
        const lower = c.toLowerCase();
        return (
          lower !== "sgp" &&
          lower !== "sgp+" &&
          lower !== "sgp_plus" &&
          lower !== "sgp/sgp+"
        );
      })
      .sort();
  }, [categories]);

  // Spreadsheet state management
  const [focusedCell, setFocusedCell] = useState<CellCoordinate | null>(null);
  const [editingCell, setEditingCell] = useState<CellCoordinate | null>(null); // Cell actively being edited
  const [editSeed, setEditSeed] = useState<string | null>(null); // First character typed for type-to-edit
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
  const [rowSelectionAnchorId, setRowSelectionAnchorId] = useState<
    string | null
  >(null);
  const [showClearFieldsModal, setShowClearFieldsModal] = useState(false);
  const [fieldsToToggle, setFieldsToToggle] = useState<Set<string>>(new Set());
  

  // Quick Add Tail state
  const [resolvingTailItem, setResolvingTailItem] = useState<{
    initialValue: string;
    row: FlatBet;
  } | null>(null);

  // Name resolution modal state
  const [resolvingNameItem, setResolvingNameItem] = useState<{
    row: FlatBet;
    legIndex: number | null;
    entityType: "player" | "team";
  } | null>(null);
  const [resolutionMode, setResolutionMode] = useState<"map" | "create">("map");

  // Phase 1.1: Batch count for Add and Duplicate
  const [batchCount, setBatchCount] = useState<number>(1);

  // Phase 1.1: Delete confirmation state
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellRefs = useRef<Map<string, React.RefObject<HTMLInputElement>>>(
    new Map()
  );

  // Handle scrollbar visibility - show while scrolling, hide after delay
  const handleScrollbarVisibility = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Add is-scrolling class to show scrollbar
    container.classList.add("is-scrolling");

    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Hide scrollbar after 1 second of no scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      container.classList.remove("is-scrolling");
    }, 1000);
  }, []);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Helper to exit edit mode and clear the type-to-edit seed
  const exitEditMode = useCallback(() => {
    setEditingCell(null);
    setEditSeed(null);
  }, []);

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
            ? parseFloat(finalRow.Bet) || 0
            : 0;
        const toWinAmount =
          finalRow._rawToWin !== undefined
            ? finalRow._rawToWin
            : finalRow["To Win"]
            ? parseFloat(finalRow["To Win"]) || 0
            : 0;
        const netAmount =
          finalRow._rawNet !== undefined
            ? finalRow._rawNet
            : finalRow.Net
            ? parseFloat(finalRow.Net) || 0
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
  // GATE: Only adds to suggestions if entity is RESOLVED
  // Unresolved entities remain in cell value and get queued, but don't pollute suggestions
  const autoAddEntity = (sport: string, entity: string, market: string) => {
    if (!sport || !entity || !entity.trim()) return;

    const trimmedEntity = entity.trim();
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

    // Determine entity type and check resolver status before adding to suggestions
    if (isPlayerMarket && !isTeamMarket) {
      // Check if player is resolved before adding to suggestions
      const playerResult = resolvePlayer(trimmedEntity, { sport: sport as Sport });
      if (playerResult.status === "resolved") {
        addPlayer(sport, playerResult.canonical);
      }
      // If unresolved, do NOT add - let queue flow handle it
    } else if (isTeamMarket && !isPlayerMarket) {
      // Check if team is resolved before adding to suggestions
      const teamResult = resolveTeamForSport(trimmedEntity, sport as Sport);
      if (teamResult.status === "resolved") {
        addTeam(sport, teamResult.canonical);
      }
      // If unresolved, do NOT add - let queue flow handle it
    } else {
      // Ambiguous market type - determine by sport
      const teamSports = ["NFL", "NBA", "MLB", "NHL", "Soccer"];
      if (teamSports.includes(sport)) {
        const teamResult = resolveTeamForSport(trimmedEntity, sport as Sport);
        if (teamResult.status === "resolved") {
          addTeam(sport, teamResult.canonical);
        }
      } else {
        const playerResult = resolvePlayer(trimmedEntity, { sport: sport as Sport });
        if (playerResult.status === "resolved") {
          addPlayer(sport, playerResult.canonical);
        }
      }
    }
  };

  // Helper to check name resolution status (for real-time badge display)
  // Returns status: 'resolved' | 'ambiguous' | 'unresolved'
  // Checks managed teams list first (authoritative suppression)
  // Uses sport-scoped team resolution to prevent cross-sport alias collisions
  const getNameResolutionStatus = useCallback(
    (
      name: string,
      sport: string
    ): { status: "resolved" | "ambiguous" | "unresolved"; name: string } => {
      if (!name || !name.trim() || !sport || !sport.trim()) {
        return { status: "resolved", name };
      }

      const trimmedName = name.trim();
      const normalizedName = trimmedName.toLowerCase();

      // Check managed teams list first (authoritative suppression)
      // If the team exists in the user's managed teams for this sport, don't flag it
      const managedTeamsForSport = teams[sport] || [];
      if (
        managedTeamsForSport.some((t) => t.toLowerCase() === normalizedName)
      ) {
        return { status: "resolved", name: trimmedName };
      }

      // Check managed players list (authoritative suppression)
      const managedPlayersForSport = players[sport] || [];
      if (
        managedPlayersForSport.some((p) => p.toLowerCase() === normalizedName)
      ) {
        return { status: "resolved", name: trimmedName };
      }

      // Use sport-scoped team resolution to prevent cross-sport alias collisions
      const teamResult = resolveTeamForSport(trimmedName, sport as Sport);
      const playerResult = resolvePlayer(trimmedName, {
        sport: sport as Sport,
      });

      // If either is resolved, name is resolved
      if (
        teamResult.status === "resolved" ||
        playerResult.status === "resolved"
      ) {
        return { status: "resolved", name: trimmedName };
      }

      // If either is ambiguous, name is ambiguous
      if (
        teamResult.status === "ambiguous" ||
        playerResult.status === "ambiguous"
      ) {
        return { status: "ambiguous", name: trimmedName };
      }

      // Neither resolved nor ambiguous - unresolved
      return { status: "unresolved", name: trimmedName };
    },
    [teams, players, resolverVersion]
  );

  // Legacy helper for simple boolean check (used in handleNameCommitWithQueue)
  const isNameUnresolved = useCallback(
    (name: string, sport: string): boolean => {
      const result = getNameResolutionStatus(name, sport);
      return result.status !== "resolved";
    },
    [getNameResolutionStatus]
  );

  const normalizeNameForComparison = (value?: string): string =>
    (value || "").trim().toLowerCase();

  // Helper to determine entity type and add to unresolvedQueue if needed
  const handleNameCommitWithQueue = useCallback(
    (
      val: string,
      row: FlatBet,
      legIndex: number | null,
      prevValue?: string
    ) => {
      const trimmedNext = val.trim();
      const trimmedPrev = (prevValue || "").trim();
      const normalizedNext = normalizeNameForComparison(trimmedNext);
      const normalizedPrev = normalizeNameForComparison(trimmedPrev);

      if (normalizedPrev === normalizedNext) return;

      const resolvedLegIndex = legIndex ?? 0;

      if (trimmedPrev) {
        const prevQueueId = generateUnresolvedItemId(
          trimmedPrev,
          row.betId,
          resolvedLegIndex
        );
        removeFromUnresolvedQueue([prevQueueId]);
      }

      if (!trimmedNext) return;

      // Add to suggestions (existing behavior)
      autoAddEntity(row.sport, trimmedNext, row.type);

      // If sport is known, check resolution and add to queue if unresolved
      if (row.sport && row.sport.trim()) {
        const resolution = getNameResolutionStatus(trimmedNext, row.sport);
        if (resolution.status === "resolved") return;

        // Neither resolved - determine type based on market context
        const lowerMarket = row.type.toLowerCase();
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
        const isTeamMarket = teamMarketKeywords.some((keyword) =>
          lowerMarket.includes(keyword)
        );

        const entityType: UnresolvedEntityType = isTeamMarket
          ? "team"
          : "player";

        // Add to unresolvedQueue (we only reach here if neither resolved)
        const queueItem = {
          id: generateUnresolvedItemId(
            trimmedNext,
            row.betId,
            resolvedLegIndex
          ),
          rawValue: trimmedNext,
          entityType: entityType,
          encounteredAt: new Date().toISOString(),
          book: row.site,
          betId: row.betId,
          legIndex: resolvedLegIndex,
          sport: row.sport,
          market: row.type,
          context: "manual-entry",
        };

        addToUnresolvedQueue([queueItem]);
      }
    },
    [autoAddEntity, getNameResolutionStatus]
  );

  // Handler to open resolution modal
  const handleOpenResolutionModal = useCallback(
    (
      row: FlatBet,
      legIndex: number | null,
      entityTypeOverride?: UnresolvedEntityType
    ) => {
      let entityType: UnresolvedEntityType = "player";

      if (entityTypeOverride) {
        entityType = entityTypeOverride;
      } else {
        // Determine entity type from market context
        const lowerMarket = (row.type || "").toLowerCase();
        const teamKeywords = [
          "moneyline",
          "ml",
          "spread",
          "total",
          "run line",
          "money line",
          "outright winner",
          "to win",
        ];
        const isTeam = teamKeywords.some((kw) => lowerMarket.includes(kw));
        entityType = isTeam ? "team" : "player";
      }

      setResolvingNameItem({
        row,
        legIndex,
        entityType,
      });
      setResolutionMode("map");
    },
    []
  );

  // Handler for map confirmation
  const handleMapConfirm = useCallback(
    (item: UnresolvedItem, targetCanonical: string) => {
      if (!resolvingNameItem) return;
      const sport = resolvingNameItem.row.sport as Sport;

      if (item.entityType === "team") {
        addTeamAlias(targetCanonical, item.rawValue);
        // Also add canonical to suggestions so it appears in dropdown immediately
        addTeam(sport, targetCanonical);
      } else if (item.entityType === "player") {
        addPlayerAlias(targetCanonical, sport, item.rawValue);
        // Also add canonical to suggestions so it appears in dropdown immediately
        addPlayer(sport, targetCanonical);
      }

      // Clear unresolved queue entry
      const queueId = generateUnresolvedItemId(
        item.rawValue,
        resolvingNameItem.row.betId,
        resolvingNameItem.legIndex ?? 0
      );
      removeFromUnresolvedQueue([queueId]);

      setResolvingNameItem(null);
    },
    [resolvingNameItem, addTeamAlias, addPlayerAlias, addTeam, addPlayer]
  );

  // Handler for create confirmation
  const handleCreateConfirm = useCallback(
    (
      item: UnresolvedItem,
      canonical: string,
      sport: Sport,
      additionalAliases: string[],
      extraData?: {
        teamId?: string;
        description?: string;
        abbreviations?: string[];
      }
    ) => {
      if (!resolvingNameItem) return;

      const aliases = [
        item.rawValue,
        ...additionalAliases.filter((a) => a !== item.rawValue),
      ];

      if (item.entityType === "team") {
        const newTeam: TeamData = {
          canonical,
          sport,
          aliases,
          abbreviations: extraData?.abbreviations || [],
        };
        addNormalizationTeam(newTeam);
        // Also add canonical to suggestions so it appears in dropdown immediately
        addTeam(sport, canonical);
      } else if (item.entityType === "player") {
        // Resolve team name from ID if present
        let teamName: string | undefined = undefined;
        if (extraData?.teamId) {
          const foundTeam = normalizationTeams.find(
            (t) => t.id === extraData?.teamId
          );
          if (foundTeam) teamName = foundTeam.canonical;
        }

        const newPlayer: PlayerData = {
          canonical,
          sport,
          aliases,
          team: teamName,
          teamId: extraData?.teamId,
        };
        addNormalizationPlayer(newPlayer);
        // Also add canonical to suggestions so it appears in dropdown immediately
        addPlayer(sport, canonical);
      }

      // Clear unresolved queue entry
      const queueId = generateUnresolvedItemId(
        item.rawValue,
        resolvingNameItem.row.betId,
        resolvingNameItem.legIndex ?? 0
      );
      removeFromUnresolvedQueue([queueId]);

      setResolvingNameItem(null);
    },
    [
      resolvingNameItem,
      addNormalizationTeam,
      addNormalizationPlayer,
      normalizationTeams,
      addTeam,
      addPlayer,
    ]
  );

  const availableTypes = useMemo(() => {
    if (filters.sport === "all") {
      return Array.from(new Set(Object.values(betTypes).flat())).sort();
    }
    return (betTypes[filters.sport] || []).sort();
  }, [betTypes, filters.sport]);

  // Abbreviated types for display in dropdown
  const abbreviatedTypes = useMemo(() => {
    const types = availableTypes.map((type) =>
      abbreviateMarket(
        type,
        filters.sport === "all" ? undefined : filters.sport
      )
    );
    return types;
  }, [availableTypes, filters.sport]);

  // Abbreviated types by sport for dropdown options
  const getAbbreviatedTypesForSport = useCallback(
    (sport: string) => {
      const types = betTypes[sport] || [];
      return types.map((type) => abbreviateMarket(type, sport));
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
        // Only include resolved bet types from normalization service
        const snapshot = getReferenceDataSnapshot();
        const propTypes = snapshot.betTypes.filter(
          (t) => t.sport === sport || t.sport === "Other"
        );
        
        // Combine resolved props with standard system types (Main Markets, Futures)
        const allTypes = [
          ...propTypes.map((t) => abbreviateMarket(t.canonical)),
          ...Object.values(MAIN_MARKET_TYPES),
          ...Object.values(FUTURES_TYPES),
        ];

        const unique = new Set(allTypes);
        return Array.from(unique).sort();
      },
      players: (sport: string) => {
        const all = new Set<string>();

        // Only include resolved players from normalization service (SSOT)
        const snapshot = getReferenceDataSnapshot();
        snapshot.players.forEach((p) => {
          all.add(p.canonical);
        });

        return Array.from(all).sort();
      },
      teams: (sport: string) => {
        const all = new Set<string>();

        // Only include resolved teams from normalization service (SSOT)
        const snapshot = getReferenceDataSnapshot();
        snapshot.teams.forEach((t) => {
          all.add(t.canonical);
        });

        return Array.from(all).sort();
      },
    }),
    [
      sports,
      availableSites,
      displayCategories,
      betTypes,
      resolverVersion,
    ]
  );

  const tailSuggestions = useMemo(() => {
    return tails
      .map((t) => t.displayName)
      .filter((n): n is string => !!n) // Filter out null/undefined/empty
      .sort();
  }, [tails]);

  // Helper: Check if Type is unresolved
  const isTypeUnresolved = useCallback(
    (type: string, sport: string): boolean => {
      if (!type) return false;
      const res = resolveBetType(type, sport as Sport);
      return res.status === "unresolved";
    },
    []
  );

  // Helper: Check if Tail is unresolved (not in saved list)
  const isTailUnresolved = useCallback(
    (tail: string): boolean => {
      if (!tail) return false;
      // Check if tail matches any existing tail name or display name
      return !tails.some(
        (t) =>
          t.name.toLowerCase() === tail.toLowerCase() ||
          (t.displayName && t.displayName.toLowerCase() === tail.toLowerCase())
      );
    },
    [tails]
  );

  // Helper: Handle quick-adding a tail
  const handleAddTail = useCallback(
    (tail: string, row: FlatBet) => {
      setResolvingTailItem({ initialValue: tail, row });
    },
    []
  );

  const filteredBets = useMemo(() => {
    const tablePredicate = createBetTableFilterPredicate(
      filters,
      debouncedSearchTerm,
      ["name", "name2", "sport", "type", "category", "tail"]
    );
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
      .filter((h) => h.key !== "toWin" && h.key !== "net" && h.key !== "isLive")
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

  // Helper: Check if cell is being edited
  const isCellEditing = useCallback(
    (rowIndex: number, columnKey: keyof FlatBet): boolean => {
      return (
        editingCell?.rowIndex === rowIndex &&
        editingCell?.columnKey === columnKey
      );
    },
    [editingCell]
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
  const handleDuplicateRows = useCallback(
    (multiplier: number = 1) => {
      const idsToClone =
        selectedRowIds.size > 0
          ? Array.from(selectedRowIds)
          : focusedCell
          ? [visibleBets[focusedCell.rowIndex]?.betId].filter(Boolean)
          : [];

      if (idsToClone.length === 0) return;

      const newIds =
        multiplier === 1
          ? duplicateBets(idsToClone)
          : batchDuplicateBets(idsToClone, multiplier);

      setSelectedRowIds(new Set(newIds));
      setTimeout(() => {
        const idx = visibleBets.findIndex((b) => b.betId === newIds[0]);
        setFocusedCell({ rowIndex: idx >= 0 ? idx : 0, columnKey: "site" });
      }, 50);
    },
    [
      selectedRowIds,
      focusedCell,
      visibleBets,
      duplicateBets,
      batchDuplicateBets,
    ]
  );

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
  const handleAddManualBet = useCallback(
    (count: number = 1) => {
      const newIds =
        count === 1 ? [createManualBet()] : batchCreateManualBets(count);

      setSelectedRowIds(new Set(newIds));
      setTimeout(() => {
        const idx = visibleBets.findIndex((b) => b.betId === newIds[0]);
        setFocusedCell({
          rowIndex: idx >= 0 ? idx : visibleBets.length - count,
          columnKey: "site",
        });
        // Scroll to bottom to show new row and Add Bet button
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop =
            scrollContainerRef.current.scrollHeight;
        }
      }, 50);
    },
    [createManualBet, batchCreateManualBets, visibleBets]
  );

  // Handle insert row above selected/focused row
  const handleInsertRowAbove = useCallback(() => {
    // Get reference bet ID from selection or focused cell
    let referenceBetId: string | null = null;

    if (selectedRowIds.size > 0) {
      // Use first selected row
      referenceBetId = Array.from(selectedRowIds)[0] as string;
    } else if (focusedCell) {
      const row = visibleBets[focusedCell.rowIndex];
      if (row) referenceBetId = row.betId;
    }

    if (!referenceBetId) return;

    const newId = insertBetAt(referenceBetId, "above");
    if (newId) {
      setSelectedRowIds(new Set([newId]));
      setTimeout(() => {
        const idx = visibleBets.findIndex((b) => b.betId === newId);
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
      referenceBetId = selectedArray[selectedArray.length - 1] as string;
    } else if (focusedCell) {
      const row = visibleBets[focusedCell.rowIndex];
      if (row) referenceBetId = row.betId;
    }

    if (!referenceBetId) return;

    const newId = insertBetAt(referenceBetId, "below");
    if (newId) {
      setSelectedRowIds(new Set([newId]));
      setTimeout(() => {
        const idx = visibleBets.findIndex((b) => b.betId === newId);
        // Focus the newly inserted row
        setFocusedCell({ rowIndex: idx >= 0 ? idx : 0, columnKey: "site" });
      }, 50);
    }
  }, [selectedRowIds, focusedCell, visibleBets, insertBetAt]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // ============================================================
      // EDITOR KEY OWNERSHIP: When editing, the editor owns all keys
      // except Escape (to cancel) and Tab (to navigate).
      // This ensures multi-character typing and Enter-select work.
      // ============================================================
      const target = e.target as HTMLElement;
      const isInputElement =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        (target instanceof HTMLElement && target.isContentEditable);

      // When editingCell is set OR focus is on any input element,
      // the grid must yield all keys to the editor EXCEPT:
      // - Escape: to cancel editing (handled below)
      // - Tab: to navigate between cells (handled below)
      // All other keys (Enter, Arrow keys, printable chars, Backspace, Delete)
      // belong to the editor and should NOT be intercepted by the grid.
      if (editingCell != null || isInputElement) {
        // Only allow grid to handle Escape (cancel edit) and Tab (navigate)
        if (e.key !== "Escape" && e.key !== "Tab") {
          return; // Let the editor handle all other keys
        }
      }

      if (!focusedCell) return;

      // Check if user is actively editing or focused on an input element
      const isEditingContent =
        editingCell != null ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable);

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
        if (isEditingContent) return; // Allow native undo for input
        e.preventDefault();
        undoLastAction();
        return;
      }

      // Handle insert row below (Ctrl+I or Cmd+I) - default insert action
      if ((e.ctrlKey || e.metaKey) && e.key === "i" && !e.shiftKey) {
        e.preventDefault();
        handleInsertRowBelow();
        return;
      }

      // Handle insert row above (Ctrl+Shift+I or Cmd+Shift+I)
      if ((e.ctrlKey || e.metaKey) && e.key === "I" && e.shiftKey) {
        e.preventDefault();
        handleInsertRowAbove();
        return;
      }

      // Handle bulk apply value (Ctrl+Enter or Cmd+Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleBulkApplyValue();
        return;
      }

      // Handle delete (Delete or Backspace when not typing in an input)
      if ((e.key === "Delete" || e.key === "Backspace") && !isEditingContent) {
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
          // Enter on focused cell: enter edit mode (if not already editing)
          if (!(target instanceof HTMLInputElement)) {
            e.preventDefault();
            if (focusedCell && !editingCell) {
              // Enter edit mode
              setEditingCell({ rowIndex, columnKey });
            } else {
              // Already editing or just finished - move down
              exitEditMode();
              navigateToCell(rowIndex, columnKey, "down");
            }
          }
          break;
        case "Escape":
          // Cancel edit, stay focused
          if (editingCell) {
            e.preventDefault();
            exitEditMode();
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
        default:
          // TYPE-TO-EDIT: If not editing, focused on a cell, and a printable character is typed,
          // enter edit mode immediately with that character as the seed.
          // Criteria: single char key, no modifiers (except Shift for capitals), not a special key
          if (
            !editingCell &&
            focusedCell &&
            isCellEditable(columnKey) &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            e.key.length === 1 // Single printable character
          ) {
            e.preventDefault();
            setEditSeed(e.key);
            setEditingCell({ rowIndex, columnKey });
          }
          break;
      }
    },
    [
      focusedCell,
      editingCell,
      navigateToCell,
      editableColumns,
      visibleBets.length,
      handleDuplicateRows,
      handleBulkApplyValue,
      handleDeleteRows,
      undoLastAction,
      batchCount,
      handleInsertRowAbove,
      handleInsertRowBelow,
      isCellEditable,
    ]
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
          updateBet(row.betId, { sport: value });
          break;
        case "category":
          updateBet(row.betId, { marketCategory: value as MarketCategory });
          break;
        case "type":
          if (isLeg) {
            // GATE: Only add to suggestions if bet type is RESOLVED
            const legTypeResult = resolveBetType(value, row.sport as Sport);
            if (legTypeResult.status === "resolved") {
              addBetType(row.sport, legTypeResult.canonical);
            }
            handleLegUpdate(row.betId, legIndex, { market: value });
          } else {
            // Update bet.type (stat type), NOT betType (bet form)
            // GATE: Only add to suggestions if bet type is RESOLVED
            const typeResult = resolveBetType(value, row.sport as Sport);
            if (typeResult.status === "resolved") {
              addBetType(row.sport, typeResult.canonical);
            }
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
    [sportsbooks, updateBet, handleLegUpdate, addBetType, autoAddEntity]
  );

  // Cell click handler - single click selects only, does NOT enter edit mode
  const handleCellClick = useCallback(
    (rowIndex: number, columnKey: keyof FlatBet, e: React.MouseEvent) => {
      if (!isCellEditable(columnKey)) return;

      // Clear editing state on single click (select only)
      exitEditMode();

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
        // Regular click: single selection (no edit mode)
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

  // Cell double-click handler - enters edit mode
  const handleCellDoubleClick = useCallback(
    (rowIndex: number, columnKey: keyof FlatBet) => {
      if (!isCellEditable(columnKey)) return;

      setFocusedCell({ rowIndex, columnKey });
      setEditingCell({ rowIndex, columnKey });
      setSelectionAnchor({ rowIndex, columnKey });
      setSelectionRange({
        start: { rowIndex, columnKey },
        end: { rowIndex, columnKey },
      });
    },
    [isCellEditable]
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
    <div className="p-3 h-full flex flex-col space-y-2 bg-neutral-100 dark:bg-neutral-950 relative">
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

      {/* Actions row: Selected row actions + Undo */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Undo button */}
        {canUndo && (
          <button
            type="button"
            onClick={undoLastAction}
            className="px-2 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded border border-neutral-300 dark:border-neutral-600 transition-colors"
            title={`Undo: ${lastUndoLabel || "Last action"} (Cmd/Ctrl+Z)`}
          >
            ↩ Undo{lastUndoLabel ? ` (${lastUndoLabel})` : ""}
          </button>
        )}

        {selectedRowIds.size > 0 && (
          <>
            <div className="h-5 w-px bg-neutral-300 dark:bg-neutral-700" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {selectedRowIds.size} row{selectedRowIds.size !== 1 ? "s" : ""}{" "}
              selected
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
              Duplicate{batchCount > 1 ? ` ×${batchCount}` : ""}
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
              Delete {pendingDeleteIds.length} bet
              {pendingDeleteIds.length !== 1 ? "s" : ""}?
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
              Select fields to clear for {selectedRowIds.size} selected row
              {selectedRowIds.size !== 1 ? "s" : ""}:
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {CLEARABLE_FIELDS.map((field) => (
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
                  <span className="capitalize">
                    {field === "ou" ? "O/U" : field}
                  </span>
                </label>
              ))}
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
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-w-0 overlay-scrollbar"
          style={{ width: "100%" }}
          onScroll={handleScrollbarVisibility}
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

                  // Map result values to display labels
                  const resultLabels: Record<string, string> = {
                    win: "Win",
                    loss: "Loss",
                    push: "Push",
                    pending: "Pend",
                  };

                  const displayResultLabel =
                    resultLabels[displayResult] || displayResult;
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
                    // Note: overflow-hidden removed from base classes to allow dropdown menus to render.
                    // Numeric columns handle overflow via their own span styles (textOverflow: 'clip').
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
                      } ${
                        rowIsSelected ? "!bg-blue-100 dark:!bg-blue-900/30" : ""
                      }`}
                    >
                      {/* Row selector cell */}
                      <td
                        className="px-0.5 py-0.5 text-center border-r border-neutral-300 dark:border-neutral-700 cursor-pointer select-none hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={(e) =>
                          handleRowSelectorClick(row.betId, rowIndex, e)
                        }
                        title={
                          rowIsSelected
                            ? "Click to deselect (Cmd/Ctrl+click to toggle)"
                            : "Click to select (Shift+click for range)"
                        }
                      >
                        {/* Selection indicator removed - rely on background color */}
                        {/* Insert buttons - appear on hover when row is selected */}
                        {rowIsSelected && (
                          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInsertRowAbove();
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
                                handleInsertRowBelow();
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
                          getCellClasses("date") +
                          " whitespace-nowrap min-w-0 cursor-default"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "date", e)}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "date")
                        }
                      >
                        {isCellFocused(rowIndex, "date") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "date", e)
                            }
                          />
                        )}
                        {isCellEditing(rowIndex, "date") ? (
                          <EditableCell
                            value={
                              !row._isParlayChild || row._isParlayHeader
                                ? formatDateShort(row.date)
                                : ""
                            }
                            type="text"
                            isFocused={true}
                            onFocus={() =>
                              setFocusedCell({ rowIndex, columnKey: "date" })
                            }
                            inputRef={getCellRef(rowIndex, "date")}
                            onSave={(val) => {
                              if (!row._isParlayChild || row._isParlayHeader) {
                                const parsed = parseDateInput(val, row.date);
                                if (parsed) {
                                  updateBet(row.betId, { placedAt: parsed });
                                }
                              }
                              exitEditMode();
                            }}
                            initialValue={editSeed ?? undefined}
                          />
                        ) : (
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
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("site") +
                          " font-bold whitespace-nowrap min-w-0 !cursor-default"
                        }
                        style={{ cursor: "default" }}
                        onClick={() => handleCellDoubleClick(rowIndex, "site")}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "site")
                        }
                      >
                        {isCellFocused(rowIndex, "site") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "site", e)
                            }
                          />
                        )}
                        {isCellEditing(rowIndex, "site") ? (
                          <TypableDropdown
                            value={
                              !row._isParlayChild || row._isParlayHeader
                                ? siteShortNameMap[row.site] || row.site
                                : ""
                            }
                            isFocused={true}
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
                              exitEditMode();
                            }}
                            options={suggestionLists.sites}
                            allowCustom={false}
                            initialQuery={editSeed ?? undefined}
                          />
                        ) : (
                          <span className="block truncate font-bold">
                            {!row._isParlayChild || row._isParlayHeader
                              ? siteShortNameMap[row.site] || row.site
                              : ""}
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("sport") +
                          " whitespace-nowrap min-w-0 !cursor-default"
                        }
                        style={{ cursor: "default" }}
                        onClick={() => handleCellDoubleClick(rowIndex, "sport")}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "sport")
                        }
                      >
                        {isCellFocused(rowIndex, "sport") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "sport", e)
                            }
                          />
                        )}
                        {isCellEditing(rowIndex, "sport") ? (
                          <TypableDropdown
                            value={row.sport}
                            onSave={(val) => {
                              updateBet(row.betId, { sport: val });
                              exitEditMode();
                            }}
                            options={suggestionLists.sports}
                            isFocused={true}
                            onFocus={() =>
                              setFocusedCell({ rowIndex, columnKey: "sport" })
                            }
                            inputRef={getCellRef(rowIndex, "sport")}
                            allowCustom={false}
                            initialQuery={editSeed ?? undefined}
                          />
                        ) : (
                          <span className="block truncate">{row.sport}</span>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("category") +
                          " whitespace-nowrap min-w-0 !cursor-default"
                        }
                        style={{ cursor: "default" }}
                        onClick={() =>
                          handleCellDoubleClick(rowIndex, "category")
                        }
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "category")
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
                        {isCellEditing(rowIndex, "category") ? (
                          <TypableDropdown
                            value={normalizeCategoryForDisplay(row.category)}
                            onSave={(val) => {
                              updateBet(row.betId, {
                                marketCategory: val as MarketCategory,
                              });
                              exitEditMode();
                            }}
                            options={suggestionLists.categories}
                            isFocused={true}
                            onFocus={() =>
                              setFocusedCell({
                                rowIndex,
                                columnKey: "category",
                              })
                            }
                            inputRef={getCellRef(rowIndex, "category")}
                            allowCustom={false}
                            initialQuery={editSeed ?? undefined}
                          />
                        ) : (
                          <span className="block truncate">
                            {normalizeCategoryForDisplay(row.category)}
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("type") +
                          " capitalize whitespace-nowrap min-w-0 cursor-default"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "type", e)}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "type")
                        }
                      >
                        {isCellFocused(rowIndex, "type") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "type", e)
                            }
                          />
                        )}
                        {isCellEditing(rowIndex, "type") ? (
                          <TypableDropdown
                            value={abbreviateMarket(row.type)}
                            onSave={(val) => {
                              // Convert abbreviation back to full name if it exists
                              const fullName =
                                typeAbbreviationToFull[val.toLowerCase()] ||
                                val;

                              // GATE: Only add to suggestions if it's NEW and RESOLVED
                              // to prevent pollution by unresolved types
                              const currentOptions = suggestionLists.types(
                                row.sport
                              );
                              const isNew = !currentOptions.some(
                                (opt) =>
                                  opt.toLowerCase() === fullName.toLowerCase()
                              );
                              if (isNew && fullName.trim()) {
                                const typeRes = resolveBetType(fullName, row.sport as Sport);
                                if (typeRes.status === "resolved") {
                                  addBetType(row.sport, typeRes.canonical);
                                }
                              }

                              if (isLeg) {
                                handleLegUpdate(row.betId, legIndex, {
                                  market: fullName,
                                });
                              } else {
                                // Update bet.type AND leg.market for single bets
                                // The view uses leg.market, so we must sync them.
                                const bet = bets.find(
                                  (b) => b.id === row.betId
                                );
                                const updates: any = { type: fullName };

                                // Sync to first leg if it exists and isn't a parlay
                                if (
                                  bet?.legs?.length === 1 &&
                                  bet.betType !== "parlay" &&
                                  bet.betType !== "sgp" &&
                                  bet.betType !== "sgp_plus"
                                ) {
                                  updates.legs = [
                                    { ...bet.legs[0], market: fullName },
                                  ];
                                }

                                updateBet(row.betId, updates);
                              }
                              exitEditMode();
                            }}
                            options={
                              isLeg
                                ? suggestionLists.types(row.sport)
                                : suggestionLists.types(row.sport) // Use stat types for single bets too
                            }
                            isFocused={true}
                            onFocus={() =>
                              setFocusedCell({ rowIndex, columnKey: "type" })
                            }
                            inputRef={getCellRef(rowIndex, "type")}
                            allowCustom={true}
                            initialQuery={editSeed ?? undefined}
                          />
                        ) : (
                          <span className="flex items-center gap-1 min-w-0">
                            <span className="truncate">
                              {abbreviateMarket(row.type)}
                            </span>
                            {row.type &&
                              isTypeUnresolved(row.type, row.sport) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenResolutionModal(
                                      row,
                                      legIndex,
                                      "betType"
                                    );
                                  }}
                                  className="flex-shrink-0 text-amber-500 hover:text-amber-600"
                                  title="Unresolved Type - Click to Resolve"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}
                          </span>
                        )}
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
                        onDoubleClick={() => {
                          if (row._isParlayHeader && row._parlayGroupId) return;
                          handleCellDoubleClick(rowIndex, "name");
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
                                      handleNameCommitWithQueue(
                                        val,
                                        row,
                                        null,
                                        row.name
                                      );
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
                                      handleNameCommitWithQueue(
                                        val,
                                        row,
                                        null,
                                        row.name2
                                      );
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
                              (() => {
                                // Display mode: "Team1 / Team2" (single line)
                                // Compute resolution status for both teams
                                const name1Status = row.name
                                  ? getNameResolutionStatus(row.name, row.sport)
                                  : null;
                                const name2Status = row.name2
                                  ? getNameResolutionStatus(
                                      row.name2,
                                      row.sport
                                    )
                                  : null;

                                // Build tooltip text
                                const tooltipParts: string[] = [];
                                if (name1Status?.status === "ambiguous")
                                  tooltipParts.push(`Ambiguous: ${row.name}`);
                                if (name1Status?.status === "unresolved")
                                  tooltipParts.push(`Unresolved: ${row.name}`);
                                if (name2Status?.status === "ambiguous")
                                  tooltipParts.push(`Ambiguous: ${row.name2}`);
                                if (name2Status?.status === "unresolved")
                                  tooltipParts.push(`Unresolved: ${row.name2}`);

                                // Determine badge type
                                const hasAmbiguous =
                                  name1Status?.status === "ambiguous" ||
                                  name2Status?.status === "ambiguous";
                                const hasUnresolved =
                                  name1Status?.status === "unresolved" ||
                                  name2Status?.status === "unresolved";
                                const needsBadge =
                                  hasAmbiguous || hasUnresolved;

                                return (
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                    <span className="truncate">
                                      {row.name || "—"} / {row.name2 || "—"}
                                    </span>
                                    {needsBadge && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Open resolution modal for the first problematic name
                                          if (
                                            name1Status?.status !== "resolved"
                                          ) {
                                            handleOpenResolutionModal(
                                              row,
                                              null
                                            );
                                          } else if (
                                            name2Status?.status !== "resolved"
                                          ) {
                                            const name2Row = {
                                              ...row,
                                              name: row.name2 || "",
                                            };
                                            handleOpenResolutionModal(
                                              name2Row,
                                              null
                                            );
                                          }
                                        }}
                                        className={`flex-shrink-0 ${
                                          hasAmbiguous
                                            ? "text-blue-500 hover:text-blue-600"
                                            : "text-amber-500 hover:text-amber-600"
                                        }`}
                                        title={
                                          tooltipParts.join("; ") ||
                                          "Click to resolve"
                                        }
                                      >
                                        {hasAmbiguous ? (
                                          <HelpCircle className="w-3.5 h-3.5" />
                                        ) : (
                                          <AlertTriangle className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    )}
                                  </span>
                                );
                              })()
                            )}
                          </span>
                        ) : isCellEditing(rowIndex, "name") ? (
                          // Single input for non-totals bets (Edit Mode)
                          <TypableDropdown
                            value={row.name}
                            isFocused={true}
                            onFocus={() =>
                              setFocusedCell({ rowIndex, columnKey: "name" })
                            }
                            inputRef={getCellRef(rowIndex, "name")}
                            onSave={(val) => {
                              if (isLeg) {
                                handleNameCommitWithQueue(
                                  val,
                                  row,
                                  legIndex,
                                  row.name
                                );
                                handleLegUpdate(row.betId, legIndex, {
                                  entities: [val],
                                });
                              } else {
                                // Update bet.name AND leg.entities[0] for single bets
                                handleNameCommitWithQueue(
                                  val,
                                  row,
                                  null,
                                  row.name
                                );

                                const bet = bets.find(
                                  (b) => b.id === row.betId
                                );
                                const updates: any = { name: val };

                                if (
                                  bet?.legs?.length === 1 &&
                                  bet.betType !== "parlay" &&
                                  bet.betType !== "sgp" &&
                                  bet.betType !== "sgp_plus"
                                ) {
                                  // Preserve other entities if they exist (unlikely for single leg, but safe)
                                  const currentEntities =
                                    bet.legs[0].entities || [];
                                  const newEntities = [...currentEntities];
                                  newEntities[0] = val;
                                  updates.legs = [
                                    { ...bet.legs[0], entities: newEntities },
                                  ];
                                }

                                updateBet(row.betId, updates);
                              }
                              exitEditMode();
                            }}
                            options={[
                              ...suggestionLists.players(row.sport),
                              ...suggestionLists.teams(row.sport),
                            ]}
                            initialQuery={editSeed ?? undefined}
                            allowCustom={true}
                            className="w-full"
                          />
                        ) : (
                          // Display Mode
                          <span className="flex items-center gap-1 min-w-0">
                            <span className="truncate">
                              {row.name || (
                                <span className="opacity-0">Empty</span>
                              )}
                            </span>
                            {row.name &&
                              isNameUnresolved(row.name, row.sport) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenResolutionModal(row, legIndex);
                                  }}
                                  className="flex-shrink-0 text-amber-500 hover:text-amber-600"
                                  title="Unresolved - click to resolve"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              )}
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("ou") +
                          " text-center whitespace-nowrap min-w-0"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "ou", e)}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "ou")
                        }
                      >
                        {isCellFocused(rowIndex, "ou") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "ou", e)
                            }
                          />
                        )}
                        {isCellEditing(rowIndex, "ou") ? (
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
                                const bet = bets.find(
                                  (b) => b.id === row.betId
                                );
                                const updates: any = { ou: ouValue };

                                if (
                                  bet?.legs?.length === 1 &&
                                  bet.betType !== "parlay" &&
                                  bet.betType !== "sgp" &&
                                  bet.betType !== "sgp_plus"
                                ) {
                                  updates.legs = [
                                    { ...bet.legs[0], ou: ouValue },
                                  ];
                                }

                                updateBet(row.betId, updates);
                              }
                              exitEditMode();
                            }}
                            options={["O", "U"]}
                            isFocused={true}
                            onFocus={() =>
                              setFocusedCell({ rowIndex, columnKey: "ou" })
                            }
                            inputRef={getCellRef(rowIndex, "ou")}
                            allowCustom={false}
                            className="text-center font-semibold"
                            initialQuery={editSeed ?? undefined}
                          />
                        ) : (
                          <span className="block font-semibold">
                            {row.ou === "Over"
                              ? "O"
                              : row.ou === "Under"
                              ? "U"
                              : ""}
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("line") +
                          " whitespace-nowrap text-right tabular-nums min-w-0"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "line", e)}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "line")
                        }
                      >
                        {isCellFocused(rowIndex, "line") && (
                          <div
                            className="absolute bottom-0 right-0 w-2 h-2 bg-blue-500 cursor-crosshair z-10"
                            onMouseDown={(e) =>
                              handleDragFillStart(rowIndex, "line", e)
                            }
                          />
                        )}
                        {isCellEditing(rowIndex, "line") ? (
                          <EditableCell
                            value={row.line || ""}
                            type="text"
                            isFocused={true}
                            onFocus={() =>
                              setFocusedCell({ rowIndex, columnKey: "line" })
                            }
                            inputRef={getCellRef(rowIndex, "line")}
                            onSave={(val) => {
                              if (isLeg) {
                                handleLegUpdate(row.betId, legIndex, {
                                  target: val,
                                });
                              } else {
                                const bet = bets.find(
                                  (b) => b.id === row.betId
                                );
                                const updates: any = { line: val };

                                // Sync to leg target for single bets
                                if (
                                  bet?.legs?.length === 1 &&
                                  bet.betType !== "parlay" &&
                                  bet.betType !== "sgp" &&
                                  bet.betType !== "sgp_plus"
                                ) {
                                  // target field in leg is number | string, line field in bet is string
                                  // Attempt to keep them consistent
                                  updates.legs = [
                                    { ...bet.legs[0], target: val },
                                  ];
                                }

                                updateBet(row.betId, updates);
                              }
                              exitEditMode();
                            }}
                            className="text-right tabular-nums"
                            initialValue={editSeed ?? undefined}
                          />
                        ) : (
                          <span
                            className="block whitespace-nowrap overflow-hidden"
                            style={{ textOverflow: "clip" }}
                            title={row.line || ""}
                          >
                            {row.line}
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("odds") +
                          " whitespace-nowrap text-right tabular-nums min-w-0"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "odds", e)}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "odds")
                        }
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
                        ) : isCellEditing(rowIndex, "odds") ? (
                          <EditableCell
                            value={formatOdds(row.odds)}
                            type="number"
                            formatAsOdds={true}
                            isFocused={true}
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
                              exitEditMode();
                            }}
                            className="text-right tabular-nums"
                            initialValue={editSeed ?? undefined}
                          />
                        ) : (
                          <span
                            className="block whitespace-nowrap overflow-hidden"
                            style={{ textOverflow: "clip" }}
                            title={formatOdds(row.odds)}
                          >
                            {formatOdds(row.odds)}
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("bet") +
                          " whitespace-nowrap text-right tabular-nums border-l border-neutral-200 dark:border-neutral-700 min-w-0"
                        }
                        onClick={(e) => handleCellClick(rowIndex, "bet", e)}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "bet")
                        }
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
                        ) : isCellEditing(rowIndex, "bet") ? (
                          <EditableCell
                            value={formatCurrency(row.bet)}
                            type="number"
                            isFocused={true}
                            onFocus={() =>
                              setFocusedCell({
                                rowIndex,
                                columnKey: "bet",
                              })
                            }
                            inputRef={getCellRef(rowIndex, "bet")}
                            onSave={(val) => {
                              const numVal = parseFloat(
                                val.replace(/[$,]/g, "")
                              );
                              if (!isNaN(numVal))
                                updateBet(row.betId, { stake: numVal });
                              exitEditMode();
                            }}
                            className="text-right tabular-nums"
                            initialValue={editSeed ?? undefined}
                          />
                        ) : (
                          <span
                            className="block whitespace-nowrap overflow-hidden"
                            style={{ textOverflow: "clip" }}
                            title={formatCurrency(row.bet)}
                          >
                            {formatCurrency(row.bet)}
                          </span>
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
                          <span
                            className="block whitespace-nowrap overflow-hidden"
                            style={{ textOverflow: "clip" }}
                            title={formatCurrency(row.toWin)}
                          >
                            {formatCurrency(row.toWin)}
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          getCellClasses("result") +
                          " capitalize whitespace-nowrap text-center min-w-0 !cursor-default " +
                          resultBgClass
                        }
                        style={{ cursor: "default" }}
                        onClick={() => handleCellDoubleClick(rowIndex, "result")}
                        onDoubleClick={() =>
                          handleCellDoubleClick(rowIndex, "result")
                        }
                      >
                        <div className={resultTextClass}>
                          {isCellEditing(rowIndex, "result") ? (
                            <ResultCell
                              value={displayResult}
                              onSave={(val) => {
                                if (isLeg) {
                                  handleLegUpdate(row.betId, legIndex, {
                                    result: val,
                                  });
                                } else {
                                  const bet = bets.find(
                                    (b) => b.id === row.betId
                                  );
                                  const updates: any = { result: val };

                                  if (
                                    bet?.legs?.length === 1 &&
                                    bet.betType !== "parlay" &&
                                    bet.betType !== "sgp" &&
                                    bet.betType !== "sgp_plus"
                                  ) {
                                    updates.legs = [
                                      { ...bet.legs[0], result: val },
                                    ];
                                  }

                                  updateBet(row.betId, updates);
                                }
                                exitEditMode();
                              }}
                              isFocused={true}
                              inputRef={getCellRef(rowIndex, "result")}
                              initialQuery={editSeed ?? undefined}
                            />
                          ) : (
                            <span className="block font-semibold">
                              {displayResultLabel}
                            </span>
                          )}
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
                          <span
                            className="block whitespace-nowrap overflow-hidden"
                            style={{ textOverflow: "clip" }}
                            title={formatCurrency(net)}
                          >
                            {formatCurrency(net)}
                          </span>
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
                        {isCellEditing(rowIndex, "tail") ? (
                          <TypableDropdown
                            value={row.tail || ""}
                            isFocused={true}
                            onFocus={() =>
                              setFocusedCell({ rowIndex, columnKey: "tail" })
                            }
                            inputRef={getCellRef(rowIndex, "tail")}
                            onSave={(newValue) => {
                              updateBet(row.betId, { tail: newValue });
                              exitEditMode();
                            }}
                            options={tailSuggestions}
                            allowCustom={true}
                            initialQuery={editSeed ?? undefined}
                          />
                        ) : (
                          <span className="flex items-center gap-1 min-w-0">
                            <span className="truncate">
                              {(() => {
                                if (!row.tail) return "";
                                const found = tails.find(t => 
                                  t.name.toLowerCase() === row.tail?.toLowerCase() || 
                                  t.displayName?.toLowerCase() === row.tail?.toLowerCase()
                                );
                                return found?.displayName || row.tail;
                              })()}
                            </span>
                            {row.tail && isTailUnresolved(row.tail) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddTail(row.tail!, row);
                                }}
                                className="flex-shrink-0 text-amber-500 hover:text-amber-600"
                                title="Unrecognized Tail - Click to Add to List"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
              {/* Add Bet row - subtle row at bottom of table */}
              <tr
                onClick={() => handleAddManualBet(batchCount)}
                className="border-b dark:border-neutral-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors group"
              >
                <td
                  colSpan={headers.length + 1}
                  className="px-2 py-1.5 text-neutral-400 dark:text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                >
                  <span className="text-lg leading-none mr-1">+</span>
                  <span className="text-sm">Add Bet</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Name Resolution Modals */}
      {resolvingNameItem && (() => {
        const rawValue =
          resolvingNameItem.entityType === "betType" ||
          resolvingNameItem.entityType === "stat"
            ? resolvingNameItem.row.type
            : resolvingNameItem.row.name;
            
        const commonItemProps = {
            id: generateUnresolvedItemId(
              rawValue,
              resolvingNameItem.row.betId,
              resolvingNameItem.legIndex ?? 0
            ),
            rawValue: rawValue,
            entityType: resolvingNameItem.entityType,
            encounteredAt: new Date().toISOString(),
            book: resolvingNameItem.row.site,
            betId: resolvingNameItem.row.betId,
            legIndex: resolvingNameItem.legIndex ?? 0,
            sport: resolvingNameItem.row.sport,
            market: resolvingNameItem.row.type,
        };

        return (
          <>
            {resolutionMode === "map" && (
              <MapToExistingModal
                item={commonItemProps}
                teams={normalizationTeams}
                players={normalizationPlayers}
                betTypes={normalizationBetTypes}
                onConfirm={handleMapConfirm}
                onCancel={() => setResolvingNameItem(null)}
                onSwitchToCreate={() => setResolutionMode("create")}
              />
            )}
            {resolutionMode === "create" && (
              <CreateCanonicalModal
                item={commonItemProps}
                onConfirm={handleCreateConfirm}
                onCancel={() => setResolvingNameItem(null)}
              />
            )}
          </>
        );
      })()}

      {/* Tail Quick Add Modal */}
      {/* Tail Quick Add Modal */}
      {resolvingTailItem && (
        <AddTailModal
          tailName={resolvingTailItem.initialValue}
          onConfirm={(finalName, finalDisplayName) => {
            // Add to saved list with provided display name
            addTail({ name: finalName, displayName: finalDisplayName });

            // Update the specific bet row. Use the display name as that's what we show in the grid.
            if (finalDisplayName !== resolvingTailItem.initialValue && finalName !== resolvingTailItem.initialValue) {
               // Logic: If user edited the name, update the cell.
               // We should probably update the cell to the Display Name to match the dropdown behavior.
               updateBet(resolvingTailItem.row.betId, { tail: finalDisplayName });
            }

            setResolvingTailItem(null);
          }}
          onCancel={() => setResolvingTailItem(null)}
        />
      )}
    </div>
  );
};

export default BetTableView;
