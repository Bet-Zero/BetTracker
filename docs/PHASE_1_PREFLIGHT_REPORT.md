# PHASE 1 PREFLIGHT REPORT — BetTracker

**Date**: 2025-12-28  
**Goal**: Persistent Unresolved Queue + Resolver Chokepoint Contract for Teams/Stat Types + No Raw String Aggregation

> [!IMPORTANT]
> This report is **read-only analysis**. No code changes have been made.

---

## A) Current Import Pipeline Map (As-Is)

### 1. Entry Point(s)
| Step | File | Function/Component | Object Shape |
|------|------|-------------------|--------------|
| User pastes HTML | [ImportView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/ImportView.tsx) | `ImportView` component | Raw HTML string in `pageHtml` state |

### 2. Parsing Step
| Step | File | Function | Object Shape |
|------|------|----------|--------------|
| Parser dispatch | [importer.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/importer.ts) | `parseBetsResult()` | `Result<Bet[]>` |
| DraftKings single | [draftkings/parsers/single.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/parsing/draftkings/parsers/single.ts) | Parser function | `Bet[]` |
| DraftKings parlay | [draftkings/parsers/parlay.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/parsing/draftkings/parsers/parlay.ts) | Parser function | `Bet[]` |
| FanDuel parsers | [fanduel/parsers/](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/parsing/fanduel/parsers/) | Various | `Bet[]` |

**Bet Object (from parsing):**
```typescript
interface Bet {
  id: string;           // "{book}:{betId}:{placedAt}"
  book: SportsbookName;
  betId: string;
  placedAt: string;     // ISO timestamp
  betType: BetType;     // 'single' | 'parlay' | 'sgp' | 'sgp_plus' | 'live' | 'other'
  marketCategory: MarketCategory;  // 'Props' | 'Main Markets' | 'Futures' | 'Parlays'
  sport: string;
  description: string;
  name?: string;
  odds?: number | null;
  stake: number;
  payout: number;
  result: BetResult;
  type?: string;
  line?: string;
  ou?: "Over" | "Under";
  legs?: BetLeg[];
  tail?: string;
  raw?: string;
  isLive?: boolean;
}
```

**BetLeg Object:**
```typescript
interface BetLeg {
  entities?: string[];      // Raw entity names from sportsbook
  entityType?: "player" | "team" | "unknown";  // ClassificationType
  market: string;           // Raw market text
  target?: number | string;
  ou?: "Over" | "Under";
  odds?: number;
  result?: LegResult | BetResult;
  isGroupLeg?: boolean;
  children?: BetLeg[];
}
```

### 3. Normalization Step(s)
| File | Function | Purpose |
|------|----------|---------|
| [normalizationService.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts) | `normalizeTeamName(teamName)` | Resolves team aliases → canonical name |
| [normalizationService.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts) | `normalizeTeamNameWithMeta(teamName)` | Same, but returns collision metadata |
| [normalizationService.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts) | `normalizeStatType(statType, sport?)` | Resolves stat aliases → canonical code |

**Key Finding**: Normalization occurs at **consumption time** (DashboardView, BySportView), NOT at import time. Parsers store raw entity names; normalization is applied when aggregating.

### 4. Classification Step(s)
| File | Function | Purpose |
|------|----------|---------|
| [marketClassification.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/marketClassification.ts) | `classifyBet(bet)` | Determines `MarketCategory` |
| [marketClassification.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/marketClassification.ts) | `classifyLeg(market, sport)` | Classifies individual leg category |
| [marketClassification.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/marketClassification.ts) | `determineType(market, category, sport)` | Determines stat type / market type |

### 5. Confirmation Step
| File | Component | Purpose |
|------|-----------|---------|
| [ImportConfirmationModal.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/components/ImportConfirmationModal.tsx) | `ImportConfirmationModal` | User reviews/edits parsed bets |

Key functions:
- `getBetIssues()` — Identifies missing sports, unknown players/teams (lines 259–375)
- `validateBetsForImport()` — Computes blockers vs warnings (from `importValidation.ts`)

### 6. Persistence Step
| File | Function | Storage Key |
|------|----------|-------------|
| [useBets.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/hooks/useBets.tsx) | `addBets(newBets)` | Calls `saveState()` |
| [persistence.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/persistence.ts) | `saveState(state)` | **`bettracker-state`** |

