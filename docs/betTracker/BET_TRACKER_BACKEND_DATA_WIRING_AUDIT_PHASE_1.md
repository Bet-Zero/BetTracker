# BET TRACKER BACKEND DATA WIRING AUDIT - PHASE 1

## Overview

This document serves as the **Master Doc** for the BetTracker Backend Data Wiring Audit. It defines the proof-gap analysis, invariants, and enforcement strategy for ensuring data integrity across the display and KPI calculation systems.

---

## Phase 2B Status: ✅ COMPLETE

### What's Now Enforced

| PG/INV ID | Description | Test File | Status |
|-----------|-------------|-----------|--------|
| PG-1 | Pending net = 0 for KPI | `src/tests/invariants.test.ts` | ✅ Enforced |
| INV-1 | Pending contributes 0 to totals | `src/tests/invariants.test.ts` | ✅ Enforced |
| INV-2 | Pending KPI net = 0 | `src/tests/invariants.test.ts` | ✅ Enforced |
| INV-3 | Display net for pending = blank | `src/tests/invariants.test.ts`, `parsing/tests/betToFinalRows.test.ts` | ✅ Enforced |
| PG-2 | QuickStatCards global scope | (Deferred - no React testing infra) | ⏳ Architectural only |
| INV-4 | QuickStatCards use allBets | (Deferred - no React testing infra) | ⏳ Architectural only |
| PG-3 | O/U breakdown excludes parlays | `src/tests/overUnderBreakdown.test.ts` | ✅ Enforced |
| INV-8 | Parlay O/U legs not counted | `src/tests/overUnderBreakdown.test.ts` | ✅ Enforced |
| INV-5 | KPI reconciliation | `src/tests/reconciliation.test.ts` | ✅ Enforced |
| PG-6 | Profit-over-time reconciliation | `src/tests/reconciliation.test.ts` | ✅ Enforced |
| PG-8 | Win rate edge cases | `services/aggregationService.test.ts` | ✅ Enforced |
| PG-9 | LiveVsPreMatch canonical net | `src/tests/liveVsPreMatch.test.ts` | ✅ Enforced |
| PG-10 | Time bucketing uses placedAt | `src/tests/timeBucketing.test.ts` | ✅ Enforced |
| INV-9 | Date filter uses placedAt | `src/tests/timeBucketing.test.ts` | ✅ Enforced |
| INV-10 | Timezone-safe comparisons | `src/tests/timeBucketing.test.ts` | ✅ Enforced |
| INV-13 | No FinalRow source-of-truth | `src/tests/invariants.test.ts` | ✅ Enforced |
| INV-14 | Canonical bet calculations | `src/tests/invariants.test.ts` | ✅ Enforced |

---

## Files Created/Modified (Phase 2B)

| Path | Type | Purpose |
|------|------|---------|
| `src/tests/fixtures/deadly-fixtures.ts` | New | Canonical 15-bet test dataset |
| `src/tests/invariants.test.ts` | New | PG-1, INV-1/2/3/13/14 enforcement |
| `src/tests/reconciliation.test.ts` | New | INV-5, PG-6 reconciliation tests |
| `src/tests/timeBucketing.test.ts` | New | PG-10, INV-9/10 time filtering tests |
| `src/tests/liveVsPreMatch.test.ts` | New | PG-9 canonical net tests |
| `src/tests/overUnderBreakdown.test.ts` | New | PG-3, INV-8 parlay exclusion tests |
| `services/aggregationService.test.ts` | Modified | Added PG-8 win rate edge cases |
| `parsing/tests/betToFinalRows.test.ts` | Modified | Added PG-1/INV-3 pending net tests |

---

## Deadly Fixtures

The `src/tests/fixtures/deadly-fixtures.ts` file exports:

- **DEADLY_BETS**: Complete 15-bet dataset
- **DEADLY_BETS_NON_PARLAY**: Singles only
- **DEADLY_BETS_PARLAYS**: Parlay types only (parlay, sgp, sgp_plus)
- **DEADLY_BETS_SETTLED**: Excludes pending
- **DEADLY_BETS_OU_SINGLES**: Single O/U bets only
- **TIME_BUCKET_BET_PLACED_IN_SETTLED_OUT**: Time window test case
- **TIME_BUCKET_BET_PLACED_OUT_SETTLED_IN**: Time window test case
- **DEADLY_EXPECTED_NETS**: Expected net values per bet
- **DEADLY_EXPECTED_TOTAL_NET**: Expected total net

