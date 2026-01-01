# Phase 4 Preflight Report — Input Management UX Overhaul

**Date:** 2025-01-01  
**Status:** Preflight Complete  
**Scope:** Read-only analysis for UI/UX + wiring improvements

---

## Executive Summary

Phase 4 targets a **clean, dense, scalable Input Management UI** for managing Teams, Players, and Stat Types with sport/category grouping, Hide/Disable functionality, and improved ImportConfirmationModal integration.

Key findings:
- InputManagementView exists but is embedded within SettingsView (no dedicated nav entry)
- Two parallel input systems exist: `useInputs` (legacy) and `useNormalizationData` (canonical data with aliases)
- **No `disabled`/`hidden` field exists** in current data models — additive change required
- **No `category` field exists** on StatTypes — currently inferred from market classification
- Sport tabs can source from `SPORTS` constant in referenceData.ts
- ImportConfirmationModal already integrates with `resolverVersion` for live refresh
- Map/Create modals are reusable but currently only accessible from UnresolvedQueueManager

---

## A) Inventory: Current Input Management

### Entry Point

| Component | File | Access |
|-----------|------|--------|
| InputManagementSection | [InputManagementView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/InputManagementView.tsx) | Embedded in SettingsView (Settings tab) |
| SettingsView | [SettingsView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/SettingsView.tsx) | Nav tab "Settings" |

> [!NOTE]
> There is **no dedicated nav entry** for Input Management. Users must navigate to Settings → scroll to "Input Management" section.

### Component Tree / Wiring Map

```
App.tsx
├── NormalizationDataProvider (context for canonical data)
├── InputsProvider (context for legacy inputs)
└── SettingsView (tab="settings")
    └── InputManagementSection
        ├── QueueAccordion("Unresolved Queue")
        │   └── UnresolvedQueueManager
        │       ├── MapToExistingModal
        │       └── CreateCanonicalModal
        ├── Accordion("Sportsbooks") → SportsbooksManager
        ├── ListManager("Sports")
        ├── ListManager("Categories")
        ├── Accordion("Teams with Aliases")
        │   └── TeamAliasManager
        ├── Accordion("Players (Canonical + Aliases)")
        │   └── PlayerAliasManager
        ├── Accordion("Stat Types with Aliases")
        │   └── StatTypeAliasManager
        ├── BetTypesManager
        ├── SportFilteredListManager("Players" - legacy)
        └── SportFilteredListManager("Teams (Legacy)")
```

### Subcomponent Details

