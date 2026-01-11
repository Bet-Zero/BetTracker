# BET_TRACKER_ROW_GRID_SPEC.md

## PREFLIGHT RETURN PACKAGE — Row-Based "Spreadsheet Feel" for Bet Tracker Grid

**MODE**: PREFLIGHT (Review-only; NO code changes)  
**DATE**: 2026-01-07  
**STATUS**: COMPLETE

---

## 1) Grid Entry Points

### Main Component(s)

- **`BetTableView`** - The primary grid/table component for displaying and editing bet rows

### File Paths

- `views/BetTableView.tsx` (2,473 lines) - Main grid component
- `hooks/useBets.tsx` - Data source and CRUD operations for bets
- `hooks/useInputs.tsx` - Reference data (sportsbooks, sports, categories, bet types, players, teams, tails)
- `parsing/shared/betToFinalRows.ts` - Converts Bet objects to FinalRow display format
- `services/persistence.ts` - localStorage persistence layer

### Column Definitions Location

Columns are defined as a **static array** at `BetTableView.tsx:888-912`:

```typescript
const headers: {
  key: keyof FlatBet;
  label: string;
  style: React.CSSProperties;
}[] = [
  { key: "date", label: "Date", style: {} },
  { key: "site", label: "Site", style: {} },
  { key: "sport", label: "Sport", style: {} },
  { key: "category", label: "Cat", style: {} },
  { key: "type", label: "Type", style: {} },
  { key: "name", label: "Name", style: {} },
  { key: "ou", label: "O/U", style: { whiteSpace: "nowrap" } },
  { key: "line", label: "Line", style: { textAlign: "right" } },
  { key: "odds", label: "Odds", style: { textAlign: "right" } },
  { key: "bet", label: "Bet", style: { textAlign: "right" } },
  { key: "toWin", label: "Win", style: { textAlign: "right" } },
  { key: "result", label: "Result", style: { textAlign: "center" } },
  { key: "net", label: "Net", style: { textAlign: "right" } },
  { key: "isLive", label: "Live", style: { textAlign: "center" } },
  { key: "tail", label: "Tail", style: {} },
];
```

Fixed column widths are defined at `BetTableView.tsx:27-43`:

```typescript
const COL_W: Record<string, string> = {
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
```

### Overflow Handling (Numeric Columns)

**Strategy**: Hard clip at cell boundary + tooltip-only for full value visibility (no truncation/ellipsis).

**Implementation** (added 2026-01-09):

- All `<td>` cells include `overflow-hidden` via `getCellClasses()` base classes
- Numeric column display spans use:
  - `whitespace-nowrap overflow-hidden` classes
  - `style={{ textOverflow: 'clip' }}` (explicit hard clip, NOT ellipsis)
  - `title={formattedValue}` attribute for hover tooltip

**Columns covered**:
| Column | Key | Tooltip Shows |
|--------|-----|---------------|
| Line | `line` | Raw line value (e.g., "25.5") |
| Odds | `odds` | Formatted odds (e.g., "+3452453") |
| Bet | `bet` | Formatted currency (e.g., "$1,000.00") |
| Win | `toWin` | Formatted currency (e.g., "$2,500.00") |
| Net | `net` | Formatted currency (e.g., "-$20,000.00") |

**What this ensures**:

- Long values like `+3452453` or `-$20,000.00` do NOT overflow into adjacent cells
- No ellipsis ("...") appears - values are hard-clipped at cell edge
- Full formatted value is visible on hover via native browser tooltip

### Row Data Source

Row data flows from:

1. **`useBets()` hook** (BetTableView.tsx line 448) → provides `bets`, `loading`, `updateBet`
2. **`flattenedBets` memo** (BetTableView.tsx lines 548-630) → transforms `Bet[]` to `FlatBet[]` via `betToFinalRows()`
3. **`filteredBets` memo** (BetTableView.tsx lines 768-771) → applies search/filter predicates
4. **`sortedBets` memo** (BetTableView.tsx lines 773-797) → applies sort config
5. **`visibleBets` memo** (BetTableView.tsx lines 800-811) → filters out collapsed parlay children

### Virtualization

**NO virtualization is currently used.** The table renders all visible rows directly via `.map()` at line 1682. This is a potential performance concern for large datasets.

---

## 2) Bet Row Schema

### Type/Interface Location

- **Bet interface**: `types.ts:103-126`
- **FinalRow interface**: `types.ts:163-198`
- **FlatBet interface** (internal): `BetTableView.tsx:57-83`

### Bet Interface (Canonical)

```typescript
export interface Bet {
  id: string; // Unique identifier (betId + placedAt combination)
  book: SportsbookName;
  betId: string; // Sportsbook-provided ID
  placedAt: string; // ISO timestamp
  settledAt?: string; // ISO timestamp
  betType: BetType; // "single" | "parlay" | "sgp" | "sgp_plus" | "live" | "other"
  marketCategory: MarketCategory; // "Props" | "Main Markets" | "Futures" | "Parlays"
  sport: string;
  description: string;
  name?: string; // Player/team name only
  odds?: number | null;
  stake: number;
  payout: number;
  result: BetResult; // "win" | "loss" | "push" | "pending"
  type?: string; // Stat type for props (e.g., "3pt", "Pts", "Ast")
  line?: string; // Line/threshold (e.g., "3+", "25.5")
  ou?: "Over" | "Under";
  legs?: BetLeg[]; // All bets have legs: singles have length === 1
  tail?: string; // Who the bet was tailed from
  raw?: string; // Raw text block for debugging
  isLive?: boolean; // Whether bet was placed live/in-game
  isSample?: boolean; // Whether this is sample data
}
```

### Example Object

```javascript
{
  id: "FD-12345-2024-01-15T10:30:00Z",
  book: "FanDuel",
  betId: "FD-12345",
  placedAt: "2024-01-15T10:30:00Z",
  betType: "single",
  marketCategory: "Props",
  sport: "NBA",
  description: "LeBron James Over 25.5 Points",
  name: "LeBron James",
  odds: -110,
  stake: 10,
  payout: 19.09,
  result: "win",
  type: "Pts",
  line: "25.5",
  ou: "Over",
  legs: [{
    entities: ["LeBron James"],
    entityType: "player",
    market: "Player Points",
    target: 25.5,
    ou: "Over",
    odds: -110,
    result: "WIN"
  }],
  isLive: false
}
```

### Required vs Optional Fields

**Required fields** (enforced by `validateBetForImport()` in `utils/importValidation.ts`):

- `id` - Must be non-empty string
- `stake` - Must be positive number
- `placedAt` - Must be valid ISO timestamp
- `result` - Must be valid BetResult
- `odds` - Required for wins (for Net calculation)

**Optional fields**:

- `settledAt`, `name`, `line`, `ou`, `tail`, `raw`, `isLive`, `isSample`
- `type`, `description`
- `legs` (but recommended for structured data)

### Default Values for New Rows

Currently, **no manual row creation exists**. Rows are only created via the import pipeline. When implementing manual row add, suggested defaults:

```javascript
{
  id: generateUniqueId(),       // UUID or timestamp-based
  book: "",                     // User must select
  betId: "",                    // Can be empty for manual entries
  placedAt: new Date().toISOString(),
  betType: "single",
  marketCategory: "Props",      // Most common
  sport: "",                    // User must select
  description: "",
  stake: 0,                     // User must enter
  payout: 0,
  result: "pending",
  legs: []
}
```

### Validation Code

- `utils/validation.ts` - `validateBet()` for general bet validation
- `utils/importValidation.ts` - `validateBetForImport()` for import pipeline validation

---

## 3) Edit Commit Path

### Where Edits Are Captured

Edits are captured in **cell-level components** within `BetTableView.tsx`:

1. **`EditableCell`** (lines 93-198) - Text/number inputs
2. **`TypableDropdown`** (lines 220-414) - Combobox for categorical fields
3. **`OUCell`** (lines 416-444) - Over/Under dropdown
4. **`ResultCell`** (lines 200-217) - Result select dropdown

Each cell component maintains **local state** via `useState` and commits on **blur** or **Enter**.

### Where Edits Are Committed

Edits are committed via the **`updateBet`** function from `useBets()`:

