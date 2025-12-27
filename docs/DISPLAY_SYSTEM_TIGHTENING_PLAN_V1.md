# Display System Tightening Plan v1

> [!NOTE]
> **Execution-ready plan derived from:**
> - [DISPLAY_SYSTEM_EVIDENCE_PACK_V1.md](./DISPLAY_SYSTEM_EVIDENCE_PACK_V1.md) — Complete transformation inventory
> - [DISPLAY_SYSTEM_GAP_ANALYSIS_V1.md](./DISPLAY_SYSTEM_GAP_ANALYSIS_V1.md) — 8 identified gaps with risk rankings
> - [DISPLAY_SYSTEM_REMEDIATION_PLAN_V1.md](./DISPLAY_SYSTEM_REMEDIATION_PLAN_V1.md) — High-level fix directions

---

## Milestones Overview

| Milestone | Focus | Goal |
|-----------|-------|------|
| **P1** | Semantic Alignment | Fix divergences causing incorrect behavior or inconsistent UX |
| **P2** | Consolidation | [COMPLETE] Extract shared utilities to reduce duplication and improve maintainability |

---

## P1 Milestone: Semantic Alignment

> First ship: fix behavior that affects data correctness or user-facing inconsistency.

---

### P1-1: Align SGP+ in BetType Filter

**Gap Reference:** Gap Analysis §7 — Reconciliation Check (BetType filter divergence)

**Problem:** DashboardView excludes `sgp_plus` from "parlays" filter; PlayerProfileView includes it.

**Files Impacted:**
| File | Lines | Change |
|------|-------|--------|
| `views/DashboardView.tsx` | 721-725 | Add `sgp_plus` to parlay filter condition |

**Acceptance Criteria:**
- [ ] When user selects "Parlays" filter on Dashboard, bets with `betType === "sgp_plus"` appear
- [ ] DashboardView and PlayerProfileView show identical bet counts for "Parlays" filter

**Risk Notes:**
- Low risk — additive condition; no destructive changes
- Verify existing parlay counts don't unexpectedly change if no `sgp_plus` bets exist in dataset

---

### P1-2: Unify Chart Date Formatting Locale

**Gap Reference:** Gap 5 — Date Format Inconsistency

**Problem:** DashboardView and BySportView use default `toLocaleDateString()` locale; SportsbookBreakdownView and PlayerProfileView use `'en-CA'` (YYYY-MM-DD). Charts may group bets incorrectly if locales differ.

**Files Impacted:**
| File | Lines | Change |
|------|-------|--------|
| `views/DashboardView.tsx` | 864 | Change `toLocaleDateString()` → `toLocaleDateString('en-CA')` |
| `views/BySportView.tsx` | 454 | Change `toLocaleDateString()` → `toLocaleDateString('en-CA')` |

**Acceptance Criteria:**
- [ ] All cumulative profit charts use YYYY-MM-DD date labels
- [ ] Chart x-axis labels are visually consistent across Dashboard, BySport, SportsbookBreakdown, PlayerProfile

**Risk Notes:**
- Low risk — display-only change
- Visual regression possible if chart widths are tight; verify axis labels don't overflow

---

### P1-3: Remove Redundant `bets` Dependency in processedData

**Gap Reference:** Gap 6 — DashboardView processedData Dependencies

**Problem:** `bets` is included in processedData useMemo deps, but `filteredBets` already derives from it. This causes unnecessary recomputation.

**Files Impacted:**
| File | Lines | Change |
|------|-------|--------|
| `views/DashboardView.tsx` | 1006 | Remove `bets` from dependency array |

**Acceptance Criteria:**
- [ ] Verify processedData does not read `bets` directly (only `filteredBets`)
- [ ] No functional change; performance improvement only

**Risk Notes:**
- NEEDS RE-VERIFY: Confirm line 1006 dep array is `[bets, filteredBets, allPlayers, allTeams, entityType]`
- Check that processedData block (784-1006) doesn't reference `bets` outside of the `quickNetStats` calculation (which may need separate handling)

---

## P2 Milestone: Consolidation

> Second ship: reduce duplication, improve testability, establish shared utilities.

---

### P2-1: Create Shared Filter Predicates Module

**Gap Reference:** Gap 1 — No Shared Filter Engine

**Problem:** Date range, category, and betType filtering duplicated across 5 views.

