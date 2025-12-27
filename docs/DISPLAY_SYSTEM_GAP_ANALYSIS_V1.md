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
| **ROI Calculation** | DashboardView:848, 329-330, 481-482, 970; SportsbookBreakdownView:180; BySportView:448, 493; PlayerProfileView:417 | ❌ Duplicated |
| **Win Rate** | DashboardView:852; SportsbookBreakdownView:181; BySportView:447; PlayerProfileView:418 | ❌ Duplicated |
| **Cumulative Profit** | DashboardView:857-867; SportsbookBreakdownView:153-157; BySportView:451-455; PlayerProfileView:421-425 | ❌ Duplicated |
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
- `parsing/shared/betToFinalRows.ts:642-685` — `computeNetNumeric()` (imports finalRowValidators)
- Inline in all views: `bet.payout - bet.stake`

**ROI Formula (6 locations):**
- DashboardView.tsx:848-851 — `(netProfit / totalWagered) * 100`
- DashboardView.tsx:329-330 — `(s.net / s.stake) * 100` (OverUnderBreakdown calculateRoi)
- DashboardView.tsx:481-482 — `(s.net / s.stake) * 100` (LiveVsPreMatchBreakdown calculateRoi)
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

### Gap 1: No Shared Filter Engine (ADDRESSED)

> [!CHECK] **Addressed in P2** by `utils/filterPredicates.ts`

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

### Gap 2: No Shared Aggregation Service (ADDRESSED)

> [!CHECK] **Addressed in P2** by `services/aggregationService.ts`

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

> [!CHECK] **ADDRESSED (policy codified)** in P3 by `services/displaySemantics.ts`

**Previous state:**
- Inline views: `bet.payout - bet.stake` — returned -stake for pending (since payout is 0)
- `finalRowValidators.ts:217-280`: returns empty string for pending
- `utils/betCalculations.ts:28-36`: `calculateProfit` doesn't handle result at all

**Current state (P3):**
- All views now call `getNetNumeric(bet)` from `services/displaySemantics.ts`
- Pending bets contribute **0** to numeric net (not -stake)
- Display strings use `getNetDisplay(bet)` which returns `""` for pending
- Policy is documented in `displaySemantics.ts` with clear comments

**Behavioral change:**
- KPIs that previously showed pending as -stake now show pending as 0
- This is the **correct** behavior: pending bets are undecided

**Risk level:** **ADDRESSED**

---

### Gap 4: Parlay Stake Attribution Unclear for Per-Entity Stats

> [!CHECK] **ADDRESSED (P4 policy implemented)** in P4 by `services/entityStatsService.ts`

**Previous state (P3):**
- When computing player/team stats from parlay legs, the entire `bet.stake` was attributed to each entity
- This was documented as **"ticket-level" attribution policy** but caused stake inflation

**Current state (P4):**
- **Parlays excluded from entity money attribution**: Parlay bets contribute 0 stake and 0 net to entity breakdowns
- **Singles only**: Entity money columns (Wagered/Net/ROI) reflect only single bets
- **Leg accuracy added**: Entity breakdowns include leg-level metrics (legs, legWins, legLosses, legWinRate)
- `computeEntityStatsMap()` in `services/entityStatsService.ts` implements the P4 policy
- `getEntityMoneyContribution()` in `services/displaySemantics.ts` returns {stake: 0, net: 0} for parlays

**P4 Policy (from entityStatsService.ts):**
```typescript
// P4 SEMANTICS:
// - Singles: Money (stake/net) attributed to each entity
// - Parlays: Zero money; only leg outcomes counted
// - Leg outcomes tracked independently of ticket result
```

**Why P4 policy is correct:**
- Prevents stake inflation: A $10 parlay is ONE $10 ticket, not $10 per entity
- Provides accurate money KPIs: Entity breakdowns show actual singles performance
- Still provides parlay insight: Leg accuracy metrics show how entities perform in parlays
- Leg outcomes independent: A leg can win even if the ticket loses

**Risk level:** **ADDRESSED (P4 implemented)**

---

### Gap 5: Date Format Inconsistency