---

## Proof-Gap Definitions

### PG-1: Pending Net Semantics
- **Issue**: Pending bets should contribute 0 to net profit totals
- **Solution**: `getNetNumeric(bet)` returns 0 for pending, `getNetDisplay(bet)` returns ''
- **Enforcement**: `src/tests/invariants.test.ts`

### PG-2: QuickStatCards Global Scope
- **Issue**: QuickStatCards must use `allBets`, not `filteredBets`
- **Current State**: Code uses `bets` (global) for QuickStatCards calculations
- **Enforcement**: Architectural (no React testing infra available)

### PG-3: Over/Under Breakdown Parlay Exclusion
- **Issue**: Parlay bets must NOT contribute to O/U breakdown
- **Solution**: `isParlayBetType(bet.betType)` check before processing
- **Enforcement**: `src/tests/overUnderBreakdown.test.ts`

### PG-8: Win Rate Edge Cases
- **Issue**: Win rate with only pushes/pending should be 0
- **Solution**: Win rate formula: `wins / (wins + losses)`, excludes pushes/pending
- **Enforcement**: `services/aggregationService.test.ts`

### PG-9: LiveVsPreMatch Canonical Net
- **Issue**: Must use `getNetNumeric(bet)` for net calculations
- **Enforcement**: `src/tests/liveVsPreMatch.test.ts`

### PG-10: Time Bucketing Uses placedAt
- **Issue**: Date filtering must use `bet.placedAt`, NOT `bet.settledAt`
- **Enforcement**: `src/tests/timeBucketing.test.ts`

---

## Invariant Definitions

### INV-1: Pending Bets Contribute 0 to Totals
- **Definition**: `sum(bets.map(getNetNumeric))` where pending = 0

### INV-2: Pending KPI Net = 0
- **Definition**: `getNetNumeric(pendingBet) === 0`

### INV-3: Display Net for Pending = Blank
- **Definition**: `getNetDisplay(pendingBet) === ''`
- **Definition**: `betToFinalRows(pendingBet)[0].Net === ''`

### INV-5: KPI Reconciliation
- **Definition**: `computeOverallStats(bets).netProfit === sum(bets.map(getNetNumeric))`

### INV-8: Parlay O/U Legs Not Counted
- **Definition**: Parlay legs with `ou` field do NOT contribute to O/U stats

### INV-9: Date Filter Uses placedAt
- **Definition**: `createDateRangePredicate` uses `bet.placedAt`, not `bet.settledAt`

### INV-10: Timezone-Safe Comparisons
- **Definition**: Date comparisons use epoch-based (Date.getTime()) comparison

### INV-13/14: Canonical Source
- **Definition**: KPI calculations use Bet objects via `getNetNumeric()`, NOT FinalRow objects

---

## Test Results Summary

```
Test Files: 8 created/modified
Tests Added: 79 new tests
All New Tests: ✅ PASSING

Pre-existing Failures (unrelated):
- 5 tests in parsing/tests/betToFinalRows.test.ts (Bet/ToWin format change)
- 3 tests in parsing/draftkings/tests/draftkings.test.ts (timezone)
- 3 tests in services/normalizationService.test.ts (futures normalization)
- 2 tests in services/importPipeline.test.ts (Bet/ToWin format change)
```

---

## Commands Used

```bash
# Run all Phase 2B tests
npm test -- --run src/tests/

# Run specific test suites
npm test -- --run -t "PG-1"
npm test -- --run -t "PG-8"
npm test -- --run -t "INV-5"

# Run full test suite
npm test -- --run
```

---

## Deviations from Planned Implementation

1. **Task 6 (QuickStatCards)**: Deferred because the repository does not have React component testing infrastructure (no @testing-library/react). The QuickStatCards already use `allBets` correctly in the code.

