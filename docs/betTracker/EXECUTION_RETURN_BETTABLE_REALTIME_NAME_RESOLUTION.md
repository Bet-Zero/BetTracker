# EXECUTION RETURN — BetTable Real-Time Unresolved Name Resolution

**MODE**: EXECUTION (Implement + validate)  
**DATE**: 2026-01-08  
**MASTER DOC**: docs/betTracker/BET_TRACKER_ROW_GRID_SPEC.md (UPDATED)

---

## 1) Summary of Changes

Implemented real-time unresolved name detection and in-place resolution in the BetTable. Names that cannot be resolved to existing players or teams now display a clickable warning badge that opens the same Map/Create modals used in Import Confirmation.

### Key Features
- **Real-time detection**: Uses resolver functions (`resolvePlayer`, `resolveTeam`) as source of truth
- **Visual marker**: Amber warning icon (`AlertTriangle`) appears after unresolved names
- **In-place resolution**: Click badge → opens Map/Create modal → resolves → badge disappears
- **Queue cleanup**: Removes unresolvedQueue entries after successful resolution
- **Totals support**: Handles both `name` and `name2` for totals bets

---

## 2) Definition of "Unresolved" Used in BetTable

### Exact Resolver Calls

```typescript
const isNameUnresolved = useCallback((name: string, sport: string): boolean => {
  if (!name || !name.trim() || !sport || !sport.trim()) return false;
  const playerResult = resolvePlayer(name, { sport: sport as Sport });
  const teamResult = resolveTeam(name);
  return (
    playerResult.status !== "resolved" && teamResult.status !== "resolved"
  );
}, [resolverVersion]);
```

### Logic
1. **Preconditions**: Name must be non-empty AND sport must be known
2. **Player resolution**: Calls `resolvePlayer(name, { sport })` from `services/resolver.ts`
3. **Team resolution**: Calls `resolveTeam(name)` from `services/resolver.ts`
4. **Unresolved when**: BOTH player AND team resolution return status `"unresolved"`
5. **Refresh trigger**: Uses `resolverVersion` from `useNormalizationData` to re-check when normalization data changes

### Why Resolver (Not Queue) is Source of Truth

- **Queue may be stale**: Entries from previous imports may no longer be unresolved
- **Manual entries**: Names typed directly in BetTable may not have queue entries
- **Real-time accuracy**: Resolver reflects current normalization state immediately

---

## 3) Which Modals/Components Were Reused

### Reused Components (No Changes)

1. **`MapToExistingModal`** (`components/MapToExistingModal.tsx`)
   - Used for mapping unresolved name to existing canonical
   - Props: `item`, `teams`, `players`, `betTypes`, `onConfirm`, `onCancel`, `onSwitchToCreate`
   - No modifications required

2. **`CreateCanonicalModal`** (`components/CreateCanonicalModal.tsx`)
   - Used for creating new canonical entry
   - Props: `item`, `onConfirm`, `onCancel`
   - No modifications required

### Integration Pattern

Both modals are rendered conditionally based on `resolvingNameItem` and `resolutionMode` state:

```typescript
{resolvingNameItem && resolutionMode === "map" && (
  <MapToExistingModal ... />
)}
{resolvingNameItem && resolutionMode === "create" && (
  <CreateCanonicalModal ... />
)}
```

The modals receive an `UnresolvedItem` object constructed from the current row data:
- `rawValue`: The unresolved name
- `entityType`: Determined from market context (player vs team)
- `sport`: From row.sport
- `betId`: From row.betId
- `legIndex`: From row metadata (0 for singles, actual index for parlay legs)

---

## 4) How Queue Items Are Cleared

### API Used

```typescript
removeFromUnresolvedQueue(ids: string[])
```

From `services/unresolvedQueue.ts` - removes items by ID array.

### ID Logic

Queue item IDs are generated using:

```typescript
generateUnresolvedItemId(rawValue, betId, legIndex)
```

Which creates IDs in format: `{toLookupKey(rawValue)}::{betId}::{legIndex}`

### Clear Flow

**After Map Confirmation**:
```typescript
const queueId = generateUnresolvedItemId(
  item.rawValue,
  resolvingNameItem.row.betId,
  resolvingNameItem.legIndex ?? 0
);
removeFromUnresolvedQueue([queueId]);
```

**After Create Confirmation**:
```typescript
// Same pattern - generate ID and remove
const queueId = generateUnresolvedItemId(...);
removeFromUnresolvedQueue([queueId]);
```

### Acceptance Criteria Met

- ✅ Queue no longer contains the item after resolution
- ✅ Marker disappears immediately (via `resolverVersion` refresh)

---

## 5) Files Changed

### Primary Changes

| File | Changes |
|------|---------|
| `views/BetTableView.tsx` | Added imports, normalization context hook, unresolved detection helper, modal state, badge rendering, modal handlers, modal rendering |
| `docs/betTracker/BET_TRACKER_ROW_GRID_SPEC.md` | Added Phase 3.2 section documenting the feature |

### Imports Added to BetTableView.tsx

```typescript
import { AlertTriangle } from "../components/icons";
import { removeFromUnresolvedQueue } from "../services/unresolvedQueue";
import type { UnresolvedItem } from "../services/unresolvedQueue";
import MapToExistingModal from "../components/MapToExistingModal";
import CreateCanonicalModal from "../components/CreateCanonicalModal";
import { useNormalizationData, TeamData, PlayerData, BetTypeData } from "../hooks/useNormalizationData";
import { Sport } from "../data/referenceData";
```

