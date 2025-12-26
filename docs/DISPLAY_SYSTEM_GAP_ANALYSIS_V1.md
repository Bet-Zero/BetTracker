# Dashboard & Display System Gap Analysis v1

## 1. What the Display System Is Trying to Be

A correct consumption layer for a sports betting tracker should:

1. **Present derived insights from Bet[] data** — KPIs, charts, tables, aggregations — without re-interpreting raw data
2. **Apply filters uniformly** — A single, declarative filter system where predicate logic is defined once and reused across all views
3. **Own metric calculations centrally** — Net profit, ROI, win rate computed in one location, consumed everywhere
4. **Handle parlays/multi-leg bets consistently** — One transformation layer producing both ticket-level and leg-level views
5. **Cache intelligently** — Derived data memoized with correct dependencies; no redundant recomputation
6. **Format consistently** — Dates, currencies, odds, percentages formatted via shared utilities
7. **Respect status semantics** — Pending, win, loss, push handled uniformly; no silent drops or edge-case divergence

The ideal architecture:

```
Bet[] (Source of Truth in BetsContext)
    ↓
FilterEngine (single predicate library)
    ↓
Aggregation Service (computes KPIs)
    ↓
View Adapters (shape data for charts/tables)
    ↓
UI Components (purely presentational)
```

---

## 2. What the Display System Currently Is

### Actual Architecture

The current display system is a **view-centric, ad-hoc transformation layer**:

- Each view (DashboardView, BetTableView, SportsbookBreakdownView, BySportView, PlayerProfileView) independently:
  - Manages its own filter state via `useState`
  - Applies filter predicates in local `useMemo` blocks
  - Computes aggregations/KPIs inline
  - Formats data for display

There is no shared filter engine, no aggregation service, and no view adapters.

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                      localStorage                                    │
│  STORAGE_KEY = 'bettracker-state'                                   │
│  { version, updatedAt, bets: Bet[] }                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ loadState() @ services/persistence.ts:212
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BetsContext                                     │
│  hooks/useBets.tsx:37 → useState<Bet[]>([])                         │
│  Exposes: { bets, addBets, updateBet, clearBets, loading }          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ useBets() hook
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          VIEWS                                       │
│  Each view independently:                                            │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ DashboardView.tsx                                           │    │
│  │   useState: dateRange, marketCategory, betTypeFilter, etc.  │    │
│  │   useMemo: filteredBets (lines 718-782)                     │    │
│  │   useMemo: processedData (lines 784-1006)                   │    │
│  │     → profitByBook, profitOverTime, marketCategoryStats     │    │
│  │     → playerTeamStats, tailStats, sportStats, overallStats  │    │
│  │   Sub-components: OverUnderBreakdown, LiveVsPreMatchBreakdown│    │
│  │     (each has its own useMemo aggregations)                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ BetTableView.tsx                                            │    │
│  │   useState: filters, searchTerm, sortConfig                 │    │
│  │   useMemo: flattenedBets (lines 534-616)                    │    │
│  │     → uses betToFinalRows() for Bet → FlatBet conversion    │    │
│  │   useMemo: filteredBets (lines 750-766)                     │    │
│  │   useMemo: sortedBets, visibleBets                          │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ SportsbookBreakdownView.tsx                                 │    │
│  │   useState: selectedBook, dateRange, customDateRange        │    │
│  │   useMemo: filteredBets (lines 94-146)                      │    │
│  │   useMemo: processedData (lines 148-186)                    │    │
│  │     → stats, profitOverTime, profitBySportData              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ BySportView.tsx                                             │    │
│  │   useState: selectedSport, dateRange, customDateRange       │    │
│  │   useMemo: filteredBets (lines 404-433)                     │    │
│  │   useMemo: processedData (lines 435-508)                    │    │
│  │     → overallStats, profitOverTime, playerTeamStats         │    │
│  │   Sub-components: OverUnderBreakdown, LiveVsPreMatchBreakdown│    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ PlayerProfileView.tsx                                       │    │
│  │   useState: selectedPlayer, dateRange, betTypeFilter        │    │
│  │   useMemo: playerBets (lines 354-405)                       │    │
│  │   useMemo: processedData (lines 407-453)                    │    │
│  │     → overallStats, profitOverTime, marketStats             │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow Mapping

### Bet[] → Derived Data → UI

