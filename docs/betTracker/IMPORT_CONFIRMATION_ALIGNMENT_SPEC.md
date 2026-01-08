# IMPORT_CONFIRMATION_ALIGNMENT_SPEC.md

## PREFLIGHT RETURN PACKAGE — Import Confirmation Modal ↔ Bet Sheet Alignment

**MODE**: PREFLIGHT (Review-only; NO code changes)  
**DATE**: 2026-01-07  
**STATUS**: COMPLETE

---

## 1) Import Confirmation Modal & Flow

### Component Files

| Component | File Path | Lines |
|-----------|-----------|-------|
| **ImportConfirmationModal** | `components/ImportConfirmationModal.tsx` | 2,238 |
| **ImportView** (parent) | `views/ImportView.tsx` | 377 |
| **useBets** (save handler) | `hooks/useBets.tsx` | 691 |
| **useNormalizationData** (Inputs CRUD) | `hooks/useNormalizationData.tsx` | 596 |
| **normalizationService** (resolution logic) | `services/normalizationService.ts` | 1,540 |
| **resolver** (chokepoint API) | `services/resolver.ts` | 298 |
| **unresolvedQueue** (persistence) | `services/unresolvedQueue.ts` | 245 |

### Import Flow Call Chain

```
1. ImportView.tsx → handleParseClick()
   ↓ parseBetsResult(selectedBook, sourceProvider)
   ↓ setParsedBets(result.value)
   ↓ setImportState('parsed')

2. ImportConfirmationModal renders with:
   - bets = parsedBets (local state array)
   - existingBetIds (for duplicate detection)
   - onEditBet → handleEditBet (modifies parsedBets in parent)
   - onConfirm → handleConfirmImport

3. User edits rows in modal
   ↓ handleEditBet(index, updates) [ImportView line 124-129]
   ↓ setParsedBets(updatedBets)

4. User clicks "Import X Bets"
   ↓ handleConfirmImport(summary) [ImportView line 86-117]
   ↓ addBets(parsedBets) [useBets.tsx line 130-191]
   ↓ saveBets() → localStorage
```

### Where Unknowns Are Detected

**Location**: `ImportConfirmationModal.tsx` → `getBetIssues()` (lines 409-556)

The `getBetIssues` function checks each bet/leg for:
- **Missing Sport**: `!bet.sport` or sport not in `availableSports`
- **Unknown Team**: `resolveTeam()` returns `status === "unresolved"`
- **Unknown Player**: `!sportPlayers.includes(legName)`
- **Missing Type**: `!leg.market` for Props
- **Ambiguous Team**: `resolveTeam()` returns `status === "ambiguous"` with collision

Returns array of `{ field, message, collision? }` for display.

### Where Modal Edits Are Stored

**Location**: `ImportView.tsx` state + `ImportConfirmationModal.tsx` local state

- **Staged bets array**: `parsedBets` state in `ImportView` (line 34)
- **Editing row index**: `editingIndex` state in modal (line 208)
- **Editing leg index**: `editingLegIndex` state in modal (line 209)
- **Resolution state**: `resolvingItem` for Map/Create modals (line 229)

Edits are applied via `onEditBet(index, updates)` which calls `setParsedBets()` in parent.

---

## 2) Modal Column → Bet Field → Grid Column Mapping

### Mapping Table

| Modal Column | Bet Field | FinalRow Field | Grid Column | Notes |
|--------------|-----------|----------------|-------------|-------|
| Date | `placedAt` | `Date` | date | ISO → MM/DD/YY |
| Site | `book` | `Site` | site | Sportsbook name |
| Sport | `sport` | `Sport` | sport | e.g., "NBA" |
| Category | `marketCategory` | `Category` | category | "Props" / "Main Markets" / "Futures" |
| Type | `type` (or `legs[i].market`) | `Type` | type | Stat type (Pts, Reb) or market (Spread) |
| Name | `name` (or `legs[i].entities[0]`) | `Name` | name | Player/team name only |
| O/U | `ou` (or `legs[i].ou`) | `Over` / `Under` | ou | "Over" / "Under" |
| Line | `line` (or `legs[i].target`) | `Line` | line | Target value |
| Odds | `odds` (or `legs[i].odds`) | `Odds` | odds | American odds format |
| Bet | `stake` | `Bet` | bet | Stake amount |
| To Win | (calculated) | `To Win` | toWin | Derived from stake + odds |
| Result | `result` | `Result` | result | win/loss/push/pending |
| Net | (calculated) | `Net` | net | Derived from result + stake + payout |
| Live | `isLive` | `Live` | isLive | Boolean → "1" or "" |
| Tail | `tail` | `Tail` | tail | Tailed from name |