| Component | File | Rendering | Density | Editing |
|-----------|------|-----------|---------|---------|
| **TeamAliasManager** | [TeamAliasManager.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/TeamAliasManager.tsx) | List with sport filter, expandable aliases | ~60px per row | Inline edit with modal-like panel |
| **PlayerAliasManager** | [PlayerAliasManager.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/PlayerAliasManager.tsx) | List grouped by sport, search, expandable aliases | ~60px per row | Inline edit |
| **StatTypeAliasManager** | [StatTypeAliasManager.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/StatTypeAliasManager.tsx) | List with sport filter, expandable aliases | ~60px per row | Inline edit |
| **UnresolvedQueueManager** | [UnresolvedQueueManager.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/UnresolvedQueueManager.tsx) | Grouped list with count badges, expandable context | ~80px per row | Map/Create modal actions |
| **BetTypesManager** | [InputManagementView.tsx#242-349](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/InputManagementView.tsx#L242-L349) | Accordion with sport filter, flat list per sport | ~40px per row | Add form at top, delete only |
| **SportFilteredListManager** | [InputManagementView.tsx#351-420](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/InputManagementView.tsx#L351-L420) | Sport-filtered flat list | ~40px per row | Delete only (legacy) |

### Alias Manager Pattern (Shared)

All alias managers follow the same pattern:
1. Sport filter buttons at top
2. Search input (Players only currently)
3. Scrollable list with alternating row colors
4. Each row shows: canonical name, sport badge, alias count
5. Edit button → opens inline edit form
6. Delete button → immediate removal
7. Add form at bottom

---

## B) Data Model Reality Check

### Storage Keys & Locations

| Key | Service | Shape |
|-----|---------|-------|
| `bettracker-normalization-teams` | normalizationService.ts | `TeamData[]` |
| `bettracker-normalization-players` | normalizationService.ts | `PlayerData[]` |
| `bettracker-normalization-stattypes` | normalizationService.ts | `StatTypeData[]` |
| `bettracker-unresolved-queue` | unresolvedQueue.ts | `UnresolvedQueueState` |
| `bettracker-sportsbooks` | useInputs.tsx | `Sportsbook[]` |
| `bettracker-sports` | useInputs.tsx | `string[]` |
| `bettracker-categories` | useInputs.tsx | `string[]` |
| `bettracker-bettypes` | useInputs.tsx | `ItemsBySport` |
| `bettracker-players` | useInputs.tsx (legacy) | `ItemsBySport` |
| `bettracker-teams` | useInputs.tsx (legacy) | `ItemsBySport` |

### Current Canonical Entity Shapes

```typescript
// From services/normalizationService.ts (lines 192-225)

export interface TeamData {
  canonical: string;         // Display name
  sport: Sport;              // Required sport
  abbreviations: string[];   // Short forms (e.g., "LAL")
  aliases: string[];         // Alternative names
}

export interface StatTypeData {
  canonical: string;         // Display name
  sport: Sport;              // Required sport  
  description: string;       // What this stat measures
  aliases: string[];         // Alternative names
}

export interface PlayerData {
  id?: string;               // Optional unique ID
  canonical: string;         // Display name
  sport: Sport;              // Required sport
  team?: string;             // Optional team affiliation
  aliases: string[];         // Alternative names
}
```

### Unresolved Queue Shape

```typescript
// From services/unresolvedQueue.ts (lines 28-55)

export type UnresolvedEntityType = 'team' | 'stat' | 'player' | 'unknown';

export interface UnresolvedItem {
  id: string;                    // Generated from rawValue + betId + legIndex
  rawValue: string;              // Original unresolved text
  entityType: UnresolvedEntityType;
  encounteredAt: string;         // ISO timestamp
  book: string;                  // Sportsbook name
  betId: string;                 // Source bet ID
  legIndex?: number;             // Leg index if applicable
  market?: string;               // Raw market text
  sport?: string;                // Inferred sport
  context?: string;              // Context snippet
}
```

### Base Seed Data Locations

| Entity | File | Export |
|--------|------|--------|
| Teams | [data/referenceData.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/data/referenceData.ts) | `TEAMS: TeamInfo[]` |
| Stat Types | [data/referenceData.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/data/referenceData.ts) | `STAT_TYPES: StatTypeInfo[]` |
| Players | [data/referencePlayers.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/data/referencePlayers.ts) | `PLAYERS: PlayerInfo[]` (empty seed) |

---

## C) Sport + Category Tab Sources

### Sport Tabs

**Authoritative Source:** [`SPORTS` constant in data/referenceData.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/data/referenceData.ts#L15-L30)

```typescript
export const SPORTS = [
  'NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 
  'UFC', 'PGA', 'Soccer', 'Tennis', 'Other'
] as const;

export type Sport = typeof SPORTS[number];
```

**Current Usage:**
- `useInputs.tsx` maintains a separate `sports: string[]` in localStorage (`bettracker-sports`)
- Default: `['NBA', 'NFL', 'MLB', 'NHL', 'Soccer', 'Tennis']`
- Alias managers use `SPORTS` directly for validation (`isValidSport()`)

**Recommendation:** Sport tabs should source from `SPORTS` constant for consistency with validation. The `useInputs.sports` list could be used for "user-enabled sports" UI filtering, but the global tab list should use `SPORTS`.

### Category Tabs

> [!IMPORTANT]
> **No `category` field exists on StatTypeData.** Category is determined at the *bet level* via `marketCategory` field.

**Current Bet-Level Categories:** (from [useInputs.tsx#97-102](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/hooks/useInputs.tsx#L97-L102))
```typescript
const defaultCategories: string[] = [
  "Props", "Main Markets", "Futures", "Parlays"
];
```

**Market Classification:** The `classifyBet()` and `classifyLeg()` functions in [marketClassification.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/marketClassification.ts) determine category from the bet/leg market text.

**Recommendation for Stat Type Categories:**
If stat type category tabs are needed, add an **optional `category?: 'props' | 'main' | 'futures'` field** to `StatTypeData`. However, most stat types are inherently "props" — only totals/spread/moneyline are "main markets," and those are classified by `MAIN_MARKET_TYPES` already.

**Alternative:** Use a derived grouping in UI rather than adding a field:
- "Main Markets" → filter by canonical ∈ `['Moneyline', 'Spread', 'Total']`
- "Props" → everything else
- "Futures" → filter by canonical ∈ `FUTURE_TYPES[].canonical`

---

## D) CRUD / Refresh Mechanics

### Write Path Diagram

```
UI Action (Edit/Add/Delete)
        │
        ▼
useNormalizationData.tsx (hook)
        │
        ├─ addTeam / updateTeam / removeTeam
        ├─ addStatType / updateStatType / removeStatType
        └─ addPlayer / updatePlayer / removePlayer
                │
                ▼
        setTeams/setStatTypes/setPlayers (useState + localStorage)
                │
                ▼
        localStorage.setItem(NORMALIZATION_STORAGE_KEYS.*)
                │
                ▼
        refreshLookupMaps() (normalizationService.ts)
                │
                ├─ Rebuilds teamLookupMap, statTypeLookupMap, playerLookupMap
                └─ Increments resolverVersion++
                        │
                        ▼
                setResolverVersion(getResolverVersion())
                        │
                        ▼
                Dependent components re-render
```

### CRUD Function Inventory

**From [hooks/useNormalizationData.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/hooks/useNormalizationData.tsx):**

| Entity | Add | Update | Remove |
|--------|-----|--------|--------|
| Team | `addTeam(team: TeamData)` | `updateTeam(canonical, team)` | `removeTeam(canonical)` |
| StatType | `addStatType(statType: StatTypeData)` | `updateStatType(canonical, statType)` | `removeStatType(canonical)` |
| Player | `addPlayer(player: PlayerData)` | `updatePlayer(canonical, sport, player)` | `removePlayer(canonical, sport)` |

All functions:
1. Check for duplicates (return false if exists)
2. Update useState via `set*` 
3. Trigger `localStorage.setItem()` via `useLocalStorage` wrapper
4. Call `refreshLookupMaps()` internally (via `useLocalStorage` effect)
5. Update `resolverVersion` for UI refresh

### Resolver Version Trigger

The `resolverVersion` counter (exposed by `useNormalizationData`) is used by consumers to trigger re-renders when normalization data changes:

```typescript
// ImportConfirmationModal.tsx (line 208)
const { resolverVersion } = useNormalizationData();

// Used as dependency for validation memos (lines 221-224, 476-496)
const validationSummary = useMemo(() => {
  return validateBetsForImport(bets);
}, [bets, resolverVersion]);
```

### Enabled/Disabled Support

> [!CAUTION]
> **No `disabled` or `hidden` field exists in current data models.**

Current CRUD only supports full removal. To add Hide/Disable:
1. Add optional field to interfaces
2. Update resolver to skip disabled entries (unless explicitly requested)
3. Update UI to show/hide based on toggle

---

## E) Hidden vs Delete: Feasibility + Best Practice

### Proposed Field

Add to each entity interface:
```typescript
export interface TeamData {
  // ... existing fields
  disabled?: boolean;  // If true, excluded from resolution
}
```

Field name `disabled` is recommended over `hidden` because:
- Semantically matches "not active for resolution"
- More explicit than "hidden" (which could mean UI-only)
- Pairs well with "Enable/Disable" actions in UI

### Recommended Enforcement Strategy

| Location | Behavior |
|----------|----------|
| **Resolver Lookup** | **Skip disabled entities** — they shouldn't match during import. This prevents new bets from resolving to disabled entities. |
| **Map Building** | **Include disabled entities in lookup maps** but mark them. Required for "re-enable" functionality. |
| **Input Management UI** | Default hide disabled, with "Show disabled" toggle. Disabled rows show grayed styling. |
| **Alias Managers** | Show disabled entities with visual indicator, allow re-enable action. |

### Implementation Surface

1. **Add field to interfaces:** `normalizationService.ts` — `TeamData`, `StatTypeData`, `PlayerData`
2. **Update type guards:** `isValidTeamData()`, `isValidStatTypeData()`, `isValidPlayerData()` — allow optional `disabled`
3. **Update resolver:** Check `disabled !== true` before returning match
4. **Add toggle to CRUD hook:** `disableTeam(canonical)`, `enableTeam(canonical)` etc.
5. **Update UI:** Add "Disable"/"Enable" buttons, add "Show disabled" toggle

### Delete Safety

Delete (hard remove) is already safe because:
- Bets store raw strings, not foreign keys
- Removing an entity doesn't break existing bets
- Worst case: entity becomes "unresolved" for new imports

---

## F) ImportConfirmationModal Connection

### Current Issue Detection

The modal uses `getBetIssues()` (lines 286-433) to detect:
- Missing sport
- Unknown sport
- Unknown team (via `resolveTeam()`)
- Unknown player (via `availablePlayers` lookup)
- Missing stat type

### Resolution Flow Today

```
Import HTML → Parse Bets → Show ImportConfirmationModal
                                    │
                                    ├─ Shows issues inline (yellow/red indicators)
                                    └─ User must go to Settings → Input Management → Unresolved Queue
                                                │
                                                └─ Use Map/Create modals
                                                        │
                                                        ▼
                                                resolverVersion++
                                                        │
                                                        ▼
                                                Return to Import Modal → issues re-validated
```

### Proposed Integration Options

**Option 1: Inline Resolution (Recommended)**

Reuse `MapToExistingModal` and `CreateCanonicalModal` directly from ImportConfirmationModal:

1. When issue row is clicked, open the appropriate modal
2. Pass the issue context (rawValue, sport, entityType) as an `UnresolvedItem`-like object
3. On confirm, add alias/canonical via `useNormalizationData`
4. `resolverVersion++` triggers re-validation, issue disappears

**Files to touch:**
- `ImportConfirmationModal.tsx` — add modal state, import modals
- Minor: ensure modals work without actual queue item (already close to working)

**Option 2: Deep-Link to Input Management**

Add a "Manage Inputs" button that:
1. Switches to Settings tab
2. Opens relevant accordion (Teams/Players/StatTypes)
3. Pre-fills search with the problematic value

Pros: Less modal stacking  
Cons: User leaves import flow, may lose context

### Recommended Approach

**Option 1 with grouped resolution:**

1. Add "Resolve" button next to each issue in ImportConfirmationModal
2. Clicking opens a **mini-resolver UI** (not full modal) with:
   - "Map to existing" dropdown/search
   - "Create new" quick form
3. Confirmation adds alias, triggers `resolverVersion++`, issue clears

Create a new component: `ResolveInlineWidget.tsx` that can be used by both:
- ImportConfirmationModal (inline)
- UnresolvedQueueManager (in expanded row or as alternative to full modals)

---

## G) Proposed Phase 4 Execution Outline

### UI Structure Changes
- [ ] Add dedicated "Input Management" nav entry OR move to more prominent location
- [ ] Redesign InputManagementView with tabbed navigation:
  - Tab 1: Unresolved Queue (prominent, count badge)
  - Tab 2: Teams (sport sub-tabs)
  - Tab 3: Players (sport sub-tabs)
  - Tab 4: Stat Types (sport sub-tabs)
- [ ] Consolidate legacy `useInputs` players/teams into `useNormalizationData` system

### Data Model Changes
- [ ] Add `disabled?: boolean` field to `TeamData`, `StatTypeData`, `PlayerData`
- [ ] Update type guards to accept optional `disabled`
- [ ] Add "category" grouping for stat types (derived, not stored)

### Resolver Changes
- [ ] Update `resolveTeam()`, `resolvePlayer()` to respect `disabled`
- [ ] Add `includeDisabled?: boolean` option for admin views

### CRUD Hook Changes
- [ ] Add `disableTeam()`, `enableTeam()` functions
- [ ] Add `disableStatType()`, `enableStatType()` functions
- [ ] Add `disablePlayer()`, `enablePlayer()` functions

### UI Component Changes
- [ ] Add "Disable" / "Enable" buttons to alias managers
- [ ] Add "Show disabled" toggle to each manager
- [ ] Style disabled rows with reduced opacity

### ImportConfirmationModal Integration
- [ ] Add inline resolution capability (ResolveInlineWidget)
- [ ] Allow Map/Create from issue rows without leaving modal
- [ ] Remove queue addition for items resolved at import time

### Verification
- [ ] Verify disabled entities don't match on import
- [ ] Verify UI correctly hides/shows disabled based on toggle
- [ ] Verify ImportConfirmationModal live refresh after inline resolve
- [ ] Verify delete still works for overlay items

---

## H) Top 5 Files Phase 4 Execution Will Change

1. **[views/InputManagementView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/InputManagementView.tsx)** — Major restructure for tabbed navigation, sport sub-tabs, dense layout

2. **[services/normalizationService.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts)** — Add `disabled` field to interfaces, update type guards, update resolver logic

3. **[hooks/useNormalizationData.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/hooks/useNormalizationData.tsx)** — Add disable/enable CRUD functions

4. **[components/ImportConfirmationModal.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/components/ImportConfirmationModal.tsx)** — Add inline resolution capability

5. **[views/TeamAliasManager.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/TeamAliasManager.tsx)** (and `PlayerAliasManager.tsx`, `StatTypeAliasManager.tsx`) — Add disable/enable buttons, disabled styling, show/hide toggle

---

## I) Open Questions / Potential Blockers

### 1. Nav Entry Decision
Should Input Management get its own top-level nav entry, or remain under Settings?

**Recommendation:** Add dedicated nav entry if daily usage expected; otherwise accordion within Settings is fine.

### 2. Legacy `useInputs` Consolidation
The legacy `bettracker-players` and `bettracker-teams` keys (flat lists by sport) duplicate data from the canonical normalization system. Should Phase 4 migrate these to use `useNormalizationData` exclusively?

**Recommendation:** Keep legacy for now, mark UI sections as "(Legacy)" — full migration can be Phase 5.

### 3. Stat Type Category Field
Is an explicit `category` field on StatTypeData needed, or is derived grouping sufficient?

**Recommendation:** Start with derived grouping. Add field only if users need to override classification.

### 4. Disabled Entity Matching Behavior
Should disabled entities be completely invisible to resolver, or should they still match but flag a warning?

**Recommendation:** Completely invisible — that's the point of disabling.

### 5. Bulk Operations
Should Phase 4 include bulk disable/enable/delete for multiple entities?

**Recommendation:** Defer to Phase 5 — keep Phase 4 focused on single-entity operations.

---

## Summary

Phase 4 is **feasible with minimal data model changes**:
- Add one optional field (`disabled`) to existing interfaces
- No schema migrations required
- No Firestore/server changes
- Main work is UI restructuring and wiring

The existing `resolverVersion` mechanism already provides the refresh trigger needed for live updates. The Map/Create modals are reusable with minor adaptation for ImportConfirmationModal integration.

**No hard blockers identified.**
