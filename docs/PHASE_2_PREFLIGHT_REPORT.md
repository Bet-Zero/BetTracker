# PHASE 2 PREFLIGHT REPORT — Player Canonicalization

**Date:** 2025-12-29  
**Scope:** Player canonicalization + alias resolution system  
**Status:** Preflight Analysis Complete

---

## A) Where Player Strings Are Created/Stored Today

### Parser Extraction Points

Player names are extracted during HTML parsing in sportsbook-specific parsers:

| Sportsbook | File | Function | Key Logic |
|------------|------|----------|-----------|
| DraftKings | `parsing/draftkings/parsers/single.ts` | `parseSingleBet()` | Calls `extractNameAndType(leg.market, leg.target)` → populates `leg.entities` |
| DraftKings | `parsing/draftkings/parsers/parlay.ts` | Parlay parsing | Same pattern, builds `BetLeg` objects with `entities[]` |
| FanDuel | `parsing/fanduel/parsers/*.ts` | Various | Same `leg.entities[]` pattern |

### Where Player Names Land in Bet Objects

```typescript
// types.ts:58-92
interface BetLeg {
  entities?: string[];           // Player/team names extracted from market text
  entityType?: "player" | "team" | "unknown";  // Classification
  market: string;                // Raw market text (e.g., "LeBron James Points")
  // ...
}

interface Bet {
  name?: string;                 // Convenience field from legs[0].entities[0]
  legs?: BetLeg[];               // All legs, each with own entities[] 
}
```

### Storage Location

**Primary Storage Key:** `bettracker-state`  
**File:** `services/persistence.ts`

```typescript
interface PersistedState {
  version: number;
  updatedAt: string;
  bets: Bet[];  // Player names stored inside bet.legs[].entities[]
}
```

> **Key Finding:** Player names are stored as raw strings inside `leg.entities[]`. There is **no separate player list storage** — players are extracted at read-time from bet data.

---

## B) How Entity Type Is Determined Today

### Parser-Level Assignment

`entityType` is assigned by parsers based on market type detection:

**DraftKings single.ts (Lines 106-123):**
```typescript
const MAIN_MARKET_TYPES = ['Spread', 'Total', 'Moneyline'];

if (MAIN_MARKET_TYPES.includes(type)) {
  leg.entityType = 'team';
} else if (type) {
  if (isPlayerStatType(type)) {
    leg.entityType = 'player';
  } else if (isTeamPropType(type)) {
    leg.entityType = 'team';
  } else {
    leg.entityType = 'unknown';
  }
} else {
  leg.entityType = 'unknown';
}
```

### Helper Functions

Located in `parsing/draftkings/parsers/common.ts`:
- `isPlayerStatType(type)` — checks if type is a player prop (e.g., "Pts", "Reb", "Pass Yds")
- `isTeamPropType(type)` — checks if type is a team prop

### Consumer Fallback Logic

Views like `DashboardView.tsx` (Lines 764-778) use fallback when `entityType` is undefined:

```typescript
if (leg.entityType === 'player') {
  players.add(aggregationKey);
} else if (leg.entityType === 'team') {
  teams.add(aggregationKey);
} else {
  // Fallback: check if entity is a known team via normalization service
  const teamInfo = getTeamInfo(entity);
  if (teamInfo) {
    teams.add(aggregationKey);
  } else {
    // Assume player if not a known team
    players.add(aggregationKey);
  }
}
```

### Known Failure Modes

| Failure Mode | Example | Consequence |
|--------------|---------|-------------|
| Player mis-tagged as team | Unrecognized prop type | Falls to `unknown`, then fallback logic checks team database |
| Team mis-tagged as player | Future bet on team win total if not recognized | Incorrect entity type assignment |
| `undefined` entityType | Legacy data or parsers that didn't set it | Must be handled identically to `unknown` |

> **IMPORTANT:** Both `undefined` and `"unknown"` indicate unreliable classification. Consumers must check for both.

---

## C) Existing Normalization/Resolver Touchpoints

### Phase 1 Resolver Location