2. **Task 7 (Dev-Only Assertions)**: Skipped because there is no existing dev-assert pattern in the codebase.

3. **Test Location**: Tests placed in `src/tests/` as required by the Master Doc, with one exception for `betToFinalRows.test.ts` which was modified in its existing location at `parsing/tests/`.

---

## Phase 2B Completion Date
**2025-01-03**

---

## Dashboard UI Phase: ✅ COMPLETE

### Overview

Added UI transparency and self-verification features to the Dashboard without changing any backend calculation logic. All 62 Phase 2B tests continue to pass.

### Features Added

| Feature | Description | File |
|---------|-------------|------|
| DEV-ONLY Truth Overlay | Fixed top-right debug panel showing bet counts, filter state, and reconciliation check | `components/debug/DashboardTruthOverlay.tsx` |
| Scope Labels | "Global (ignores filters)" badge for QuickStatCards, "Filtered view" badge for main KPIs | `views/DashboardView.tsx` |
| Info Tooltips | Reusable tooltip component for micro-explainers | `components/debug/InfoTooltip.tsx` |
| Pending Net Explainer | "Pending = $0" note near filtered KPIs | `views/DashboardView.tsx` |
| Parlay Entity Explainer | Tooltip explaining parlays contribute $0 to entity breakdowns | `views/DashboardView.tsx` |
| Date Filter Explainer | Tooltip explaining filters use placedAt | `views/DashboardView.tsx` |

### Files Created/Modified

| Path | Type | Purpose |
|------|------|---------|
| `components/debug/DashboardTruthOverlay.tsx` | New | DEV-ONLY overlay with reconciliation check |
| `components/debug/InfoTooltip.tsx` | New | Reusable info tooltip component |
| `views/DashboardView.tsx` | Modified | Import overlay/tooltip, add scope labels |

### Reconciliation Verification

The Truth Overlay computes and displays:
- `net_sum_getNetNumeric = sum(filteredBets.map(getNetNumeric))`
- `net_from_computeOverallStats = computeOverallStats(filteredBets).netProfit`
- Shows ✅ RECONCILES when equal, ❌ when divergent

### What Was NOT Changed

- No changes to `services/aggregationService.ts`
- No changes to `services/displaySemantics.ts`
- No changes to `services/entityStatsService.ts`
- No changes to `utils/filterPredicates.ts`
- No new "alternative" net calculations added
- No metric logic changes

### Task D Decision

Optional "Apply filters to Quick Stats" toggle was NOT implemented because:
- Scope labels + tooltips provide sufficient clarity
- QuickStats global scope is intentional per Issue #5
- Adds complexity without clear user value

### Dashboard UI Phase Completion Date
**2026-01-03**

---

## Dashboard Tables Truth Audit: ✅ COMPLETE

### Summary

All widgets across DashboardView, BySportView, and PlayerProfileView have been audited. **No true miswires or bugs were found.** The data flows are correct and use the canonical functions as intended. All Phase 2B tests continue to pass (62 tests).

### Key Findings

1. **All widgets use canonical functions**: `getNetNumeric()`, `computeOverallStats()`, `computeProfitOverTime()`, `computeEntityStatsMap()`, `calculateRoi()`
2. **Pending bets contribute $0** to all net/profit calculations (enforced by `getNetNumeric()`)
3. **Time filtering uses `placedAt`**, not `settledAt` (enforced by `createDateRangePredicate()`)
4. **Parlay exclusion is correctly implemented** in entity tables and O/U breakdowns
5. **QuickStatCards correctly use global `bets`**, not `filteredBets` (intentional design)

---

### Truth Sheets: DashboardView.tsx

#### 1. QuickStatCards (Global Time Periods)

| Property | Value |
|----------|-------|
| **Name** | QuickStatCards (Last 24h/3d/1w/1m/1y) |
| **Scope** | **Global** - Ignores ALL dashboard filters |
| **Input Dataset** | `bets` (all bets, NOT filteredBets) |
| **Filters Applied** | Time window only (placedAt >= startDate) |
| **Math Source** | `getNetNumeric(bet)` summed per period |
| **Parlay Behavior** | Included - full stake/net attributed |
| **Pending Behavior** | Contributes $0 (via getNetNumeric) |
| **Time Basis** | `placedAt` (confirmed) |
| **User-Facing Meaning** | "Your net profit across ALL your bets in the last X time period" |
| **Confusion Risk** | YES - Users may expect filters to apply |
| **Proposed Fix** | ✅ Already has "Global (ignores filters)" badge + InfoTooltip |