```typescript
// useBets.tsx:193-227
const updateBet = useCallback((betId: string, updates: Partial<Bet>) => {
  setBets((prevBets) => {
    const betIndex = prevBets.findIndex((b) => b.id === betId);
    if (betIndex === -1) return prevBets;

    const updatedBets = [...prevBets];
    const updatedBet = { ...originalBet, ...updates };

    // Validation
    const validation = validateBet(updatedBet);
    if (!validation.valid) {
      console.warn(`Bet validation failed: ${validation.errors.join(", ")}`);
    }

    // Auto-recalculate payout if stake/odds/result change
    if ("stake" in updates || "odds" in updates || "result" in updates) {
      updatedBet.payout = recalculatePayout(
        updatedBet.stake,
        updatedBet.odds,
        updatedBet.result
      );
    }

    updatedBets[betIndex] = updatedBet;
    saveBets(updatedBets);
    return updatedBets;
  });
}, []);
```

### Persistence Layer

- **Storage mechanism**: localStorage
- **Key**: `bettracker-state`
- **Format**: JSON envelope with version + bets array
- **Service**: `services/persistence.ts`

```typescript
// persistence.ts:255-297
export function saveState(state: PersistedState): Result<void> {
  if (!validatePersistedStateShape(state)) {
    return err(
      createImportError(
        "STORAGE_FAILED",
        "Cannot save: state has invalid shape"
      )
    );
  }

  const serialized = JSON.stringify(stateToSave);
  localStorage.setItem(STORAGE_KEY, serialized);
  return ok(undefined);
}
```

### Debouncing/Throttling

- **No debouncing** on individual cell edits - each `updateBet()` call triggers immediate save
- **Search input** is debounced (200ms) via `useDebouncedValue` hook (BetTableView.tsx line 517)

### Edit Flow Summary

```
User types in cell → local state updates →
blur/Enter → onSave callback →
updateBet(betId, { field: newValue }) →
setBets() → saveBets() →
localStorage.setItem()
```

---

## 4) Import Append Path

### Entry Function(s)

Bets are added via **`addBets`** function in `useBets.tsx:130-191`:

```typescript
const addBets = useCallback(
  (newBets: Bet[]) => {
    // 1. Process entities from legs
    newBets.forEach((bet) => {
      bet.legs?.forEach((leg) => {
        if (leg.entityType === "player") addPlayer(bet.sport, entity);
        else if (leg.entityType === "team") addTeam(bet.sport, entity);
      });
    });

    // 2. Filter duplicates by ID
    const existingBetIds = new Set(prevBets.map((b) => b.id));
    const trulyNewBets = newBets.filter(
      (newBet) => !existingBetIds.has(newBet.id)
    );

    // 3. Validate (filter out blockers)
    const validBets = trulyNewBets.filter(
      (bet) => validateBetForImport(bet).valid
    );

    // 4. Auto-classify if missing category
    const classifiedNewBets = validBets.map((bet) => {
      if (!bet.marketCategory)
        return { ...bet, marketCategory: classifyBet(bet) };
      return bet;
    });

    // 5. Merge and save
    const updatedBets = [...prevBets, ...classifiedNewBets].sort(
      (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
    );
    saveBets(updatedBets);
    return classifiedNewBets.length;
  },
  [addPlayer, addTeam]
);
```

### ID Generation

IDs are generated by **parsers** (not by addBets):

- Format: `{betId from sportsbook}-{placedAt ISO timestamp}`
- Example: `"FD-12345-2024-01-15T10:30:00Z"`

For manual row creation, a new ID generation strategy will be needed (e.g., UUID or `manual-{timestamp}`).

### Normalization/Migration

- **Migration on load**: `services/persistence.ts:migrateIfNeeded()` handles legacy format migration
- **Classification fallback**: `addBets()` calls `classifyBet()` if `marketCategory` is missing
- **Entity normalization**: `services/normalizationService.ts` provides `normalizeStatType()`, `normalizeTeamName()`, etc.

### Import Pipeline Call Path

```
ImportView.tsx:handleConfirmImport() →
addBets(parsedBets) →
dedup by ID → validateBetForImport() →
classifyBet() → sort by date →
saveBets() → localStorage
```

---

## 5) Existing Selection / Keyboard / Clipboard

### Cell Selection (EXISTS)

The grid **already has cell-based selection** implemented in BetTableView.tsx at lines 496-501, 991-1017:

```typescript
// State
const [focusedCell, setFocusedCell] = useState<CellCoordinate | null>(null);
const [selectionRange, setSelectionRange] = useState<SelectionRange>(null);
const [selectionAnchor, setSelectionAnchor] = useState<CellCoordinate | null>(
  null
);

// Types
type CellCoordinate = { rowIndex: number; columnKey: keyof FlatBet };
type SelectionRange = { start: CellCoordinate; end: CellCoordinate } | null;
```

**Features**:

- Single cell focus (click)
- Range selection (Shift+click)
- Multi-cell selection (Ctrl/Cmd+click extends)
- Visual highlight for selected/focused cells

### Row Selection (DOES NOT EXIST)

**No row-level selection exists.** The current selection is cell-based. To implement row selection, new state is needed:

```typescript
// Proposed (not implemented)
const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
```

### Keyboard Navigation (EXISTS)

Keyboard handling exists in BetTableView.tsx at lines 1031-1141:

**Supported keys**:

- `ArrowUp/Down/Left/Right` - Navigate cells
- `Tab/Shift+Tab` - Move right/left across columns
- `Enter` - Move down (when not editing)
- `Home/End` - First/last column (with Ctrl: first/last row)
- `Escape` - Cancel edit (reverts to original value)
- `Ctrl/Cmd+C` - Copy selected cells
- `Ctrl/Cmd+V` - Paste into cells

**NOT implemented**:

- `Cmd/Ctrl+Enter` - No shortcut for adding rows
- `Cmd/Ctrl+D` - No shortcut for duplicating rows
- `Shift+Enter` - Does not move up (only down is implemented)

### Clipboard Support (PARTIAL)

Clipboard **copy and paste exist** in BetTableView.tsx at lines 1163-1274:

**Copy** (handleCopy):

- Copies focused cell or selection range
- Formats as **TSV** (tab-separated values)
- Uses `navigator.clipboard.writeText()`

**Paste** (handlePaste):

- Reads TSV from clipboard
- Parses rows by newline, columns by tab
- Pastes into existing cells starting at focused cell
- **Does NOT create new rows** - only fills existing cells

**Missing for row creation from paste**:

- Parse TSV and create new Bet objects
- Add rows via `addBets()` or a new `addManualBet()` function

---

## 6) Constraints + Risk Notes

### Performance

- **No virtualization**: All visible rows render; potential slowdown with 500+ rows
- **Cell ref map**: `cellRefs.current` grows unbounded as more cells are accessed
- **Full re-render on any bet update**: `flattenedBets` memo recalculates on every bet change

**Recommendation**: Consider virtualization (react-window) if row count exceeds ~1000

### Persistence

- **Immediate save on every edit**: Each cell blur triggers localStorage write
- **No batching**: Rapid edits cause multiple writes
- **No undo/redo**: Changes are immediate and permanent

**Recommendation**: For bulk operations, batch updates into a single `saveBets()` call

### UI Constraints (from problem statement: NO UI restyling)

- Must preserve existing table layout and fixed column widths
- Must preserve existing color scheme and styling
- Any new buttons (e.g., "+ Add Bet") must fit existing visual conventions

### Data Model Constraints

- Bet ID must be unique (used as React key and for deduplication)
- Manual entries need a distinct ID scheme (e.g., `manual-{uuid}`)
- Partial rows must still pass validation before save

### Controlled Input Rerender Risks

- Each cell is a controlled input with local state + value sync from props
- Rapid state updates can cause cursor position issues
- Current mitigation: `useEffect` syncs `text` state when `value` prop changes (BetTableView.tsx lines 122-124)

---

## 7) Recommended Minimal Implementation Plan

### A) What to Build New

#### 1. Row Selection State (in BetTableView.tsx)

```typescript
const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
```

- Add row header column (or use existing mechanism) for row selection
- Implement Shift+click for range select
- Implement Cmd/Ctrl+click for toggle select

#### 2. Manual Row Creation (in useBets.tsx)