**File:** `services/resolver.ts`

| Function | Purpose | Returns |
|----------|---------|---------|
| `resolveTeam(rawTeamName)` | Team resolution chokepoint | `ResolverResult { status, canonical, raw, collision? }` |
| `resolveStatType(rawStatType, sport?)` | Stat type resolution | Same structure |
| `getTeamAggregationKey(raw, bucket)` | Returns canonical or fallback bucket | `string` |

### Import Confirmation Modal

**File:** `components/ImportConfirmationModal.tsx`

```typescript
// Phase 1: Use resolver chokepoint for team detection
const resolverResult = resolveTeam(legName);
if (resolverResult.status === 'unresolved') {
  issues.push({ field: "Name", message: `Team "${legName}" not in database` });
} else if (resolverResult.status === 'ambiguous' && resolverResult.collision) {
  issues.push({ field: "Name", message: `Ambiguous team alias...` });
}
```

### Dashboard Aggregation (Pure Read)

**File:** `views/DashboardView.tsx`

```typescript
const playerTeamMap = computeEntityStatsMap(filteredBets, (leg, bet) => {
  if (leg.entities && leg.entities.length > 0) {
    return leg.entities.map(entity => getTeamAggregationKey(entity, '[Unresolved]'));
  }
  return null;
});
```

> **Key Finding:** Dashboard aggregation is **pure** — it uses `getTeamAggregationKey()` for read-only normalization, causing no queue writes.

### Queue Writes

**Only location:** `components/ImportConfirmationModal.tsx`

The queue is populated via `addToUnresolvedQueue()` during import confirmation, never during render or navigation.

---

## D) Current Storage Model & Keys (Players)

### All Storage Keys

| Key | Purpose | File | Shape |
|-----|---------|------|-------|
| `bettracker-state` | Main bet storage | `services/persistence.ts` | `{ version, updatedAt, bets: Bet[] }` |
| `bettracker-normalization-teams` | Team alias overlays | `services/normalizationService.ts` | `TeamData[]` |
| `bettracker-normalization-stattypes` | Stat type overlays | `services/normalizationService.ts` | `StatTypeData[]` |
| `bettracker-unresolved-queue` | Unresolved entity queue | `services/unresolvedQueue.ts` | `{ version, updatedAt, items: UnresolvedItem[] }` |

### Player-Specific Storage

> **CRITICAL FINDING:** There is **NO dedicated player storage key today.** 
> 
> Players exist only within `bet.legs[].entities[]` as raw strings. Unlike teams, there is no `bettracker-players` or similar key.

### Existing Normalization Overlay Pattern

From `services/normalizationService.ts`:

```typescript
// Architecture:
// - Base seed data comes from `data/referenceData.ts` (versioned in code)
// - User-added aliases are stored in localStorage as overlays
// - Overlays EXTEND base data (user entries take precedence on conflict)
// - Call `refreshLookupMaps()` after users add/edit aliases via UI
```

---

## E) Proposed Player Canonical Data Shape

Following the existing team/stat patterns:

### Seed Data Location

**Proposed Path:** `data/referenceData.ts` (extend existing file)

```typescript
// Add to existing referenceData.ts
export interface PlayerInfo {
  canonical: string;      // Official display name (e.g., "Jayson Tatum")
  sport: Sport;           // Associated sport
  team?: string;          // Current team canonical (for disambiguation)
  aliases: string[];      // All variations: ["J. Tatum", "Tatum", "Jason Tatum"]
}

export const PLAYERS: PlayerInfo[] = [
  // NBA Players
  {
    canonical: 'Jayson Tatum',
    sport: 'NBA',
    team: 'Boston Celtics',
    aliases: ['J. Tatum', 'Tatum', 'Jay Tatum', 'JT']
  },
  // ...
];
```

### LocalStorage Overlay Key

**Proposed Key:** `bettracker-normalization-players`

