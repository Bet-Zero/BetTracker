# Display System Evidence Pack v1

## 1) Repo Entry Points & Data Ownership

### Primary Entry Points for Persisted Bets

#### Persistence Layer
- **File:** `services/persistence.ts`
- **Key Constants:**
  - `STORAGE_VERSION = 1` (line 19)
  - `STORAGE_KEY = 'bettracker-state'` (line 22)
  - `LEGACY_STORAGE_KEY = 'bettracker-bets'` (line 25)

#### Loading/Hydration
- **Function:** `loadState()` (line 212-244)
- **Where localStorage is read:** `localStorage.getItem(STORAGE_KEY)` (line 214)
- **Persistence version handling:** `migrateIfNeeded()` function (line 143-207) handles version upgrades

```typescript
// services/persistence.ts:212-223
export function loadState(): Result<PersistedState> {
  try {
    const rawString = localStorage.getItem(STORAGE_KEY);
    
    // Case 1: No data in main key -> try migration from legacy
    if (!rawString) {
      return migrateIfNeeded(null);
    }
    // ... parse and migrate
  }
}
```

#### React Provider Hydration
- **File:** `hooks/useBets.tsx`
- **Hook/Context:** `BetsProvider` (line 34-236), `useBets()` (line 238-244)
- **Initial load location:** `useEffect` block (line 41-77)

```typescript
// hooks/useBets.tsx:41-77
useEffect(() => {
  const processLoad = () => {
    try {
      const result = loadState();
      if (!result.ok) {
        // Handle errors
        setBets([]); // Start clean
        return;
      }
      setBets(result.value.bets);
    } finally {
      setLoading(false);
    }
  };
  processLoad();
}, []);
```

### Where `Bet[]` Lives After Hydration

- **React State in Context:** `useState<Bet[]>([])` in `BetsProvider` (line 37)
- **Context Export:** `BetsContext.Provider` exposes `{ bets, addBets, updateBet, clearBets, loading }` (line 229-235)
- **Consumer Hook:** `useBets()` returns `BetsContextType` (line 238-244)

### Single Source of Truth Stores

| Store Name | File Path | Purpose |
|------------|-----------|---------|
| `BetsContext` | `hooks/useBets.tsx:32` | Primary bet data store |
| `InputsContext` | `hooks/useInputs.tsx:37` | Reference data (sportsbooks, sports, categories, players, teams) |
| `PersistedState` | `services/persistence.ts:30-39` | On-disk envelope containing `version`, `updatedAt`, `bets[]` |
 
### Shared Logic Modules (Single Source of Truth)
 
| Module | File Path | Purpose |
|--------|-----------|---------|
| **Filter Engine** | `utils/filterPredicates.ts` | Centralized filter predicates (Date, Sport, Book, Type) |
| **Aggregation Service** | `services/aggregationService.ts` | Centralized KPI formulas (Net, ROI, Win Rate) |
| **Display Semantics** | `services/displaySemantics.ts` | Semantic policies (Pending net, Stake attribution) |
| **Formatting** | `utils/formatters.ts` | Centralized formatting (Dates, Odds, Currency) |

### Semantics Policy (P3)

The `services/displaySemantics.ts` module codifies semantic rules for bet data interpretation:

| Policy | Rule | Implementation |
|--------|------|----------------|
| **Pending Net (Numeric)** | Pending bets contribute **0** to net profit | `getNetNumeric(bet)` returns 0 for pending |
| **Pending Net (Display)** | Pending bets show **blank** in tables | `getNetDisplay(bet)` returns "" for pending |
| **Stake Attribution** | Ticket-level: full stake to each leg/entity | `STAKE_ATTRIBUTION_POLICY = 'ticket-level'` |

These policies ensure consistent behavior across all views and KPI calculations.

---

## 2) Inventory of All Bet[] Transformations (Master List)

### FILTER Transformations