```typescript
const createManualBet = useCallback((): string => {
  const newBet: Bet = {
    id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    book: "",
    betId: "",
    placedAt: new Date().toISOString(),
    betType: "single",
    marketCategory: "Props",
    sport: "",
    description: "",
    stake: 0,
    payout: 0,
    result: "pending",
    legs: [],
  };
  setBets((prev) => {
    const updated = [newBet, ...prev];
    saveBets(updated);
    return updated;
  });
  return newBet.id;
}, []);
```

#### 3. Duplicate Row(s) Function (in useBets.tsx)

```typescript
const duplicateBets = useCallback((betIds: string[]): string[] => {
  const newIds: string[] = [];
  setBets((prev) => {
    const toDuplicate = prev.filter((b) => betIds.includes(b.id));
    const duplicated = toDuplicate.map((bet) => {
      const newId = `dup-${bet.id}-${Date.now()}`;
      newIds.push(newId);
      return {
        ...bet,
        id: newId,
        placedAt: new Date().toISOString(),
        result: "pending", // Clear result for duplicate
        payout: 0, // Clear payout
      };
    });
    const updated = [...prev, ...duplicated].sort(/*by date*/);
    saveBets(updated);
    return updated;
  });
  return newIds;
}, []);
```

#### 4. Bulk Clear Fields (in BetTableView.tsx)

```typescript
const bulkClearFields = useCallback(
  (rowIds: string[], fields: (keyof Bet)[]) => {
    rowIds.forEach((id) => {
      const updates: Partial<Bet> = {};
      fields.forEach((field) => {
        updates[field] = field === "result" ? "pending" : "";
      });
      updateBet(id, updates);
    });
  },
  [updateBet]
);
```

#### 5. Bulk Apply Value (in BetTableView.tsx)

```typescript
const bulkApplyValue = useCallback(
  (rowIds: string[], field: keyof Bet, value: any) => {
    rowIds.forEach((id) => {
      updateBet(id, { [field]: value });
    });
  },
  [updateBet]
);
```

#### 6. Paste-to-Create-Rows (in BetTableView.tsx)

```typescript
const handlePasteToCreateRows = useCallback(async () => {
  const text = await navigator.clipboard.readText();
  const rows = text.split("\n").filter((r) => r.trim());
  const pasteData = rows.map((row) => row.split("\t"));

  // Map TSV columns to Bet fields (by column order or header detection)
  const newBets: Bet[] = pasteData.map((rowData, idx) => ({
    id: `paste-${Date.now()}-${idx}`,
    // ... map columns to fields
  }));

  addBets(newBets);
}, [addBets]);
```

### B) What to Reuse

| Feature          | Existing Code                           | Location                     |
| ---------------- | --------------------------------------- | ---------------------------- |
| Cell editing     | `EditableCell`, `TypableDropdown`, etc. | BetTableView.tsx:93-444      |
| Cell selection   | `focusedCell`, `selectionRange` state   | BetTableView.tsx:496-501     |
| Keyboard nav     | `handleKeyDown`                         | BetTableView.tsx:1031-1141   |
| Copy/Paste cells | `handleCopy`, `handlePaste`             | BetTableView.tsx:1163-1274   |
| Bet persistence  | `updateBet`, `saveBets`                 | useBets.tsx:193-227, 111-128 |
| Validation       | `validateBet`, `validateBetForImport`   | utils/validation.ts          |
| Reference data   | `useInputs()` hook                      | hooks/useInputs.tsx          |
| Drag-to-fill     | `dragFillData`, handlers                | BetTableView.tsx:1400-1537   |

### C) Suggested File/Module Placement

| New Feature                           | Recommended Location                                  |
| ------------------------------------- | ----------------------------------------------------- |
| Row selection state                   | BetTableView.tsx (keep with existing cell selection)  |
| `createManualBet()`                   | useBets.tsx (alongside `addBets`, `updateBet`)        |
| `duplicateBets()`                     | useBets.tsx                                           |
| Bulk operations (clear, apply)        | BetTableView.tsx (UI actions calling updateBet)       |
| "+ Add Bet" button                    | BetTableView.tsx (in header area near search/filters) |
| Keyboard shortcuts (Cmd+D, Cmd+Enter) | BetTableView.tsx:handleKeyDown                        |
| Paste-to-create-rows                  | BetTableView.tsx (extend handlePaste or new handler)  |

---

## 8) Open Questions (only if truly blocking)

1. **Row ID scheme for manual entries**: Should we use UUID, timestamp-based, or sequential IDs? (Recommend: `manual-{timestamp}-{random}`)

2. **Duplicate behavior for result/net fields**: Should duplicated rows clear result to "pending" and net to 0, or preserve original values? (Recommend: Clear to pending)

3. **Paste header detection**: When pasting TSV, should we detect if the first row is headers (matching column names) and skip it? (Recommend: Yes, optional detection)

4. **Parlay handling for manual add**: Can users manually create parlay rows, or only single bets? (Recommend: V1 = singles only, V2 = parlay support)

---

## STOP CONDITIONS CHECK

| Condition                                           | Status                                            |
| --------------------------------------------------- | ------------------------------------------------- |
| Grid is generated by blocking third-party component | ✅ CLEAR - Custom React component                 |
| Bet data is not editable at model layer             | ✅ CLEAR - `updateBet()` supports partial updates |
| Cannot locate where bets are created/appended       | ✅ CLEAR - `addBets()` in useBets.tsx             |

**PREFLIGHT COMPLETE** - No stop conditions triggered. Ready for execution prompt.

---

## Phase 1 Implemented Behavior

**Date Implemented**: 2026-01-07

### New Features Implemented

#### 1. Manual Row Creation

- **Button**: `+ Add Bet` button in the action area
- **Function**: `createManualBet()` in `useBets.tsx`
- **Behavior**:
  - Creates a new Bet object with safe defaults
  - ID format: `manual-{UUID}` to avoid collision with imported bets
  - Default values: `betType: "single"`, `marketCategory: "Props"`, `result: "pending"`, `stake: 0`, `payout: 0`
  - Appears at bottom of list (ascending sort by date - oldest first)
  - Persists to localStorage immediately
  - Focus moves to first editable cell (Site column) after creation

#### 2. Row Selection

- **State**: `selectedRowIds: Set<string>` and `rowSelectionAnchorId: string | null`
- **UI**: Row selector column (narrow left gutter) with checkmark indicator
- **Selection behaviors**:
  - **Click**: Selects single row, clears other selections
  - **Shift+click**: Selects contiguous range between anchor and clicked row
  - **Cmd/Ctrl+click**: Toggles individual row selection (adds/removes from selection)
- **Visual feedback**: Selected rows have blue background highlight and checkmark in selector column

#### 3. Duplicate Selected Rows

- **Function**: `duplicateBets(betIds: string[])` in `useBets.tsx`
- **Shortcut**: `Cmd/Ctrl + D`
- **Button**: "Duplicate" button (visible when rows selected)
- **Behavior**:
  - Duplicates all selected rows (or focused row if none selected)
  - New IDs: `dup-{UUID}`
  - Clears `betId` (sportsbook-provided ID)
  - Resets `result` to `"pending"` and `payout` to `0`
  - Sets `placedAt` to current time
  - Preserves all other fields (sport, category, type, stake, odds, etc.)
  - Selection moves to newly created rows
  - Focus moves to first editable cell of first duplicated row

#### 4. Bulk Clear Fields

- **UI**: "Clear Fields…" button (visible when rows selected) opens modal
- **Modal**: Checklist of clearable fields (site, sport, category, type, name, ou, line, odds, bet, result, isLive, tail)
- **Function**: `bulkUpdateBets(updatesById)` in `useBets.tsx` for batched updates
- **Clear rules**:
  - String fields → `""`
  - Numeric fields (odds, stake) → `0` or `null`
  - `result` → `"pending"`
  - `isLive` → `false`
  - `category` → `"Props"` (default)
- **Note**: Single save operation for all selected rows

#### 5. Bulk Apply Value

- **Shortcut**: `Cmd/Ctrl + Enter` (when rows selected and cell focused)
- **Supported columns**: site, sport, category, type, isLive, tail, result
- **Behavior**: Applies the value from the focused cell to the same column in all selected rows
- **Batching**: Uses `bulkUpdateBets()` for single save operation

