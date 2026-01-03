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

**IMPORTANT:** `betToFinalRows.computeNetNumeric()` returns `undefined` for pending (display as blank), while `displaySemantics.getNetNumeric()` returns `0` for pending (KPI totals). This is **intentional divergence** documented in code.

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

### P0 (Critical — Must Fix)

**NONE IDENTIFIED**

The codebase has a well-structured single source of truth:
- Net calculations use `displaySemantics.getNetNumeric()` consistently
- Entity stats use `entityStatsService.computeEntityStatsMap()` consistently
- Filter predicates are shared via `utils/filterPredicates.ts`

### P1 (High — Should Review)

| ID | Issue | Location | Impact | Recommendation |
|----|-------|----------|--------|----------------|
| 6 | Entity type fallback heuristic | `DashboardView:776-785`, `BySportView:755-769` | Unknown entities classified by team lookup, may misclassify new teams as players | Document behavior, consider adding unknown fallback |

### P2 (Medium — Nice to Have)

| ID | Issue | Location | Impact | Recommendation |
|----|-------|----------|--------|----------------|
| 1 | `computeNetNumeric` vs `getNetNumeric` different pending behavior | Two files | **Intentional** - display vs KPI semantics | Already documented in code |
| 5 | QuickStatCards unfiltered | DashboardView:829-830 | **Intentional** design choice | Already documented in code |
| 7 | OverUnderBreakdown filters out parlays | DashboardView:339, BySportView:396 | Could be confusing if user expects parlay O/U legs | Add UI label "Singles Only" |

### P3 (Low — Future Enhancement)

| ID | Issue | Location | Impact | Recommendation |
|----|-------|----------|--------|----------------|
| 8 | Parlay child net calculation uses bet.result | betToFinalRows:485 | Child rows inherit parent result, not leg result | **Intentional** - parlay net is ticket-level |

---

## G) EXECUTION PLAN (PHASE 2)

Based on the audit findings, **the codebase is in good shape**. The data pipeline has:
- ✅ Single source of truth for net calculations (`displaySemantics`)
- ✅ Single source of truth for entity stats (`entityStatsService`)
- ✅ Consistent filter predicates (`filterPredicates`)
- ✅ Clear parlay vs singles isolation
- ✅ Documented intentional divergences

### Phase 2 Tasks (If Needed)

1. **Create Proof Harness Tests** — Add a comprehensive fixture-based test suite that:
   - Validates KPI invariants (tile total == table sum == chart total)
   - Tests singles/parlays/SGP isolation
   - Tests edge cases (void, push, pending)

2. **Document Entity Type Fallback** — Add explicit documentation for the fallback behavior when `leg.entityType` is undefined or "unknown"

3. **Add Dev-Only Assertions** — Consider adding toggleable assertions that detect:
   - KPIs computed via different paths
   - Mixed timezone bucketing
   - Inclusion-rule contradictions

### Existing Test Coverage

The codebase already has solid test coverage:
- `displaySemantics.test.ts` — 26 tests covering net, ROI, parlay semantics
- `aggregationService.test.ts` — Tests for overall stats, profit over time
- `entityStatsService.test.ts` — Tests for entity attribution
- `betToFinalRows.test.ts` — Tests for display transformation
- Parser tests — FanDuel and DraftKings with fixtures

---

## PHASE 1 ACCEPTANCE CRITERIA CHECKLIST

- [x] Every dashboard widget is mapped to an identified data source and filter context
- [x] Every displayed metric has an explicit formula or canonical field
- [x] RED FLAG section exists (P1/P2/P3 identified, no P0)
- [x] Clear Phase 2 plan is provided

---

## STOP — AWAITING "Run Phase 2"

Phase 1 complete. The audit found **no critical misattribution risks**. The codebase implements:
- Single source of truth for all KPI calculations
- Consistent parlay/singles isolation
- Well-documented intentional design divergences

Proceed to Phase 2 only if specific fixture-based proof tests are required.