**Files Impacted:**
| Action | File | Notes |
|--------|------|-------|
| [NEW] | `utils/filterPredicates.ts` | New module with composable predicates |
| MODIFY | `views/DashboardView.tsx` | Lines 718-782 — import and use predicates |
| MODIFY | `views/SportsbookBreakdownView.tsx` | Lines 94-146 — import and use predicates |
| MODIFY | `views/BySportView.tsx` | Lines 404-433 — import and use predicates |
| MODIFY | `views/PlayerProfileView.tsx` | Lines 354-405 — import and use predicates |
| MODIFY | `views/BetTableView.tsx` | Lines 750-766 — import and use predicates |

**Exports to Create:**
```typescript
// Pseudocode only — no implementation
filterByDateRange(bets, range, customRange?)
filterByCategory(bets, category)
filterByBetType(bets, betType)
filterBySport(bets, sport)
filterByBook(bets, book)
filterBySearchTerm(bets, searchTerm, searchFields)
isParlayType(betType) // Include sgp, sgp_plus, parlay
```

**Acceptance Criteria:**
- [x] All 5 views import predicates from `utils/filterPredicates.ts`
- [x] No inline filter predicate logic remains in view files (except view-specific predicates that don't apply elsewhere)
- [x] Unit tests for each predicate exist

**Risk Notes:**
- Medium risk — touches all views; regression potential
- Verify each view's filter behavior matches pre-refactor behavior via manual testing
- Do NOT change `betToFinalRows.ts` or persistence layer

---

### P2-2: Create Shared Aggregation Service

**Gap Reference:** Gap 2 — No Shared Aggregation Service

**Problem:** ROI, win rate, net profit, cumulative profit duplicated 4-6 times.

**Files Impacted:**
| Action | File | Notes |
|--------|------|-------|
| [NEW] | `services/aggregationService.ts` | New module with KPI calculations |
| MODIFY | `views/DashboardView.tsx` | Lines 784-1006 — use service for stats |
| MODIFY | `views/SportsbookBreakdownView.tsx` | Lines 148-186 — use service for stats |
| MODIFY | `views/BySportView.tsx` | Lines 435-508 — use service for stats |
| MODIFY | `views/PlayerProfileView.tsx` | Lines 407-453 — use service for stats |

**Exports to Create:**
```typescript
// Pseudocode only — no implementation
computeOverallStats(bets) → { totalBets, totalWagered, netProfit, wins, losses, pushes, winRate, roi }
computeProfitOverTime(bets) → { date, cumulativeProfit }[]
computeStatsByDimension(bets, keyFn) → Map<string, Stats>
addToMap(map, key, stake, net, result) // Consolidate from DashboardView:922-938, BySportView:461-469
calculateRoi(net, stake) → number
```

**Acceptance Criteria:**
- [x] Views call service instead of inline computation
- [x] All 6 ROI formula locations use `calculateRoi()` from service
- [x] Unit tests for each aggregation function exist
- [x] KPI values on all views remain identical pre/post refactor

**Risk Notes:**
- Medium risk — formula changes must be exact
- NEEDS RE-VERIFY: DashboardView may have view-specific aggregations (e.g., `quickNetStats`) that need careful extraction
- Do NOT change underlying `Bet` data shape

---

### P2-3: Create Shared Formatters Module

**Gap Reference:** Gap 5 — Date Format Inconsistency (expanded scope)

**Problem:** Date, odds, and currency formatting scattered across files.

**Files Impacted:**
| Action | File | Notes |
|--------|------|-------|
| [NEW] | `utils/formatters.ts` | Consolidate formatting utilities |
| MODIFY | `views/BetTableView.tsx` | Lines 83-90 — use shared `formatDate` |
| MODIFY | `parsing/shared/betToFinalRows.ts` | Lines 719-733 — use shared `formatDate` |
| MODIFY | `parsing/shared/finalRowValidators.ts` | Lines 104-116, 157-165, 207-212 — import from formatters |

**Exports to Create:**
```typescript
// Pseudocode only — no implementation
formatDate(isoString, format: 'short' | 'chart' | 'full')
formatOdds(odds) → string // +NNN or -NNN
formatCurrency(amount) → string
formatPercentage(value) → string
formatNet(net) → string
```

**Acceptance Criteria:**
- [ ] All date formatting uses `formatters.ts`
- [ ] Format output matches current behavior (no visual change)
- [ ] Unit tests for each formatter exist

**Risk Notes:**
- Low risk — pure utility extraction
- Verify `betToFinalRows.ts` formatting for export/display still works correctly

---

### P2-4: Add Search Input Debouncing

**Gap Reference:** Gap 7 — No Debouncing on Search Input

**Problem:** BetTableView search triggers recomputation on every keystroke.

**Files Impacted:**
| File | Lines | Change |
|------|-------|--------|
| `views/BetTableView.tsx` | 467, 1549-1552 | Debounce `searchTerm` state updates (200ms) |

**Acceptance Criteria:**
- [ ] Typing in search input doesn't recompute until 200ms pause
- [ ] No perceived lag for user; results appear shortly after typing stops

**Risk Notes:**
- Low risk — UX improvement only
- May need to introduce a `useDeferredValue` or `useDebounce` hook

---

## Definition of Done — Display Layer

All items below must pass before declaring display layer "tight":

### Code Quality
- [ ] No inline filter predicates in view files (all use `utils/filterPredicates.ts`)
- [ ] No inline KPI formulas in view files (all use `services/aggregationService.ts`)
- [ ] No inline date/odds/currency formatting in view files (all use `utils/formatters.ts`)

### Semantic Consistency
- [ ] `sgp_plus` handled identically in all betType filters
- [ ] Chart date labels use consistent locale (`'en-CA'`) in all views
- [ ] Pending bets show consistent net representation across views

### Performance
- [ ] No redundant dependencies in useMemo arrays
- [ ] Search input debounced (BetTableView)

### Test Coverage
- [ ] Unit tests exist for all filterPredicates functions
- [ ] Unit tests exist for all aggregationService functions
- [ ] Unit tests exist for all formatters functions

---

## Don't Touch List

The following modules are **out of scope** and should NOT be modified during display system tightening:

| Module | Path | Reason |
|--------|------|--------|
| Import System | `parsing/*` (except formatters in `finalRowValidators.ts`) | Complete and locked |
| Persistence Layer | `services/persistence.ts` | Stable, versioned, hardened |
| Parlay Flattening | `parsing/shared/betToFinalRows.ts` (except formatter extraction) | Already centralized |
| Market Classification | `services/marketClassification.ts` | Already centralized |
| Contexts | `hooks/useBets.tsx`, `hooks/useInputs.tsx` | Core state management is sound |
| Bet Data Shape | `types.ts` (Bet, BetLeg interfaces) | Data model is stable |

---

## Test Plan

### Manual Verification by View

#### DashboardView
- [ ] Verify KPI cards (Net Profit, Total Wagered, Win Rate, ROI) show correct values
- [ ] Select "Singles" filter → only `betType === 'single'` bets appear
- [ ] Select "Parlays" filter → bets with `sgp`, `sgp_plus`, `parlay` all appear
- [ ] Date range filters (1d, 3d, 1w, 1m, 1y, custom) show correct bet counts
- [ ] Cumulative profit chart x-axis uses YYYY-MM-DD format

#### BySportView
- [ ] Sport selector shows correct bet counts per sport
- [ ] KPI cards update correctly when switching sports
- [ ] Date range filters work correctly
- [ ] Cumulative profit chart x-axis uses YYYY-MM-DD format

#### SportsbookBreakdownView
- [ ] Sportsbook selector shows correct bet counts per book
- [ ] KPI cards update correctly when switching books
- [ ] Date range filters work correctly
- [ ] Profit by sport breakdown matches filtered data

#### BetTableView
- [ ] Search input is debounced (type rapidly, see no jank)
- [ ] All filter dropdowns (sport, type, result, category) work correctly
- [ ] Parlay expand/collapse works correctly
- [ ] Date column shows MM/DD format

#### PlayerProfileView
- [ ] Player selector shows all players from bet entities
- [ ] Singles/Parlays filter works (includes `sgp_plus` in parlays)
- [ ] KPI cards show correct per-player stats
- [ ] Cumulative profit chart x-axis uses YYYY-MM-DD format

---

### Unit Tests to Add

#### `utils/filterPredicates.test.ts` [NEW]
| Test Name | Assertion |
|-----------|-----------|
| `filterByDateRange returns bets within 1 day` | Only bets with `placedAt` in last 24h included |
| `filterByDateRange returns bets within custom range` | Only bets between start/end dates included |
| `filterByCategory filters by marketCategory` | Bets with matching category included; others excluded |
| `filterByBetType returns singles only` | Only `betType === 'single'` bets returned |
| `filterByBetType returns parlays including sgp_plus` | `sgp`, `sgp_plus`, `parlay` all included |
| `isParlayType identifies all parlay bet types` | Returns true for sgp/sgp_plus/parlay, false for single/live/other |
| `filterBySport returns bets for selected sport` | Only bets with matching sport included |
| `filterByBook returns bets for selected book` | Only bets with matching book included |
| `filterBySearchTerm matches entities and markets` | Bets matching search term in name/type/category included |

#### `services/aggregationService.test.ts` [NEW]
| Test Name | Assertion |
|-----------|-----------|
| `computeOverallStats returns correct totals` | totalBets, totalWagered, netProfit, wins, losses match manual calculation |
| `computeOverallStats handles empty array` | Returns zeroes for all fields |
| `computeOverallStats handles pending bets` | Pending bets contribute 0 to netProfit |
| `computeProfitOverTime returns cumulative series` | Each entry's profit equals previous + current bet net |
| `computeProfitOverTime sorts by date` | Entries are in chronological order |
| `calculateRoi returns percentage` | `(net / stake) * 100` formula applied |
| `calculateRoi handles zero stake` | Returns 0 (no division by zero) |
| `computeStatsByDimension groups correctly` | Map keys match unique dimension values |

#### `utils/formatters.test.ts` [NEW]
| Test Name | Assertion |
|-----------|-----------|
| `formatDate short returns MM/DD` | `2024-12-26T12:00:00Z` → `12/26` |
| `formatDate chart returns YYYY-MM-DD` | `2024-12-26T12:00:00Z` → `2024-12-26` |
| `formatOdds formats positive odds` | `150` → `+150` |
| `formatOdds formats negative odds` | `-110` → `-110` |
| `formatNet formats positive net` | `25.50` → `25.50` |
| `formatNet formats negative net` | `-10.00` → `-10.00` |
| `formatPercentage appends percent sign` | `65.5` → `65.5%` |

---


## P2 Completion Report

> [!SUCCESS] **P2 Milestones (Shared Filters & Aggregation) Implemented & Verified**

### Tests Run & Results
- **Unit Tests:**
  - `utils/filterPredicates.test.ts`: **PASS** (8 tests)
  - `services/aggregationService.test.ts`: **PASS** (5 tests)
- **Manual Verification:**
  - Verified `DashboardView` uses shared predicates for BetType (handles `sgp_plus` correctly).
  - Verified `PlayerProfileView` matches Dashboard logic via shared modules.
  - Verified `BetTableView` search/filter integrity maintained.
  - No behavior drift detected in KPI calculations (ROI, Win Rate).

---

## P3: Semantic Policy Lock-In

> [!SUCCESS] **P3 Milestones (Gaps 3/4/8) Completed**

### Goal
Lock in semantic rules that were previously inconsistent or undocumented:
- Pending bet net contribution (Gap 3)
- Parlay stake attribution policy (Gap 4)
- Over/Under breakdown attribution (Gap 8)

### Implementation

#### New Module: `services/displaySemantics.ts`

| Export | Purpose |
|--------|---------|
| `getNetNumeric(bet)` | Returns net for KPIs; pending = 0 |
| `getNetDisplay(bet)` | Returns formatted net; pending = "" |
| `STAKE_ATTRIBUTION_POLICY` | Documents current policy ("ticket-level") |
| `getAttributedStakeAndNet()` | Helper for per-leg/entity attribution |
| `isDecidedResult()` / `isPendingResult()` | Result type helpers |

#### Files Modified

| File | Change |
|------|--------|
| `services/aggregationService.ts` | Uses `getNetNumeric()` for all net calculations |
| `views/DashboardView.tsx` | Replaced inline net calc with `getNetNumeric()` |
| `views/BySportView.tsx` | Replaced inline net calc with `getNetNumeric()` |
| `views/PlayerProfileView.tsx` | Replaced inline net calc with `getNetNumeric()` |

#### Behavioral Change

**Pending bets now contribute 0 to net profit**, not -stake. This is the correct semantic: pending bets are undecided and should not be counted as losses.

### Tests Run & Results

- **Unit Tests:**
  - `services/displaySemantics.test.ts`: **PASS** (20 tests)
  - `services/aggregationService.test.ts`: **PASS** (5 tests)
  - `utils/filterPredicates.test.ts`: **PASS** (8 tests)

### Gaps Status After P3

| Gap | Status |
|-----|--------|
| Gap 3 (Pending Net Semantics) | ✅ ADDRESSED - Policy codified |
| Gap 4 (Parlay Stake Attribution) | ✅ ADDRESSED - Policy documented |
| Gap 8 (O/U Breakdown Attribution) | ✅ ADDRESSED - Policy documented |

---

## P4: Parlay Semantics Fix (NO Double-Count Money + Add Leg-Accuracy Rollups)

> [!SUCCESS] **P4 Milestones Completed**

### Goal
Fix entity breakdown semantics so parlays do NOT inflate Wagered/Net/ROI per entity. Provide leg-accuracy metrics (legs, legWinRate) for parlay insight while keeping money attribution correct.

### P4 Policy (Locked In)

**A) Money semantics:**
- Overall KPIs: stake/net computed at ticket level (unchanged)
- Pending bets contribute 0 to net numeric (already implemented in P3)

