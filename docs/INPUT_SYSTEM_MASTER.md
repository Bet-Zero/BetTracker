# Input System Master Documentation

This document serves as the canonical reference for the BetTracker Input Management System, covering the normalization pipeline, unresolved queue, and entity resolution mechanisms.

## System Overview

The Input Management System handles the normalization and resolution of entities (teams, players, bet types) from various sportsbooks during bet import. It ensures consistent naming across different sportsbook formats.

### Core Components

1. **Normalization Service** (`services/normalizationService.ts`)

   - Canonical data storage and lookup maps
   - Team/Player/BetType resolution
   - localStorage persistence

2. **Resolver** (`services/resolver.ts`)

   - Single chokepoint for all entity resolution
   - Collision detection and handling
   - Sport-scoped lookups

3. **Unresolved Queue** (`services/unresolvedQueue.ts`)

   - Stores entities that couldn't be resolved
   - Prevents duplicates
   - Persists across sessions

4. **UI Components**
   - `UnresolvedQueueManager` - Review and resolve queue items
   - `InputManagementView` - Manage reference data
   - `ImportConfirmationModal` - Preview imports with resolution status

## Storage Keys

| Key                                  | Purpose                            |
| ------------------------------------ | ---------------------------------- |
| `bettracker-normalization-teams`     | Team canonical data + aliases      |
| `bettracker-normalization-bettypes` | Bet type canonical data + aliases |
| `bettracker-normalization-players`   | Player canonical data + aliases    |
| `bettracker-unresolved-queue`        | Pending unresolved entities        |

---

## Phase 3.1 — UX Polish (December 2024)

### Goals

Phase 3.1 focused on three UX improvements:

1. **Grouped Queue Display** - Reduce noise by grouping identical raw values
2. **Players List Visibility** - Show stored players in Input Management
3. **Import Modal Live Refresh** - Update entity names after Map/Create without re-import

### What Changed

#### 1. Grouped Queue Display

**Files Modified:**

- [views/UnresolvedQueueManager.tsx](../views/UnresolvedQueueManager.tsx)
- [components/MapToExistingModal.tsx](../components/MapToExistingModal.tsx)
- [components/CreateCanonicalModal.tsx](../components/CreateCanonicalModal.tsx)

**Implementation:**

- Queue items are now grouped by `${entityType}::${sport ?? 'Unknown'}::${rawValue.toLowerCase().trim()}`
- Each group shows:
  - Raw value (original casing from first encounter)
  - Entity type badge
  - Sport
  - **Count badge** (number of items in group)
  - Last seen timestamp
  - Expandable context preview (book, market)
- Actions (Map/Create/Ignore) apply to **entire groups**:
  - Clicking "Ignore" removes ALL queue items in that group
  - Mapping/Creating adds alias once, then removes all matching items

**New Types:**

```typescript
interface GroupedQueueItem {
  groupKey: string;
  entityType: UnresolvedEntityType;
  sport?: string;
  rawValue: string;
  count: number;
  lastSeenAt: string;
  sampleContexts: SampleContext[];
  itemIds: string[];
  collisionCandidates: string[];
}
```

**Storage:** No changes to `bettracker-unresolved-queue` schema. Grouping is pure UI layer.

#### 2. Players List in Input Management

**Files Created:**

- [views/PlayerAliasManager.tsx](../views/PlayerAliasManager.tsx)

**Files Modified:**

- [views/InputManagementView.tsx](../views/InputManagementView.tsx)
- [components/icons.tsx](../components/icons.tsx) - Added `Search` icon

**Implementation:**

- New `PlayerAliasManager` component mirrors `TeamAliasManager` pattern
- Shows players grouped by sport with:
  - Canonical name
  - Team (optional)
  - Alias count with expandable list
  - Edit/Delete actions
- Search and sport filter functionality
- Full CRUD support via `useNormalizationData` hook

**Storage:** Uses existing `bettracker-normalization-players` key.

#### 3. Import Modal Live Refresh

**Files Modified:**