```typescript
// Add to NORMALIZATION_STORAGE_KEYS in normalizationService.ts
export const NORMALIZATION_STORAGE_KEYS = {
  TEAMS: 'bettracker-normalization-teams',
  STAT_TYPES: 'bettracker-normalization-stattypes',
  PLAYERS: 'bettracker-normalization-players',  // NEW
} as const;
```

### Lookup Map Structure

```typescript
// Following buildTeamLookupMap pattern
let playerLookupMap = new Map<string, PlayerData>();  // O(1) lookup
let playerCollisionMap = new Map<string, string[]>(); // Track ambiguous aliases

function buildPlayerLookupMap(players: PlayerData[]): Map<string, PlayerData> {
  const map = new Map<string, PlayerData>();
  // Index by canonical (lowercase), all aliases (lowercase)
  // Collision detection for shared aliases
  return map;
}
```

### Sport/League Binding

Players are **always sport-bound** (unlike some stat types that cross sports):

```typescript
interface PlayerData {
  canonical: string;
  sport: Sport;           // Required, not optional
  team?: string;          // Optional current team for disambiguation
  aliases: string[];
}
```

---

## F) Backward Compatibility Plan

### Existing Stored Bets

Old bets store player names as raw strings in `leg.entities[]`:

```json
{
  "legs": [{
    "entities": ["J. Tatum"],
    "entityType": "player",
    "market": "Pts"
  }]
}
```

### Compatibility Strategy

| Scenario | Behavior |
|----------|----------|
| Old bet with raw player string | Resolved at **read-time** (pure), display shows canonical if found |
| New bet during import | Resolved at import, queue captures unresolved |
| No `playerId` field added | Keep raw strings, canonical is display-only |
| Dashboard aggregation | `getPlayerAggregationKey(raw, '[Unresolved]')` buckets unknowns |

### No Schema Migration Required

> **Key Decision:** Do NOT add `playerId` to stored bets.
> 
> Rationale: The canonical name IS the identity. Storing redundant IDs would require migration of all historical bets. Instead, resolve at read-time using the alias map.

### Lazy Resolution (Pure, No Writes)

```typescript
// Dashboard usage pattern (pure read):
const playerKey = getPlayerAggregationKey(entity, '[Unresolved]');
// Returns canonical if found, bucket string if not
// NO queue writes during this call
```

### Import-Time Resolution (Queue Writes)

```typescript
// ImportConfirmationModal pattern (writes allowed):
const result = resolvePlayer(rawPlayerName, sport);
if (result.status === 'unresolved') {
  addToUnresolvedQueue([{
    entityType: 'player',  // NEW: add 'player' to UnresolvedEntityType
    rawValue: rawPlayerName,
    // ... context
  }]);
}
```

---

## G) Collision/Ambiguity Strategy (Players)

### When Resolver Returns Ambiguous vs Unresolved

| Status | Condition | Example |
|--------|-----------|---------|
| `resolved` | Unique match found | "Jayson Tatum" → "Jayson Tatum" |
| `ambiguous` | Multiple canonicals share alias | "J. Williams" → [Jaylin Williams, Jalen Williams, ...] |
| `unresolved` | No match in database | "Unknown Player" → stays as-is |

### Queue Item for Player Ambiguity

```typescript
interface UnresolvedItem {
  id: string;
  rawValue: string;           // "J. Williams"
  entityType: 'player';       // NEW value
  encounteredAt: string;
  book: string;
  betId: string;
  legIndex?: number;
  market?: string;            // "Pts" helps narrow (NBA-specific)
  sport?: string;             // "NBA" critical for player disambiguation
  context?: string;           // "NBA: Celtics @ Thunder" (matchup text)
}
```

### Context for Disambiguation

| Context | Source | Usage |
|---------|--------|-------|
| Sport | `bet.sport` | Primary filter (NBA player ≠ NFL player) |
| Team | `leg.entities[1]` if Total, or from matchup | Narrow candidates by roster |
| Market text | `leg.market` | "Jayson Tatum Pts" confirms NBA |
| Matchup | Event card parsing | "Celtics @ Thunder" extracts teams |

### Resolution UI Flow