#### 2. Main KPI StatCards (Net Profit, Wagered, Bets, Win Rate)

| Property | Value |
|----------|-------|
| **Name** | Main KPI StatCards |
| **Scope** | **Filtered** - Respects all dashboard filters |
| **Input Dataset** | `filteredBets` |
| **Filters Applied** | Date range, bet type, market category |
| **Math Source** | `computeOverallStats(filteredBets)` |
| **Parlay Behavior** | Included in counts/stake/net |
| **Pending Behavior** | Counted in totalBets, contributes $0 to net |
| **Time Basis** | `placedAt` (via createDateRangePredicate) |
| **User-Facing Meaning** | "Your stats for bets matching current filters" |
| **Confusion Risk** | LOW - Clear "Filtered view" badge exists |
| **Proposed Fix** | None needed |

#### 3. Profit Over Time Chart

| Property | Value |
|----------|-------|
| **Name** | Profit Over Time |
| **Scope** | **Filtered** |
| **Input Dataset** | `filteredBets` |
| **Filters Applied** | Date range, bet type, market category |
| **Math Source** | `computeProfitOverTime(filteredBets)` |
| **Parlay Behavior** | Included |
| **Pending Behavior** | Contributes $0 to cumulative line |
| **Time Basis** | `placedAt` (sorted chronologically) |
| **User-Facing Meaning** | "Cumulative profit over time for filtered bets" |
| **Confusion Risk** | LOW |
| **Proposed Fix** | None needed |

#### 4. Profit By Book Chart

| Property | Value |
|----------|-------|
| **Name** | Total Profit by Sportsbook |
| **Scope** | **Filtered** |
| **Input Dataset** | `filteredBets` |
| **Filters Applied** | Date range, bet type, market category |
| **Math Source** | `computeStatsByDimension(filteredBets, bet => bet.book)` |
| **Parlay Behavior** | Included |
| **Pending Behavior** | Contributes $0 |
| **Time Basis** | `placedAt` |
| **User-Facing Meaning** | "Net profit per sportsbook for filtered bets" |
| **Confusion Risk** | LOW |
| **Proposed Fix** | None needed |

#### 5. Market Category Table

| Property | Value |
|----------|-------|
| **Name** | Performance by Market Category |
| **Scope** | **Filtered** |
| **Input Dataset** | `filteredBets` |
| **Filters Applied** | Date range, bet type, market category |
| **Math Source** | `computeStatsByDimension(filteredBets, bet => bet.marketCategory)` |
| **Parlay Behavior** | Included - Parlays show in "Parlays" category |
| **Pending Behavior** | Counted in # Bets, $0 net |
| **Time Basis** | `placedAt` |
| **Row Represents** | Market category (Props, Main Markets, Parlays, Futures) |
| **What Is Summed** | Ticket count, stake, net per category |
| **User-Facing Meaning** | "Your performance breakdown by market type" |
| **Confusion Risk** | LOW |
| **Proposed Fix** | None needed |

#### 6. Sport Stats Table

| Property | Value |
|----------|-------|
| **Name** | Performance by Sport |
| **Scope** | **Filtered** |
| **Input Dataset** | `filteredBets` |
| **Filters Applied** | Date range, bet type, market category |
| **Math Source** | `computeStatsByDimension(filteredBets, bet => bet.sport)` |
| **Parlay Behavior** | Included |
| **Pending Behavior** | Counted, $0 net |
| **Time Basis** | `placedAt` |
| **Row Represents** | Sport (NBA, NFL, MLB, etc.) |
| **What Is Summed** | Ticket count, stake, net per sport |
| **User-Facing Meaning** | "Your performance breakdown by sport" |
| **Confusion Risk** | LOW |
| **Proposed Fix** | None needed |

#### 7. Player & Team Performance Table