- [services/normalizationService.ts](../services/normalizationService.ts)
- [hooks/useNormalizationData.tsx](../hooks/useNormalizationData.tsx)
- [components/ImportConfirmationModal.tsx](../components/ImportConfirmationModal.tsx)

**Implementation:**

- Added `resolverVersion` counter to normalization service
- `refreshLookupMaps()` now increments version
- `useNormalizationData` hook exposes `resolverVersion`
- `ImportConfirmationModal` uses `resolverVersion` as dependency for:
  - `validationSummary` useMemo
  - `hasAnyIssues` useMemo
- When Map/Create updates normalization data, version increments, triggering re-render

**New Exports:**

```typescript
// normalizationService.ts
export function getResolverVersion(): number;
```

### How to Test

1. **Grouped Queue:**

   - Import a sample HTML with multiple bets containing the same unknown player
   - Verify queue shows single row with count badge
   - Click Map/Create and confirm all items removed

2. **Players List:**

   - Open Input Management → "Players (Canonical + Aliases)"
   - Verify stored players are visible
   - Add/Edit/Delete a player and confirm persistence

3. **Modal Live Refresh:**
   - Import bets with unknown entity
   - Keep ImportConfirmationModal open
   - Open Unresolved Queue, Map the entity
   - Return to modal - entity should show as resolved

### Manual Validation Checklist

- [ ] Clear queue, import sample HTML
- [ ] Verify grouped rows with counts
- [ ] Map one player alias
- [ ] Confirm queue count decreases (entire group removed)
- [ ] Confirm `bettracker-normalization-players` updated in localStorage
- [ ] Open "Players (Canonical + Aliases)" - new player visible
- [ ] Open modal with unknown entity, map via queue, modal updates

### Known Limitations / Future Work

- **Context Preview:** Limited to 3 sample contexts per group. Full list not shown.
- **Cross-Component Modal:** Map/Create modals don't open side-by-side with Import modal. User must switch between views.
- **Bulk Edit:** No way to edit multiple groups at once from queue.
- **Player Search:** Basic substring search; no fuzzy matching.
- **Undo:** No undo for Ignore/Map/Create actions.

---

## Architecture Notes

### Write Boundaries

- **Render:** NO writes. All data access is read-only.
- **User Actions:** Writes occur ONLY on explicit button clicks (Map/Create/Ignore/Confirm Import).

### Data Flow

```
Import HTML → Parser → Bets + Entities
                           ↓
                    Resolver (pure)
                           ↓
              ┌─ resolved → display canonical
              └─ unresolved → queue + display raw
                                    ↓
                           User action (Map/Create)
                                    ↓
                           refreshLookupMaps()
                                    ↓
                           resolverVersion++
                                    ↓
                           UI re-renders with updated data
```

### Testing Commands

```bash
npm test                    # Run full test suite
npm run test:watch          # Watch mode for development
```

---

## Phase 3.2 — Alias Normalization Hardening (Preflight)

**Status:** Preflight Complete (December 29, 2024)  
**Full Report:** [PHASE_3_2_PREFLIGHT_REPORT.md](./PHASE_3_2_PREFLIGHT_REPORT.md)

### Problem Statement

Occasional "looks-the-same-but-doesn't-resolve" cases caused by inconsistent string normalization between:

- Building lookup maps (players/teams/bettypes)
- Resolving raw imports
- Grouping unresolved queue items

### Key Findings

1. **No single shared normalization function** — Multiple ad-hoc patterns scattered:

   - `.toLowerCase()` only (map-build for teams/stats)
   - `.toLowerCase().trim()` (queue grouping, player map keys)
   - `.trim().toLowerCase()` (resolve functions)
   - `normalizePlayerNameBasic()` → `.trim().replace(/\s+/g, " ")` then `.toLowerCase()` (player lookups)

2. **Team/Stat map keys don't trim** — `buildTeamLookupMap` uses `key.toLowerCase()` without trimming, but resolve uses `.trim().toLowerCase()`. Dirty aliases with whitespace won't match.