| Location | Symbol | Inputs | Outputs | Callers |
|----------|--------|--------|---------|---------|
| `views/DashboardView.tsx:718-782` | `filteredBets` (useMemo) | `bets`, `selectedMarketCategory`, `dateRange`, `customDateRange`, `betTypeFilter` | `Bet[]` | Dashboard render |
| `views/BetTableView.tsx:750-766` | `filteredBets` (useMemo) | `flattenedBets`, `filters`, `searchTerm` | `FlatBet[]` | Table render |
| `views/SportsbookBreakdownView.tsx:94-146` | `filteredBets` (useMemo) | `bets`, `selectedBook`, `dateRange`, `customDateRange` | `Bet[]` | Sportsbook breakdown |
| `views/BySportView.tsx:404-433` | `filteredBets` (useMemo) | `bets`, `selectedSport`, `dateRange`, `customDateRange` | `Bet[]` | Sport view |
| `views/PlayerProfileView.tsx:354-405` | `playerBets` (useMemo) | `bets`, `selectedPlayer`, `dateRange`, `customDateRange`, `betTypeFilter` | `Bet[]` | Player profile |

### AGGREGATION Transformations

| Location | Symbol | Inputs | Outputs | Callers |
|----------|--------|--------|---------|---------|
| `views/DashboardView.tsx:784-1006` | `processedData` (useMemo) | `bets`, `filteredBets`, `allPlayers`, `allTeams`, `entityType` | `{ profitByBook, profitOverTime, marketCategoryStats, playerTeamStats, ... }` | Dashboard charts |
| `views/SportsbookBreakdownView.tsx:148-186` | `processedData` (useMemo) | `filteredBets` | `{ stats, profitOverTime, profitBySportData }` | Sportsbook charts |
| `views/BySportView.tsx:435-508` | `processedData` (useMemo) | `filteredBets`, `entityType`, `allPlayers`, `allTeams` | `{ overallStats, profitOverTime, playerTeamStats, marketStats, tailStats }` | Sport charts |
| `views/PlayerProfileView.tsx:407-453` | `processedData` (useMemo) | `playerBets`, `selectedPlayer` | `{ overallStats, profitOverTime, marketStats, recentBets }` | Player charts |
| `views/DashboardView.tsx:299-336` | `OverUnderBreakdown` data (useMemo) | `bets`, `filter` | `{ over: {...}, under: {...} }` | O/U component |
| `views/DashboardView.tsx:458-488` | `LiveVsPreMatchBreakdown` data (useMemo) | `bets`, `filter` | `{ live: {...}, preMatch: {...} }` | Live breakdown |

### METRIC Transformations

| Type | Location | Symbol | Formula |
|------|----------|--------|---------|
| METRIC | `utils/betCalculations.ts:28-36` | `calculateProfit(stake, odds)` | `odds > 0 ? stake * (odds/100) : stake / (abs(odds)/100)` |
| METRIC | `utils/betCalculations.ts:45-62` | `recalculatePayout(stake, odds, result)` | win: stake+profit, loss: 0, push: stake, pending: 0 |
| METRIC | `parsing/shared/betToFinalRows.ts:605-632` | `calculateToWin(stake, odds, payout)` | Uses payout if available, else `stake + profit` |
| METRIC | `parsing/shared/finalRowValidators.ts:217-280` | `calculateFormattedNet(result, stake, odds, payout)` | win: profit, loss: -stake, push: 0 |

### FORMAT Transformations