### New Keyboard Shortcuts

| Shortcut           | Action                                        |
| ------------------ | --------------------------------------------- |
| `Cmd/Ctrl + D`     | Duplicate selected rows (or focused row)      |
| `Cmd/Ctrl + Enter` | Apply focused cell value to all selected rows |

### UI Changes

- **Row selector column**: Narrow (2.5ch width) left gutter column for row selection
- **Action bar**: Shows when rows selected with: count label, "Duplicate", "Clear Fields…", "✕ Clear selection"
- **Selected row highlight**: Blue background (`bg-blue-100 dark:bg-blue-900/30`)
- **No styling regressions**: All existing column widths preserved

### Technical Notes

- Deduplication logic added to prevent React.StrictMode double-invocation issues
- `saveBets()` called within functional state updates for consistency
- Row selection uses `betId` (original Bet.id) for stable references across re-renders

---

## Phase 1.1 Implemented Behavior

**Date Implemented**: 2026-01-07

### New Features Implemented

#### 1. Default Sort Order Changed to Ascending (Oldest First)

- **Change**: Default sort is now ascending by date (`{ key: "date", direction: "asc" }`)
- **Result**: Oldest bets appear at top, newest at bottom
- **New bets**: Appear at the bottom of the list (since they have `placedAt = now`)
- **Duplicates**: Appear at bottom (same logic - new `placedAt`)

#### 2. Batch Add Bet Count

- **UI**: Numeric input (1-100) next to the "+ Add Bet" button
- **Default**: 1
- **Behavior**: Clicking "+ Add Bet" creates N new manual bets in one operation
- **After creation**: All new rows selected, focus on Site cell of first new row

#### 3. Batch Duplicate Multiplier

- **UI**: Same batch count input controls both Add and Duplicate operations
- **Duplicate button**: Shows "Duplicate ×N" when N > 1
- **Shortcut**: `Cmd/Ctrl + D` uses current batch count
- **Behavior**: Duplicates the selected block N times
- **After duplication**: All new duplicated rows selected, focus on Site cell of first new row

#### 4. Delete Selected Rows

- **Button**: "Delete" button (red styling) visible when rows are selected
- **Keyboard**: `Delete` or `Backspace` triggers delete (when not typing in an input)
- **Confirmation**: Modal appears asking "Delete N bet(s)?" with Cancel/Delete buttons
- **Behavior**:
  - Deletes selected rows (or focused row if none selected)
  - Clears selection after deletion
  - Focus moves to nearest remaining row (next, or previous if no next)
- **Function**: `deleteBets(betIds: string[])` in `useBets.tsx`

#### 5. Undo System

- **Stack**: In-memory undo stack (up to 20 entries), not persisted
- **Supported actions**: Add Bet, Duplicate, Bulk Apply, Clear Fields, Delete
- **Snapshot approach**: Each undoable action captures `prevBetsSnapshot` before execution
- **Functions**:
  - `pushUndoSnapshot(label: string)` - Capture snapshot before action
  - `undoLastAction()` - Restore previous snapshot
  - `canUndo: boolean` - Whether undo is available
  - `lastUndoLabel: string | undefined` - Label of last action for display
- **UI**: "↩ Undo (Label)" button appears when undo is available
- **Keyboard**: `Cmd/Ctrl + Z` triggers undo (when not typing in an input)

### Updated Keyboard Shortcuts

| Shortcut               | Action                                        |
| ---------------------- | --------------------------------------------- |
| `Cmd/Ctrl + D`         | Duplicate selected rows ×N (uses batch count) |
| `Cmd/Ctrl + Enter`     | Apply focused cell value to all selected rows |
| `Cmd/Ctrl + Z`         | Undo last action                              |
| `Delete` / `Backspace` | Delete selected rows (shows confirmation)     |

### UI Changes

- **Batch count input**: Small numeric input (w-12) next to Add Bet button
- **Duplicate button**: Shows multiplier when batch count > 1
- **Delete button**: Red-styled button in action bar when rows selected
- **Undo button**: Shows "↩ Undo (action label)" when undo is available
- **Delete confirmation modal**: Simple confirm dialog with Cancel/Delete buttons

### Technical Notes

- Undo uses deep clone of bets array for snapshot safety
- Stack limited to 20 entries to prevent memory issues
- All undoable operations call `pushUndoSnapshot()` before mutation
- `bulkUpdateBets()` accepts optional `actionLabel` parameter for undo labeling

---

## Phase 2 Implemented Behavior — Spreadsheet UX Polish

**Date Implemented**: 2026-01-08

### Selection vs Edit Mode

The grid now has two distinct modes for cell interaction:

1. **Focused/Selected** — Cell has visual focus (blue ring) but is NOT in edit mode
2. **Editing** — Cell input is active and accepts keystrokes

#### Interaction Rules

| Action                | Result                                                 |
| --------------------- | ------------------------------------------------------ |
| Single click on cell  | Selects cell (focus ring), does NOT enter edit         |
| Double-click on cell  | Enters edit mode                                       |
| Enter on focused cell | Enters edit mode                                       |
| Escape while editing  | Cancels edit, reverts to original value, stays focused |
| Tab/Arrow keys        | Navigate between cells                                 |

#### Cursor Styling

- **Not editing**: Cell shows `cursor-default` (standard pointer)
- **Editing**: Input shows standard I-beam cursor

### TypableDropdown Typeahead Improvements

The `TypableDropdown` component (used for Sport, Site, Category, Type, etc.) now has improved Enter behavior:

1. **Auto-select first match**: When user types and filters results, pressing Enter selects the first filtered option (if no item is explicitly highlighted)
2. **Highlighted item takes priority**: If user arrows to highlight a specific option, Enter selects that option
3. **Invalid input rejection**: When `allowCustom=false`:
   - Typing an invalid value and pressing Enter does NOT create the value
   - The input reverts to the original value

### Sport Field Restrictions

The Sport dropdown now uses `allowCustom=false`:

- Typing "UF" → filters to show "UFC" → Enter selects "UFC"
- Typing "ZZZ" → no match → Enter does nothing (rejecting invalid input)
- New sports can only be created via Input Management, not by typing

### Updated State

New state in `BetTableView`:

```typescript
const [editingCell, setEditingCell] = useState<CellCoordinate | null>(null);
```

Helper function:

```typescript
const isCellEditing = useCallback(
  (rowIndex, columnKey) => {
    return (
      editingCell?.rowIndex === rowIndex && editingCell?.columnKey === columnKey
    );
  },
  [editingCell]
);
```

### Files Changed

| File                     | Changes                                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `views/BetTableView.tsx` | Added `editingCell` state, `isCellEditing` helper, `handleCellDoubleClick`, modified `handleCellClick`, updated keyboard handling, updated cell rendering for focus vs edit states |

### Phase 2.1 Extended Column Support

**Date Implemented**: 2026-01-08

This phase extended the "Select vs Edit" pattern to all remaining editable columns, ensuring a consistent spreadsheet experience across the entire grid.

#### Targeted Columns

The following columns now support the single-click select / double-click edit pattern:

- **Name**: Player/Team name input
- **O/U**: Over/Under dropdown
- **Line**: Text input for totals/spreads
- **Odds**: Numeric input
- **Bet**: Stake input
- **Tail**: Dropdown for tail source

#### Rendering Logic

Each of these columns now uses conditional rendering based on `isCellEditing(rowIndex, columnKey)`:

- **Default (Not Editing)**: Renders a static `<span>` (fast, read-only).
- **Editing**: Renders the controlled editor component (`EditableCell` or `TypableDropdown`) with `autoFocus`.

---

## Phase 2.2 Implemented Behavior — Date Editing + Delete Guard

**Date Implemented**: 2026-01-08

### Date Column Editing

The Date column is now fully editable with the same spreadsheet interaction pattern as other columns.

#### Interaction Rules

| Action                     | Result                                                 |
| -------------------------- | ------------------------------------------------------ |
| Single click on date cell  | Selects cell (focus ring), does NOT enter edit         |
| Double-click on date cell  | Enters edit mode                                       |
| Enter on focused date cell | Enters edit mode                                       |
| Escape while editing date  | Cancels edit, reverts to original value, stays focused |