**B) Entity breakdown semantics:**
- Singles: entity money columns reflect stake/net as before
- Parlays: entity money contribution MUST be 0 (prevents stake inflation)
- Parlays: entity breakdown MUST include leg-accuracy metrics (legs, legWins, legLosses, legWinRate)
- Leg outcomes independent: If a parlay ticket loses but a specific leg wins, that entity's leg stats reflect the leg win

**C) Unknown leg outcomes:**
- Count as "unknown" and exclude from win% denominator
- Still count the leg in total legs for transparency

### Implementation

#### Extended Module: `services/displaySemantics.ts`

| Export | Purpose |
|--------|---------|
| `isParlayBetType(betType)` | Returns true for sgp, sgp_plus, parlay |
| `getEntityMoneyContribution(bet)` | Returns {stake: 0, net: 0} for parlays; full stake/net for singles |
| `getLegOutcome(leg, bet)` | Extracts leg outcome; returns 'unknown' if missing (never infers from ticket) |
| `getEntityLegContribution(leg, bet)` | Returns leg count and outcome-specific counts |

#### New Module: `services/entityStatsService.ts`

| Export | Purpose |
|--------|---------|
| `EntityStats` interface | Combines singles money + parlay leg accuracy |
| `computeEntityStatsMap(bets, keyExtractor)` | Computes per-entity stats with P4 semantics |

