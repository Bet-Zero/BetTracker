# PHASE 3 PREFLIGHT REPORT — Unresolved Queue Review UI + Promote Workflow

**Date:** 2025-12-29  
**Scope:** User-facing review workflow for `bettracker-unresolved-queue`  
**Status:** Preflight Analysis Complete

---

## Executive Summary

Phase 3 implements the **Queue Review UI** that completes the "add as we go" dictionary model established in Phases 1 and 2. Users will be able to:

1. See unresolved item count (with optional badge)
2. Review items with context (book, market, sport, encountered time)
3. Take action: Map to Existing, Create New Canonical, or Ignore

This report documents the current system state and proposes a minimal implementation that follows existing patterns, requires no migrations, and maintains the strict write boundary contract (no render-time writes).

---

## A) Current Queue Data Shape (Exact)

### Storage Key

```
bettracker-unresolved-queue
```

**File:** [`services/unresolvedQueue.ts`](services/unresolvedQueue.ts)

### Queue State Structure

```typescript
interface UnresolvedQueueState {
  version: number; // Currently: 1
  updatedAt: string; // ISO timestamp of last write
  items: UnresolvedItem[];
}
```

### UnresolvedItem Schema

```typescript
export type UnresolvedEntityType = "team" | "stat" | "player" | "unknown";

export interface UnresolvedItem {
  /** Unique ID computed from rawValue + betId + legIndex */
  id: string;
  /** The raw entity text that couldn't be resolved */
  rawValue: string;
  /** Type of entity: team, stat, player, or unknown */
  entityType: UnresolvedEntityType;
  /** When this was first encountered (ISO timestamp) */
  encounteredAt: string;
  /** Sportsbook name */
  book: string;
  /** Bet ID for context */
  betId: string;
  /** Leg index if applicable */
  legIndex?: number;
  /** Raw market text for context */
  market?: string;
  /** Inferred sport if available */
  sport?: string;
  /** Short description/context snippet */
  context?: string;
}
```

### How Ambiguous Items Are Stored

**Key Finding:** Ambiguous resolution status (`status: 'ambiguous'` + `collision.candidates[]`) is **NOT persisted** in queue items.

The queue only stores the raw value and entity type. Collision candidates must be computed at action time via the resolver:

```typescript
// At action time, call resolver to get candidates
const result = resolveTeam(item.rawValue); // or resolvePlayer()
if (result.status === "ambiguous") {
  const candidates = result.collision.candidates; // Available at runtime
}
```

### Entity Type Values

Currently populated in queue (from [`ImportConfirmationModal.tsx`](components/ImportConfirmationModal.tsx) lines 1766-1805):

| entityType  | When Queued                                                    |
| ----------- | -------------------------------------------------------------- |
| `'team'`    | Main Markets legs with unresolved team name                    |
| `'player'`  | Props legs with unresolved player name                         |
| `'stat'`    | Not currently queued (stat types resolve or fallback silently) |
| `'unknown'` | Not currently queued (would require parser changes)            |

> **Note:** Only `'team'` and `'player'` are actively queued today.

---

## B) Current Normalization Overlay APIs (Exact)

### Teams

| Aspect              | Location                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| **Storage Key**     | `bettracker-normalization-teams`                                       |
| **Data Type**       | `TeamData[]`                                                           |
| **Add Function**    | `useNormalizationData().addTeam(team: TeamData)`                       |
| **Update Function** | `useNormalizationData().updateTeam(canonical: string, team: TeamData)` |
| **Refresh**         | `refreshLookupMaps()` (auto-called by hook on mutation)                |

**TeamData Interface:**

```typescript
interface TeamData {
  canonical: string;
  sport: Sport;
  abbreviations: string[];
  aliases: string[];
}
```

**File:** [`hooks/useNormalizationData.tsx`](hooks/useNormalizationData.tsx)

### Stat Types