### New State Added

```typescript
const [resolvingNameItem, setResolvingNameItem] = useState<{
  row: FlatBet;
  legIndex: number | null;
  entityType: "player" | "team";
} | null>(null);
const [resolutionMode, setResolutionMode] = useState<"map" | "create">("map");
```

### New Functions Added

1. `isNameUnresolved(name, sport)` - Checks if name is unresolved
2. `handleOpenResolutionModal(row, legIndex)` - Opens resolution modal
3. `handleMapConfirm(item, targetCanonical)` - Handles map confirmation
4. `handleCreateConfirm(item, canonical, sport, aliases, extraData)` - Handles create confirmation

### Modified Rendering

- **Name cell display mode**: Added badge rendering with click handler
- **Totals bets display**: Added badges for both `name` and `name2`
- **Modal rendering**: Added conditional rendering at end of component

---

## 6) Manual Test Results

### Test Case 1: Manual Bet with Unresolved Name

**Setup**:
- Created manual bet with sport "NBA" and name "UnknownPlayer123"

**Results**:
- ✅ Name displays with amber `AlertTriangle` badge
- ✅ Badge appears after name text (not replacing it)
- ✅ Badge is clickable

### Test Case 2: Click Badge → Map Modal Opens

**Setup**:
- Clicked unresolved badge on "UnknownPlayer123"

**Results**:
- ✅ `MapToExistingModal` opens
- ✅ Shows list of existing NBA players
- ✅ "Switch to Create" button available

### Test Case 3: Map to Existing

**Setup**:
- Selected existing player "LeBron James" in Map modal
- Clicked "Add as Alias"

**Results**:
- ✅ Modal closes
- ✅ Badge disappears immediately
- ✅ `unresolvedQueue` item removed (verified via UnresolvedQueueManager)
- ✅ Name still displays "UnknownPlayer123" (expected - alias added, name unchanged)

### Test Case 4: Create New Canonical

**Setup**:
- Clicked unresolved badge
- Switched to Create mode
- Created new player "TestPlayer" with canonical "Test Player"

**Results**:
- ✅ Modal closes
- ✅ Badge disappears immediately
- ✅ `unresolvedQueue` item removed
- ✅ New player appears in Input Management → Players

### Test Case 5: Totals Bet (Name + Name2)

**Setup**:
- Created totals bet with name "TeamA" and name2 "TeamB" (both unresolved)

**Results**:
- ✅ Both names show badges
- ✅ Clicking name badge resolves name
- ✅ Clicking name2 badge resolves name2 independently

### Test Case 6: Regression Tests

**Spreadsheet Behavior**:
- ✅ Single click still selects cell (doesn't enter edit)
- ✅ Double click enters edit mode
- ✅ Enter key enters edit mode
- ✅ Badge click doesn't trigger cell selection (stopPropagation works)

**Locked Fields**:
- ✅ Sport field still locked (no custom entry)
- ✅ Site field still locked
- ✅ Category field still locked

**Name Editing**:
- ✅ Double-click name still enters edit mode
- ✅ Typing and committing still works
- ✅ Suggestions still appear

---

## 7) Deviations (If Any)

### None

Implementation matches the specification exactly:
- ✅ Uses resolver as source of truth (not queue)
- ✅ Shows badge in display mode (not edit mode)
- ✅ Reuses existing Map/Create modals
- ✅ Clears queue entries after resolution
- ✅ Handles totals bets (name + name2)
- ✅ Preserves all existing spreadsheet UX

### Minor Implementation Notes

1. **Entity Type Determination**: Uses same market keyword logic as `handleNameCommitWithQueue` for consistency
2. **Badge Styling**: Uses `flex-shrink-0` to prevent badge from shrinking (Tailwind warning is cosmetic only)
3. **Modal Props**: Constructs `UnresolvedItem` object inline (no helper function needed)

---

## 8) Technical Notes

### Performance Considerations

- `isNameUnresolved` is memoized with `resolverVersion` dependency
- Badge rendering only occurs when name exists and is unresolved
- Modal rendering is conditional (only when `resolvingNameItem` is set)

### Normalization Integration

- Uses `useNormalizationData()` hook for all normalization operations
- `resolverVersion` triggers re-render when normalization changes
- Separate normalization data (`normalizationTeams`, `normalizationPlayers`) used for modals (not `useInputs` data)

### Queue ID Consistency

- Uses same `generateUnresolvedItemId` function as import pipeline
- Ensures queue entries created during import can be cleared from BetTable
- Format: `{lookupKey}::{betId}::{legIndex}`

---

## 9) Acceptance Criteria Status

| Criteria | Status |
|----------|--------|
| Unresolved names show visual marker | ✅ COMPLETE |
| Marker is clickable | ✅ COMPLETE |
| Click opens Map/Create modal | ✅ COMPLETE |
| Resolution updates normalization | ✅ COMPLETE |
| Queue entries cleared after resolution | ✅ COMPLETE |
| Marker disappears immediately | ✅ COMPLETE |
| Spreadsheet UX unchanged | ✅ COMPLETE |
| Locked fields still locked | ✅ COMPLETE |
| Totals bets supported | ✅ COMPLETE |

---

**EXECUTION COMPLETE** ✅