| Location | Symbol | Inputs | Outputs |
|----------|--------|--------|---------|
| `views/BetTableView.tsx:83-90` | `formatDate(isoString)` | ISO string | `MM/DD` |
| `parsing/shared/betToFinalRows.ts:719-733` | `formatDate(isoString)` | ISO string | `MM/DD/YY` |
| `services/marketClassification.ts:535-546` | `abbreviateMarket(market)` | market text | abbreviated code |
| `services/marketClassification.ts:457-469` | `normalizeCategoryForDisplay(marketCategory)` | category string | `'Props'`|`'Main'`|`'Futures'` |
| `parsing/shared/finalRowValidators.ts:104-116` | `formatOdds(odds)` | number | `+NNN` or `-NNN` |
| `parsing/shared/finalRowValidators.ts:157-165` | `formatAmount(amount)` | number | `X.XX` |
| `parsing/shared/finalRowValidators.ts:207-212` | `formatNet(net)` | number | `X.XX` or `-X.XX` |

### CACHING / DERIVED Transformations

| Type | Location | Symbol | Key Inputs | Dependencies |
|------|----------|--------|------------|--------------|
| CACHING | `views/DashboardView.tsx:712-717` | `allPlayers` / `allTeams` (useMemo) | `players`, `teams` | `[players]`, `[teams]` |
| CACHING | `views/BetTableView.tsx:534-616` | `flattenedBets` (useMemo) | `bets` | `[bets]` |
| CACHING | `views/BetTableView.tsx:768-792` | `sortedBets` (useMemo) | `filteredBets`, `sortConfig` | `[filteredBets, sortConfig]` |
| CACHING | `views/BetTableView.tsx:795-806` | `visibleBets` (useMemo) | `sortedBets`, `expandedParlays` | `[sortedBets, expandedParlays]` |

### OTHER Transformations

| Type | Location | Symbol | Purpose |
|------|----------|--------|---------|
| OTHER | `parsing/shared/betToFinalRows.ts:260-384` | `betToFinalRows(bet)` | Converts `Bet` → `FinalRow[]` for display |
| OTHER | `utils/migrations.ts:49-78` | `migrateBets(bets)` | Migrates old bet formats to current |
| OTHER | `hooks/useBets.tsx:135-143` | `classifiedNewBets` map | Applies `classifyBet()` to imported bets |

---

## 3) Filter System Map (Semantics + Ownership)

### Global Filter State

**Not found.** There is no single global filter state. Each view manages its own local filter state via `useState`:

| View | State Variables |
|------|-----------------|
| DashboardView | `selectedMarketCategory`, `dateRange`, `customDateRange`, `entityType`, `betTypeFilter` |
| BetTableView | `filters` (sport/type/result/category), `searchTerm`, `sortConfig` |
| SportsbookBreakdownView | `selectedBook`, `dateRange`, `customDateRange` |
| BySportView | `selectedSport`, `dateRange`, `customDateRange`, `entityType` |
| PlayerProfileView | `selectedPlayer`, `dateRange`, `customDateRange`, `betTypeFilter` |

### Where Filters Are Applied

All filters are applied in `useMemo` blocks within each view component. The pattern is consistent:

```typescript
// Example: views/DashboardView.tsx:718-782
const filteredBets = useMemo(() => {
  let betsToFilter = bets.filter((bet) => {
    // betTypeFilter logic
    if (betTypeFilter === "singles") {
      if (bet.betType !== "single") return false;
    } else if (betTypeFilter === "parlays") {
      if (bet.betType !== "sgp" && bet.betType !== "parlay") return false;
    }
    // marketCategory filter
    if (selectedMarketCategory !== "all" && bet.marketCategory !== selectedMarketCategory)
      return false;
    return true;
  });
  // Date range filtering follows...
}, [bets, selectedMarketCategory, dateRange, customDateRange, betTypeFilter]);
```

### Filter Dimensions Supported

#### Date Range
- **Files:** All view files
- **Predicate logic:**
```typescript
// views/DashboardView.tsx:751-778
switch (dateRange) {
  case "1d": startDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); break;
  case "3d": startDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); break;
  case "1w": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
  case "1m": startDate = new Date(new Date().setMonth(now.getMonth() - 1)); break;
  case "1y": startDate = new Date(new Date().setFullYear(now.getFullYear() - 1)); break;
}
betsToFilter = betsToFilter.filter(bet => new Date(bet.placedAt) >= startDate);
```