| Aspect              | Location                                                                           |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Storage Key**     | `bettracker-normalization-stattypes`                                               |
| **Data Type**       | `StatTypeData[]`                                                                   |
| **Add Function**    | `useNormalizationData().addStatType(statType: StatTypeData)`                       |
| **Update Function** | `useNormalizationData().updateStatType(canonical: string, statType: StatTypeData)` |
| **Refresh**         | `refreshLookupMaps()` (auto-called by hook on mutation)                            |

**StatTypeData Interface:**

```typescript
interface StatTypeData {
  canonical: string;
  sport: Sport;
  description: string;
  aliases: string[];
}
```

### Players

| Aspect              | Location                                                                                |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Storage Key**     | `bettracker-normalization-players`                                                      |
| **Data Type**       | `PlayerData[]`                                                                          |
| **Add Function**    | **Does NOT exist in hook** — requires direct localStorage write + `refreshLookupMaps()` |
| **Update Function** | **Does NOT exist**                                                                      |
| **Refresh**         | `refreshLookupMaps()`                                                                   |

**PlayerData Interface:**

```typescript
interface PlayerData {
  id?: string; // Optional unique identifier
  canonical: string; // Display name
  sport: Sport; // Required
  team?: string; // Optional team affiliation
  aliases: string[];
}
```

**File:** [`services/normalizationService.ts`](services/normalizationService.ts) (lines 164-175)

> **Critical Gap:** Unlike teams and stat types, players do not have CRUD functions in `useNormalizationData`. Phase 3 must either:
>
> - Extend `useNormalizationData` to include player CRUD, OR
> - Create a new `usePlayerNormalizationData` hook, OR
> - Implement direct localStorage writes in the queue review component

**Recommendation:** Extend `useNormalizationData` to include player CRUD for consistency.

---

## C) UI Entry Point Options

### Option 1: Accordion inside InputManagementView (RECOMMENDED)

Add a new accordion section to the existing [`InputManagementView.tsx`](views/InputManagementView.tsx) following the pattern of "Teams with Aliases" and "Stat Types with Aliases".

**Pros:**

- Follows existing UI pattern exactly
- Users already navigate here for entity management
- No new routes required
- Consistent with "Input Management" mental model

**Cons:**

- Queue review is slightly buried (requires Settings → Input Management → expand accordion)

### Option 2: New Route/View `UnresolvedQueueView`

Create a dedicated route like `/queue` with a full-page view.

**Pros:**

- More prominent, dedicated space
- Could support more complex workflows

**Cons:**

- Requires router changes
- Adds navigation complexity
- Overkill for MVP

### Option 3: Modal/Panel from Header Badge

Add a badge to the app header showing unresolved count, clicking opens a slide-over panel.

**Pros:**

- Highly visible badge creates urgency
- Quick access from anywhere

**Cons:**

- Panel/modal interactions harder to implement
- Less space for context display
- Disrupts existing header layout

### Recommendation: Option 1

**Add an accordion section "Unresolved Queue" inside InputManagementView.**

Justification:

1. Minimal UI disruption
2. Follows established accordion pattern
3. Natural fit with "Input Management" section purpose
4. Can show badge count in accordion title: `"Unresolved Queue (5)"`

---

## D) Minimal State & Write Boundaries

### Write Locations (User Actions Only)

| Action              | Function                                   | File                   | Write Target                  |
| ------------------- | ------------------------------------------ | ---------------------- | ----------------------------- |
| **Map to Existing** | `updateTeam()` / extend player aliases     | `useNormalizationData` | `bettracker-normalization-*`  |
| **Map to Existing** | `removeFromUnresolvedQueue()`              | `unresolvedQueue.ts`   | `bettracker-unresolved-queue` |
| **Create New**      | `addTeam()` / `addStatType()` / add player | `useNormalizationData` | `bettracker-normalization-*`  |
| **Create New**      | `removeFromUnresolvedQueue()`              | `unresolvedQueue.ts`   | `bettracker-unresolved-queue` |
| **Ignore**          | `removeFromUnresolvedQueue()`              | `unresolvedQueue.ts`   | `bettracker-unresolved-queue` |

### No-Write Boundaries (Confirmed)