### Key Field Terminology Differences

| Import/Modal Term | Bet Model Term | Grid Display |
|-------------------|----------------|--------------|
| "site" | `book` | "Site" |
| "category" | `marketCategory` | "Cat" |
| "name" (player/team) | `name` or `legs[].entities[0]` | "Name" |
| "type" (stat) | `type` or `legs[].market` | "Type" |

### Conversion Path

```
Bet (model) → betToFinalRows() → FinalRow → BetTableView flattenedBets → FlatBet → grid
```

File: `parsing/shared/betToFinalRows.ts`

---

## 3) Current Normalization & Inputs Wiring

### Where Reference Inputs Are Stored

| Entity Type | Storage Key | Hook | Service |
|-------------|-------------|------|---------|
| Teams | `bettracker-normalization-teams` | `useNormalizationData` | `normalizationService.ts` |
| Players | `bettracker-normalization-players` | `useNormalizationData` | `normalizationService.ts` |
| Bet Types | `bettracker-normalization-bet-types` | `useNormalizationData` | `normalizationService.ts` |
| Sportsbooks | `bettracker-sportsbooks` | `useInputs` | N/A (direct localStorage) |
| Sports | `bettracker-sports` | `useInputs` | N/A |
| Tails | `bettracker-tails` | `useInputs` | N/A |

### When Import Adds New Entities Automatically

**Location**: `useBets.tsx` → `addBets()` (lines 143-163)

```typescript
// Auto-add entities from leg.entityType
newBets.forEach((bet) => {
  bet.legs?.forEach((leg) => {
    if (leg.entityType === 'player') addPlayer(bet.sport, entity);
    else if (leg.entityType === 'team') addTeam(bet.sport, entity);
  });
});
```

**Current behavior**:
- Only adds entities from **legs** with `entityType` set by parsers
- Only adds to `useInputs` (simple lists), NOT to `useNormalizationData` (canonical with aliases)
- Does NOT add to normalization service (no canonical/alias creation)
- Does NOT validate against existing canonicals before adding

### What Happens When User Edits in Modal

**Current behavior** (observed from code):
- Edits update the staged `parsedBets` array only
- **NO automatic Inputs update** when user types a new name/type
- Edited values pass through as-is to `addBets()` on confirm
- On confirm, leg entities are added via simple `addPlayer`/`addTeam` from `useInputs`
- No canonical normalization occurs for user-edited values

### Resolution Capabilities in Modal (Already Implemented)

The modal HAS resolution infrastructure via `useNormalizationData`:

```typescript
// ImportConfirmationModal.tsx lines 215-226
const {
  addTeamAlias,
  addPlayerAlias,
  addBetTypeAlias,
  addTeam,
  addPlayer,
  addBetType,
} = useNormalizationData();
```

And resolution handlers (lines 277-331):
- `handleMapConfirm()` - Maps raw value to existing canonical via alias
- `handleCreateConfirm()` - Creates new canonical with aliases

---

## 4) Unknown Resolution Requirements — Current State vs Gaps

### What Currently Exists ✅