#### Status (result: win/loss/push/pending)
- **File:** `views/BetTableView.tsx:756-758`
- **Predicate:**
```typescript
(filters.result === "all" || bet.result === filters.result || bet.overallResult === filters.result)
```

#### Sportsbook
- **File:** `views/SportsbookBreakdownView.tsx:97-99`
- **Predicate:**
```typescript
if (selectedBook !== 'all') {
  betsToFilter = betsToFilter.filter(b => b.book === selectedBook);
}
```

#### Sport/League
- **File:** `views/BySportView.tsx:405`
- **Predicate:**
```typescript
let betsToFilter = bets.filter(bet => bet.sport === selectedSport);
```

#### Entity Type (player/team)
- **Files:** `views/DashboardView.tsx:976-984`, `views/BySportView.tsx:496-500`
- **Predicate:**
```typescript
// views/DashboardView.tsx:976-984
if (entityType === "player") {
  playerTeamStats = playerTeamStats.filter(item => allPlayers.has(item.name));
} else if (entityType === "team") {
  playerTeamStats = playerTeamStats.filter(item => allTeams.has(item.name));
}
```

#### Market Category
- **File:** `views/DashboardView.tsx:728-733`, `views/BetTableView.tsx:759`
- **Predicate:**
```typescript
if (selectedMarketCategory !== "all" && bet.marketCategory !== selectedMarketCategory)
  return false;
```

#### Bet Type Filter (singles/parlays/all)
- **Files:** `views/DashboardView.tsx:719-727`, `views/PlayerProfileView.tsx:392-404`
- **Predicate:**
```typescript
// views/DashboardView.tsx:719-727
if (betTypeFilter === "singles") {
  if (bet.betType !== "single") return false;
} else if (betTypeFilter === "parlays") {
  if (bet.betType !== "sgp" && bet.betType !== "parlay") return false;
}
```

#### Search Term
- **File:** `views/BetTableView.tsx:760-765`
- **Predicate:**
```typescript
(searchTerm === "" ||
  bet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  bet.name2?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  bet.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
  bet.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
  bet.tail?.toLowerCase().includes(searchTerm.toLowerCase()))
```

#### Tags/Flags (tail, isLive)
- **isLive:** Not directly filtered at view level
- **tail:** Included in search term filter (BetTableView)

---

## 4) Metric Definitions Catalog (Canonical vs Duplicated)

### Net / Profit

| Location | Formula | Status Inclusion |
|----------|---------|------------------|
| `utils/betCalculations.ts:28-36` (`calculateProfit`) | `odds > 0 ? stake * (odds/100) : stake / (abs(odds)/100)` | N/A (pure calculation) |
| `parsing/shared/finalRowValidators.ts:217-280` (`calculateFormattedNet`) | win: profit from odds/payout, loss: `-stake`, push: `0`, pending: empty | Handles all statuses |
| `parsing/shared/betToFinalRows.ts:641-685` (`computeNetNumeric`) | Same formula as finalRowValidators | Handles all statuses |
| **Inline (all views):** | `bet.payout - bet.stake` | win/loss/push only (pending returns 0) |

**Difference:** Inline calculations in views (`bet.payout - bet.stake`) do not distinguish pending bets - they return `0` for pending, while dedicated functions return `undefined` or empty string.

### Stake / Risk

| Location | Implementation |
|----------|----------------|
| All views | Direct read from `bet.stake` |

**No calculation needed** - stake is stored directly on the Bet object.

### To Win / Payout / Return

| Location | Formula |
|----------|---------|
| `parsing/shared/betToFinalRows.ts:605-632` (`calculateToWin`) | Uses `payout` if available, else `stake + profit` |
| `utils/betCalculations.ts:45-62` (`recalculatePayout`) | win: `stake + profit`, loss: `0`, push: `stake`, pending: `0` |