| Stage | Location | Transformation |
|-------|----------|----------------|
| **Source** | `hooks/useBets.tsx:37` | `useState<Bet[]>([])` stores raw bets |
| **Filter** | Each view's `useMemo` | Custom predicate per view, no shared logic |
| **Aggregate** | Each view's `processedData` | Inline loops computing net, wins, losses, ROI |
| **Format** | Each view or `betToFinalRows` | Inline formatters or `finalRowValidators.ts` |
| **Display** | React components | Recharts, tables, stat cards |

### Where Transformations Occur

| Transformation Type | Files | Shared? |
|---------------------|-------|---------|
| **Filtering** | DashboardView:718, BetTableView:750, SportsbookBreakdownView:94, BySportView:404, PlayerProfileView:354 | ❌ No |
| **Net Calculation** | Inline in all views: `bet.payout - bet.stake` | ❌ Duplicated |
| **ROI Calculation** | DashboardView:848, 329, 970; SportsbookBreakdownView:180; BySportView:448, 493; PlayerProfileView:417 | ❌ Duplicated |
| **Win Rate** | DashboardView:852; SportsbookBreakdownView:181; BySportView:447; PlayerProfileView:418 | ❌ Duplicated |
| **Cumulative Profit** | DashboardView:857-867; SportsbookBreakdownView:151-157; BySportView:451-455; PlayerProfileView:421-425 | ❌ Duplicated |
| **Date Formatting** | BetTableView:83-90 (MM/DD), betToFinalRows:719-733 (MM/DD/YY), various toLocaleDateString calls | ❌ Inconsistent |
| **Parlay Flattening** | `parsing/shared/betToFinalRows.ts:269-286` | ✓ Centralized |

### Where State Lives

| State | Location | Scope |
|-------|----------|-------|
| `Bet[]` | `BetsContext` (hooks/useBets.tsx:37) | Global, single source of truth |
| Filter state | Each view's local `useState` | Local, not shareable |
| Sort state | BetTableView:479-482, StatsTable components | Local |
| Expanded parlays | `localStorage['bettracker-expanded-parlays']` (BetTableView:495-511) | Persisted UI preference |
| Reference data | `InputsContext` (hooks/useInputs.tsx) | Global |

---

## 4. Ownership & Responsibility Audit

### Who Owns What?

| Responsibility | Owner | Location | Issues |
|----------------|-------|----------|--------|
| **Aggregations** | Each view independently | DashboardView:784-1006, SportsbookBreakdownView:148-186, BySportView:435-508, PlayerProfileView:407-453 | **Duplicated in 4+ locations** |
| **Filters** | Each view independently | DashboardView:718-782, SportsbookBreakdownView:94-146, BySportView:404-433, PlayerProfileView:354-405 | **Duplicated in 5 locations** |
| **Calculations (Net)** | Multiple | Inline `bet.payout - bet.stake` everywhere; also `utils/betCalculations.ts:28-36`, `parsing/shared/finalRowValidators.ts:217-280` | **4 definitions of net logic** |
| **Calculations (ROI)** | Each view | 6 inline definitions, all using same formula | **Formula duplicated 6 times** |
| **Formatting (Dates)** | Multiple | BetTableView:83-90, betToFinalRows.ts:719-733, toLocaleDateString with different locales | **3+ formats in use** |
| **Formatting (Odds)** | Mostly centralized | `finalRowValidators.ts:104-116` but also inline in BetTableView:909-913 | Minor duplication |
| **Caching** | Each view | `useMemo` blocks | Generally correct, minor dep issues |

### Duplicates and Unclear Ownership (Citations)

**Net Profit Calculation (4 locations):**
- `utils/betCalculations.ts:28-36` — `calculateProfit(stake, odds)` 
- `parsing/shared/finalRowValidators.ts:217-280` — `calculateFormattedNet(result, stake, odds, payout)`
- `parsing/shared/betToFinalRows.ts:641-685` — `computeNetNumeric()` (imports finalRowValidators)
- Inline in all views: `bet.payout - bet.stake`

**ROI Formula (6 locations):**
- DashboardView.tsx:848-851 — `(netProfit / totalWagered) * 100`
- DashboardView.tsx:329-330 — `(s.net / s.stake) * 100`
- DashboardView.tsx:970-971 — `(s.net / s.stake) * 100`
- SportsbookBreakdownView.tsx:180 — `(netProfit / totalWagered) * 100`
- BySportView.tsx:448, 493 — `(s.net / s.stake) * 100`
- PlayerProfileView.tsx:417 — `(netProfit / totalWagered) * 100`