1. User sees ambiguous queue item: "J. Williams" (NBA)
2. UI shows candidates: ["Jaylin Williams", "Jalen Williams", ...]
3. User selects correct canonical
4. System adds alias mapping: "j. williams" → selected canonical
5. `refreshLookupMaps()` updates in-memory cache

---

## H) Minimal File Surface for Phase 2 Implementation

### Files Requiring Changes

| File | Why | Changes | Risk |
|------|-----|---------|------|
| `data/referenceData.ts` | Add player seed data | Add `PlayerInfo` interface, `PLAYERS` constant | Low: Additive only |
| `services/normalizationService.ts` | Add player lookup maps + functions | Add storage key, `PlayerData` type, `buildPlayerLookupMap()`, `normalizePlayerName()`, `getPlayerInfo()` | Medium: Core service, needs thorough testing |
| `services/resolver.ts` | Add player resolution chokepoint | Add `resolvePlayer()`, `isPlayerResolved()`, `getPlayerAggregationKey()` | Low: Follows existing pattern exactly |
| `services/unresolvedQueue.ts` | Add 'player' to entity type | Change `UnresolvedEntityType = 'team' \| 'stat' \| 'player' \| 'unknown'` | Low: Type-only change |
| `components/ImportConfirmationModal.tsx` | Add player resolution logic | Update `getBetIssues()` to use `resolvePlayer()`, queue unresolved | Medium: Complex component |
| `views/DashboardView.tsx` | Use `getPlayerAggregationKey()` | Update entity extraction to normalize players | Low: Pure read, follows team pattern |

### Files to NOT Touch

- `persistence.ts` — No schema changes needed
- Parser files — entityType assignment already works
- `types.ts` — Bet/BetLeg interfaces unchanged
- `entityStatsService.ts` — Already entity-agnostic

---

## I) Phase 2 Gate Checklist

### Verification Steps

- [ ] **1. Seed Data Loading:** Player seed data loads correctly from `referenceData.ts` on app init
- [ ] **2. Overlay Persistence:** User-added player aliases persist in `bettracker-normalization-players`
- [ ] **3. Alias Resolution:** "J. Tatum" and "Jayson Tatum" resolve to same canonical "Jayson Tatum"
- [ ] **4. Cross-Book Consistency:** Same player from FanDuel and DraftKings resolves to same canonical
- [ ] **5. Ambiguous Detection:** "J. Williams" (with multiple NBA players) returns `status: 'ambiguous'`
- [ ] **6. Queue Population:** Unresolved players are added to queue with `entityType: 'player'` and context
- [ ] **7. Dashboard Aggregation:** Player stats aggregate by canonical name, not raw string
- [ ] **8. Unresolved Bucket:** Unknown players bucket under `[Unresolved]` in dashboards
- [ ] **9. No Render Writes:** Navigate between views — confirm no queue writes (check console logs)
- [ ] **10. Backward Compat:** Old bets with raw player strings still display and aggregate correctly
- [ ] **11. Sport Scoping:** NBA "J. Williams" does not collide with potential NFL "J. Williams"
- [ ] **12. Refresh Cache:** After adding alias via UI queue, `refreshLookupMaps()` updates resolution

### Test Commands

```bash
# Run existing tests (should pass unmodified)
npm test

# Run normalization service tests
npm test -- normalizationService.test.ts

# Run resolver tests  
npm test -- resolver.test.ts

# Run import pipeline tests
npm test -- importPipeline.test.ts
```

---

## Summary

Phase 2 player canonicalization can follow the established patterns for teams/stat types:

1. **Seed data** in `referenceData.ts` with `PlayerInfo[]`
2. **Overlay storage** at `bettracker-normalization-players`
3. **Resolver chokepoint** via `resolvePlayer()` in `resolver.ts`
4. **Queue integration** with `entityType: 'player'`
5. **Pure aggregation** via `getPlayerAggregationKey()`
6. **No bet schema changes** — resolution is display-time

The minimal file surface is 6 files, with most changes being additive and following existing patterns.