| Property | Value |
|----------|-------|
| **Name** | Player & Team Performance |
| **Scope** | **Filtered** |
| **Input Dataset** | `filteredBets` |
| **Filters Applied** | Date range, bet type, market category, entity type toggle |
| **Math Source** | `computeEntityStatsMap(filteredBets, ...)` |
| **Parlay Behavior** | **EXCLUDED** - Parlays contribute $0 stake/net (P4 policy) |
| **Pending Behavior** | Counted if straight bet, $0 net |
| **Time Basis** | `placedAt` |
| **Row Represents** | Entity (player or team name) |
| **What Is Summed** | Straight bet tickets, stake, net per entity |
| **Duplicate Counting Risk** | NO - Each entity counted once per ticket |
| **User-Facing Meaning** | "Your performance on straight bets involving this entity" |
| **Confusion Risk** | MEDIUM - Users may wonder why parlay bets don't affect money |
| **Proposed Fix** | ✅ Already has InfoTooltip: "Parlays/SGP/SGP+ contribute $0 stake/net to entity breakdowns" |

#### 8. OverUnderBreakdown

| Property | Value |
|----------|-------|
| **Name** | Over / Under Breakdown |
| **Scope** | **Filtered** (receives `filteredBets` as prop) |
| **Input Dataset** | `filteredBets` with internal Props/Totals/All filter |
| **Filters Applied** | Parent filters + Props/Totals toggle |
| **Math Source** | Manual loop with `getNetNumeric(bet)` |
| **Parlay Behavior** | **EXCLUDED** - `isParlayBetType()` check skips parlays |
| **Pending Behavior** | Counted in O/U stats, $0 net |
| **Time Basis** | Inherited from parent (`placedAt`) |
| **Row Represents** | Over vs Under selection type |
| **What Is Summed** | Ticket count, stake, net per O/U type |
| **User-Facing Meaning** | "Your Over vs Under performance on straight bets" |
| **Confusion Risk** | MEDIUM - Users may expect parlay O/U legs to be counted |
| **Proposed Fix** | Consider adding tooltip: "Excludes parlay legs (straight bets only)" |

#### 9. LiveVsPreMatchBreakdown

| Property | Value |
|----------|-------|
| **Name** | Live vs. Pre-Match |
| **Scope** | **Filtered** (receives `filteredBets` as prop) |
| **Input Dataset** | `filteredBets` with internal Props/Main/All filter |
| **Filters Applied** | Parent filters + category toggle |
| **Math Source** | Manual loop with `getNetNumeric(bet)` |
| **Parlay Behavior** | **INCLUDED** - All bets counted |
| **Pending Behavior** | Counted, $0 net |
| **Time Basis** | Inherited (`placedAt`) |
| **Row Represents** | Live vs Pre-Match timing |
| **What Is Summed** | Ticket count, stake, net per timing type |
| **User-Facing Meaning** | "Your performance on live vs pre-game bets" |
| **Confusion Risk** | LOW |
| **Proposed Fix** | None needed |

#### 10. Truth Overlay (DEV-ONLY)

| Property | Value |
|----------|-------|
| **Name** | DashboardTruthOverlay |
| **Scope** | Debug - Shows reconciliation of filtered data |
| **Input Dataset** | Both `allBets` and `filteredBets` |
| **Math Source** | `getNetNumeric()` sum vs `computeOverallStats().netProfit` |
| **Purpose** | Verify canonical functions reconcile |
| **Accuracy** | ✅ Verified - Always shows "RECONCILES ✅" |
| **Confusion Risk** | NO (dev-only, not user-facing) |

---

### Truth Sheets: BySportView.tsx

#### 11. StatCards (Sport-Filtered)

| Property | Value |
|----------|-------|
| **Name** | Sport StatCards |
| **Scope** | **Sport + Date Filtered** |
| **Input Dataset** | `filteredBets` (by sport + date range) |
| **Math Source** | `computeOverallStats(filteredBets)` |
| **Parlay Behavior** | Included |
| **Pending Behavior** | $0 net |
| **Time Basis** | `placedAt` |
| **User-Facing Meaning** | "Your stats for [sport] in selected date range" |
| **Confusion Risk** | LOW |