**Date Range Filtering (5 locations):**
- DashboardView.tsx:736-779
- SportsbookBreakdownView.tsx:102-145
- BySportView.tsx:407-430
- PlayerProfileView.tsx:358-385
- BetTableView — no date range filter, uses search instead

**addToMap Helper (2 locations):**
- DashboardView.tsx:922-938
- BySportView.tsx:461-469

---

## 5. The Gaps

### Gap 1: No Shared Filter Engine

**Current state:**
- Each view implements its own date range, category, and betType filtering
- DashboardView.tsx:718-782, SportsbookBreakdownView.tsx:94-146, BySportView.tsx:404-433, PlayerProfileView.tsx:354-405
- Filter predicates duplicated with slight variations

**Ideal state:**
- Single `FilterEngine` module exporting composable predicates:
  ```typescript
  filterByDateRange(bets, range)
  filterByCategory(bets, category)
  filterByBetType(bets, betType)
  filterBySport(bets, sport)
  ```

**Why it matters:**
- Bug fixes must be applied to 5 locations
- Date range boundary logic could drift between views
- Cannot share filter state across views

**Risk level:** **HIGH**

---

### Gap 2: No Shared Aggregation Service

**Current state:**
- Each view computes totals, wins, losses, net, ROI in its own `processedData` useMemo
- DashboardView.tsx:784-1006, SportsbookBreakdownView.tsx:148-186, BySportView.tsx:435-508, PlayerProfileView.tsx:407-453
- Helper functions like `addToMap` and `calculateRoi` re-implemented per view

**Ideal state:**
- Single `AggregationService` exporting:
  ```typescript
  computeOverallStats(bets) → { totalBets, totalWagered, netProfit, wins, losses, winRate, roi }
  computeProfitOverTime(bets) → { date, cumulativeProfit }[]
  computeStatsByDimension(bets, dimension) → Map<string, Stats>
  ```

**Why it matters:**
- Formula discrepancies already exist (see ROI formula duplication)
- Any formula change requires updating 4-6 files
- Difficult to unit test KPI logic when embedded in view components

**Risk level:** **HIGH**

---

### Gap 3: Inconsistent Net Calculation Semantics

**Current state:**
- Inline views: `bet.payout - bet.stake` — returns 0 for pending (since payout is 0)
- `finalRowValidators.ts:217-280`: returns empty string for pending
- `utils/betCalculations.ts:28-36`: `calculateProfit` doesn't handle result at all

**Citation:**
```typescript
// Views (inline)
const net = bet.payout - bet.stake; // Returns 0 for pending

// finalRowValidators.ts:234-235
if (resultLower === "pending") {
  return "" as FormattedNet; // Returns empty string for pending
}
```

**Ideal state:**
- Single `calculateNet(bet)` function that handles all statuses uniformly
- Views always call this function rather than inline calculation

**Why it matters:**
- Pending bets showing 0 net vs empty net is inconsistent
- Future features (open P/L tracking) need consistent treatment

**Risk level:** **MEDIUM**

---

### Gap 4: Parlay Stake Attribution Unclear for Per-Entity Stats

**Current state:**
- When computing player/team stats from parlay legs, the entire `bet.stake` is attributed to each entity
- DashboardView.tsx:958-959:
  ```typescript
  leg.entities?.forEach((entity) =>
    addToMap(playerTeamStatsMap, entity, bet.stake, net, result)
  );
  ```
- BySportView.tsx:478 follows the same pattern

**Ideal state:**
- Clear documentation or logic on whether parlay stake should be:
  - Attributed fully to each entity (current behavior, leads to double-counting stake)
  - Split across legs (more accurate but complex)
  - Excluded from per-entity rollups

**Why it matters:**
- User sees inflated "Wagered" values in player/team tables when betting parlays
- ROI calculations for entities in parlays are misleading

**Risk level:** **MEDIUM**

---

### Gap 5: Date Format Inconsistency

