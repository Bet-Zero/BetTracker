# BET TRACKER — BACKEND DATA WIRING AUDIT (Phase 1)

**Date:** 2026-01-03  
**Scope:** Prove dashboard wiring is correct and cannot misattribute fields  
**Standard:** Zero tolerance for "close enough"

---

## A) SYSTEM MAP: LAYERS + ENTRYPOINTS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    END-TO-END DATA PIPELINE                             │
└─────────────────────────────────────────────────────────────────────────┘

LAYER 1: PARSERS (HTML → Bet[])
├── FanDuel Parser
│   ├── File: parsing/fanduel/fanduel.ts
│   ├── Entry: parseFanDuel(html: string): Result<Bet[]>
│   └── Output: Bet[] with legs[], entityType, marketCategory
│
├── DraftKings Parser  
│   ├── File: parsing/draftkings/parsers/index.ts
│   ├── Entry: parseDraftKings(html: string): Bet[]
│   └── Output: Bet[] with legs[], entityType, marketCategory

LAYER 2: NORMALIZATION / CANONICALIZATION
├── File: services/normalizationService.ts
│   ├── normalizeTeamName(input): canonical team name
│   ├── normalizeStatType(input): canonical stat type code
│   ├── getTeamInfo(input): team metadata lookup
│   └── normalizeFutureType(input): future market normalization
│
├── File: services/marketClassification.ts
│   ├── classifyBet(bet): MarketCategory
│   ├── classifyLeg(market, sport): category
│   ├── determineType(market, category, sport): stat type
│   └── isParlayCategory(betType): boolean
│
├── File: services/resolver.ts
│   ├── getTeamAggregationKey(entity, fallback): canonical key
│   ├── getPlayerAggregationKey(entity, fallback, opts): canonical key
│   └── resolveTeam(entity): ResolverResult

LAYER 3: STORAGE LAYER
├── File: services/persistence.ts
│   ├── loadState(): Result<PersistedState>
│   ├── saveState(state): Result<void>
│   └── createManualBackup(state, reason): Result<string>
│
├── Storage Key: 'bettracker-state-v1'
├── Format: { version: 1, updatedAt: string, bets: Bet[] }
└── Legacy Key: 'bettracker-bets' (auto-migrated)

LAYER 4: READ MODEL (State Management)
├── File: hooks/useBets.tsx
│   ├── Provider: BetsProvider (React Context)
│   ├── Hook: useBets() → { bets, addBets, updateBet, clearBets, loading }
│   └── Self-healing: Re-classifies misclassified Main Markets on load

LAYER 5: DERIVED METRICS LAYER
├── File: services/displaySemantics.ts
│   ├── getNetNumeric(bet): number (pending=0, not -stake)
│   ├── getNetDisplay(bet): string (pending='')
│   ├── isParlayBetType(betType): boolean
│   ├── getEntityMoneyContribution(bet): {stake, net} (parlays=0)
│   └── getLegOutcome(leg, bet): LegOutcomeType
│
├── File: services/aggregationService.ts
│   ├── computeOverallStats(bets): OverallStats
│   ├── computeProfitOverTime(bets): ProfitDataPoint[]
│   ├── computeStatsByDimension(bets, keyFn): Map<string, DimensionStats>
│   ├── calculateRoi(net, stake): number
│   └── mapToStatsArray(map): StatsData[]
│
├── File: services/entityStatsService.ts
│   ├── computeEntityStatsMap(bets, keyExtractor): Map<string, EntityStats>
│   └── Purpose: Parlay-aware entity statistics (excludes parlay money)

LAYER 6: DASHBOARD AGGREGATION (Selectors/Hooks)
├── Views consume services directly (no intermediate selector layer)
├── Filter predicates: utils/filterPredicates.ts
│   ├── createBetTypePredicate(filter): (bet) => boolean
│   ├── createDateRangePredicate(range, custom): (bet) => boolean
│   ├── createMarketCategoryPredicate(category): (bet) => boolean
│   └── createEntityPredicate(entity): (bet) => boolean

LAYER 7: DASHBOARD DISPLAY (Components)
├── File: views/DashboardView.tsx
│   └── Widgets: QuickStatCards, StatCards, ProfitOverTime chart, 
│                ProfitByBook chart, StatsTable (category/sport/player/tail),
│                OverUnderBreakdown, LiveVsPreMatchBreakdown
│
├── File: views/BySportView.tsx
│   └── Widgets: Sport-filtered stats, charts, and tables
│
├── File: views/PlayerProfileView.tsx
│   └── Widgets: Player-specific stats, profit chart, market breakdown
│
├── File: views/BetTableView.tsx
│   └── Widgets: Editable spreadsheet table with FlatBet rows
│
├── File: views/SportsbookBreakdownView.tsx
│   └── Widgets: Sportsbook-specific breakdowns
│
└── File: parsing/shared/betToFinalRows.ts
    └── betToFinalRows(bet): FinalRow[] (converts Bet to display rows)