| Operation          | Allowed?                       |
| ------------------ | ------------------------------ |
| Component mount    | NO writes                      |
| List render        | NO writes                      |
| Filter/sort        | NO writes                      |
| Expand/collapse    | NO writes                      |
| Compute candidates | NO writes (pure resolver call) |

### Verification Method

To verify no render-time writes, check `bettracker-unresolved-queue.updatedAt` timestamp:

1. Open DevTools → Application → Local Storage
2. Record `updatedAt` value
3. Navigate to queue view, filter, sort
4. Verify `updatedAt` has NOT changed

---

## E) Required UI Capabilities (MVP)

### Queue List Display

Display unresolved items in a table or card list:

| Column      | Source               | Notes                                  |
| ----------- | -------------------- | -------------------------------------- |
| Raw Value   | `item.rawValue`      | The unrecognized string                |
| Entity Type | `item.entityType`    | Badge: team/player/stat                |
| Sport       | `item.sport`         | Prefilled from bet context             |
| Book        | `item.book`          | Sportsbook where encountered           |
| Market      | `item.market`        | Market context (e.g., "Pts", "Spread") |
| Encountered | `item.encounteredAt` | Formatted date/time                    |
| Actions     | —                    | Map / Create / Ignore buttons          |

### Filters (MVP)

| Filter      | Values                                            |
| ----------- | ------------------------------------------------- |
| Entity Type | All / Team / Player / (Stat if needed)            |
| Sport       | All / NBA / NFL / MLB / etc. (dynamic from queue) |
| Book        | (Optional) All / FanDuel / DraftKings / etc.      |

### Empty State

When queue is empty:

```
✓ All entities resolved
No unresolved items in queue.
```

### Count Display

Show count in accordion title:

```
Unresolved Queue (5)
```

Or with entity breakdown:

```
Unresolved Queue — 3 players, 2 teams
```

---

## F) Promote Flow Design (Exact)

### F1. Map-to-Existing Flow

**Trigger:** User clicks "Map" button on a queue item

**UI:**

1. Show dropdown/searchable select of existing canonicals for that entity type + sport
2. User selects target canonical
3. Confirm action

**Logic (Team):**

```typescript
// 1. Get selected canonical team
const targetTeam = teams.find((t) => t.canonical === selectedCanonical);

// 2. Add rawValue as new alias
const updatedTeam = {
  ...targetTeam,
  aliases: [...targetTeam.aliases, item.rawValue],
};

// 3. Update team (triggers refreshLookupMaps)
updateTeam(targetTeam.canonical, updatedTeam);

// 4. Remove from queue
removeFromUnresolvedQueue([item.id]);
```

**Logic (Player):**

```typescript
// 1. Load current players from localStorage
const players = JSON.parse(
  localStorage.getItem("bettracker-normalization-players") || "[]"
);

// 2. Find target player
const targetPlayer = players.find(
  (p) => p.canonical === selectedCanonical && p.sport === item.sport
);

// 3. Add rawValue as alias
targetPlayer.aliases.push(item.rawValue);

// 4. Save and refresh
localStorage.setItem(
  "bettracker-normalization-players",
  JSON.stringify(players)
);
refreshLookupMaps();

// 5. Remove from queue
removeFromUnresolvedQueue([item.id]);
```

### F2. Create-New Flow

**Trigger:** User clicks "Create" button on a queue item

**UI:**

1. Show form with prefilled values:
   - Canonical Name: input (default: `item.rawValue` with title case)
   - Sport: dropdown (prefilled from `item.sport`, required)
   - Aliases: multi-input (default includes `item.rawValue`)
   - For players: Team (optional), ID (optional)
2. User adjusts and confirms

**Logic (Team):**

```typescript
const newTeam: TeamData = {
  canonical: inputCanonical,
  sport: selectedSport,
  aliases: [item.rawValue, ...additionalAliases],
  abbreviations: [],
};

addTeam(newTeam);
removeFromUnresolvedQueue([item.id]);
```