**Current state:**
- BetTableView.tsx:83-90: `MM/DD` format (no year)
- betToFinalRows.ts:719-733: `MM/DD/YY` format
- DashboardView.tsx:864, BySportView.tsx:454, PlayerProfileView.tsx:424: `toLocaleDateString()` (locale-dependent)
- SportsbookBreakdownView.tsx:156: `toLocaleDateString('en-CA')` (YYYY-MM-DD)

**Ideal state:**
- Single `formatDate(isoString, format)` utility used everywhere
- Consistent format per context (table vs chart vs export)

**Why it matters:**
- User sees different date formats in different views
- Chart aggregation by date string could fail to group correctly if formats differ

**Risk level:** **LOW**

---

### Gap 6: DashboardView processedData Dependencies

**Current state:**
- DashboardView.tsx:1006:
  ```typescript
  }, [bets, filteredBets, allPlayers, allTeams, entityType]);
  ```
- `bets` is included but `filteredBets` already derives from `bets`

**Ideal state:**
- Remove redundant `bets` from dependency array since `filteredBets` already depends on it

**Why it matters:**
- Potential extra recomputation when `bets` changes but `filteredBets` wouldn't change
- Minor performance impact, but violates React dependency array best practices

**Risk level:** **LOW**

---

### Gap 7: No Debouncing on Search Input

**Current state:**
- BetTableView.tsx:467, 1549-1552: `searchTerm` state changes trigger immediate refilter
- filteredBets useMemo at line 750 recomputes on every keystroke

**Ideal state:**
- Debounce search input (e.g., 200ms delay) before applying filter

**Why it matters:**
- With large bet datasets (500+ bets), rapid keystroke filtering could cause jank
- Minor UX improvement opportunity

**Risk level:** **LOW**

---

### Gap 8: Over/Under Breakdown Uses Full Bet Net, Not Per-Leg

**Current state:**
- DashboardView.tsx:313-325 (OverUnderBreakdown):
  ```typescript
  bet.legs.forEach((leg) => {
    if (leg.ou) {
      const ou = leg.ou.toLowerCase() as "over" | "under";
      const net = bet.payout - bet.stake; // Full bet net
      stats[ou].count++;
      stats[ou].stake += bet.stake; // Full stake attributed per leg
      stats[ou].net += net;
    }
  });
  ```
- If a bet has multiple legs, each O/U leg gets the full stake/net attributed

**Ideal state:**
- Document expected behavior: is this intentional (ticket-level O/U) or should it be leg-normalized?

**Why it matters:**
- Can inflate O/U stats if many multi-leg bets exist
- Consistent with parlay attribution gap (Gap 4)

**Risk level:** **MEDIUM**

---

## 6. Risk Ranking

### HIGH Risk
1. **Gap 1: No Shared Filter Engine** — Duplication across 5 views; bug fixes require multi-file updates
2. **Gap 2: No Shared Aggregation Service** — ROI/net formulas duplicated 6 times; difficult to test

### MEDIUM Risk
3. **Gap 3: Inconsistent Net Calculation Semantics** — Pending bets show 0 vs empty
4. **Gap 4: Parlay Stake Attribution** — Per-entity stats double-count stake on parlays
5. **Gap 8: Over/Under Breakdown Attribution** — Full ticket net attributed per O/U leg

### LOW Risk
6. **Gap 5: Date Format Inconsistency** — Multiple formats in use
7. **Gap 6: DashboardView processedData Dependencies** — Redundant `bets` in dep array
8. **Gap 7: No Debouncing on Search Input** — Performance opportunity

---

## 7. Initial Fix Direction (NO CODE YET)

### High-Level Consolidation Strategy

1. **Create `utils/filterPredicates.ts`**
   - Extract date range filter logic from DashboardView.tsx:751-778
   - Export `createDateRangeFilter(range, customRange)` returning `(bet) => boolean`
   - Export `createCategoryFilter(category)`, `createBetTypeFilter(betType)`, etc.
   - All views import and compose these predicates

2. **Create `services/aggregationService.ts`**
   - Move `calculateRoi`, `addToMap` helpers from views
   - Export `computeOverallStats(bets)`, `computeProfitOverTime(bets)`, `groupByDimension(bets, dimension)`
   - Views call service instead of inline computation

3. **Unify Net Calculation**
   - Standardize on `bet.payout - bet.stake` for numeric net
   - Create wrapper `getNetDisplay(bet)` that returns formatted string with pending handling
   - Update `finalRowValidators.ts` to use the same logic