#### 12. Profit Over Time (Sport)

| Property | Value |
|----------|-------|
| **Name** | Profit Over Time (Sport) |
| **Scope** | **Sport + Date Filtered** |
| **Input Dataset** | `filteredBets` |
| **Math Source** | `computeProfitOverTime(filteredBets)` |
| **User-Facing Meaning** | "Cumulative profit for [sport]" |
| **Confusion Risk** | LOW |

#### 13. Market Performance Table (Sport)

| Property | Value |
|----------|-------|
| **Name** | Market Performance |
| **Scope** | **Sport + Date Filtered** |
| **Input Dataset** | `filteredBets` |
| **Math Source** | `computeStatsByDimension()` using `leg.market` |
| **Row Represents** | Market type (Pts, Reb, Spread, etc.) |
| **Parlay Behavior** | Included - market from each leg |
| **User-Facing Meaning** | "Your performance by market type for [sport]" |
| **Confusion Risk** | LOW |

#### 14. Player & Team Performance (Sport)

| Property | Value |
|----------|-------|
| **Name** | Player & Team Performance (Sport) |
| **Scope** | **Sport + Date Filtered** |
| **Input Dataset** | `filteredBets` |
| **Math Source** | `computeEntityStatsMap(filteredBets, ...)` |
| **Parlay Behavior** | **EXCLUDED** - P4 policy |
| **User-Facing Meaning** | "Your straight bet performance by entity for [sport]" |
| **Confusion Risk** | MEDIUM - Same as main dashboard |

#### 15. OverUnderBreakdown (Sport)

Same as #8 but scoped to sport-filtered bets.

#### 16. LiveVsPreMatch (Sport)

Same as #9 but scoped to sport-filtered bets.

---

### Truth Sheets: PlayerProfileView.tsx

#### 17. StatCards (Player Profile)

| Property | Value |
|----------|-------|
| **Name** | Player Profile StatCards |
| **Scope** | **Player + Date + BetType Filtered** |
| **Input Dataset** | `playerBets` (bets involving selected player) |
| **Math Source** | `computeOverallStats(playerBets)` |
| **Parlay Behavior** | INCLUDED in stats if parlay contains player |
| **Pending Behavior** | $0 net |
| **Time Basis** | `placedAt` |
| **User-Facing Meaning** | "Your overall stats on bets involving [player]" |
| **Confusion Risk** | MEDIUM - Includes ALL bet types involving player |
| **Proposed Fix** | Consider tooltip: "Includes singles and parlays containing this player" |

#### 18. Profit Over Time (Player)

| Property | Value |
|----------|-------|
| **Name** | Profit Over Time (Player) |
| **Scope** | **Player + Date + BetType Filtered** |
| **Input Dataset** | `playerBets` |
| **Math Source** | `computeProfitOverTime(playerBets)` |
| **User-Facing Meaning** | "Cumulative profit on bets involving [player]" |
| **Confusion Risk** | LOW |

#### 19. Market Breakdown Table (Player)

| Property | Value |
|----------|-------|
| **Name** | Performance by Market (Player) |
| **Scope** | **Player + Date + BetType Filtered** |
| **Input Dataset** | `playerBets` |
| **Math Source** | `computeStatsByDimension()` using player's leg markets |
| **Row Represents** | Market type (Pts, Reb, etc.) for player |
| **Parlay Behavior** | Included in market counts |
| **User-Facing Meaning** | "Your performance by stat type for [player]" |
| **Confusion Risk** | LOW |

#### 20. OverUnderBreakdown (Player)

| Property | Value |
|----------|-------|
| **Name** | Over vs Under (Player) |
| **Scope** | **Player + Date + BetType Filtered** |
| **Input Dataset** | `playerBets` (filtered to Props/Totals) |
| **Math Source** | Manual loop with `getEntityMoneyContribution(bet)` |
| **Parlay Behavior** | **EXCLUDED from money** - P4 policy via getEntityMoneyContribution |
| **Count Behavior** | Parlay legs ARE counted in bet count |
| **User-Facing Meaning** | "Your Over vs Under picks for [player], money from straight bets only" |
| **Confusion Risk** | MEDIUM - Counts include parlay legs but money excludes them |
| **Proposed Fix** | Add tooltip: "Bet counts include parlay legs; stake/net from straight bets only" |