### ROI

| Location | Formula |
|----------|---------|
| `views/DashboardView.tsx:848-851` | `totalWagered > 0 ? (netProfit / totalWagered) * 100 : 0` |
| `views/DashboardView.tsx:329-330` | `stake > 0 ? (net / stake) * 100 : 0` |
| `views/DashboardView.tsx:970-971` | `stake > 0 ? (net / stake) * 100 : 0` |
| `views/SportsbookBreakdownView.tsx:180` | `totalWagered > 0 ? (netProfit / totalWagered) * 100 : 0` |
| `views/BySportView.tsx:448, 493` | `stake > 0 ? (net / stake) * 100 : 0` |
| `views/PlayerProfileView.tsx:417` | `totalWagered > 0 ? (netProfit / totalWagered) * 100 : 0` |

**All implementations are consistent:** ROI = (net / stake) * 100

### Win Rate / Hit Rate

| Location | Formula |
|----------|---------|
| `views/DashboardView.tsx:852-855` | `(wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0` |
| `views/SportsbookBreakdownView.tsx:181` | `(wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0` |
| `views/BySportView.tsx:447-448` | `(wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0` |
| `views/PlayerProfileView.tsx:418` | `(wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0` |

**All implementations are consistent:** Win% = (wins / (wins + losses)) * 100

### Units (if used)

**Not found.** Units are not used in this codebase.

### Exposure (if used)

**Not found.** Exposure calculations are not implemented.

### Counts: bets, wins, losses, pushes, voids, pending

| Location | Implementation |
|----------|----------------|
| All views | `filteredBets.length` for total |
| All views | `bet.result === 'win'` / `'loss'` / `'push'` / `'pending'` filtered counts |

**Note:** `void` status is **not supported** - the `BetResult` type in `types.ts:1` defines only four values: `"win" | "loss" | "push" | "pending"` (see `export type BetResult = "win" | "loss" | "push" | "pending";`).

---

## 5) Parlay / Multi-leg Handling (If Applicable)

### How Bets Are Represented for Parlays

- **File:** `types.ts:95-118` (Bet interface)
- **Leg structure:** `legs?: BetLeg[]` (line 113)
- **BetType values:** `"single" | "parlay" | "sgp" | "sgp_plus" | "live" | "other"` (types.ts:38-44)

```typescript
// types.ts:59-93 - BetLeg interface
export interface BetLeg {
  entities?: string[];
  entityType?: "player" | "team" | "unknown";
  market: string;
  target?: number | string;
  ou?: "Over" | "Under";
  odds?: number;
  actual?: number | string;
  result?: LegResult | BetResult;
  isGroupLeg?: boolean;      // Marks SGP container within SGP+
  children?: BetLeg[];       // Nested legs for SGP+ inner SGP
}
```

### Parlay Detection Logic

- **File:** `parsing/shared/betToFinalRows.ts:289`
```typescript
const isParlay = hasLegs && expandedLegs.length > 1;
```

### Functions That Explode/Flatten Legs

- **File:** `parsing/shared/betToFinalRows.ts:269-286`
```typescript
// Drop placeholder SGP container legs, then flatten group legs
const normalizedLegs = hasLegs
  ? bet.legs!.filter((leg) => {
      const market = (leg.market || "").toLowerCase();
      const isSgpPlaceholder = market.includes("same game parlay") && ...;
      return !isSgpPlaceholder;
    })
  : [];

const expandedLegs = normalizedLegs.flatMap((leg) => {
  if (leg.isGroupLeg) {
    return leg.children && leg.children.length ? leg.children : [];
  }
  return leg;
});
```

### Views Displaying Parlays