**PersistedState Shape:**
```typescript
interface PersistedState {
  version: number;
  updatedAt: string;
  bets: Bet[];
  metadata?: {
    lastMigration?: string;
    previousVersion?: number;
    _needsLegacyCleanup?: boolean;
  };
}
```

---

## B) Where Unknowns Are Currently Dropped (The Leak)

### B1. Parser-Level: `entityType: 'unknown'`

**File**: [draftkings/parsers/single.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/parsing/draftkings/parsers/single.ts)  
**Lines**: 118–122
```typescript
// Unrecognized prop type - mark as unknown for future handling
leg.entityType = 'unknown';
```

**File**: [fanduel/parsers/common.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/parsing/fanduel/parsers/common.ts)  
**Lines**: 118–125
```typescript
/**
 * Ambiguous or unrecognized markets return "unknown" to prevent entity list pollution.
 */
inferEntityType("Super Bowl Winner") // => "unknown"
```

**What happens today**: Parsers set `leg.entityType = 'unknown'`, but this flag is **only used for display filtering**. No unresolved queue is created.

**What should happen in Phase 1**: When `entityType === 'unknown'`:
1. Add the entity to a persistent **Unresolved Queue**
2. Flow continues normally (bet is imported)
3. UI provides resolution workflow later

### B2. ImportConfirmationModal: Warnings Shown But Not Persisted

**File**: [ImportConfirmationModal.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/components/ImportConfirmationModal.tsx)  
**Function**: `getBetIssues()` (lines 259–375)

```typescript
if (!isKnownTeam(legName) && normResult.canonical === legName.trim()) {
  // Unknown team
  issues.push({
    field: "Name",
    message: `Team "${legName}" not in database`,
  });
}
```

**What happens today**: Issues are displayed as warnings in the modal. User can:
- Add team/player via `handleAddTeam()` / `handleAddPlayer()`
- Or ignore warning and import anyway

**What should happen in Phase 1**: Unknown entities should automatically queue to the **Unresolved Queue** and be persisted, regardless of whether user adds them.

### B3. Dashboard Aggregation: Silent Passthrough

**File**: [DashboardView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/DashboardView.tsx)  
**Lines**: 854–859
```typescript
const playerTeamMap = computeEntityStatsMap(filteredBets, (leg, bet) => {
  if (leg.entities && leg.entities.length > 0) {
    return leg.entities.map(entity => normalizeTeamName(entity));
  }
  return null;
});
```

**What happens today**: If `normalizeTeamName(entity)` returns the original string (no match), that raw string becomes an aggregation key. This creates **silent entity fragmentation**.

**What should happen in Phase 1**: Before passing to aggregation functions, check if normalization produced a known canonical. If not, either:
- Use a placeholder key like `"[Unresolved]"` for aggregation
- Or exclude unknown entities from entity-specific breakdowns (they still count in overall stats)

---

## C) Existing Storage Keys / Local Persistence Inventory