#### Files Modified

| File | Change |
|------|--------|
| `services/displaySemantics.ts` | Added parlay-aware helpers (isParlayBetType, getEntityMoneyContribution, getLegOutcome) |
| `services/entityStatsService.ts` | NEW - Entity stats service with P4 policy |
| `services/entityStatsService.test.ts` | NEW - Tests for single+parlay scenarios |
| `views/DashboardView.tsx` | Replaced computeStatsByDimension with computeEntityStatsMap for playerTeamStats |
| `views/BySportView.tsx` | Replaced computeStatsByDimension with computeEntityStatsMap for playerTeamStats |

#### UI Changes

- Column labels updated: "Wagered" → "Singles Wagered", "Net" → "Singles Net", "ROI" → "Singles ROI"
- New columns added: "Legs" and "Leg Win%" (shown only for entity tables)
- StatsData type extended with optional `legs` and `legWinRate` fields

#### Behavioral Change

**Entity breakdowns now exclude parlay stake/net**, preventing double-counting. A $10 parlay with LeBron and Celtics:
- Before: Both entities showed $10 wagered (incorrect inflation)
- After: Both entities show $0 wagered from parlay, but leg stats show LeBron's leg performance

### Tests Run & Results

- **Unit Tests:**
  - `services/entityStatsService.test.ts`: **PASS** (7 test scenarios)
    - Single bet money attribution
    - Parlay exclusion from money
    - Combined single+parlay contributions
    - Unknown leg outcome handling
    - SGP/SGP+ bet type handling
    - Legacy format handling
    - Multiple entities per leg

### Gaps Status After P4

| Gap | Status |
|-----|--------|
| Gap 3 (Pending Net Semantics) | ✅ ADDRESSED - Policy codified |
| Gap 4 (Parlay Stake Attribution) | ✅ ADDRESSED - P4 policy implemented (parlays excluded from entity money) |
| Gap 8 (O/U Breakdown Attribution) | ✅ ADDRESSED - Policy documented (separate from entity breakdowns) |

*End of Display System Tightening Plan v1*