| View | Treatment |
|------|-----------|
| BetTableView | **Mixed:** Header row with expand/collapse + child rows per leg |
| DashboardView | **Ticket-level:** Aggregates at bet level (`bet.payout - bet.stake`) |
| Other views | **Ticket-level:** No leg-level breakdown |

### Parlay Row Metadata in FinalRow

- `_parlayGroupId`: Bet ID for grouping header + children
- `_legIndex`: 1-based leg index within parlay
- `_legCount`: Total legs in parlay
- `_isParlayHeader`: Boolean for header row
- `_isParlayChild`: Boolean for child rows

---

## 6) Time & Bucketing Rules

### Timestamp Field Used

- **Primary:** `bet.placedAt` (ISO timestamp)
- **Secondary (when available):** `bet.settledAt` (optional, not always populated)

### Timezone Handling

**No explicit timezone handling found.** Dates are processed as-is using JavaScript's `Date` constructor:

```typescript
// views/DashboardView.tsx:758
const betDate = new Date(bet.placedAt);
```

Custom date range inputs use UTC midnight:
```typescript
// views/DashboardView.tsx:738-741
const customStart = customDateRange.start
  ? new Date(`${customDateRange.start}T00:00:00.000Z`)
  : null;
```

### Daily/Weekly/Monthly Bucketing Logic

**Chart bucketing uses per-bet cumulative profit, not calendar periods:**

```typescript
// views/DashboardView.tsx:857-867
const sortedBets = [...filteredBets].sort(
  (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()
);
let cumulativeProfit = 0;
const profitOverTime = sortedBets.map((bet) => {
  cumulativeProfit += bet.payout - bet.stake;
  return {
    date: new Date(bet.placedAt).toLocaleDateString(),
    profit: cumulativeProfit,
  };
});
```

**Date formatting for charts:**
- Dashboard: `toLocaleDateString()` (locale-dependent format)
- SportsbookBreakdown: `toLocaleDateString('en-CA')` (YYYY-MM-DD format)
- BetTableView: `MM/DD` format (custom formatDate)

### Chart Adapters

**Recharts library is used directly** - no custom adapters for bucketing.

---

## 7) Caching / Memoization / Derived State

### useMemo Blocks Computing KPIs

| File | Line | Key Inputs | Dependencies | Risk |
|------|------|------------|--------------|------|
| `DashboardView.tsx` | 712 | `players` | `[players]` | Low |
| `DashboardView.tsx` | 716 | `teams` | `[teams]` | Low |
| `DashboardView.tsx` | 718 | `bets`, filters | `[bets, selectedMarketCategory, dateRange, customDateRange, betTypeFilter]` | Low |
| `DashboardView.tsx` | 784 | `bets`, `filteredBets`, `allPlayers`, `allTeams`, `entityType` | `[bets, filteredBets, allPlayers, allTeams, entityType]` | **Medium** - `bets` should not be in deps since `filteredBets` already derives from it |
| `BetTableView.tsx` | 534 | `bets` | `[bets]` | Low |
| `BetTableView.tsx` | 750 | `flattenedBets`, `filters`, `searchTerm` | `[flattenedBets, filters, searchTerm]` | Low |
| `BetTableView.tsx` | 768 | `filteredBets`, `sortConfig` | `[filteredBets, sortConfig]` | Low |
| `BetTableView.tsx` | 795 | `sortedBets`, `expandedParlays` | `[sortedBets, expandedParlays]` | Low |
| `BetTableView.tsx` | 811 | `visibleBets`, `expandedParlays` | `[visibleBets, expandedParlays]` | Low |

### Stored Derived Results

**Parlay expansion state is persisted:**
```typescript
// views/BetTableView.tsx:495-511
const [expandedParlays, setExpandedParlays] = useState<Set<string>>(() => {
  const saved = localStorage.getItem("bettracker-expanded-parlays");
  return saved ? new Set(JSON.parse(saved)) : new Set();
});

useEffect(() => {
  localStorage.setItem("bettracker-expanded-parlays", JSON.stringify(Array.from(expandedParlays)));
}, [expandedParlays]);
```