| Storage Key | Defined In | Shape |
|-------------|-----------|-------|
| **`bettracker-state`** | [persistence.ts:27](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/persistence.ts#L27) | `PersistedState { version, updatedAt, bets: Bet[], metadata? }` |
| **`bettracker-normalization-teams`** | [normalizationService.ts:93](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts#L93) | `TeamData[]` |
| **`bettracker-normalization-stattypes`** | [normalizationService.ts:94](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts#L94) | `StatTypeData[]` |
| **`bettracker-sportsbooks`** | [useInputs.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/hooks/useInputs.tsx) (via `useLocalStorage`) | `Sportsbook[]` |
| **`bettracker-sports`** | [useInputs.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/hooks/useInputs.tsx) (via `useLocalStorage`) | `string[]` |
| **`bettracker-players`** | [useInputs.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/hooks/useInputs.tsx) (via `useLocalStorage`) | `Record<string, string[]>` |
| **`bettracker-teams`** | [useInputs.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/hooks/useInputs.tsx) (via `useLocalStorage`) | `Record<string, string[]>` (sport → team names) |

> [!NOTE]
> **No existing "unresolved" or "warnings" storage key exists.** Phase 1 must create one.

---

## D) Current Canonicalization "Source of Truth" (As-Is)

### TEAMS

| Aspect | Location |
|--------|----------|
| Seed data | [data/referenceData.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/data/referenceData.ts) → `TEAMS: TeamInfo[]` |
| Overlay data | localStorage key `bettracker-normalization-teams` |
| Lookup built | [normalizationService.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts) → `buildTeamLookupMap()` |
| Lookup function | `normalizeTeamName(teamName): string` |

**Team canonical output today is: CANONICAL STRING** (e.g., `"Phoenix Suns"`, not an ID)

### STAT TYPES

| Aspect | Location |
|--------|----------|
| Seed data | [data/referenceData.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/data/referenceData.ts) → `STAT_TYPES: StatTypeInfo[]` |
| Overlay data | localStorage key `bettracker-normalization-stattypes` |
| Lookup built | [normalizationService.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts) → `buildStatTypeLookupMap()` |
| Lookup function | `normalizeStatType(statType, sport?): string` |

**Stat type canonical output today is: CANONICAL STRING** (e.g., `"Pts"`, `"3pt"`, not an ID)

---

## E) Analytics / Dashboard Aggregation Keys (Critical)

### E1. Team/Player Aggregation (Entity Stats)

**File**: [DashboardView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/DashboardView.tsx#L854-L859)  
**Function**: `computeEntityStatsMap()` with inline `keyExtractor`

```typescript
const playerTeamMap = computeEntityStatsMap(filteredBets, (leg, bet) => {
  if (leg.entities && leg.entities.length > 0) {
    return leg.entities.map(entity => normalizeTeamName(entity));
  }
  return null;
});
```

| Key | Normalized? | Issue |
|-----|-------------|-------|
| `leg.entities[i]` → `normalizeTeamName(entity)` | ✅ Partially | If `normalizeTeamName()` returns original (no match), raw string becomes key |

**Intercept Point**: Add validation after `normalizeTeamName()` to detect unresolved entities.

### E2. Sport Aggregation

**File**: [DashboardView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/DashboardView.tsx#L849)

```typescript
const sportMap = computeStatsByDimension(filteredBets, (bet) => bet.sport);
```

| Key | Normalized? | Issue |
|-----|-------------|-------|
| `bet.sport` | ❌ Raw string | Sports are user-defined, no normalization exists |

**Note**: Sport normalization is out of scope for Phase 1.

### E3. Market Category Aggregation

**File**: [DashboardView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/DashboardView.tsx#L848)

```typescript
const categoryMap = computeStatsByDimension(filteredBets, (bet) => bet.marketCategory);
```

| Key | Normalized? | Issue |
|-----|-------------|-------|
| `bet.marketCategory` | ✅ Canonical | Uses `MarketCategory` enum values |

**No issue**: Already uses canonical values.

### E4. Stat Type Aggregation

**Not directly aggregated** in current dashboard. Stat types are used for display (`bet.type`) but not as aggregation dimension.

### E5. BySportView Entity Aggregation

**File**: [BySportView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/BySportView.tsx)

Uses same pattern as DashboardView with `computeEntityStatsMap()` and `normalizeTeamName()`.

---

## F) Minimal Phase 1 Implementation Surface (File List)

### F1. NEW: Unresolved Queue Storage + Hook

| File | Change | Risk |
|------|--------|------|
| **`services/unresolvedQueue.ts`** [NEW] | Create persistent queue for unresolved entities | Low |
| **`hooks/useUnresolvedQueue.tsx`** [NEW] | React context for unresolved queue | Low |

- Store unresolved items with: `{ id, rawValue, context, resolvedTo?, createdAt, resolvedAt? }`
- Storage key: `bettracker-unresolved-queue`

### F2. MODIFY: Normalization Service — Add Resolver Contract

| File | Change | Risk |
|------|--------|------|
| [normalizationService.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts) | Add `resolveTeamName()` that wraps `normalizeTeamName()` and queues unknowns | Medium |

- New function: `resolveTeamName(rawName, context): { canonical: string; isResolved: boolean }`
- If not resolved, add to unresolved queue

### F3. MODIFY: ImportConfirmationModal — Queue Unknowns

| File | Change | Risk |
|------|--------|------|
| [ImportConfirmationModal.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/components/ImportConfirmationModal.tsx) | On import confirm, queue any unresolved entities from `getBetIssues()` | Medium |

- After `onConfirm()`, iterate warnings and queue unresolved entities
- Does not block import

### F4. MODIFY: Dashboard Aggregation — Enforce Canonical Keys

| File | Change | Risk |
|------|--------|------|
| [DashboardView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/DashboardView.tsx#L854-L859) | Replace direct `normalizeTeamName()` with `resolveTeamName()` in keyExtractor | Medium |
| [BySportView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/BySportView.tsx) | Same pattern | Medium |
| [PlayerProfileView.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/PlayerProfileView.tsx) | Same pattern | Medium |

- Unresolved entities get bucketed under `"[Unresolved]"` key or excluded from entity-specific aggregation

### F5. NEW: Unresolved Queue UI (Optional for Phase 1)

| File | Change | Risk |
|------|--------|------|
| **`views/UnresolvedQueueView.tsx`** [NEW] | Resolution workflow UI | Low (optional) |

- Show pending unresolved items
- Allow user to map to existing canonical or create new

---

## G) Phase 1 "Do Not Touch" List

| File/Area | Reason |
|-----------|--------|
| **Players as canonical system** | Phase 2 scope — players don't have a canonical reference system yet |
| **`data/referenceData.ts`** | Seed data should not change in Phase 1 |
| **`parsing/` parsers** | Parsers already set `entityType` correctly; no changes needed |
| **`bet.sport` field** | Sports normalization out of scope |
| **`marketClassification.ts`** | Classification is not the leak; normalization is |
| **`persistence.ts` structure** | `bettracker-state` schema should not change |
| **Storage key names** | Do not rename existing keys |

---

## H) Phase 1 Gate Checklist (Concrete Verification)

### Import Tests (Unresolved Queue)

- [ ] **H1**: Import a bet with a team alias NOT in referenceData (e.g., `"PHO Suns TYPO"`)
  - Verify: Bet imports successfully
  - Verify: Unresolved queue contains an entry for `"PHO Suns TYPO"`
  - Verify: After browser refresh, unresolved queue entry persists

- [ ] **H2**: Import a bet with a known team alias (e.g., `"PHO Suns"`)
  - Verify: Bet imports successfully
  - Verify: Unresolved queue does NOT contain an entry (it resolved to `"Phoenix Suns"`)

### Resolution Tests (Alias Resolution)

- [ ] **H3**: Add a custom team alias via Settings → Team Alias Manager
  - Verify: Alias resolves correctly on next import
  - Verify: Dashboard aggregation groups correctly

- [ ] **H4**: Import a bet with ambiguous abbreviation (e.g., `"ATL"` which matches both Hawks and Falcons)
  - Verify: System uses first match (as documented)
  - Verify: Collision is logged (check console)
  - Verify: If collision detection is added to Phase 1, item appears in queue

### Dashboard Aggregation Tests

- [ ] **H5**: Import multiple bets with same team in different alias formats (e.g., `"Magic"`, `"Orlando Magic"`, `"ORL"`)
  - Verify: Dashboard "Player & Team Performance" shows ONE entry for `"Orlando Magic"`
  - Verify: Stats are aggregated correctly (not split across aliases)

- [ ] **H6**: Import a bet with completely unknown entity
  - Verify: Dashboard does NOT create a separate aggregation row for the raw string
  - Verify: Either excluded from entity breakdown OR bucketed under `"[Unresolved]"`

### Persistence Tests

- [ ] **H7**: View unresolved queue, resolve an item, refresh browser
  - Verify: Resolution persists
  - Verify: Future imports with same raw string resolve to the new canonical

- [ ] **H8**: Export/import localStorage backup
  - Verify: Unresolved queue exports with backup
  - Verify: Restores correctly

---

## Notes for Phase 2

1. **Players as canonical system**: Phase 2 should introduce player reference data similar to teams
2. **Sport normalization**: Consider normalizing sport strings (e.g., `"Basketball"` → `"NBA"`)
3. **Proactive collision detection**: Add UI indicator when importing a bet with a collision-prone abbreviation
4. **Resolution UI polish**: Add bulk resolution, smart suggestions based on context

---

*Report generated by BetTracker Phase 1 Preflight Analysis*