#### Date Parsing

- **Input formats accepted**: `MM/DD/YY`, `MM/DD/YYYY`, `M/D/YY`, `M/D/YYYY`
- **Time handling**: Set to 12:00:00 local time (avoids midnight timezone rollover issues)
- **Invalid input**: Reverts to original value (no error shown)
- **Display format**: `MM/DD` (via existing `formatDateShort`)
- **Parsing function**: `parseDateInput()` in `utils/formatters.ts`

#### Implementation Details

- Date column added to `editableColumns` (removed from exclusion filter)
- Date cell uses `EditableCell` component when editing
- On save: parses input via `parseDateInput()`, updates `bet.placedAt` if valid
- Preserves existing display formatting and parlay child handling

### Sport Column Validation (Verified)

The Sport column already had proper validation in place:

- Uses `TypableDropdown` with `allowCustom={false}` (line 2593)
- Typeahead filtering works correctly
- Enter selects first filtered match
- Invalid values (e.g., "ZZZ") revert on blur/enter - no new sports created

### Delete/Backspace Guard

Fixed issue where Delete/Backspace keys triggered row deletion modal even while editing text.

#### Guard Conditions

Delete/Backspace triggers row deletion ONLY when ALL of these are true:

1. `editingCell === null` (not in edit mode)
2. Event target is NOT an `HTMLInputElement`
3. Event target is NOT an `HTMLTextAreaElement`
4. Event target is NOT an `HTMLSelectElement`
5. Event target is NOT contenteditable
6. At least one row is selected OR a cell is focused

#### Behavior

- **While editing any cell**: Delete/Backspace deletes characters normally (no modal)
- **While not editing with rows selected**: Delete/Backspace opens confirmation modal
- **While not editing with cell focused**: Delete/Backspace opens confirmation modal

### Files Changed

| File                     | Changes                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `views/BetTableView.tsx` | Added date to editableColumns, implemented date cell edit rendering, fixed delete guard |
| `utils/formatters.ts`    | Added `parseDateInput()` function                                                       |

---

## Phase 3 Implemented Behavior — Locked Input Management for Sports/Sites/Categories

**Date Implemented**: 2026-01-08

### Locked Fields Policy

The following fields in the BetTable are **managed-only** and cannot be created by typing in the table:

- **Sport**: Must be selected from managed Sports list
- **Site** (Sportsbook): Must be selected from managed Sites list
- **Category** (MarketCategory): Must be selected from managed Categories list

**Fields that remain flexible** (typing allowed):

- **Name**: Player/team name (auto-added to suggestions on commit)
- **Type**: Stat type (auto-added to suggestions on commit)

### Input Management UI

Sports, Sites, and Categories are managed in the **Input Management** view (`views/InputManagementView.tsx`):

1. **Sports Tab** (`components/InputManagement/SportsManager.tsx`):

   - List all sports
   - Add new sport (explicit button)
   - Delete sport (blocked if used by existing bets)
   - Shows bet count for each sport

2. **Sites Tab** (`components/InputManagement/SitesManager.tsx`):

   - List all sportsbooks (name, abbreviation, URL)
   - Add new site (explicit button with name/abbreviation/URL fields)
   - Delete site (blocked if used by existing bets)
   - Shows bet count for each site

3. **Categories Tab** (`components/InputManagement/CategoriesManager.tsx`):
   - Display fixed enum values: Props, Main Markets, Futures, Parlays
   - Read-only (no add/delete) - categories are fixed by system
   - Shows bet count for each category

### Removal Behavior (Option A - Block)

When a user attempts to delete a Sport or Site that is currently used by existing bets:

- **Block removal** with alert: "Cannot remove: X bets currently use this [sport/site]."
- The option remains in the list but cannot be deleted until all bets using it are removed or changed.

### No Accidental New Options Rule

In `BetTableView.tsx`, the dropdown components for Sport/Site/Category enforce strict picklist behavior:

- **`allowCustom={false}`** for Sport, Site, and Category dropdowns
- Typing an invalid value and pressing Enter:
  - Does NOT create the value
  - Does NOT add it to the options list
  - Reverts to the original value
- Enter selects first filtered match when typing partial text
- Invalid typed values never appear in dropdown options (no pollution)

### Implementation Details

**BetTableView.tsx changes**:

- Site dropdown: Changed `allowCustom={true}` → `allowCustom={false}` (line ~2594)
- Category dropdown: Changed `allowCustom={true}` → `allowCustom={false}` (line ~2673)
- Removed `addSport(val)` call from Sport onSave handler (line ~2623)
- Removed `addCategory(val)` call from Category onSave handler (line ~2661)
- Removed `addSport`/`addCategory` calls from bulk apply handler (lines ~1763, ~1767)
- Removed unused `addSport`/`addCategory` from useInputs destructuring

**New Manager Components**:

- `components/InputManagement/SportsManager.tsx` - Full CRUD with in-use blocking
- `components/InputManagement/SitesManager.tsx` - Full CRUD with in-use blocking
- `components/InputManagement/CategoriesManager.tsx` - Read-only display of enum values

**InputManagementView.tsx changes**:

- Added "Sports", "Sites", "Categories" tabs
- Updated `EntityTab` type to include new tabs
- Imported and rendered new manager components

### Files Changed

| File                                               | Changes                                                         |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `components/InputManagement/SportsManager.tsx`     | New component - Sports CRUD with in-use blocking                |
| `components/InputManagement/SitesManager.tsx`      | New component - Sites CRUD with in-use blocking                 |
| `components/InputManagement/CategoriesManager.tsx` | New component - Categories read-only display                    |
| `views/InputManagementView.tsx`                    | Added Sports/Sites/Categories tabs                              |
| `views/BetTableView.tsx`                           | Set allowCustom=false for Site/Category, removed auto-add calls |

---

## Phase 3.1 Implemented Behavior — Name Manual Entry Fix

**Date Implemented**: 2026-01-08

### Name Column Editing Fix

Fixed the Name column to fully support manual entry with proper persistence and unresolvedQueue integration.

#### Root Cause

The Name cell was missing the `onDoubleClick` handler that all other editable cells have, preventing double-click entry into edit mode.

#### Interaction Rules

| Action                     | Result                                                 |
| -------------------------- | ------------------------------------------------------ |
| Single click on name cell  | Selects cell (focus ring), does NOT enter edit         |
| Double-click on name cell  | Enters edit mode                                       |
| Enter on focused name cell | Enters edit mode                                       |
| Escape while editing name  | Cancels edit, reverts to original value, stays focused |

#### Data Persistence

When a Name is committed:

1. **For single bets without legs** (`legs: []`):

   - Updates `bet.name` field
   - Name display comes from `bet.name` via `betToFinalRows` (line 298)

2. **For single bets with one leg**:

   - Updates `bet.name` field
   - Also syncs to `bet.legs[0].entities[0]` to ensure consistency
   - Name display comes from `leg.entities[0]` via `betToFinalRows` (line 202)

3. **For parlay legs**:
   - Updates `bet.legs[legIndex].entities[0]`
   - Name display comes from `leg.entities[0]` via `betToFinalRows`

#### Saved Suggestions Behavior

On commit of a non-empty Name:

- Name is automatically added to player/team suggestions via `autoAddEntity()`
- Entity type (player vs team) is determined by market keywords:
  - Team markets: "moneyline", "ml", "spread", "total", etc.
  - Player markets: "player", "prop", "points", "rebounds", etc.
- Suggestions appear in Name dropdown on next edit

#### UnresolvedQueue Integration

When a Name is committed:

1. **Detect change** using a trimmed, case-insensitive compare (no-op if unchanged).
2. **Remove previous queue entry** if the previous value is non-empty:
   - `prevQueueId = generateUnresolvedItemId(prevName, betId, legIndex)`
   - `removeFromUnresolvedQueue([prevQueueId])`
3. **Enqueue the new value only if unresolved**:
   - If new name is empty: do not enqueue
   - If sport is missing: do not enqueue
   - Use `getNameResolutionStatus()` (same resolver logic as the badges)
   - If status is not `"resolved"`, add to unresolvedQueue with:
     - `context: "manual-entry"`
     - `sport`: Current sport
     - `rawValue`: The typed name
     - `betId`: Bet ID
     - `legIndex`: 0 for single/totals, actual leg index for parlay legs
     - `market`: Current bet type/market
     - `book`: Current sportsbook