4. **Document Parlay Attribution Semantics**
   - Add to evidence pack: "Per-entity stats use ticket-level stake (intentional double-count for parlays)"
   - Or refactor to split stake / exclude parlays from entity stats

5. **Create `utils/formatters.ts`**
   - Consolidate `formatDate`, `formatCurrency`, `formatOdds`, `formatPercentage`
   - Migrate all inline formatting to use these utilities

### What Should Become Single-Source-of-Truth

| Concern | New Location | Replaces |
|---------|--------------|----------|
| Filter predicates | `utils/filterPredicates.ts` | 5 inline implementations |
| KPI calculations | `services/aggregationService.ts` | 4 view-local processedData blocks |
| Net calculation | `utils/betCalculations.ts` (expand) | Inline `payout - stake` + finalRowValidators |
| Date formatting | `utils/formatters.ts` | 4+ inline formatDate implementations |
| Category display | `services/marketClassification.ts` (already done) | N/A |

### What Should NOT Be Touched

1. **Import system** — Complete and locked per requirements
2. **Persistence layer** — `services/persistence.ts` is stable and versioned
3. **Parlay flattening** — `betToFinalRows.ts` is already centralized
4. **Market classification** — `services/marketClassification.ts` is already centralized
5. **BetsContext/InputsContext** — Core state management is sound

---

## 8. Verdict

### Is the Display Foundation Solid?

**No.** The display foundation **looks aligned but isn't**.

**Symptoms of misalignment:**
- The same formula (ROI, win rate, net) is implemented 4-6 times
- Filter predicates are copy-pasted with slight variations
- Date formatting differs across views
- Parlay stake attribution is neither documented nor consistent

**What's working well:**
- `BetsContext` as single source of truth for Bet[] data
- `betToFinalRows.ts` as centralized parlay flattening
- `marketClassification.ts` as centralized category/type logic
- `useMemo` usage is generally correct (minor dep issues)
- Persistence layer is robust with versioning and backup

**Root cause:**
The views evolved independently, each implementing display logic locally. There was no architectural enforcement of shared aggregation or filter modules, so duplication accumulated.

**Prognosis:**
The foundation is **fixable** without major refactoring. The data model (`Bet`, `FinalRow`) is sound. The gaps are in the **transformation layer** between Bet[] and UI, not in the data structures or persistence.

---

## Reconciliation Check

### Can every KPI on each view be traced to a filtered bet set definable in one place?

**No.** Currently:

1. **DashboardView** filters by `betTypeFilter`, `selectedMarketCategory`, `dateRange` at lines 718-782
2. **SportsbookBreakdownView** filters by `selectedBook`, `dateRange` at lines 94-146
3. **BySportView** filters by `selectedSport`, `dateRange` at lines 404-433
4. **PlayerProfileView** filters by `selectedPlayer`, `dateRange`, `betTypeFilter` at lines 354-405
5. **BetTableView** filters by `sport`, `type`, `result`, `category`, `searchTerm` at lines 750-766

Each uses subtly different predicate implementations. A single bug fix (e.g., timezone handling in date comparison) would require updating 5 files.

### Where do semantics diverge?

1. **Status handling (pending bets):**
   - Views: `bet.payout - bet.stake` returns 0 for pending
   - `finalRowValidators.ts:234`: returns empty string for pending
   - **Citation:** DashboardView.tsx:841 vs finalRowValidators.ts:234-235

2. **Parlay attribution:**
   - All views attribute full `bet.stake` to each entity/leg
   - **Citation:** DashboardView.tsx:958-959, BySportView.tsx:478

3. **BetType filter (singles vs parlays):**
   - DashboardView.tsx:721-724: includes `betType === 'sgp' || betType === 'parlay'` for parlays
   - PlayerProfileView.tsx:395-401: includes `betType === 'sgp' || betType === 'sgp_plus' || betType === 'parlay'` for parlays
   - **Citation:** DashboardView.tsx:721-724 vs PlayerProfileView.tsx:395-401 (SGP+ handling differs)

4. **Time bucketing:**
   - All views use per-bet cumulative (no calendar bucketing)
   - Date formatting varies: `toLocaleDateString()` vs `toLocaleDateString('en-CA')`
   - **Citation:** SportsbookBreakdownView.tsx:156 uses 'en-CA' locale; others use default locale

---

*End of Dashboard & Display System Gap Analysis v1*