### Computed Once at Hydration

| Location | Computation |
|----------|-------------|
| `services/persistence.ts:143-207` | `migrateIfNeeded()` - legacy format migration |
| `utils/migrations.ts:49-78` | `migrateBets()` - bet field migration (legs, isLive, marketCategory) |

### Potential Staleness Risks

1. **DashboardView processedData deps:** includes `bets` unnecessarily at line 1006 (`[bets, filteredBets, allPlayers, allTeams, entityType]`) - `filteredBets` already depends on `bets`
2. **No debouncing on search:** `searchTerm` filter triggers recomputation on every keystroke

---

## 8) View-by-View Wiring Map

### DashboardView (`views/DashboardView.tsx`)

```
DashboardView
  ├── useBets() → { bets, loading }
  ├── useInputs() → { players, teams, categories }
  │
  ├── allPlayers = useMemo(() => Set(Object.values(players).flat()), [players])
  ├── allTeams = useMemo(() => Set(Object.values(teams).flat()), [teams])
  │
  ├── filteredBets = useMemo(filter by marketCategory, dateRange, betTypeFilter)
  │
  ├── processedData = useMemo() → {
  │     profitByBook, profitOverTime, marketCategoryStats,
  │     playerTeamStats, tailStats, sportStats, quickNetStats, overallStats
  │   }
  │
  ├── KPIs Displayed:
  │     - Net Profit, Total Wagered, Total Bets, Win Rate, ROI
  │     - Quick stats: net1d, net3d, net1w, net1m, net1y
  │
  └── Sub-components:
        ├── OverUnderBreakdown(bets) → internal useMemo for O/U stats
        └── LiveVsPreMatchBreakdown(bets) → internal useMemo for live/prematch stats
```

### BetTableView (`views/BetTableView.tsx`)

```
BetTableView
  ├── useBets() → { bets, loading, updateBet }
  ├── useInputs() → { sportsbooks, sports, categories, betTypes, players, teams, add* }
  │
  ├── flattenedBets = useMemo(() => {
  │     bets.forEach(bet => {
  │       betToFinalRows(bet) → FinalRow[]
  │       → convert to FlatBet[]
  │     })
  │   }, [bets])
  │
  ├── filteredBets = useMemo(filter by sport, type, result, category, searchTerm)
  ├── sortedBets = useMemo(sort by sortConfig)
  ├── visibleBets = useMemo(filter out collapsed parlay children)
  │
  ├── Transforms Used:
  │     - betToFinalRows (parsing/shared/betToFinalRows.ts)
  │     - abbreviateMarket (services/marketClassification.ts)
  │     - normalizeCategoryForDisplay (services/marketClassification.ts)
  │
  ├── KPIs Displayed: None (raw data table)
  │
  └── Inline Computations:
        - formatDate(isoString) → MM/DD
        - formatOdds(odds) → +NNN/-NNN
```

### SportsbookBreakdownView (`views/SportsbookBreakdownView.tsx`)

```
SportsbookBreakdownView
  ├── useBets() → { bets, loading }
  │
  ├── availableBooks = useMemo(() => unique books from bets)
  ├── filteredBets = useMemo(filter by selectedBook, dateRange)
  │
  ├── processedData = useMemo() → {
  │     stats (totalBets, totalWagered, netProfit, wins, losses, winRate, roi),
  │     profitOverTime, profitBySportData
  │   }
  │
  └── KPIs Displayed:
        Net Profit, Total Wagered, Total Bets, Win Rate, ROI
```

### BySportView (`views/BySportView.tsx`)