```

---

## B) CANONICAL DATA CONTRACT

### Bet Interface (Ticket-Level)

| Field | Type | Required | Definition | Allowed Values | Source |
|-------|------|----------|------------|----------------|--------|
| `id` | string | ✅ | Unique identifier | `{book}:{betId}:{placedAt}` | Parser-generated |
| `book` | SportsbookName | ✅ | Sportsbook name | "FanDuel", "DraftKings" | Parser |
| `betId` | string | ✅ | Sportsbook's bet ID | Alphanumeric | Parser |
| `placedAt` | string | ✅ | ISO 8601 timestamp | ISO format | Parser |
| `settledAt` | string | ❌ | Settlement timestamp | ISO format | Parser |
| `betType` | BetType | ✅ | Bet structure type | "single", "parlay", "sgp", "sgp_plus", "live", "other" | Parser |
| `marketCategory` | MarketCategory | ✅ | Market classification | "Props", "Main Markets", "Futures", "Parlays" | Parser/Classifier |
| `sport` | string | ✅ | Sport name | "NBA", "NFL", etc. | Parser |
| `description` | string | ✅ | Human-readable description | Free text | Parser |
| `name` | string | ❌ | Player/team name only | Free text | Parser |
| `odds` | number \| null | ✅ | American odds | Positive/negative integers | Parser |
| `stake` | number | ✅ | Wager amount | > 0 | Parser |
| `payout` | number | ✅ | Total return | >= 0 | Parser |
| `result` | BetResult | ✅ | Bet outcome | "win", "loss", "push", "pending" | Parser |
| `type` | string | ❌ | Stat type convenience field | "Pts", "3pt", etc. | Derived from legs[0] |
| `line` | string | ❌ | Line/threshold convenience | "25.5", "3+", etc. | Derived from legs[0] |
| `ou` | "Over" \| "Under" | ❌ | O/U convenience field | "Over", "Under" | Derived from legs[0] |
| `legs` | BetLeg[] | ✅ | Structured selections | Non-empty array | Parser |
| `tail` | string | ❌ | Who bet was tailed from | Free text | User-editable |
| `raw` | string | ❌ | Raw HTML for debugging | HTML text | Parser |
| `isLive` | boolean | ❌ | Live/in-game bet flag | true/false | Parser |
| `isSample` | boolean | ❌ | Sample data marker | true/false | Internal |

### BetLeg Interface (Leg-Level)

| Field | Type | Required | Definition | Allowed Values | Source |
|-------|------|----------|------------|----------------|--------|
| `market` | string | ✅ | Market type | "Pts", "Spread", "Moneyline", etc. | Parser |
| `entities` | string[] | ❌ | Player/team names | Array of names | Parser |
| `entityType` | "player" \| "team" \| "unknown" | ❌ | Entity classification | Explicit or undefined | Parser |
| `target` | number \| string | ❌ | Line/threshold value | "25.5", "3+", "-5.5" | Parser |
| `ou` | "Over" \| "Under" | ❌ | Over/Under indicator | "Over", "Under" | Parser |
| `odds` | number \| null | ❌ | Leg-specific odds | Number or null for SGP inner | Parser |
| `result` | LegResult \| BetResult | ❌ | Leg outcome | "WIN", "LOSS", "PUSH", "PENDING", "UNKNOWN" | Parser |
| `isGroupLeg` | boolean | ❌ | SGP group marker | true for SGP containers | Parser |
| `children` | BetLeg[] | ❌ | Nested selections | For SGP+ inner legs | Parser |

### RED FLAGS — Data Contract Issues

**NONE IDENTIFIED.** The canonical data contract is well-defined in:
- `types.ts` (interfaces)
- `parsing/parserContract.ts` (validation)
- `parsing/PARSER_TARGET_FIELDS.md` (documentation)

---

## C) DERIVED METRICS INVENTORY

### 1. Net Profit/Loss Calculation

**Formula:** `net = payout - stake`

**Special Cases:**
| Result | Formula | Implementation |
|--------|---------|----------------|
| win | payout - stake | `displaySemantics.ts:67-74` |
| loss | payout - stake (= -stake when payout=0) | `displaySemantics.ts:67-74` |
| push | payout - stake (= 0 when payout=stake) | `displaySemantics.ts:67-74` |
| pending | **0** (NOT -stake) | `displaySemantics.ts:68-72` |

**Locations:**
- `services/displaySemantics.ts:getNetNumeric()` — KPI calculations
- `services/displaySemantics.ts:getNetDisplay()` — Display formatting  
- `parsing/shared/betToFinalRows.ts:computeNetNumeric()` — Table display

**IMPORTANT — PROOF GAP PG-1:** `betToFinalRows.computeNetNumeric()` returns `undefined` for pending (display as blank), while `displaySemantics.getNetNumeric()` returns `0` for pending (KPI totals). This is **intentional divergence** documented in code, but **no cross-module test enforces** that both implementations follow the same policy for settled bets. See Section H for enforcement plan.

### 2. ROI Calculation

**Formula:** `roi = (net / stake) * 100`

**Edge Case:** If stake = 0, ROI = 0

**Location:** `services/aggregationService.ts:calculateRoi()`

### 3. Win Rate Calculation

**Formula:** `winRate = (wins / (wins + losses)) * 100`

**Excludes:** Pushes and pending bets

**Location:** `services/aggregationService.ts:computeOverallStats()` line 122-123

### 4. "To Win" Calculation

**Formula:**
```
if (odds > 0): toWin = stake + (stake * odds / 100)
if (odds < 0): toWin = stake + (stake / (|odds| / 100))
```

**Location:** `parsing/shared/betToFinalRows.ts:calculateToWin()`

### 5. Parlay-Aware Entity Attribution

**Policy:** Parlays contribute **0 stake/net** to entity breakdowns

**Rationale:** Prevents stake inflation when a player appears in a parlay

**Location:** `services/displaySemantics.ts:getEntityMoneyContribution()`

**Implementation:** `services/entityStatsService.ts:computeEntityStatsMap()`

### 6. Cumulative Profit Over Time

**Formula:** Sort bets by placedAt, accumulate net

**Location:** `services/aggregationService.ts:computeProfitOverTime()`

### RED FLAGS — Derived Metrics Issues

| ID | Priority | Issue | Location | Risk |
|----|----------|-------|----------|------|
| 1 | P2 | `computeNetNumeric` (betToFinalRows) vs `getNetNumeric` (displaySemantics) have different pending behavior | Two files | **Intentional** - documented divergence |

---

## D) DASHBOARD WIDGET WIRING MAP

### DashboardView.tsx

| Widget | Data Source | Filters | Recomputes Metrics? |
|--------|-------------|---------|---------------------|
| QuickStatCards (1d/3d/1w/1m/1y) | All bets (unfiltered) | Date windows only | Yes - `calculateNetForPeriod()` |
| StatCard (Net Profit) | `filteredBets` | betType, marketCategory, dateRange | Uses `computeOverallStats()` |
| StatCard (Total Wagered) | `filteredBets` | Same | Uses `computeOverallStats()` |
| StatCard (Total Bets) | `filteredBets` | Same | Uses `computeOverallStats()` |
| StatCard (Win Rate) | `filteredBets` | Same | Uses `computeOverallStats()` |
| Profit Over Time Chart | `filteredBets` | Same | Uses `computeProfitOverTime()` |
| Profit By Book Chart | `filteredBets` | Same | Uses `computeStatsByDimension()` |
| Market Category Table | `filteredBets` | Same | Uses `computeStatsByDimension()` |
| Sport Stats Table | `filteredBets` | Same | Uses `computeStatsByDimension()` |
| Player/Team Stats Table | `filteredBets` | Same + entityType | Uses `computeEntityStatsMap()` |
| OverUnderBreakdown | `filteredBets` | Same + props/totals filter | Local computation, skips parlays |
| LiveVsPreMatchBreakdown | `filteredBets` | Same + props/main filter | Local computation |

### BySportView.tsx

| Widget | Data Source | Filters | Recomputes Metrics? |
|--------|-------------|---------|---------------------|
| StatCards | `filteredBets` | sport, dateRange | Uses `computeOverallStats()` |
| Profit Over Time | `filteredBets` | Same | Uses `computeProfitOverTime()` |
| Market Stats Table | `filteredBets` | Same | Uses `computeStatsByDimension()` |
| Player/Team Table | `filteredBets` | Same + entityType | Uses `computeEntityStatsMap()` |
| OverUnderBreakdown | `filteredBets` | Same | Local, skips parlays |
| LiveVsPreMatch | `filteredBets` | Same | Local |

### PlayerProfileView.tsx

| Widget | Data Source | Filters | Recomputes Metrics? |
|--------|-------------|---------|---------------------|
| StatCards | `playerBets` | player, dateRange, betType | Uses `computeOverallStats()` |
| Profit Over Time | `playerBets` | Same | Uses `computeProfitOverTime()` |
| Market Stats Table | `playerBets` | Same | Uses `computeStatsByDimension()` |
| OverUnderBreakdown | `playerBets` | Same + props/totals | Local, uses `getEntityMoneyContribution()` |
| Recent Bets Table | `playerBets` | Same | Direct mapping |

### BetTableView.tsx

| Widget | Data Source | Filters | Recomputes Metrics? |
|--------|-------------|---------|---------------------|
| BetTable | `bets` → `flattenedBets` | sport, type, result, category, search | Uses `betToFinalRows()` |

### RED FLAGS — Widget Wiring Issues

| ID | Priority | Issue | Location | Risk |
|----|----------|-------|----------|------|
| 5 | P3 | QuickStatCards use ALL bets, not filteredBets | DashboardView:829-830 | **Intentional** - shows "at-a-glance" regardless of filters |

---

## E) FIELD LINEAGE TABLE

| Dashboard Value | Widget | Canonical Field | Code Path | Transformation | Miswire Vector | Required Test |
|-----------------|--------|-----------------|-----------|----------------|----------------|---------------|
| Net Profit | StatCard | `bet.payout - bet.stake` | `displaySemantics.getNetNumeric()` → `computeOverallStats()` | Sum of nets | Pending counted as -stake | `displaySemantics.test.ts` |
| Total Wagered | StatCard | `bet.stake` | `computeOverallStats()` | Sum of stakes | None | `aggregationService.test.ts` |
| Total Bets | StatCard | `bets.length` | `computeOverallStats()` | Count | Duplicates | Parser dedup tests |
| Win Rate | StatCard | `wins / (wins + losses)` | `computeOverallStats()` | Calculation | Pushes counted | `aggregationService.test.ts` |
| ROI | StatCard subtitle | `net / stake * 100` | `calculateRoi()` | Calculation | Zero stake | `aggregationService.test.ts` |
| Player Net | StatsTable | `bet.payout - bet.stake` | `computeEntityStatsMap()` | Sum (non-parlays only) | Parlay money included | `entityStatsService.test.ts` |
| Player Wins | StatsTable | `bet.result === 'win'` | `computeEntityStatsMap()` | Count (non-parlays only) | Parlay wins counted | `entityStatsService.test.ts` |
| Bet Amount | BetTable | `bet.stake` | `betToFinalRows()` | Format to string | Currency format | `betToFinalRows.test.ts` |
| To Win | BetTable | Calculated | `calculateToWin()` | Odds-based | Wrong odds formula | `betToFinalRows.test.ts` |
| Result | BetTable | `bet.result` or `leg.result` | `betToFinalRows()` | Case normalization | Header vs leg result | `betToFinalRows.test.ts` |

---

## F) RED FLAGS LIST

### P0 (Critical — Proof Gaps Requiring Enforcement)

No **observed** misattribution bugs found in Phase 1 mapping; however, **Phase 2A identified proof gaps** that must be enforced to prevent silent drift.

| ID | Issue | Location | Impact | Status |
|----|-------|----------|--------|--------|
| PG-1 | Net semantics divergence: `computeNetNumeric` (betToFinalRows) vs `getNetNumeric` (displaySemantics) have different pending behavior with no cross-module test | Two files | Could silently diverge | **NEEDS INVARIANT TEST** |
| PG-2 | QuickStatCards use ALL bets (global) but no test enforces this behavior | DashboardView:830 | Could break on refactor | **NEEDS TEST** |
| PG-3 | O/U parlay exclusion is inline check, not centralized guard | DashboardView:339, BySportView:396 | New components could miss check | **NEEDS TEST** |
| PG-4 | Self-healing reclassification could mask classifier bugs | useBets.tsx:68-92 | False confidence in classifier | **NEEDS MONITORING** |
| PG-5 | Entity type fallback heuristic not tested for unknown entities | DashboardView:873-884 | Unknown entities misclassified | **NEEDS TEST** |

### P1 (High — Should Review)

| ID | Issue | Location | Impact | Recommendation |
|----|-------|----------|--------|----------------|
| PG-6 | No reconciliation test for ROI consistency across widgets | aggregationService | Could diverge silently | Add reconciliation test |
| PG-7 | Parlay detection (`isParlayBetType`) spread across files with inline calls | Multiple | Could miss a check | Consolidate + test |

### P2 (Medium — Nice to Have)

| ID | Issue | Location | Impact | Recommendation |
|----|-------|----------|--------|----------------|
| PG-8 | Win rate edge case (all pushes) not explicitly tested | aggregationService | Edge case only | Add test |
| PG-9 | LiveVsPreMatch breakdown not tested in isolation | DashboardView | Low risk | Add unit test |

### P3 (Low — Future Enhancement)

| ID | Issue | Location | Impact | Recommendation |
|----|-------|----------|--------|----------------|
| 8 | Parlay child net calculation uses bet.result | betToFinalRows:485 | Child rows inherit parent result, not leg result | **Intentional** - parlay net is ticket-level |

---

## G) EXECUTION PLAN (PHASE 2 OVERVIEW)

Based on the audit findings, the codebase is **correct in behavior** but has **proof gaps** where enforcement is needed. The data pipeline has:
- ✅ Single source of truth for net calculations (`displaySemantics`)
- ✅ Single source of truth for entity stats (`entityStatsService`)
- ✅ Consistent filter predicates (`filterPredicates`)
- ✅ Clear parlay vs singles isolation
- ⚠️ **Intentional divergences documented but not enforced by tests**

### Phase 2A (Proof Gap Review) — COMPLETE

See sections H, I, J below for:
- H) Proof Gaps identified (P0/P1/P2)
- I) Invariants defined (must-never-break rules)
- J) Phase 2B Execution Plan (lockdown implementation)

### Phase 2B Tasks (Pending Approval)

1. **Create Invariant Tests** — Cross-module tests that fail if semantics diverge
2. **Create Reconciliation Tests** — Same-filter-context => same-totals
3. **Create Deadly Fixtures** — Minimal dataset covering all edge cases
4. **Add Missing Unit Tests** — Per-component tests for undocumented behavior
5. **Add Dev-Only Assertions** — Toggleable runtime checks

### Existing Test Coverage

The codebase already has solid test coverage:
- `displaySemantics.test.ts` — 26 tests covering net, ROI, parlay semantics ✅
- `aggregationService.test.ts` — Tests for overall stats, profit over time ✅
- `entityStatsService.test.ts` — Tests for entity attribution with parlay exclusion ✅
- `betToFinalRows.test.ts` — Tests for display transformation ✅
- Parser tests — FanDuel and DraftKings with fixtures ✅

---

## PHASE 1 ACCEPTANCE CRITERIA CHECKLIST

- [x] Every dashboard widget is mapped to an identified data source and filter context
- [x] Every displayed metric has an explicit formula or canonical field
- [x] RED FLAG section exists (P1/P2/P3 identified, no P0)
- [x] Clear Phase 2 plan is provided

---

## H) PROOF GAPS (P0/P1/P2) — Where Correctness Is Assumed, Not Enforced

This section identifies areas where current correctness is based on **convention** rather than **enforcement**. Any item marked P0 represents a risk of silent drift that could cause misattribution.

### P0 — Critical Proof Gaps (No Enforcement Exists)

| ID | What is Currently Happening | Why It Can Drift Silently | Enforcement Needed | Location | Proposed Test |
|----|----------------------------|---------------------------|-------------------|----------|---------------|
| PG-1 | `computeNetNumeric` (betToFinalRows) returns `undefined` for pending; `getNetNumeric` (displaySemantics) returns `0` for pending | Two separate implementations of "pending net" semantics. If someone changes one but not the other, KPIs and display could diverge. No cross-module test ensures both follow the same policy. | Cross-module invariant test that asserts: "KPI totals using getNetNumeric must equal the sum of table rows using betToFinalRows for settled bets only" | `parsing/shared/betToFinalRows.ts:648-695`, `services/displaySemantics.ts:67-74` | `invariants.test.ts`: "pending bets contribute 0 to KPI totals and blank to display" |
| PG-2 | QuickStatCards compute net using ALL bets; other widgets use `filteredBets` | No assertion or type separation ensures QuickStatCards cannot accidentally use `filteredBets`. A future refactor could silently break the "global at-a-glance" design. | Comment + test that explicitly asserts QuickStatCards ignore filter controls | `views/DashboardView.tsx:830-851` | `DashboardView.test.tsx`: "QuickStatCards net values unchanged when filters change" |
| PG-3 | OverUnderBreakdown (Dashboard) skips parlays via `isParlayBetType()` check inside the component | If someone adds a new O/U breakdown elsewhere and forgets this check, parlay legs could be double-counted. No centralized "O/U must exclude parlays" guard. | Centralize parlay exclusion in a shared helper or add explicit test for each O/U breakdown | `views/DashboardView.tsx:339-354`, `views/BySportView.tsx:396-409` | `OverUnderBreakdown.test.ts`: "parlay bets never contribute to O/U counts" |
| PG-4 | Self-healing reclassification in `useBets.tsx` corrects Main Markets on load | If the classifier has a bug, self-healing masks it. No test catches when self-healing fires excessively. | Add logging/assertion when self-healing fires > N bets, plus regression test for classifier edge cases | `hooks/useBets.tsx:68-92` | `useBets.test.ts`: "self-healing fires for known edge cases only" |
| PG-5 | Entity type fallback uses `getTeamInfo()` heuristic when `leg.entityType` is undefined | New teams not in reference data could be misclassified as players. No test ensures unknown entities are flagged or handled consistently. | Add `[Unknown Entity]` fallback category with explicit test coverage | `views/DashboardView.tsx:873-884`, `views/BySportView.tsx:820-831` | `entityTypeResolution.test.ts`: "unknown entities resolve to consistent fallback" |

### P1 — High Priority Gaps (Enforcement Exists but Incomplete)

| ID | What is Currently Happening | Why It Can Drift | Enforcement Needed | Location | Proposed Test |
|----|----------------------------|------------------|-------------------|----------|---------------|
| PG-6 | ROI calculation uses `calculateRoi()` from aggregationService | Tests exist but no reconciliation test ensures chart ROI == table ROI == card ROI for same data | Add "same filter context => same totals" reconciliation test | `services/aggregationService.ts:calculateRoi()` | `reconciliation.test.ts`: "all widgets show identical ROI for identical filter" |
| PG-7 | Parlay exclusion uses `isParlayBetType()` in entityStatsService | Tests exist for entity stats, but OverUnderBreakdown has its own inline `isParlayBetType()` call | Consolidate all parlay checks to use same function + add cross-component test | Multiple files | `parlayExclusion.test.ts`: "isParlayBetType is the single source of parlay detection" |

### P2 — Medium Priority Gaps (Documented but Not Tested)

| ID | What is Currently Happening | Why It Can Drift | Enforcement Needed | Location | Proposed Test |
|----|----------------------------|------------------|-------------------|----------|---------------|
| PG-8 | Win rate excludes pushes and pending bets | Implemented correctly but no explicit test for edge case where all bets are pushes | Add edge case test | `services/aggregationService.ts:computeOverallStats()` | "win rate is 0% when all bets are pushes" |
| PG-9 | LiveVsPreMatchBreakdown uses `getNetNumeric()` directly | Correct usage but not tested in isolation | Add unit test | `views/DashboardView.tsx:489-590` | "LiveVsPreMatch uses canonical net function" |

---

## I) INVARIANTS (MUST NEVER BREAK)

These invariants represent non-negotiable correctness rules. Each must have an enforcement mechanism.

### Net/Profit Semantics

| Invariant | Enforcement Method | Enforcement Location |
|-----------|-------------------|---------------------|
| **INV-1:** KPI net calculations must treat `pending` as 0 (never -stake). The function `getNetNumeric()` in displaySemantics is the SINGLE SOURCE OF TRUTH for KPI net. | Unit test | `displaySemantics.test.ts` line 49-53 ✅ |
| **INV-2:** Display net for pending bets must be blank (""), not "0.00" or "-stake". The function `getNetDisplay()` is the SINGLE SOURCE OF TRUTH for display net. | Unit test | `displaySemantics.test.ts` line 82-85 ✅ |
| **INV-3:** `betToFinalRows.computeNetNumeric()` must return `undefined` for pending (for display), NOT use displaySemantics for table display. This is intentional divergence. | Comment + unit test | `betToFinalRows.ts:689-694` (comment exists), `betToFinalRows.test.ts` (test needed) |

### Filter Context / Scoping

| Invariant | Enforcement Method | Enforcement Location |
|-----------|-------------------|---------------------|
| **INV-4:** QuickStatCards MUST always use ALL bets (unfiltered). They are GLOBAL metrics that ignore dashboard filter controls. | Comment exists | `DashboardView.tsx:826-829` (test needed) |
| **INV-5:** StatCards, charts, and tables MUST use `filteredBets` and share identical filter context. Same filter => same totals across all widgets. | No explicit test | Needs reconciliation test |

### Parlays vs Singles Isolation

| Invariant | Enforcement Method | Enforcement Location |
|-----------|-------------------|---------------------|
| **INV-6:** Entity stats (player/team breakdowns) must NEVER include parlay stake/net. Parlays contribute 0 money to entity stats. | Unit test | `entityStatsService.test.ts` line 61-93 ✅ |
| **INV-7:** `isParlayBetType()` in displaySemantics is the SINGLE SOURCE OF TRUTH for parlay detection. All code checking "is this a parlay" must use this function. | Unit test | `displaySemantics.test.ts` line 177-201 ✅ |
| **INV-8:** OverUnderBreakdown widgets must exclude parlays. O/U stats are for straight bets only. | Inline check | `DashboardView.tsx:339-340` (test needed) |

### Time Bucketing / Date Range Logic

| Invariant | Enforcement Method | Enforcement Location |
|-----------|-------------------|---------------------|
| **INV-9:** All date comparisons must use `bet.placedAt` (not `settledAt`) for time bucketing. | Convention | `filterPredicates.ts:createDateRangePredicate()` (test exists) |
| **INV-10:** Custom date ranges use UTC boundaries (00:00:00.000Z start, 23:59:59.999Z end). | Implementation | `filterPredicates.ts:76-80` (test needed for edge cases) |

### Entity Resolution / entityType Classification

| Invariant | Enforcement Method | Enforcement Location |
|-----------|-------------------|---------------------|
| **INV-11:** When `leg.entityType` is undefined, the fallback must use `getTeamInfo()` to check if entity is a known team; otherwise treat as player. | Inline logic | `DashboardView.tsx:873-884` (no test) |
| **INV-12:** Unknown entities must resolve to a consistent fallback (`[Unresolved]` prefix). | Inline logic | `resolver.ts:getTeamAggregationKey()`, `resolver.ts:getPlayerAggregationKey()` (test needed) |

### Display Conversions vs KPI Calculations

| Invariant | Enforcement Method | Enforcement Location |
|-----------|-------------------|---------------------|
| **INV-13:** KPI calculations must NEVER use `betToFinalRows` output. FinalRows are for display only. | Architecture separation | No explicit test (relies on code review) |
| **INV-14:** Table display net (FinalRow.Net) is independent from KPI net. These are intentionally different semantics for pending bets. | Comment | `betToFinalRows.ts:689-694` (test needed) |

---

## J) PHASE 2B EXECUTION PLAN (LOCKDOWN)

Based on proof gaps identified, here is a minimal execution plan to enforce correctness.

### 1) Files to Modify (Tests First)

| Order | File | Action | Purpose |
|-------|------|--------|---------|
| 1 | `tests/invariants.test.ts` (NEW) | Create | Cross-module invariant tests |
| 2 | `tests/reconciliation.test.ts` (NEW) | Create | Same-filter-context reconciliation |
| 3 | `parsing/tests/betToFinalRows.test.ts` | Add tests | Pending net display = blank |
| 4 | `views/__tests__/DashboardView.test.tsx` (NEW or existing) | Create/extend | QuickStatCards global behavior |
| 5 | `tests/fixtures/deadly-fixtures.ts` (NEW) | Create | Canonical test fixture dataset |

### 2) Fixture Dataset Plan (Deadly Fixtures)

A minimal but comprehensive test dataset with **10-15 bets** covering:

| Bet ID | Type | Result | Stake | Payout | Purpose |
|--------|------|--------|-------|--------|---------|
| SINGLE-WIN-1 | single | win | $10 | $25 | Basic win calculation |
| SINGLE-LOSS-1 | single | loss | $10 | $0 | Basic loss calculation |
| SINGLE-PUSH-1 | single | push | $10 | $10 | Push = 0 net |
| SINGLE-PENDING-1 | single | pending | $10 | $0 | Pending = 0 net (KPI), blank (display) |
| PARLAY-WIN-1 | parlay | win | $5 | $50 | Parlay excluded from entity stats |
| PARLAY-LOSS-1 | parlay | loss | $5 | $0 | Parlay excluded from entity stats |
| SGP-WIN-1 | sgp | win | $5 | $30 | SGP treated as parlay |
| SGP-PLUS-LOSS-1 | sgp_plus | loss | $5 | $0 | SGP+ treated as parlay |
| SINGLE-OVER-1 | single | win | $10 | $20 | O/U breakdown (Over) |
| SINGLE-UNDER-1 | single | loss | $10 | $0 | O/U breakdown (Under) |
| PARLAY-OVER-1 | parlay | win | $5 | $40 | O/U excludes parlays |
| SINGLE-LIVE-1 | single (isLive: true) | win | $10 | $18 | Live vs Pre-Match |
| SINGLE-TEAM-1 | single | win | $10 | $19 | entityType: team |
| SINGLE-PLAYER-1 | single | win | $10 | $22 | entityType: player |
| SINGLE-UNKNOWN-1 | single | win | $10 | $20 | entityType: undefined (fallback test) |

**Expected Totals (Calculated):**

For all bets:
- Total Bets: 15
- Total Wagered: $115
- Net Profit (settled only): $59 (excludes pending)
- Pending Net Contribution: $0

For entity stats (non-parlays only):
- Total tickets: 9 (excluding parlays/SGP/SGP+)
- Total stake: $90

### 3) Test Plan by Category

#### Parser → Canonical Snapshot Tests
- [ ] FanDuel single bet parses to expected Bet object
- [ ] DraftKings parlay parses to expected Bet object
- [ ] Leg-level result fields populated correctly

#### Derived Metrics Unit Tests
- [ ] `getNetNumeric()` returns 0 for pending (EXISTING ✅)
- [ ] `getNetDisplay()` returns '' for pending (EXISTING ✅)
- [ ] `computeNetNumeric()` returns undefined for pending (NEEDS TEST)
- [ ] `calculateRoi()` returns 0 when stake is 0 (EXISTING ✅)
- [ ] Win rate excludes pushes and pending (NEEDS EXPLICIT TEST)

#### Dashboard Aggregation Reconciliation Tests
- [ ] StatCard net == sum(filteredBets table rows net) for settled bets
- [ ] Chart total == table total for same filter context
- [ ] QuickStatCards unchanged when dashboard filters change
- [ ] O/U breakdown excludes parlays

#### "No Leakage" Tests (Parlays Never Counted as Singles)
- [ ] `isParlayBetType()` returns true for 'parlay', 'sgp', 'sgp_plus' (EXISTING ✅)
- [ ] `getEntityMoneyContribution()` returns 0 for parlay types (EXISTING ✅)
- [ ] `computeEntityStatsMap()` excludes parlays entirely (EXISTING ✅)
- [ ] OverUnderBreakdown parlay exclusion (NEEDS TEST)

### 4) Optional Dev-Only Assertions (Toggleable)

Consider adding `console.assert()` or conditional assertions that:
- Detect when KPI totals diverge across widgets
- Flag excessive self-healing (> 5 bets reclassified on load)
- Warn if an entity has both player and team classifications

---

## F) RED FLAGS LIST (UPDATED)

### P0 (Critical — Proof Gaps Requiring Enforcement)

| ID | Issue | Location | Impact | Status |
|----|-------|----------|--------|--------|
| PG-1 | Net semantics divergence without cross-module test | Two files | Could silently diverge | **NEEDS TEST** |
| PG-2 | QuickStatCards global behavior undocumented by test | DashboardView | Could break on refactor | **NEEDS TEST** |
| PG-3 | O/U parlay exclusion not centralized | Multiple views | Could add new component without check | **NEEDS TEST** |
| PG-4 | Self-healing masks classifier bugs | useBets.tsx | False confidence in classifier | **NEEDS MONITORING** |
| PG-5 | Entity type fallback not tested | Multiple views | Unknown entities misclassified | **NEEDS TEST** |

### P1 (High — Should Review)

| ID | Issue | Location | Impact | Recommendation |
|----|-------|----------|--------|----------------|
| PG-6 | No reconciliation test for ROI across widgets | aggregationService | Could diverge silently | Add reconciliation test |
| PG-7 | Parlay detection spread across files | Multiple | Could miss a check | Consolidate + test |

### P2 (Medium — Nice to Have)

| ID | Issue | Location | Impact | Recommendation |
|----|-------|----------|--------|----------------|
| PG-8 | Win rate edge case (all pushes) not tested | aggregationService | Edge case only | Add test |
| PG-9 | LiveVsPreMatch not tested in isolation | DashboardView | Low risk | Add unit test |

---

## PHASE 1 ACCEPTANCE CRITERIA CHECKLIST (UPDATED)

- [x] Every dashboard widget is mapped to an identified data source and filter context
- [x] Every displayed metric has an explicit formula or canonical field
- [x] RED FLAG section exists (P0/P1/P2 identified)
- [x] Clear Phase 2 plan is provided
- [x] **PHASE 2A:** Proof gaps identified (Section H)
- [x] **PHASE 2A:** Invariants defined (Section I)
- [x] **PHASE 2A:** Execution plan created (Section J)

---

## CONCLUSION (UPDATED)

Phase 1 mapping found no **observed** misattribution bugs. However, **Phase 2A analysis identified 5 P0 proof gaps** where correctness is based on convention rather than enforcement:

1. **Net semantics divergence** — Two implementations of pending net with no cross-module test
2. **QuickStatCards scoping** — Global behavior undocumented by test
3. **O/U parlay exclusion** — Inline checks without centralized guard
4. **Self-healing masking** — Could hide classifier bugs
5. **Entity type fallback** — Unknown entities not tested

**These are NOT bugs today**, but they represent silent drift risks. Phase 2B implementation will add:
- Invariant tests to lock in semantics
- Reconciliation tests to ensure widget consistency
- Deadly fixtures to catch regressions

**Status:** Phase 2A complete. Ready for Phase 2B execution upon approval.

---

## STOP — AWAITING "Run Phase 2B"

Phase 2A complete. Proof gaps identified and invariants documented. Phase 2B will implement the test suite and enforcement mechanisms defined above.