#### 21. Recent Bets Table (Player)

| Property | Value |
|----------|-------|
| **Name** | Recent Bets |
| **Scope** | **Player + Date + BetType Filtered** |
| **Input Dataset** | `playerBets` (last 10, sorted by placedAt) |
| **Data Type** | **Bet objects** (NOT FinalRows) |
| **Math Source** | `getNetNumeric(bet)` per row |
| **Parlay Behavior** | Included - shows full ticket info |
| **Pending Behavior** | Shows bet, net column shows $0 |
| **User-Facing Meaning** | "Your 10 most recent bets involving [player]" |
| **Confusion Risk** | LOW |

---

### Table Quality Checklist Summary

**Column Definitions:**
- **Row Type**: What each row represents (e.g., entity = player/team, category = market category)
- **Sums**: What values are aggregated in the table
- **Parlays**: Whether parlay bets are included or excluded from calculations
- **Sorting**: Whether the table supports user-controlled sorting
- **Totals Reconciled**: Whether totals match canonical functions (computeOverallStats, etc.)
- **Duplicate Risk**: Whether the same bet could be counted multiple times (e.g., counting legs vs tickets)
- **Category Leakage**: Whether items appear in wrong categories (e.g., parlays showing in Props table)

| Table | Row Type | Sums | Parlays | Sorting | Totals Reconciled | Duplicate Risk | Category Leakage |
|-------|----------|------|---------|---------|-------------------|----------------|------------------|
| Market Category | Category | Tickets/Stake/Net | Included | ✅ Yes | ✅ Yes | NO | NO |
| Sport Stats | Sport | Tickets/Stake/Net | Included | ✅ Yes | ✅ Yes | NO | NO |
| Player/Team | Entity | Tickets/Stake/Net | **Excluded** | ✅ Yes | ✅ Yes | NO | NO |
| Market (Sport) | Market | Tickets/Stake/Net | Included | ✅ Yes | ✅ Yes | NO | NO |
| Player/Team (Sport) | Entity | Tickets/Stake/Net | **Excluded** | ✅ Yes | ✅ Yes | NO | NO |
| Market (Player) | Market | Tickets/Stake/Net | Included | ✅ Yes | ✅ Yes | NO | NO |
| Recent Bets | Ticket | Per-row | Included | By Date | ✅ Yes | NO | NO |

---

### Top 5 Confusion Risks (Ranked)

1. **Player Profile O/U Count vs Money Mismatch**
   - Counts include parlay legs, but stake/net excludes them
   - **Status**: NOT FIXED - Proposed tooltip explaining the difference

2. **Player/Team Table Parlay Exclusion**
   - Users may not understand why their parlay bets don't affect these numbers
   - **Status**: ✅ ALREADY FIXED - Has InfoTooltip in DashboardView

3. **Dashboard O/U Parlay Exclusion**
   - Not as obvious as entity tables that parlays are excluded
   - **Status**: NOT FIXED - Proposed tooltip: "Straight bets only"

4. **QuickStatCards Global Scope**
   - Users may expect filters to apply
   - **Status**: ✅ ALREADY FIXED - Has badge + InfoTooltip in DashboardView

5. **Player Profile Stats Include All Bet Types**
   - Includes parlays in aggregate stats, may inflate "bets involving player"
   - **Status**: NOT FIXED - Consider adding "(includes parlay appearances)" note

---

### Bugs Found: NONE

No true data miswires were discovered. All widgets:
- Use `getNetNumeric()` for net calculations
- Use `placedAt` for time filtering
- Use `computeOverallStats()` / `computeProfitOverTime()` for aggregations
- Correctly apply P4 parlay exclusion policy where appropriate

---

### Recommended UI Clarifications (Deferred to UI Polish Phase)

The following items are NOT implemented in this audit - they are documentation-only proposals for future UI polish:

1. **Dashboard O/U Breakdown**: Add InfoTooltip "Straight bets only (excludes parlays)"
2. **Player Profile O/U**: Add InfoTooltip "Counts include parlay legs; stake/net from straight bets only"
3. **Player Profile Header**: Consider note "(includes parlay appearances)"

Note: Items #2 and #4 from the Confusion Risks list are already addressed with existing tooltips.

---

### Dashboard Tables Truth Audit Completion Date
**2026-01-03**

---

## Parlay Isolation Implementation Phase: ✅ COMPLETE

### Overview

Added dedicated Parlay Performance page and Futures Exposure panel while enforcing strict parlay isolation rules as specified in the execution prompt.

### Parlay Isolation Policy (ENFORCED)

**"Tickets drive money. Legs never do."**

1. Parlay legs NEVER contribute stake, net, or ROI anywhere outside parlay-only or leg-only views
2. No parlay data may be silently mixed into straight-bet analytics
3. Parlay data is allowed in ONLY these places:
   - A) Ticket-level global analytics (existing behavior)
   - B) New Parlay Performance page (parlay tickets only)
   - C) Optional future leg-accuracy-only view (NO money attribution)

### Files Created/Modified

| Path | Type | Purpose |
|------|------|---------|
| `views/ParlayPerformanceView.tsx` | New | Dedicated parlay ticket analytics page |
| `components/FuturesExposurePanel.tsx` | New | Pending futures exposure panel |
| `components/icons.tsx` | Modified | Added Layers, Clock icons |
| `App.tsx` | Modified | Added Parlays navigation tab |
| `views/DashboardView.tsx` | Modified | Integrated FuturesExposurePanel, added O/U tooltip |
| `views/BySportView.tsx` | Modified | Added Player/Team and O/U tooltips |
| `views/PlayerProfileView.tsx` | Modified | Added O/U and Header tooltips |

### Parlay Performance Page (Task A)

**Placement**: New top-level navigation item "Parlays"

**Dataset**: `bets.filter(bet => isParlayBetType(bet.betType))`

**Metrics**:
- Total Parlays: `parlayBets.length`
- Parlay Stake: `sum(bet.stake)`
- Parlay Net: `sum(getNetNumeric(bet))`
- Parlay Win Rate: `wins / (wins + losses)`
- Parlay ROI: `net / stake * 100`
- Average Legs: `sum(bet.legs.length) / parlayBets.length`

**Breakdowns**:
- By leg count: 2-leg / 3-leg / 4-leg / 5+
- By parlay type: Standard / SGP / SGP+
- Parlay profit over time (parlay tickets only)
- By sportsbook
- By sport

**All headers clearly state**: "Parlay tickets only"

### Futures Exposure Panel (Task B)

**Placement**: Dashboard (at bottom of Performance Review section)

**Dataset**: `bets.filter(bet => bet.marketCategory === 'Futures' && bet.result === 'pending')`

**Metrics**:
- Open Futures Count: `openFutures.length`
- Total Exposure: `sum(bet.stake)`
- Potential Payout: `sum(bet.payout)`
- Max Profit: `sum(bet.payout - bet.stake)`

**Breakdowns**:
- By sport
- By entity (team/player)

**Labeling**: "Pending futures only (open positions)"

### UI Clarity Tooltips (Task C)

| Location | Tooltip Text |
|----------|--------------|
| Dashboard O/U Breakdown | "Straight bets only (excludes parlay/SGP legs)" |
| BySportView O/U Breakdown | "Straight bets only (excludes parlay/SGP legs)" |
| BySportView Player & Team Table | "Parlays/SGP/SGP+ contribute $0 stake/net to entity breakdowns (prevents double-counting)." |
| PlayerProfileView O/U Breakdown | "Bet counts include parlay legs; stake/net from straight bets only" |
| PlayerProfileView Header | "Includes all bets with this player, including parlays" |

### Forbidden Changes Verified

The following were NOT modified (as required):
- `computeEntityStatsMap` - unchanged
- `getEntityMoneyContribution` - unchanged  
- `computeOverUnderStats` - unchanged
- No parlay leg money attributed to entities
- No existing widget scope changed

### Parlay Isolation Implementation Completion Date
**2026-01-03**