```
BySportView
  ├── useBets() → { bets, loading }
  ├── useInputs() → { sports, players, teams }
  │
  ├── allPlayers = useMemo(() => Set(Object.values(players).flat()))
  ├── allTeams = useMemo(() => Set(Object.values(teams).flat()))
  ├── availableSports = useMemo(() => unique sports from bets)
  │
  ├── filteredBets = useMemo(filter by selectedSport, dateRange)
  │
  ├── processedData = useMemo() → {
  │     overallStats, profitOverTime, playerTeamStats,
  │     marketStats, tailStats
  │   }
  │
  └── KPIs Displayed:
        Net Profit, Total Wagered, Total Bets, Win Rate,
        Market performance table, Player/Team performance table
```

### PlayerProfileView (`views/PlayerProfileView.tsx`)

```
PlayerProfileView
  ├── useBets() → { bets, loading }
  ├── useInputs() → { players }
  │
  ├── allPlayers = useMemo(() => unique players from all sports)
  ├── filteredPlayers = useMemo(filter by searchTerm)
  │
  ├── playerBets = useMemo(
  │     filter by selectedPlayer, dateRange, betTypeFilter,
  │     using leg.entities?.includes(selectedPlayer)
  │   )
  │
  ├── processedData = useMemo() → {
  │     overallStats, profitOverTime, marketStats, recentBets
  │   }
  │
  └── KPIs Displayed:
        Net Profit, Total Wagered, Total Bets, Win/Loss/Push record,
        Win Rate, ROI, Market performance table
```

---

## 9) Quick Duplication & Divergence Flags (Evidence Only)

### Metrics Computed in >1 Location

| Metric | Locations |
|--------|-----------|
| **Net profit** | `utils/betCalculations.ts:28-36`, `parsing/shared/betToFinalRows.ts:641-685`, `parsing/shared/finalRowValidators.ts:217-280`, inline in all views (`bet.payout - bet.stake`) |
| **ROI** | `DashboardView.tsx:848-851`, `DashboardView.tsx:329-330`, `DashboardView.tsx:970-971`, `SportsbookBreakdownView.tsx:180`, `BySportView.tsx:448,493`, `PlayerProfileView.tsx:417` |
| **Win rate** | `DashboardView.tsx:852-855`, `SportsbookBreakdownView.tsx:181`, `BySportView.tsx:447-448`, `PlayerProfileView.tsx:418` |
| **calculateRoi helper** | Defined inline in multiple views: `DashboardView.tsx:329`, `DashboardView.tsx:970`, `BySportView.tsx:214,300,493` |

### Filters Applied in >1 Location

| Filter Type | Locations |
|-------------|-----------|
| **Date range filtering** | `DashboardView.tsx:736-779`, `SportsbookBreakdownView.tsx:102-145`, `BySportView.tsx:407-430`, `PlayerProfileView.tsx:358-385` |
| **betType filter** | `DashboardView.tsx:719-727`, `PlayerProfileView.tsx:392-404` |
| **marketCategory filter** | `DashboardView.tsx:728-733`, `BetTableView.tsx:759` |

### Bucketing Implemented in >1 Location

| Bucketing Logic | Locations |
|-----------------|-----------|
| **Cumulative profit over time** | `DashboardView.tsx:857-867`, `SportsbookBreakdownView.tsx:151-157`, `BySportView.tsx:451-455`, `PlayerProfileView.tsx:421-425` |

### Formatting Logic Duplicated in >1 Location

| Formatting | Locations |
|------------|-----------|
| **Date formatting** | `BetTableView.tsx:83-90` (MM/DD), `parsing/shared/betToFinalRows.ts:719-733` (MM/DD/YY) |
| **toLocaleDateString for charts** | `DashboardView.tsx:864`, `BySportView.tsx:454`, `PlayerProfileView.tsx:424` (default locale), `SportsbookBreakdownView.tsx:156` (en-CA locale) |
| **Stats aggregation helper (addToMap)** | `DashboardView.tsx:922-938`, `BySportView.tsx:461-469` |

---

*End of Display System Evidence Pack v1*