**Logic (Stat Type):**

```typescript
const newStatType: StatTypeData = {
  canonical: inputCanonical,
  sport: selectedSport,
  description: inputDescription,
  aliases: [item.rawValue, ...additionalAliases],
};

addStatType(newStatType);
removeFromUnresolvedQueue([item.id]);
```

**Logic (Player):**

```typescript
const newPlayer: PlayerData = {
  id: inputId || undefined, // Optional
  canonical: inputCanonical,
  sport: selectedSport,
  team: inputTeam || undefined, // Optional
  aliases: [item.rawValue, ...additionalAliases],
};

// Add to players array in localStorage
const players = JSON.parse(
  localStorage.getItem("bettracker-normalization-players") || "[]"
);
players.push(newPlayer);
localStorage.setItem(
  "bettracker-normalization-players",
  JSON.stringify(players)
);
refreshLookupMaps();

removeFromUnresolvedQueue([item.id]);
```

### F3. Ignore Flow

**Trigger:** User clicks "Ignore" button on a queue item

**UI:** Confirmation dialog (optional for MVP)

**Logic:**

```typescript
removeFromUnresolvedQueue([item.id]);
```

> **Note:** No "ignore list" is implemented. Item is simply removed. If the same raw value appears in a future import, it will be re-queued.

---

## G) Collision / Ambiguity Handling (MVP)

### Current State

Queue items do **NOT** store collision candidates. The `UnresolvedItem` interface has no `candidates[]` field.

### Compute Candidates at Action Time

When user opens "Map to Existing" flow:

```typescript
// For teams
const result = resolveTeam(item.rawValue);
if (result.status === "ambiguous" && result.collision) {
  // Show collision.candidates as primary suggestions
  const suggestions = result.collision.candidates;
}

// For players
const result = resolvePlayer(item.rawValue, { sport: item.sport as Sport });
if (result.status === "ambiguous" && result.collision) {
  const suggestions = result.collision.candidates;
}
```

### UI for Ambiguous Items

When item was queued due to ambiguity (not just "not found"):

1. Show collision badge: `⚠️ Ambiguous`
2. In Map flow, pre-filter dropdown to collision candidates
3. Message: "This alias matches multiple canonicals. Pick the correct one."

### Detecting Ambiguous vs Unresolved

At runtime:

```typescript
const result = resolveTeam(item.rawValue);
if (result.status === "ambiguous") {
  // Show "Multiple matches" indicator
} else if (result.status === "unresolved") {
  // Show "Not found" indicator
} else {
  // Resolved — item shouldn't be in queue (edge case)
}
```

---

## H) File Surface Proposal

### New Files

| File                                  | Purpose                                                |
| ------------------------------------- | ------------------------------------------------------ |
| `views/UnresolvedQueueManager.tsx`    | Main component for queue review UI (accordion content) |
| `components/MapToExistingModal.tsx`   | Modal for mapping to existing canonical                |
| `components/CreateCanonicalModal.tsx` | Modal for creating new canonical entry                 |

### Modified Files

| File                                                                   | Changes                                                                 |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`views/InputManagementView.tsx`](views/InputManagementView.tsx)       | Add `<UnresolvedQueueManager />` accordion                              |
| [`hooks/useNormalizationData.tsx`](hooks/useNormalizationData.tsx)     | Add player CRUD functions (`addPlayer`, `updatePlayer`, `removePlayer`) |
| [`services/normalizationService.ts`](services/normalizationService.ts) | No changes needed (player functions exist)                              |
| [`services/unresolvedQueue.ts`](services/unresolvedQueue.ts)           | No changes needed (CRUD functions exist)                                |

### File Hierarchy

```
views/
├── InputManagementView.tsx          # Modified: add accordion
├── UnresolvedQueueManager.tsx       # NEW: queue list + filters
├── TeamAliasManager.tsx             # Existing (reference pattern)
└── StatTypeAliasManager.tsx         # Existing (reference pattern)

components/
├── MapToExistingModal.tsx           # NEW: map flow UI
└── CreateCanonicalModal.tsx         # NEW: create flow UI

hooks/
└── useNormalizationData.tsx         # Modified: add player CRUD

services/
├── unresolvedQueue.ts               # Existing (no changes)
├── normalizationService.ts          # Existing (no changes)
└── resolver.ts                      # Existing (no changes)
```