| Feature | Status | Location |
|---------|--------|----------|
| Unknown detection | ✅ EXISTS | `getBetIssues()` line 409-556 |
| Warning icons display | ✅ EXISTS | Modal table row rendering |
| Map to existing modal | ✅ EXISTS | `MapToExistingModal.tsx` |
| Create new canonical modal | ✅ EXISTS | `CreateCanonicalModal.tsx` |
| `handleInitiateResolve()` | ✅ EXISTS | Line 234-275 |
| `handleMapConfirm()` | ✅ EXISTS | Line 277-292 |
| `handleCreateConfirm()` | ✅ EXISTS | Line 294-331 |
| Live refresh after Map/Create | ✅ EXISTS | `resolverVersion` dependency |
| Unresolved queue service | ✅ EXISTS | `unresolvedQueue.ts` |

### What Is Missing / Gaps 🔴

| Feature | Status | Impact |
|---------|--------|--------|
| **Inline combobox for fields** | 🔴 MISSING | User must click issue icon to open Map/Create modal; cannot search/select inline |
| **Dropdown suggestions from stored inputs** | 🔴 MISSING | Type/Name/Sport fields don't show autocomplete from existing canonicals |
| **"Mark as unresolved" action** | 🔴 MISSING | No way to explicitly defer resolution; imports with warnings anyway |
| **Bulk resolution UI** | 🔴 MISSING | Must resolve each unknown one at a time |
| **Wire edited values to Inputs** | 🔴 PARTIAL | `addBets` wires legs but not user's manual edits |
| **Prevent junk inputs** | 🔴 MISSING | User can type any name; it gets added blindly on confirm |

### Current Unknown Resolution Flow

```
1. getBetIssues() detects unknown entity
2. Warning icon shown in cell
3. User clicks icon → handleInitiateResolve()
4. MapToExistingModal or CreateCanonicalModal opens
5. User maps to existing OR creates new canonical
6. resolverVersion increments → getBetIssues() re-runs
7. Warning clears (entity now resolves)
```

**Gap**: If user simply edits the Name/Type cell manually (without using Map/Create), the new value is NOT wired to canonicals and may still be "unknown" after import.

---

## 5) Proposed Minimal Solution (Design Only)

### A) Resolution UI Per Field

| Field | Current UI | Proposed Enhancement |
|-------|-----------|---------------------|
| **Sport** | Plain dropdown | ✅ Already has dropdown from `availableSports` |
| **Category** | Plain dropdown | ✅ Already has dropdown |
| **Site** | Editable cell | Add combobox with `sportsbooks` suggestions |
| **Name** | Editable cell + warning icon | Add combobox with player/team suggestions; inline "Create new" option |
| **Type** | Editable cell + warning icon | Add combobox with bet type suggestions; inline "Create new" option |
| **Tail** | Editable cell | Add combobox with `tails` suggestions |

**Minimal approach**: Prioritize **Name** and **Type** fields since those trigger unknown warnings.

### B) Data Written on Confirm

#### Current Flow (on confirm)
```
parsedBets → addBets() → entities extracted from legs → addPlayer/addTeam (useInputs) → bets saved
```

#### Proposed Flow (on confirm)
```
parsedBets → 
  FOR EACH bet:
    - Check Name/Type against normalization
    - If resolved → no action needed
    - If edited AND matches existing canonical (case-insensitive) → auto-confirm mapping (add alias if needed)
    - If edited AND new value → prompt OR auto-create canonical
    - If still unresolved → add to unresolved queue
→ addBets() → bets saved
```

#### Specific Writes

| Action | What Gets Written | Service |
|--------|-------------------|---------|
| User maps to existing | New alias added to canonical | `addTeamAlias` / `addPlayerAlias` / `addBetTypeAlias` |
| User creates new | New canonical with aliases | `addTeam` / `addPlayer` / `addBetType` |
| User skips / defers | UnresolvedItem added to queue | `addToUnresolvedQueue` |
| User edits to known value | Nothing (already resolved) | N/A |

### C) Guardrails Against Junk Inputs

**Problem**: User could type "asdfasdf" in Name field → gets added as new player.

**Proposed guardrails**:

1. **Soft-block on unresolved confirm**: Show warning banner "X bets have unresolved entities. These will be added to the Unresolved Queue."