**Current state:**
- BetTableView.tsx:83-90: `MM/DD` format (no year)
- betToFinalRows.ts:719-733: `MM/DD/YY` format
- DashboardView.tsx:864, BySportView.tsx:454: `toLocaleDateString()` (locale-dependent, defaults to system locale)
- SportsbookBreakdownView.tsx:156, PlayerProfileView.tsx:424: `toLocaleDateString('en-CA')` (YYYY-MM-DD)

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

> [!CHECK] **ADDRESSED (policy documented)** in P3 by `services/displaySemantics.ts`

**Current state:**
- O/U breakdowns now use `getNetNumeric(bet)` from `displaySemantics.ts`
- This follows the same **"ticket-level" attribution policy** as Gap 4
- Each O/U leg gets the full stake/net attributed (intentional behavior)

**Why ticket-level is intentional:**
- Consistent with parlay attribution policy (Gap 4)
- Answers: "How do my Over bets perform?" at the ticket level
- If a ticket wins/loses, the O/U direction on that ticket contributed to the outcome

**Code now uses semantic helpers:**
```typescript
const net = getNetNumeric(bet); // Uses centralized semantics
stats[ou].net += net;
```

**Risk level:** **ADDRESSED (policy documented)**

---

## 6. Risk Ranking

### HIGH Risk — ADDRESSED
1. **Gap 1: No Shared Filter Engine** — ✅ ADDRESSED in P2 by `utils/filterPredicates.ts`
2. **Gap 2: No Shared Aggregation Service** — ✅ ADDRESSED in P2 by `services/aggregationService.ts`

### MEDIUM Risk — ADDRESSED
3. **Gap 3: Inconsistent Net Calculation Semantics** — ✅ ADDRESSED in P3 by `services/displaySemantics.ts`
4. **Gap 4: Parlay Stake Attribution** — ✅ ADDRESSED in P3 (policy documented in `displaySemantics.ts`)
5. **Gap 8: Over/Under Breakdown Attribution** — ✅ ADDRESSED in P3 (policy documented in `displaySemantics.ts`)

### LOW Risk — PARTIALLY ADDRESSED
6. **Gap 5: Date Format Inconsistency** — ⏳ Partially addressed (chart dates use `'en-CA'` locale)
7. **Gap 6: DashboardView processedData Dependencies** — ⏳ Minor, not blocking
8. **Gap 7: No Debouncing on Search Input** — ⏳ Minor, not blocking

---

## 7. Verdict

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
   
   **DashboardView.tsx:721-724:**
   ```typescript
   // L721: if (betTypeFilter === "singles") {
   // L722:   if (bet.betType !== "single") return false;
   // L723: } else if (betTypeFilter === "parlays") {
   // L724:   if (bet.betType !== "sgp" && bet.betType !== "parlay") return false;
   // L725: }
   ```
   > ✓ Logic is correct: `!== "sgp" && !== "parlay"` means "if NOT sgp AND NOT parlay, reject" — effectively allowing only sgp OR parlay bets.
   
   **PlayerProfileView.tsx:392-401:**
   ```typescript
   if (betTypeFilter === "singles") {
     filtered = filtered.filter(bet => bet.betType === "single");
   } else if (betTypeFilter === "parlays") {
     filtered = filtered.filter(
       bet =>
         bet.betType === "sgp" ||
         bet.betType === "sgp_plus" ||
         bet.betType === "parlay"
     );
   }
   ```
   > ✓ Also correct, using positive matching with `||`.
   
   **Semantic Divergence:** PlayerProfileView includes `sgp_plus` in the parlays filter; DashboardView excludes it. This is a **semantic alignment issue**, not a logic bug.

4. **Time bucketing:**
   - All views use per-bet cumulative (no calendar bucketing)
   - Date formatting varies: `toLocaleDateString()` vs `toLocaleDateString('en-CA')`
   - **Citation:** SportsbookBreakdownView.tsx:156 and PlayerProfileView.tsx:424 use 'en-CA' locale; DashboardView.tsx:864 and BySportView.tsx:454 use default locale

---

> [!NOTE]
> **Remediation planning has been moved to:** [DISPLAY_SYSTEM_REMEDIATION_PLAN_V1.md](./DISPLAY_SYSTEM_REMEDIATION_PLAN_V1.md)

<!-- End of Dashboard & Display System Gap Analysis v1 -->