---

## I) Phase 3 Gates (Acceptance Criteria)

### Core Functionality

- [ ] **I1: Queue Visibility** — Unresolved queue count is visible in InputManagementView accordion title
- [ ] **I2: Queue List Render** — All queue items display with rawValue, entityType, sport, book, encounteredAt
- [ ] **I3: Filter by Type** — Can filter queue by entityType (team/player)
- [ ] **I4: Map to Existing (Team)** — Can map unresolved team to existing canonical; alias is added to team's aliases
- [ ] **I5: Map to Existing (Player)** — Can map unresolved player to existing canonical; alias is added to player's aliases
- [ ] **I6: Create New (Team)** — Can create new team with rawValue as default alias; appears in team lookup after refresh
- [ ] **I7: Create New (Player)** — Can create new player with rawValue as default alias; appears in player lookup after refresh
- [ ] **I8: Ignore** — Can ignore item; item is removed from queue permanently

### Integration

- [ ] **I9: Immediate Refresh** — After map/create, `refreshLookupMaps()` is called; same import no longer queues that rawValue
- [ ] **I10: Dashboard Reflects Changes** — After promoting "J. Tatum" → "Jayson Tatum", dashboard aggregation groups correctly
- [ ] **I11: Persistence** — After browser refresh, promoted canonicals persist and resolve correctly

### Write Boundary Compliance

- [ ] **I12: No Render Writes** — Navigate to queue view, filter, sort — verify `updatedAt` timestamp does not change
- [ ] **I13: Writes Only on User Action** — Only "Map", "Create", "Ignore" button clicks modify localStorage

### Edge Cases

- [ ] **I14: Empty Queue** — When queue is empty, show appropriate "all resolved" message
- [ ] **I15: Ambiguous Display** — Items with collision candidates show distinct indicator
- [ ] **I16: Sport Prefill** — Create flow prefills sport from queue item context

### Testing

- [ ] **I17: Unit Tests** — `unresolvedQueue.ts` has existing tests; add tests for new CRUD flows
- [ ] **I18: Integration Test** — Import bet with unknown entity → queue item appears → promote → re-import same bet → no new queue item

---

## Appendix: Existing Functions Reference

### unresolvedQueue.ts

```typescript
export function getUnresolvedQueue(): UnresolvedItem[];
export function addToUnresolvedQueue(newItems: UnresolvedItem[]): number;
export function removeFromUnresolvedQueue(ids: string[]): number;
export function clearUnresolvedQueue(): void;
export function getUnresolvedQueueCount(): number;
export function generateUnresolvedItemId(rawValue, betId, legIndex?): string;
```

### resolver.ts

```typescript
export function resolveTeam(rawTeamName: string): ResolverResult;
export function resolvePlayer(rawPlayerName: string, context?): ResolverResult;
export function resolveStatType(rawStatType: string, sport?): ResolverResult;
export function getTeamAggregationKey(raw, bucket): string;
export function getPlayerAggregationKey(raw, bucket, context?): string;
```

### useNormalizationData.tsx

```typescript
// Teams (existing)
addTeam(team: TeamData): boolean
updateTeam(canonical: string, team: TeamData): boolean
removeTeam(canonical: string): void

// Stat Types (existing)
addStatType(statType: StatTypeData): boolean
updateStatType(canonical: string, statType: StatTypeData): boolean
removeStatType(canonical: string): void

// Players (TO BE ADDED in Phase 3)
addPlayer(player: PlayerData): boolean        // NEW
updatePlayer(canonical: string, player: PlayerData): boolean  // NEW
removePlayer(canonical: string, sport: Sport): void           // NEW
```

---

_Report generated by BetTracker Phase 3 Preflight Analysis_