2. **Explicit "Create new" action**: Don't auto-create canonicals for manually typed values. Instead:
   - If typed value doesn't match any canonical, show inline "Create as new?" button
   - Or show confirmation step before creating

3. **Defer button**: Add "Defer" option that imports bet but adds entity to unresolved queue for later cleanup.

4. **Validation on create**: When creating via modal, require:
   - Non-empty canonical name
   - Sport selection
   - Optional: team association for players

---

## 6) Edge Cases & Integrity Concerns

### Player/Team Name Mismatches

| Scenario | Current Behavior | Proposed Handling |
|----------|------------------|-------------------|
| "Lebron" vs "LeBron James" | Unresolved (no alias match) | Fuzzy search in combobox; suggest "LeBron James" |
| "NYK" vs "New York Knicks" | May resolve (if alias exists) | Add abbreviations to suggestion display |
| Same name, different sports | No collision detection | Sport-scoped lookup already exists |

### Stat Type Aliases

| Raw Value | Canonical | Notes |
|-----------|-----------|-------|
| "Pts" | "Points" | Need alias |
| "3pt" | "3-Pointers Made" | Need alias |
| "PRA" | "Points + Rebounds + Assists" | Combined stat type |
| "three pointers" | "3-Pointers Made" | Case/format normalization |

**Current**: `normalizeBetType()` in normalizationService handles these via aliases in `BET_TYPES` reference data.

### Same Display Name Across Sports

| Name | Sports |
|------|--------|
| "Michael Jordan" | NBA, MLB (different people) |
| "Chris Paul" | NBA | (likely unique but could collide) |

**Current handling**: Players are **sport-scoped** in `PlayerData`:
```typescript
interface PlayerData {
  canonical: string;
  sport: Sport;  // Scoping field
  // ...
}
```

Resolution uses sport context when available.

### Parlays / Legs Interactions

| Scenario | Current Behavior | Concern |
|----------|------------------|---------|
| Edit leg[0].entities in modal | Updates staged bet leg | ✅ Works |
| Edit bet.name for single | Updates staged bet | ✅ Works |
| Leg entityType mismatch | Parser sets entityType; modal doesn't change it | Could cause wrong entity type on import |
| Nested SGP+ children | `getVisibleLegs()` flattens for display | Need to maintain correct parent/child structure on edit |

**Risk**: If user edits a player name to a team name (or vice versa), the `entityType` doesn't update, causing incorrect auto-add on import.

**Proposed mitigation**: When user edits Name field:
1. Re-classify using `classifyLeg()` based on market
2. Update `entityType` if classification suggests different type

---

## 7) Stop Conditions Check

| Condition | Status |
|-----------|--------|
| Modal does not have access to edited/staged rows at confirm time | ✅ CLEAR - `parsedBets` state is accessible |
| Inputs system cannot be safely updated from import | ✅ CLEAR - `useNormalizationData` provides CRUD functions |
| Resolution modals not implemented | ✅ CLEAR - Map/Create modals exist and are wired |

**No stop conditions triggered.**

---

## 8) Summary of Existing vs Required

### Already Working ✅
- Import parsing → staged bets → modal display → confirm → save
- Unknown detection in `getBetIssues()`
- Map to existing canonical (via modal)
- Create new canonical (via modal)
- Live refresh after Map/Create
- Unresolved queue infrastructure

### Needs Enhancement 🔧
- Inline combobox suggestions for Name/Type fields
- Auto-add-or-prompt for manually edited values
- Explicit "defer to unresolved queue" option
- Batch resolution for multiple unknowns
- Update `entityType` when user edits Name to different entity category

### Not Started 🔴
- Dropdown suggestions wired to normalization data
- Confirmation step for creating new canonicals from manual edits
- Unresolved queue visible from import modal

---

## 9) Minimal Implementation Recommendation

### Phase 1: Combobox for Name/Type (Estimated: 4-6 hours)