Entity type (player vs team) is determined by market keywords:

- Team markets: "moneyline", "ml", "spread", "total", "run line", "money line", "outright winner", "to win"
- Player markets: All other markets default to player

**Field coverage**:

- `name` for single bets (legIndex = 0)
- `name2` for totals bets (legIndex = 0)
- Parlay leg `entities[0]` (legIndex = actual leg index)

#### Implementation Details

- Added `onDoubleClick` handler to Name cell td (line ~2749)
- Created `handleNameCommitWithQueue()` helper function to:
  - Add name to suggestions (via `autoAddEntity`)
  - Check resolution status
  - Add to unresolvedQueue if unresolved
- Updated Name `onSave` handler to use new helper
- Updated totals bet name handlers (name and name2) to use queue integration

### Files Changed

| File                     | Changes                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `views/BetTableView.tsx` | Added `onDoubleClick` to Name cell, added unresolvedQueue integration, created `handleNameCommitWithQueue` helper |

---

## Phase 3.2 Implemented Behavior — Real-Time Unresolved Name Resolution

**Date Implemented**: 2026-01-08

### Overview

The BetTable now displays visual markers for unresolved Name values and enables in-place resolution via the same Map/Create modals used in Import Confirmation.

### Unresolved Detection

Names are considered unresolved when:

- The name is non-empty AND
- The sport is known AND
- Both `resolvePlayer(name, { sport })` and `resolveTeam(name)` return status `"unresolved"`

**Source of Truth**: The resolver functions (`resolvePlayer`, `resolveTeam`) are used directly, NOT the unresolvedQueue. This ensures real-time accuracy even if queue entries are stale or missing.

### Visual Marker

When a Name is unresolved:

- A small amber warning icon (`AlertTriangle`) appears after the name text
- The icon is clickable and shows a tooltip: "Unresolved - click to resolve"
- The marker appears in both regular Name cells and totals bet Name/Name2 cells
- The marker does NOT force edit mode; it's visible in display mode

### Resolution Flow

1. **Click Badge**: User clicks the unresolved marker
2. **Modal Opens**: `MapToExistingModal` opens (default mode)
3. **User Chooses**:
   - **Map to Existing**: Select an existing canonical and add the raw value as an alias
   - **Create New**: Switch to `CreateCanonicalModal` to create a new canonical entry
4. **After Confirmation**:
   - Normalization data is updated (via `addTeamAlias`/`addPlayerAlias` or `addTeam`/`addPlayer`)
   - The unresolvedQueue entry is removed (via `removeFromUnresolvedQueue`)
   - The marker disappears immediately (due to `resolverVersion` refresh)

### Entity Type Determination

The entity type (player vs team) is determined from market context:

- **Team markets**: "moneyline", "ml", "spread", "total", "run line", "money line", "outright winner", "to win"
- **Player markets**: All other markets default to player

### Totals Bets Handling

For totals bets (Main Markets with type "Total"):

- Both `name` and `name2` cells are checked for unresolved status
- Each has its own badge if unresolved
- Clicking a badge opens the resolution modal for that specific name

### Implementation Details

**New State**:

```typescript
const [resolvingNameItem, setResolvingNameItem] = useState<{
  row: FlatBet;
  legIndex: number | null;
  entityType: "player" | "team";
} | null>(null);
const [resolutionMode, setResolutionMode] = useState<"map" | "create">("map");
```

**Helper Function**:

```typescript
const isNameUnresolved = useCallback(
  (name: string, sport: string): boolean => {
    if (!name || !name.trim() || !sport || !sport.trim()) return false;
    const playerResult = resolvePlayer(name, { sport: sport as Sport });
    const teamResult = resolveTeam(name);
    return (
      playerResult.status !== "resolved" && teamResult.status !== "resolved"
    );
  },
  [resolverVersion]
);
```

**Reused Components**:

- `MapToExistingModal` - For mapping to existing canonical
- `CreateCanonicalModal` - For creating new canonical
- Both modals are reused from ImportConfirmationModal without modification

**Normalization Integration**:

- Uses `useNormalizationData()` hook for:
  - `addTeamAlias`, `addPlayerAlias` (for mapping)
  - `addTeam`, `addPlayer` (for creating)
  - `resolverVersion` (for triggering re-renders)

### Files Changed

| File                     | Changes                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |

---

## Phase 5 Implemented Behavior — Date Cell UX: Digits-Only MMDD Input (Auto-format)

**Date Implemented**: 2026-01-11

### Overview

Improved the Date column editing experience to be faster and more spreadsheet-like:

- **Display**: Stays as `MM/DD` in the grid.
- **Input**: Digits-only input (user types `MMDD`).
- **Auto-Format**: Input automatically adds slash (e.g., `01` -> `01`, `011` -> `01/1`, `0112` -> `01/12`).
- **Commit**: Saves full ISO timestamp using **current year** and `12:00:00` local time.

### Interaction Rules

| Action | Result |
| :--- | :--- |
| Type digit (e.g. "1") on selected cell | Enters edit mode, sets input to "1" (Type-to-Edit) |
| Double-click cell | Enters edit mode, selects existing MMDD text |
| Backspace | Deletes digits naturally |
| Enter/Blur | Commits if valid, Reverts if invalid |
| Escape | Cancels edit, reverts to original |

### Validation & Parsing

- **Format**: `MM/DD` (digits only)
- **Validation**:
  - Month: 01-12
  - Day: Valid calendar day for the month (uses current year)
- **Time Rule**: Time is set to `12:00:00` local time to avoid timezone date rollover issues.
- **Year Rule**: Year is assumed to be the **current year** at the time of commit.

### Files Changed

| File | Changes |
| :--- | :--- |
| `views/BetTableView.tsx` | Implemented `DateCell` component and replaced `EditableCell` usage for date column. |
| `utils/formatters.ts` | Added `formatMMDDInput`, `parseMMDDInput`, `isValidMMDD`, `buildIsoFromMMDD` helpers. |

---

## Phase 4 Implemented Behavior — Totals Row UX + Sport-Scoped Team Resolution

**Date Implemented**: 2026-01-09

### Overview

Fixed two issues in BetTableView:

1. Totals bets (two-team rows like "Warriors / Magic") now render as a single line, preserving table density
2. Team resolution is now sport-scoped to prevent cross-sport alias collisions (e.g., "Hawks" in NBA won't match NFL Seahawks)

### Single-Line Totals Display

Totals bets (Main Markets with type "Total") now display team names on a single line:

```
"{team1} / {team2}"      [badge if needed]
```

**Styling applied**:

- `whitespace-nowrap` - prevents line wrapping
- `overflow-hidden` / `text-ellipsis` - truncates long names
- `inline-flex` layout with single combined badge

### Sport-Scoped Team Resolution

New function `resolveTeamForSport(name, sport)` in `services/resolver.ts`:

- Filters team matches by the provided sport context
- If a team matches but belongs to a different sport, returns `unresolved` status
- Prevents "Hawks" in NBA context from matching NFL Seahawks aliases

#### Resolution Order

1. If sport provided and team resolves with matching sport → `resolved`
2. If sport provided and team resolves but different sport → `unresolved`
3. If no sport provided, falls back to standard `resolveTeam` behavior

### Managed Teams/Players Suppression

The `getNameResolutionStatus()` helper now checks managed lists first:

- If a team/player exists in the user's managed list (from `useInputs`) for that sport, no warning is shown
- Case-insensitive, trimmed comparison
- This prevents false warnings for user-defined entities

### Ambiguous vs Unresolved States

Resolution now returns three distinct states:

| Status       | Badge         | Color | Description                                         |
| ------------ | ------------- | ----- | --------------------------------------------------- |
| `resolved`   | None          | -     | Team/player found in reference data or managed list |
| `ambiguous`  | HelpCircle    | Blue  | Multiple teams match this name (collision)          |
| `unresolved` | AlertTriangle | Amber | No match found in reference data                    |

**Tooltip format for totals**:

- Shows which team(s) have issues: `"Ambiguous: Hawks; Unresolved: TeamB"`
- Click opens resolution modal for the first problematic team

### Totals Two-Team Evaluation

For totals bets, both `name` and `name2` are evaluated independently:

1. Each team is checked against managed teams list (suppression)
2. Each team is checked via sport-scoped resolution
3. States are combined for badge display:
   - If either is ambiguous → show blue HelpCircle
   - If either is unresolved → show amber AlertTriangle
   - Tooltip lists all problematic teams

### Files Changed

| File                     | Changes                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `services/resolver.ts`   | Added `resolveTeamForSport()` function with sport filtering                                       |
| `views/BetTableView.tsx` | Added `getNameResolutionStatus()`, updated totals display to single-line, added HelpCircle import |
| `components/icons.tsx`   | Added `HelpCircle` icon for ambiguous state                                                       |

---

## Phase 5 Implemented Behavior — Site/Type Alias Search

**Date Implemented**: 2026-01-11

### Overview

BetTable dropdowns for **Site** and **Type** columns now support "smart" typeahead search where users can type full names or aliases, but the cell stores the canonical short code.

### Site Alias Search

**Matching Rule**:
- User types partial text (e.g., "Dra", "Draft", "DraftKings")
- Dropdown filters to match against: abbreviation, name, or aliases
- Display shows: `DK — DraftKings` (code — label format)
- On selection, cell stores: `DK` (abbreviation only)

**Data Model**:
The `Sportsbook` interface now includes an optional `aliases` field:

```typescript
interface Sportsbook {
  name: SportsbookName;      // "DraftKings"
  abbreviation: string;      // "DK"
  url: string;
  aliases?: string[];        // ["draftkings", "draft kings"]
}
```

If aliases are not specified, the sportsbook name (lowercased) is used as a default alias.

**No Custom Creation**:
Site dropdown uses `allowCustom={false}`. Invalid typed values do NOT create new sites.

### Type Alias Search

**Matching Rule**:
- User types full phrase (e.g., "Points", "Triple Double", "Threes")
- Dropdown filters to match against: canonical code, description, or aliases
- Display shows: `Pts — Points` (code — description format)
- On selection, cell stores: `Pts` (canonical code)

**Data Source**:
Type options come from the normalization service's `BetTypeInfo` which includes:
- `canonical`: Short code (e.g., "Pts", "TD", "3pt")
- `description`: Human-readable name (e.g., "Points", "Triple Double")
- `aliases`: Search terms (e.g., ["points", "pts", "point"])

**No Custom Creation**:
Type dropdown now uses `allowCustom={false}` (changed from `true`). Invalid typed values:
- Do NOT create new bet types
- Do NOT pollute the option list
- Revert to original value on blur/escape

### TypableDropdown Enhancement

The `TypableDropdown` component was enhanced with a new `optionData` prop:

```typescript
interface DropdownOption {
  value: string;      // Stored in cell
  label: string;      // Human-readable display
  aliases: string[];  // Search terms
}

// Props
optionData?: DropdownOption[];  // Rich options for alias search
```

When `optionData` is provided:
- Filtering uses alias-aware matching via `filterOptionsByQuery()`
- Display shows formatted options via `formatOptionDisplay()`
- Selection saves `option.value` (the code, not display text)

Legacy `options` prop (string array) continues to work for backwards compatibility.

### Alias Matching Utility

New file: `utils/aliasMatching.ts`

```typescript
// Normalize for comparison: lowercase, trim, remove punctuation
function normalizeForSearch(str: string): string;

// Check if query matches option's value, label, or aliases
function matchesOption(query: string, option: DropdownOption): boolean;

// Filter options array by query
function filterOptionsByQuery(query: string, options: DropdownOption[]): DropdownOption[];

// Format option for display: "value — label"
function formatOptionDisplay(option: DropdownOption): string;

// Score how well query matches option (higher = better)
function scoreMatch(query: string, option: DropdownOption): number;
```

### Ranking Rules (2026-01-11)

Results from `filterOptionsByQuery()` are sorted by match quality:

**Scoring Priority (highest to lowest):**
| Priority | Match Type | Score |
|----------|-----------|-------|
| 1 | Exact match on value (code) | 100 |
| 2 | Exact match on label | 90 |
| 3 | Exact match on alias | 80 |
| 4 | Prefix match on label | 70 |
| 5 | Prefix match on alias | 60 |
| 6 | Word-boundary match on label/alias | 40 |
| 7 | Substring match anywhere | 10 |

**Tie-breakers (in order):**
1. Prefer shorter label length
2. Prefer fewer words/tokens in label
3. Prefer shorter value/code length
4. Stable alphabetical by label/value

### No Option Pollution Rule

Neither Site nor Type dropdown adds typed junk into option lists:
- **Site**: Only added/removed via Input Management
- **Type**: Only created via canonical normalization flows (Map/Create), not raw typing

### Files Changed

| File | Changes |
|------|---------|
| `types.ts` | Added `aliases?: string[]` to `Sportsbook` interface |
| `utils/aliasMatching.ts` | NEW: Alias matching utility with `DropdownOption`, `matchesOption()`, etc. |
| `utils/aliasMatching.test.ts` | NEW: 20 unit tests for alias matching |
| `views/BetTableView.tsx` | Enhanced `TypableDropdown` with `optionData` prop; added `siteOptionData` and `getTypeOptionData()` memos; wired Site/Type columns |

---

## Document Metadata

- **Created**: 2026-01-07
- **Author**: Copilot Agent (PREFLIGHT Investigation)
- **Updated**: 2026-01-07 (Phase 1 Implementation)
- **Updated**: 2026-01-07 (Phase 1.1 Implementation)
- **Updated**: 2026-01-08 (Phase 2 Spreadsheet UX Polish)
- **Updated**: 2026-01-08 (Phase 2.1 Extended Column Support)
- **Updated**: 2026-01-08 (Phase 2.2 Date Editing + Delete Guard)
- **Updated**: 2026-01-08 (Phase 3 Locked Input Management)
- **Updated**: 2026-01-08 (Phase 3.1 Name Manual Entry Fix)
- **Updated**: 2026-01-08 (Phase 3.2 Real-Time Unresolved Name Resolution)
- **Updated**: 2026-01-09 (Phase 4 Totals Row UX + Sport-Scoped Team Resolution)
- **Updated**: 2026-01-10 (Phase 4.1 Resolved-Only Suggestions for Name/Type)
- **Updated**: 2026-01-11 (Phase 5 Site/Type Alias Search)
- **Updated**: 2026-01-11 (Phase 5.1 Alias Ranking Fix)
- **Related Files**: BetTableView.tsx, useBets.tsx, useInputs.tsx, types.ts, persistence.ts, InputManagementView.tsx, resolver.ts, aliasMatching.ts

### Phase 2.2 Type-to-Edit Behavior

**Date Implemented**: 2026-01-09

This phase completes the spreadsheet interaction model by allowing users to type immediately into selected cells.

#### Features

1.  **Direct Typing**: Selecting a cell and typing a character triggers edit mode immediately.
2.  **Overwrite Behavior**: For text/numeric cells, the initial keystroke overwrites the previous value.
3.  **Dropdown Filtering**: For dropdowns, the initial keystroke filters the options immediately (e.g., typing 'N' in Sport filters to NBA/NFL).
4.  **Result Cell**: Converted to standard View/Edit pattern (view as text, edit as dropdown).
5.  **Keyboard Safety**: Global shortcuts (Undo, Delete) are disabled while editing cell content to prevent accidental data loss.

#### Technical Details

- **State**: `editSeed` stores the triggering character.
- **Props**: `initialQuery` (Dropdowns) and `initialValue` (Inputs) pass the seed to editors.
- **Guard**: `isEditingContent` check prevents global key handlers during local edits.

---

## Phase 4.1 Implemented Behavior — Resolved-Only Suggestions for Name/Type

**Date Implemented**: 2026-01-10

### Overview

This phase ensures Name and Type suggestion lists remain clean by only adding resolved entities to suggestions. Unresolved manual entries (e.g., "ABCD") do NOT pollute the suggestion dropdowns.

### Resolved-Only Suggestions Rule

**For Name Column**:
- When a name is committed, `autoAddEntity()` checks resolver status before adding to `useInputs` suggestions (players/teams)
- If resolver status is `RESOLVED` → add the **canonical** to suggestions
- If resolver status is `AMBIGUOUS` or `UNRESOLVED` → do NOT add to suggestions

**For Type Column**:
- When a type is committed, `addBetType()` is gated by `resolveBetType()` status check
- If resolver status is `RESOLVED` → add the **canonical** to suggestions
- If resolver status is not `RESOLVED` → do NOT add to suggestions

### Queue + Badge Behavior (Unchanged)

Unresolved/ambiguous names still:
- Remain in the cell value (not cleared)
- Show unresolved badge (amber warning icon)
- Are added to `unresolvedQueue`
- Can be resolved in-place via Map/Create modals

### Map/Create Resolution Flow

When a user resolves via Map or Create:

1. **Map to Existing**:
   - Alias is added to normalization data via `addTeamAlias`/`addPlayerAlias`
   - **Canonical is also added to `useInputs` suggestions** via `addTeam`/`addPlayer`
   - Queue entry is removed, badge disappears

2. **Create New**:
   - New canonical is created in normalization data
   - **Canonical is also added to `useInputs` suggestions** via `addTeam`/`addPlayer`
   - Queue entry is removed, badge disappears

After Map/Create:
- The canonical name appears in suggestions immediately
- Future uses of the alias will resolve to canonical and also appear in suggestions

### Implementation Details

**`autoAddEntity()` gating**:
```typescript
// Check resolver status before adding to suggestions
if (isPlayerMarket && !isTeamMarket) {
  const playerResult = resolvePlayer(trimmedEntity, { sport: sport as Sport });
  if (playerResult.status === "resolved") {
    addPlayer(sport, playerResult.canonical);
  }
  // If unresolved, do NOT add - queue flow handles it
} else if (isTeamMarket && !isPlayerMarket) {
  const teamResult = resolveTeamForSport(trimmedEntity, sport as Sport);
  if (teamResult.status === "resolved") {
    addTeam(sport, teamResult.canonical);
  }
}
```

**`addBetType()` gating**:
```typescript
const typeResult = resolveBetType(value, row.sport as Sport);
if (typeResult.status === "resolved") {
  addBetType(row.sport, typeResult.canonical);
}
```

**Map/Create canonical promotion**:
```typescript
// In handleMapConfirm and handleCreateConfirm
if (item.entityType === "team") {
  addTeamAlias(targetCanonical, item.rawValue);
  addTeam(sport, targetCanonical); // Add to suggestions
} else if (item.entityType === "player") {
  addPlayerAlias(targetCanonical, sport, item.rawValue);
  addPlayer(sport, targetCanonical); // Add to suggestions
}
```

### Manual Validation Checklist

1. **Unresolved stays out of suggestions**:
   - Type "ABCD" into Name with sport set
   - Badge appears, queue entry created
   - "ABCD" does NOT appear in Name suggestions next time

2. **Resolved via Map adds to suggestions**:
   - Click badge → Map to "LeBron James"
   - Badge disappears, queue cleared
   - "LeBron James" appears in Name suggestions

3. **Resolved via Create adds to suggestions**:
   - Click badge → Create new canonical
   - Badge disappears, queue cleared
   - New canonical appears in Name suggestions

4. **Type column behaves same way**:
   - Unresolved types do NOT get added to suggestions
   - Known types (in normalization) get added to suggestions

### Files Changed

| File                     | Changes                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `views/BetTableView.tsx` | Added `resolveBetType` import, gated `autoAddEntity`, gated `addBetType`, Map/Create add canonical |

---

## Phase 4.2 Implemented Behavior — Editor Key Ownership Fix

**Date Implemented**: 2026-01-10

### Overview

This phase fixes broken spreadsheet typing behavior where dropdown cells (Site, Sport, Category, O/U, Result) only accepted 1 character and Enter did nothing.

### Root Cause

The grid's global `handleKeyDown` listener was stealing keyboard events from active cell editors:

1. **Enter key hijacked**: Grid intercepted Enter to navigate down instead of letting TypableDropdown select suggestions
2. **Printable characters intercepted**: Grid's type-to-edit logic consumed characters instead of allowing continued typing
3. **Arrow keys stolen**: Grid navigation consumed arrows instead of letting dropdown navigate suggestions

### Key Ownership Rule

> **While editing, editors own all keystrokes; grid does not intercept.**

The grid only handles two keys when `editingCell != null` or focus is on an input element:
- **Escape**: To cancel editing and exit edit mode
- **Tab**: To navigate between cells

All other keys (Enter, arrows, Backspace, Delete, printable characters) are yielded to the editor.

### Implementation Details

#### 1. Grid Keydown Guard (handleKeyDown)

```typescript
// When editingCell is set OR focus is on any input element,
// the grid must yield all keys to the editor EXCEPT:
// - Escape: to cancel editing (handled below)
// - Tab: to navigate between cells (handled below)
if (editingCell != null || isInputElement) {
  if (e.key !== "Escape" && e.key !== "Tab") {
    return; // Let the editor handle all other keys
  }
}
```

#### 2. Auto-Focus on Editor Mount

Both `TypableDropdown` and `EditableCell` now have `autoFocus={isFocused}`:

```typescript
// TypableDropdown and EditableCell inputs:
<input
  ...
  autoFocus={isFocused}
/>
```

This ensures the input receives focus immediately when entering edit mode.

#### 3. Type-to-Edit Seed Behavior

The `editSeed` mechanism works as follows:

1. **Setting**: When user types a printable character on a selected (not editing) cell, `setEditSeed(e.key)` is called
2. **Application**: Editors receive `initialQuery` (dropdowns) or `initialValue` (inputs), which is used ONCE in `useState` initialization
3. **Clearing**: `exitEditMode()` clears the seed via `setEditSeed(null)`

The seed is never re-applied on re-render because it's only used in the initial state.

### Expected Behavior

| Action | Result |
|--------|--------|
| Select Site cell, type "Dra" | Cell enters edit, input shows "Dra", dropdown filters to DraftKings |
| Press Enter | DraftKings is selected, edit mode exits |
| Select Sport cell, type "NBA", Enter | "NBA" is selected from dropdown |
| Edit O/U, type "O", Enter | "Over" is selected |
| Type multiple characters quickly | All characters appear in input, not just first |

### Files Changed

| File | Changes |
|------|---------|
| `views/BetTableView.tsx` | Rewrote handleKeyDown early-return guard to yield keys when editing; added `autoFocus` to TypableDropdown and EditableCell inputs |

---

## Phase 4.3 Implemented Behavior — Global Name/Team Suggestions

**Date Implemented**: 2026-01-10

### Overview

To ensure users can always find stored players and teams regardless of sport mismatch or storage anomalies, the suggestion logic for **Name** cells has been updated to use a global fallback strategy.

### Behavior Change

**Previous Behavior**:
- Suggestions for "Name" only showed players/teams stored specifically under the current row's `Sport` (e.g., Row Sport = "NBA" → only `players["NBA"]` showed).
- If a player was stored under a slightly different key or the row sport was empty, the suggestion list was empty.

**New Behavior (Global Fallback)**:
- Suggestions for "Name" now include **ALL known players and teams** from **ALL sports**.
- The list merges two data sources:
  1. Manual user inputs (`useInputs`)
  2. Resolved entities from Normalization Service (SSOT)
- The list is a unique set (deduplicated by name).
- This ensures that if "Duncan Robinson" is stored, he appears in the suggestion list regardless of the row's sport context.

### Implementation Details

Modified `suggestionLists.players` and `suggestionLists.teams` in `BetTableView.tsx`:

```typescript
// Flatten all players across all sports into a single unique list
const specific = players[sport] || [];
const all = new Set(specific);

// Merge manual inputs from other sports
Object.values(players).forEach((list) => {
  list.forEach((p) => all.add(p));
});

// Merge resolved players from normalization service
const snapshot = getReferenceDataSnapshot();
snapshot.players.forEach((p) => all.add(p.canonical));

return Array.from(all).sort();
```

### Impact

- **Pros**: Users always find what they are looking for; resolved entities immediately available.
- **Cons**: Suggestion list is larger.

### Files Changed

| File | Changes |
|------|---------|
| `views/BetTableView.tsx` | Updated `suggestionLists` memo to aggregate all manual inputs AND resolved entities |