3. **Queue grouping doesn't collapse spaces** — Players use space-collapse but queue grouping doesn't, potentially showing duplicate groups for whitespace variants.

4. **Alias save path has no normalization** — Raw values saved as-is, preserving any whitespace issues.

### Normalization Consistency Matrix

| Entity Type | Map-Build                                  | Resolve                 | Queue Grouping          | Mismatch? |
| ----------- | ------------------------------------------ | ----------------------- | ----------------------- | --------- |
| Team        | `.toLowerCase()`                           | `.trim().toLowerCase()` | `.toLowerCase().trim()` | **Y**     |
| Bet Type    | `.toLowerCase()`                           | `.trim().toLowerCase()` | `.toLowerCase().trim()` | **Y**     |
| Player      | `normalizePlayerNameBasic().toLowerCase()` | Same                    | `.toLowerCase().trim()` | **Y**     |

### Recommended Fix

Create single shared `toLookupKey()` function:

```typescript
export function toLookupKey(raw: string): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
```

Use everywhere: map-build, resolve, queue grouping, alias save validation.

### Execution Scope (If Approved)

| File                               | Changes                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| `services/normalizationService.ts` | Add `toLookupKey()`, update all map-build and resolve functions |
| `services/unresolvedQueue.ts`      | Use `toLookupKey()` in ID generation                            |
| `views/UnresolvedQueueManager.tsx` | Use `toLookupKey()` in group key generation                     |

### Risk Assessment

- **Low risk** — Whitespace collapse is safe (no real names differ by space count)
- **No fuzzy matching** — Pure deterministic transformation
- **Backward compatible** — Existing clean aliases match as before

### Deferred to Phase 3.3

- Unicode NFKC normalization
- Smart quote → ASCII conversion
- Em-dash → hyphen conversion

---

## Phase 3.P1 — Lookup Key Unification (January 2025)

**Status:** Implemented

### Summary

Created a single deterministic `toLookupKey()` function and applied it everywhere lookup keys are generated or compared. This eliminates "looks identical but doesn't resolve" bugs caused by inconsistent whitespace handling.

### What `toLookupKey()` Does

```typescript
export function toLookupKey(raw: string): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
```

Rules:
1. Trim leading/trailing whitespace
2. Collapse internal whitespace to a single space (`\s+` → " ")
3. Lowercase
4. Return "" for empty/null-ish input

### What `toLookupKey()` Does NOT Do

- **No Unicode NFKC normalization** — Deferred to Phase 3.3
- **No punctuation stripping** — Preserves apostrophes, periods, hyphens
- **No fuzzy matching** — Pure deterministic transformation

### Where It's Used

| Location | Purpose |
|----------|---------|
| `buildTeamLookupMap()` | Map key generation for teams |
| `buildBetTypeLookupMap()` | Map key generation for bet types |
| `buildPlayerLookupMap()` | Map key generation for players |
| `normalizeTeamName()` / `normalizeTeamNameWithMeta()` | Team resolution lookups |
| `normalizeBetType()` | Bet type resolution lookups |
| `getTeamInfo()` / `getSportForTeam()` | Team info lookups |
| `getBetTypeInfo()` | Bet type info lookups |
| `getPlayerInfo()` / `getPlayerCollision()` | Player resolution lookups |
| `generateUnresolvedItemId()` | Queue item ID generation |
| `generateGroupKey()` | Queue UI group key generation |
| `dedupeAliases()` | Alias deduplication on save |

### Files Modified

- `services/normalizationService.ts` — Added `toLookupKey()`, updated all map-build and lookup functions
- `services/unresolvedQueue.ts` — Uses `toLookupKey()` in ID generation
- `views/UnresolvedQueueManager.tsx` — Uses `toLookupKey()` in group key generation
- `hooks/useNormalizationData.tsx` — Added `dedupeAliases()` for alias save paths

### New Test Files

- `services/normalizationService.lookupKey.test.ts` — Unit tests for `toLookupKey()`

### Updated Test Files

- `services/resolver.test.ts` — Added "whitespace handling" describe block