1. Replace `EditableCell` for Name/Type columns with `TypableDropdown` variant
2. Wire suggestions:
   - Name → `players[sport]` + `teams` filtered by sport
   - Type → `betTypes` filtered by sport
3. Add "Not found? Create new..." option at bottom of dropdown
4. On create click → open existing `CreateCanonicalModal`

### Phase 2: Smart Confirm (Estimated: 2-3 hours)

1. Before calling `addBets()`, check each bet's Name/Type against resolver
2. For unresolved values that user manually edited:
   - If value matches existing canonical (case-insensitive) → auto-map
   - If new value → add to pending creates list
3. Show confirmation: "X new entities will be created. Continue?"
4. On confirm: execute all creates, then `addBets()`

### Phase 3: Defer Option (Estimated: 1-2 hours)

1. Add "Import with Unresolved" button (lower priority than main Import)
2. For any remaining unresolved → call `addToUnresolvedQueue()`
3. Show banner: "X entities added to Unresolved Queue for later resolution"

## Implementation Status (2026-01-08)

### ✅ Completed

| Feature | Status |
|---------|--------|
| Resolution tracking state (`resolutionDecisions`) | ✅ Done |
| `handleDefer()` function | ✅ Done |
| Defer buttons in Name/Type cells | ✅ Done |
| Deferred badge display | ✅ Done |
| `getUnresolvedWithoutDefer()` function | ✅ Done |
| Confirm gate (blocks unresolved without Defer) | ✅ Done |
| Blocking banner in footer | ✅ Done |
| Queue only deferred items on confirm | ✅ Done |
| EntityCombobox component created | ✅ Done |
| **Leg-level resolution key format** | ✅ Done (2026-01-08) |
| **EntityType 'betType' (replaces 'stat')** | ✅ Done (2026-01-08) |

### ⏳ Deferred

| Feature | Reason |
|---------|--------|
| Inline EntityCombobox in cells | Existing edit flow preserved; less UI disruption |

### 📄 Related Documents

- [EXECUTION_RETURN_IMPORT_CONFIRMATION_ALIGNMENT.md](./EXECUTION_RETURN_IMPORT_CONFIRMATION_ALIGNMENT.md) - Initial return package
- [EXECUTION_RETURN_IMPORT_CONFIRMATION_LEG_LEVEL.md](./EXECUTION_RETURN_IMPORT_CONFIRMATION_LEG_LEVEL.md) - Leg-level resolution return package

---

## Leg-Level Resolution Key Format (Updated 2026-01-08)

### Key Format

**Previous**: `{betId}:{field}` (e.g., `bet-123:Name`)  
**Current**: `{betId}:{field}:{legIndex}` (e.g., `bet-123:Name:0`)

- For single-leg bets, `legIndex` = 0
- For parlays/SGPs, each leg has its own index

### Functions Updated

- `handleDefer(betId, field, legIndex, value, entityType)`
- `clearResolutionDecision(betId, field, legIndex)`
- `getResolutionDecision(betId, field, legIndex)`
- `handleMapConfirm()` - uses `item.legIndex ?? 0`
- `handleCreateConfirm()` - uses `item.legIndex ?? 0`
- `getUnresolvedWithoutDefer()` - uses leg-level keys for parlays

---

## EntityType Schema (Updated 2026-01-08)

### UnresolvedEntityType

**Previous**: `'team' | 'stat' | 'player' | 'unknown'`  
**Current**: `'team' | 'betType' | 'player' | 'unknown'`

### Backward Compatibility

- Legacy items with `entityType: 'stat'` are still valid when reading
- New writes always use `'betType'`
- `isValidUnresolvedItem()` accepts both `'stat'` and `'betType'`

---

## Document Metadata

- **Created**: 2026-01-07
- **Updated**: 2026-01-08 (Leg-Level Resolution + EntityType)
- **Author**: Copilot Agent
- **Related Files**: ImportConfirmationModal.tsx, EntityCombobox.tsx, ImportView.tsx, useBets.tsx, useNormalizationData.tsx, normalizationService.ts, resolver.ts, unresolvedQueue.ts

