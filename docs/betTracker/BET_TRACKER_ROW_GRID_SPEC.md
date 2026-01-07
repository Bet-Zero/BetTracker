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
  id: string;              // Unique identifier (betId + placedAt combination)
  book: SportsbookName;
  betId: string;           // Sportsbook-provided ID
  placedAt: string;        // ISO timestamp
  settledAt?: string;      // ISO timestamp
  betType: BetType;        // "single" | "parlay" | "sgp" | "sgp_plus" | "live" | "other"
  marketCategory: MarketCategory; // "Props" | "Main Markets" | "Futures" | "Parlays"
  sport: string;
  description: string;
  name?: string;           // Player/team name only
  odds?: number | null;
  stake: number;
  payout: number;
  result: BetResult;       // "win" | "loss" | "push" | "pending"
  type?: string;           // Stat type for props (e.g., "3pt", "Pts", "Ast")
  line?: string;           // Line/threshold (e.g., "3+", "25.5")
  ou?: "Over" | "Under";
  legs?: BetLeg[];         // All bets have legs: singles have length === 1
  tail?: string;           // Who the bet was tailed from
  raw?: string;            // Raw text block for debugging
  isLive?: boolean;        // Whether bet was placed live/in-game
  isSample?: boolean;      // Whether this is sample data
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
      console.warn(`Bet validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Auto-recalculate payout if stake/odds/result change
    if ("stake" in updates || "odds" in updates || "result" in updates) {
      updatedBet.payout = recalculatePayout(updatedBet.stake, updatedBet.odds, updatedBet.result);
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
    return err(createImportError('STORAGE_FAILED', 'Cannot save: state has invalid shape'));
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
const addBets = useCallback((newBets: Bet[]) => {
  // 1. Process entities from legs
  newBets.forEach((bet) => {
    bet.legs?.forEach((leg) => {
      if (leg.entityType === 'player') addPlayer(bet.sport, entity);
      else if (leg.entityType === 'team') addTeam(bet.sport, entity);
    });
  });

  // 2. Filter duplicates by ID
  const existingBetIds = new Set(prevBets.map((b) => b.id));
  const trulyNewBets = newBets.filter((newBet) => !existingBetIds.has(newBet.id));

  // 3. Validate (filter out blockers)
  const validBets = trulyNewBets.filter((bet) => validateBetForImport(bet).valid);

  // 4. Auto-classify if missing category
  const classifiedNewBets = validBets.map((bet) => {
    if (!bet.marketCategory) return { ...bet, marketCategory: classifyBet(bet) };
    return bet;
  });

  // 5. Merge and save
  const updatedBets = [...prevBets, ...classifiedNewBets].sort(
    (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
  );
  saveBets(updatedBets);
  return classifiedNewBets.length;
}, [addPlayer, addTeam]);
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
const [selectionAnchor, setSelectionAnchor] = useState<CellCoordinate | null>(null);

// Types
type CellCoordinate = { rowIndex: number; columnKey: keyof FlatBet; };
type SelectionRange = { start: CellCoordinate; end: CellCoordinate; } | null;
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
    legs: []
  };
  setBets(prev => {
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
  setBets(prev => {
    const toDuplicate = prev.filter(b => betIds.includes(b.id));
    const duplicated = toDuplicate.map(bet => {
      const newId = `dup-${bet.id}-${Date.now()}`;
      newIds.push(newId);
      return {
        ...bet,
        id: newId,
        placedAt: new Date().toISOString(),
        result: "pending",  // Clear result for duplicate
        payout: 0,          // Clear payout
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
const bulkClearFields = useCallback((rowIds: string[], fields: (keyof Bet)[]) => {
  rowIds.forEach(id => {
    const updates: Partial<Bet> = {};
    fields.forEach(field => {
      updates[field] = field === 'result' ? 'pending' : '';
    });
    updateBet(id, updates);
  });
}, [updateBet]);
```

#### 5. Bulk Apply Value (in BetTableView.tsx)
```typescript
const bulkApplyValue = useCallback((rowIds: string[], field: keyof Bet, value: any) => {
  rowIds.forEach(id => {
    updateBet(id, { [field]: value });
  });
}, [updateBet]);
```

#### 6. Paste-to-Create-Rows (in BetTableView.tsx)
```typescript
const handlePasteToCreateRows = useCallback(async () => {
  const text = await navigator.clipboard.readText();
  const rows = text.split("\n").filter(r => r.trim());
  const pasteData = rows.map(row => row.split("\t"));
  
  // Map TSV columns to Bet fields (by column order or header detection)
  const newBets: Bet[] = pasteData.map((rowData, idx) => ({
    id: `paste-${Date.now()}-${idx}`,
    // ... map columns to fields
  }));
  
  addBets(newBets);
}, [addBets]);
```

### B) What to Reuse

| Feature | Existing Code | Location |
|---------|---------------|----------|
| Cell editing | `EditableCell`, `TypableDropdown`, etc. | BetTableView.tsx:93-444 |
| Cell selection | `focusedCell`, `selectionRange` state | BetTableView.tsx:496-501 |
| Keyboard nav | `handleKeyDown` | BetTableView.tsx:1031-1141 |
| Copy/Paste cells | `handleCopy`, `handlePaste` | BetTableView.tsx:1163-1274 |
| Bet persistence | `updateBet`, `saveBets` | useBets.tsx:193-227, 111-128 |
| Validation | `validateBet`, `validateBetForImport` | utils/validation.ts |
| Reference data | `useInputs()` hook | hooks/useInputs.tsx |
| Drag-to-fill | `dragFillData`, handlers | BetTableView.tsx:1400-1537 |

### C) Suggested File/Module Placement

| New Feature | Recommended Location |
|-------------|---------------------|
| Row selection state | BetTableView.tsx (keep with existing cell selection) |
| `createManualBet()` | useBets.tsx (alongside `addBets`, `updateBet`) |
| `duplicateBets()` | useBets.tsx |
| Bulk operations (clear, apply) | BetTableView.tsx (UI actions calling updateBet) |
| "+ Add Bet" button | BetTableView.tsx (in header area near search/filters) |
| Keyboard shortcuts (Cmd+D, Cmd+Enter) | BetTableView.tsx:handleKeyDown |
| Paste-to-create-rows | BetTableView.tsx (extend handlePaste or new handler) |

---

## 8) Open Questions (only if truly blocking)

1. **Row ID scheme for manual entries**: Should we use UUID, timestamp-based, or sequential IDs? (Recommend: `manual-{timestamp}-{random}`)

2. **Duplicate behavior for result/net fields**: Should duplicated rows clear result to "pending" and net to 0, or preserve original values? (Recommend: Clear to pending)

3. **Paste header detection**: When pasting TSV, should we detect if the first row is headers (matching column names) and skip it? (Recommend: Yes, optional detection)

4. **Parlay handling for manual add**: Can users manually create parlay rows, or only single bets? (Recommend: V1 = singles only, V2 = parlay support)

---

## STOP CONDITIONS CHECK

| Condition | Status |
|-----------|--------|
| Grid is generated by blocking third-party component | ✅ CLEAR - Custom React component |
| Bet data is not editable at model layer | ✅ CLEAR - `updateBet()` supports partial updates |
| Cannot locate where bets are created/appended | ✅ CLEAR - `addBets()` in useBets.tsx |

**PREFLIGHT COMPLETE** - No stop conditions triggered. Ready for execution prompt.

---

## Document Metadata
- **Created**: 2026-01-07
- **Author**: Copilot Agent (PREFLIGHT Investigation)
- **Related Files**: BetTableView.tsx, useBets.tsx, useInputs.tsx, types.ts, persistence.ts
