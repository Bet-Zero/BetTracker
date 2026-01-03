# BET TRACKER DASHBOARD: PRODUCT/TRUTH REVIEW (Phase 1)

**MODE**: PREFLIGHT (Review-only; no code changes)  
**DATE**: 2026-01-03  
**MASTER DOC**: `docs/betTracker/BET_TRACKER_BACKEND_DATA_WIRING_AUDIT_PHASE_1.md`

---

## EXECUTIVE SUMMARY

This document provides a comprehensive product/truth review of all dashboard tables, charts, and breakdowns in the BetTracker application. The review evaluates whether widgets **make sense as products**, display the **right data**, avoid **misleading semantics**, and identifies **missing tables** that would materially improve the dashboard.

### Key Findings

1. **Wiring Correctness**: ✅ All widgets correctly use canonical functions (`getNetNumeric`, `computeOverallStats`, etc.)
2. **Product Truth/Clarity**: ⚠️ Several confusion risks identified, particularly around parlay exclusion policies
3. **Missing Tables**: ❌ Notable gaps in Parlay/SGP performance tracking and Futures exposure management

---

## SECTION 1 — INVENTORY

### Grouped by View

#### DashboardView.tsx (10 widgets)
1. QuickStatCards (Global Time Periods: 24h/3d/1w/1m/1y)
2. Main KPI StatCards (Net Profit, Wagered, Bets, Win Rate)
3. Profit Over Time Chart
4. Profit By Sportsbook Chart
5. Performance by Market Category Table
6. Performance by Sport Table
7. Player & Team Performance Table
8. Over/Under Breakdown
9. Live vs Pre-Match Breakdown
10. Performance by Tail Table (conditional)
11. DashboardTruthOverlay (DEV-ONLY)

#### BySportView.tsx (7 widgets)
12. Sport StatCards (Net Profit, Wagered, Bets, Win Rate)
13. Profit Over Time (Sport-filtered)
14. Market Performance Table
15. Player & Team Performance Table (Sport-filtered)
16. Over/Under Breakdown (Sport-filtered)
17. Live vs Pre-Match Breakdown (Sport-filtered)
18. Performance by Tail Table (Sport-filtered, conditional)

#### PlayerProfileView.tsx (6 widgets)
19. Player Profile StatCards
20. Profit Over Time (Player-filtered)
21. Over vs Under Breakdown (Player-filtered)
22. Performance by Market Table
23. Recent Bets Table

#### SportsbookBreakdownView.tsx (4 widgets)
24. Sportsbook StatCards
25. Profit Over Time (Book-filtered)
26. Net Profit by Sport Chart

#### BetTableView.tsx (1 widget)
27. Bet Table (Spreadsheet-style editable table)

---

## SECTION 2 — TRUTH SHEETS

### Widget #1: QuickStatCards (Global Time Periods)

| Property | Value |
|----------|-------|
| **Widget Name** | QuickStatCards |
| **Where it lives** | `views/DashboardView.tsx` lines 954-976 |
| **Row meaning** | Not a table; shows net profit totals for time periods |
| **What is counted** | All bets placed within each time window |
| **What is summed** | `getNetNumeric(bet)` for bets where `placedAt >= startDate` |
| **Parlay policy** | ✅ INCLUDED - Full stake/net attributed |
| **Pending policy** | ✅ Net = $0 (via `getNetNumeric`) |
| **Filter scope** | 🔵 **GLOBAL** - Ignores ALL dashboard filters |
| **Common user interpretation** | "My net profit in the last X period" |
| **Truth risk** | ⚠️ **MEDIUM** - Users may expect filters to apply |
| **Verdict** | ⚠️ Confusing but acceptable (has badge + tooltip) |
| **Fix type** | ✅ Already has "Global (ignores filters)" badge + InfoTooltip |

---

### Widget #2: Main KPI StatCards

| Property | Value |
|----------|-------|
| **Widget Name** | Main KPI StatCards (Net Profit, Wagered, Bets, Win Rate) |
| **Where it lives** | `views/DashboardView.tsx` lines 1155-1182 |
| **Row meaning** | Not a table; shows aggregate KPIs |
| **What is counted** | Ticket count (not leg count) |
| **What is summed** | `computeOverallStats(filteredBets)` → stake, net, wins, losses |
| **Parlay policy** | ✅ INCLUDED - Parlays count as single bets with full stake/net |
| **Pending policy** | ✅ Counted in totalBets, contributes $0 to net |
| **Filter scope** | 🟣 **FILTERED** - Respects date, category, bet type filters |
| **Common user interpretation** | "My stats for bets matching current filters" |
| **Truth risk** | ✅ **LOW** - Clear "Filtered view" badge exists |
| **Verdict** | ✅ Makes sense |
| **Fix type** | None needed |

---

### Widget #3: Profit Over Time Chart

| Property | Value |
|----------|-------|
| **Widget Name** | Profit Over Time |
| **Where it lives** | `views/DashboardView.tsx` lines 1184-1212 |
| **Row meaning** | Each point represents cumulative profit at a bet's `placedAt` |
| **What is counted** | Bets matching filters, sorted chronologically |
| **What is summed** | `computeProfitOverTime(filteredBets)` → cumulative `getNetNumeric()` |
| **Parlay policy** | ✅ INCLUDED |
| **Pending policy** | ✅ Contributes $0 to cumulative line |
| **Filter scope** | 🟣 **FILTERED** |
| **Common user interpretation** | "How my bankroll has changed over time" |
| **Truth risk** | ✅ **LOW** |
| **Verdict** | ✅ Makes sense |
| **Fix type** | None needed |

---

### Widget #4: Profit By Sportsbook Chart

| Property | Value |
|----------|-------|
| **Widget Name** | Total Profit by Sportsbook |
| **Where it lives** | `views/DashboardView.tsx` lines 1214-1243 |
| **Row meaning** | Each bar represents a sportsbook |
| **What is counted** | Ticket count per book |
| **What is summed** | `computeStatsByDimension(filteredBets, bet => bet.book)` → net per book |
| **Parlay policy** | ✅ INCLUDED |
| **Pending policy** | ✅ Contributes $0 |
| **Filter scope** | 🟣 **FILTERED** |
| **Common user interpretation** | "Which books am I profitable on?" |
| **Truth risk** | ✅ **LOW** |
| **Verdict** | ✅ Makes sense |
| **Fix type** | None needed |

---

### Widget #5: Performance by Market Category Table

| Property | Value |
|----------|-------|
| **Widget Name** | Performance by Market Category |
| **Where it lives** | `views/DashboardView.tsx` lines 1267-1271 |
| **Row meaning** | Each row = one market category (Props, Main Markets, Parlays, Futures) |
| **What is counted** | Ticket count per category |
| **What is summed** | `computeStatsByDimension(filteredBets, bet => bet.marketCategory)` |
| **Parlay policy** | ✅ INCLUDED - Parlays show in "Parlays" category row |
| **Pending policy** | ✅ Counted in # Bets, $0 net |
| **Filter scope** | 🟣 **FILTERED** |
| **Common user interpretation** | "My performance by market type" |
| **Truth risk** | ✅ **LOW** |
| **Verdict** | ✅ Makes sense |
| **Fix type** | None needed |

---

### Widget #6: Performance by Sport Table

| Property | Value |
|----------|-------|
| **Widget Name** | Performance by Sport |
| **Where it lives** | `views/DashboardView.tsx` lines 1272-1276 |
| **Row meaning** | Each row = one sport (NBA, NFL, MLB, etc.) |
| **What is counted** | Ticket count per sport |
| **What is summed** | `computeStatsByDimension(filteredBets, bet => bet.sport)` |
| **Parlay policy** | ✅ INCLUDED |
| **Pending policy** | ✅ Counted, $0 net |
| **Filter scope** | 🟣 **FILTERED** |
| **Common user interpretation** | "My performance by sport" |
| **Truth risk** | ✅ **LOW** |
| **Verdict** | ✅ Makes sense |
| **Fix type** | None needed |

---

### Widget #7: Player & Team Performance Table

| Property | Value |
|----------|-------|
| **Widget Name** | Player & Team Performance |
| **Where it lives** | `views/DashboardView.tsx` lines 1277-1298 |
| **Row meaning** | Each row = one entity (player or team aggregation key) |
| **What is counted** | **STRAIGHT BET tickets only** - not legs, not parlay appearances |
| **What is summed** | `computeEntityStatsMap()` → stake/net from non-parlays only |
| **Parlay policy** | ❌ **EXCLUDED** - Parlays contribute $0 stake/net (P4 policy) |
| **Pending policy** | ✅ Counted if straight bet, $0 net |
| **Filter scope** | 🟣 **FILTERED** + Entity type toggle (Player/Team/All) |
| **Common user interpretation** | "My performance betting on [player/team]" |
| **Truth risk** | ⚠️ **MEDIUM** - Users may wonder why parlay bets don't affect money |
| **Verdict** | ⚠️ Confusing but acceptable (has InfoTooltip) |
| **Fix type** | ✅ Already has InfoTooltip: "Parlays/SGP/SGP+ contribute $0..." |

**Detailed semantics note**: The `computeEntityStatsMap` function in `entityStatsService.ts` explicitly skips parlay bets (`isParlayBetType()` check on line 68). This prevents double-counting stake when a player appears in multiple parlay legs, but may confuse users who see a player in their bets but not in this table's money attribution.

---

### Widget #8: Over/Under Breakdown

| Property | Value |
|----------|-------|
| **Widget Name** | Over / Under |
| **Where it lives** | `views/DashboardView.tsx` lines 322-449 |
| **Row meaning** | Two categories: Over vs Under |
| **What is counted** | Bets with `leg.ou` set, one count per bet (not per leg) |
| **What is summed** | `computeOverUnderStats()` via `overUnderStatsService.ts` |
| **Parlay policy** | ❌ **EXCLUDED** - `isParlayBetType()` check skips parlays (PG-3/INV-8) |
| **Pending policy** | ✅ Counted in O/U stats, $0 net |
| **Filter scope** | 🟣 **FILTERED** + Internal Props/Totals/All toggle |
| **Common user interpretation** | "My Over vs Under performance" |
| **Truth risk** | ⚠️ **MEDIUM** - Users may expect parlay O/U legs to be counted |
| **Verdict** | ⚠️ Confusing but acceptable |
| **Fix type** | 📝 **RECOMMENDED**: Add tooltip: "Straight bets only (excludes parlays)" |

---

### Widget #9: Live vs Pre-Match Breakdown

| Property | Value |
|----------|-------|
| **Widget Name** | Live vs. Pre-Match |
| **Where it lives** | `views/DashboardView.tsx` lines 451-602 |
| **Row meaning** | Two categories: Live vs Pre-Match |
| **What is counted** | All bets based on `bet.isLive` flag |
| **What is summed** | Manual loop with `getNetNumeric(bet)` |
| **Parlay policy** | ✅ **INCLUDED** - All bets counted |
| **Pending policy** | ✅ Counted, $0 net |
| **Filter scope** | 🟣 **FILTERED** + Internal Props/Main/All toggle |
| **Common user interpretation** | "My performance on live vs pre-game bets" |
| **Truth risk** | ✅ **LOW** |
| **Verdict** | ✅ Makes sense |
| **Fix type** | None needed |

---

### Widget #10: Performance by Tail Table

| Property | Value |
|----------|-------|
| **Widget Name** | Performance by Tail |
| **Where it lives** | `views/DashboardView.tsx` lines 1303-1309 |
| **Row meaning** | Each row = one tail source (who the bet was followed from) |
| **What is counted** | Ticket count per tail |
| **What is summed** | `computeStatsByDimension(filteredBets, bet => bet.tail)` |
| **Parlay policy** | ✅ INCLUDED |
| **Pending policy** | ✅ Counted, $0 net |
| **Filter scope** | 🟣 **FILTERED** |
| **Common user interpretation** | "My performance following different touts/tipsters" |
| **Truth risk** | ✅ **LOW** |
| **Verdict** | ✅ Makes sense |
| **Fix type** | None needed |
| **Visibility** | ⚠️ Only shows if `tailStats.length > 0` |

---

### Widget #11: DashboardTruthOverlay (DEV-ONLY)

| Property | Value |
|----------|-------|
| **Widget Name** | DashboardTruthOverlay |
| **Where it lives** | `components/debug/DashboardTruthOverlay.tsx` |
| **Purpose** | Debug panel showing reconciliation of `getNetNumeric()` sum vs `computeOverallStats().netProfit` |
| **Visibility** | DEV-ONLY (not rendered in production) |
| **Truth risk** | N/A (debug tool) |
| **Verdict** | ✅ Valuable for development |

---

### Widget #12: Sport StatCards (BySportView)

| Property | Value |
|----------|-------|
| **Widget Name** | Sport StatCards |
| **Where it lives** | `views/BySportView.tsx` lines 951-978 |
| **Row meaning** | Not a table; shows aggregate KPIs for selected sport |
| **What is counted** | Bets for selected sport in date range |
| **What is summed** | `computeOverallStats(filteredBets)` |
| **Parlay policy** | ✅ INCLUDED |
| **Pending policy** | ✅ $0 net |
| **Filter scope** | 🟣 **SPORT + DATE FILTERED** |
| **Common user interpretation** | "My stats for [sport] in selected date range" |
| **Truth risk** | ✅ **LOW** |
| **Verdict** | ✅ Makes sense |
| **Fix type** | None needed |

---

### Widget #13: Profit Over Time (Sport)

| Property | Value |
|----------|-------|
| **Widget Name** | Profit Over Time (Sport-filtered) |
| **Where it lives** | `views/BySportView.tsx` lines 979-1007 |
| **Semantics** | Same as #3 but scoped to selected sport |
| **Verdict** | ✅ Makes sense |

---

### Widget #14: Market Performance Table (Sport)

| Property | Value |
|----------|-------|
| **Widget Name** | Market Performance |
| **Where it lives** | `views/BySportView.tsx` lines 1029-1033 |
| **Row meaning** | Each row = market type (Pts, Reb, Spread, etc.) |
| **What is counted** | Counts are derived from legs, but money is ticket-level |
| **What is summed** | `computeStatsByDimension()` using `leg.market` |
| **Parlay policy** | ✅ INCLUDED - market from each leg counted |
| **Truth risk** | ⚠️ **LOW** - Could be slightly inflated for multi-leg parlays with same market |
| **Verdict** | ✅ Makes sense |
| **Fix type** | None needed |

---

### Widget #15: Player & Team Performance (Sport)

| Property | Value |
|----------|-------|
| **Widget Name** | Player & Team Performance (Sport-filtered) |
| **Where it lives** | `views/BySportView.tsx` lines 1034-1047 |
| **Semantics** | Same as #7 but scoped to selected sport |
| **Parlay policy** | ❌ **EXCLUDED** - P4 policy |
| **Truth risk** | ⚠️ **MEDIUM** - Same as #7 |
| **Verdict** | ⚠️ Confusing but acceptable |
| **Fix type** | Consider adding InfoTooltip (matches Dashboard style) |

---

### Widget #16-18: Sport View Breakdowns

Same as Dashboard widgets #8, #9, #10 but scoped to selected sport.

---

### Widget #19: Player Profile StatCards

| Property | Value |
|----------|-------|
| **Widget Name** | Player Profile StatCards |
| **Where it lives** | `views/PlayerProfileView.tsx` lines 607-623 |
| **Row meaning** | Not a table; shows aggregate KPIs for selected player |
| **What is counted** | ALL bets containing the selected player (including parlays) |
| **What is summed** | `computeOverallStats(playerBets)` |
| **Parlay policy** | ✅ **INCLUDED** in stats if parlay contains player |
| **Pending policy** | ✅ $0 net |
| **Filter scope** | 🟣 **PLAYER + DATE + BETTYPE FILTERED** |
| **Common user interpretation** | "My overall stats on bets involving [player]" |
| **Truth risk** | ⚠️ **MEDIUM** - Includes ALL bet types involving player, may inflate totals |
| **Verdict** | ⚠️ Confusing but acceptable |
| **Fix type** | 📝 **RECOMMENDED**: Add "(includes parlay appearances)" note |

**Semantic clarification**: Unlike the Player/Team Performance table which excludes parlay money, the Player Profile **includes** parlay bets in the overall stats. This is intentional (shows all betting activity involving a player) but may confuse users expecting consistency.

---

### Widget #20: Profit Over Time (Player)

| Property | Value |
|----------|-------|
| **Widget Name** | Profit Over Time (Player-filtered) |
| **Where it lives** | `views/PlayerProfileView.tsx` lines 630-640 |
| **Semantics** | Same as #3 but scoped to bets involving selected player |
| **Parlay policy** | ✅ **INCLUDED** - All bets with player |
| **Verdict** | ✅ Makes sense |

---

### Widget #21: Over vs Under Breakdown (Player)

| Property | Value |
|----------|-------|
| **Widget Name** | Over vs. Under (Player-filtered) |
| **Where it lives** | `views/PlayerProfileView.tsx` lines 234-308 |
| **Row meaning** | Over vs Under for selected player's bets |
| **What is counted** | O/U legs where player appears (including from parlays) |
| **What is summed** | Uses `useEntityMoneyContribution: true` → P4 parlay exclusion |
| **Parlay policy** | 🔀 **MIXED** - Counts include parlay legs, money excludes them |
| **Truth risk** | ⚠️ **HIGH** - Count vs money mismatch is confusing |
| **Verdict** | ⚠️ Confusing |
| **Fix type** | 📝 **RECOMMENDED**: Add tooltip: "Bet counts include parlay legs; stake/net from straight bets only" |

**Critical semantic note**: The PlayerProfileView O/U breakdown uses `computeOverUnderStats` with `useEntityMoneyContribution: true`. This means:
- **Counts**: Parlay legs ARE counted in the bet count
- **Money**: Parlay money is NOT attributed (returns $0)

This creates a confusing mismatch where a user might see "10 Over bets" but only $50 wagered (from 5 straight bets), while the other 5 parlay legs show in count but not in money.

---

### Widget #22: Performance by Market Table (Player)

| Property | Value |
|----------|-------|
| **Widget Name** | Performance by Market (Player) |
| **Where it lives** | `views/PlayerProfileView.tsx` lines 438-449 |
| **Row meaning** | Market type (Pts, Reb, etc.) for selected player |
| **What is counted** | Legs where player appears |
| **What is summed** | `computeStatsByDimension()` using player's leg markets |
| **Parlay policy** | ✅ INCLUDED in market counts |
| **Truth risk** | ✅ **LOW** |
| **Verdict** | ✅ Makes sense |

---

### Widget #23: Recent Bets Table (Player)

| Property | Value |
|----------|-------|
| **Widget Name** | Recent Bets |
| **Where it lives** | `views/PlayerProfileView.tsx` lines 182-214 |
| **Row meaning** | Each row = one bet (ticket) involving the player |
| **What is counted** | Last 10 bets sorted by `placedAt` |
| **Data type** | **Bet objects** (NOT FinalRows) |
| **What is summed** | `getNetNumeric(bet)` per row |
| **Parlay policy** | ✅ INCLUDED - Shows full ticket info |
| **Pending policy** | ✅ Shows bet, net column shows $0 |
| **Truth risk** | ✅ **LOW** |
| **Verdict** | ✅ Makes sense |

---

### Widget #24: Sportsbook StatCards

| Property | Value |
|----------|-------|
| **Widget Name** | Sportsbook StatCards |
| **Where it lives** | `views/SportsbookBreakdownView.tsx` lines 251-268 |
| **Semantics** | Same as #2 but scoped to selected sportsbook |
| **Filter scope** | 🟣 **BOOK + DATE FILTERED** |
| **Verdict** | ✅ Makes sense |

---

### Widget #25: Profit Over Time (Book)

| Property | Value |
|----------|-------|
| **Widget Name** | Profit Over Time (Book-filtered) |
| **Where it lives** | `views/SportsbookBreakdownView.tsx` lines 271-281 |
| **Semantics** | Same as #3 but scoped to selected book |
| **Verdict** | ✅ Makes sense |

---

### Widget #26: Net Profit by Sport Chart

| Property | Value |
|----------|-------|
| **Widget Name** | Net Profit by Sport |
| **Where it lives** | `views/SportsbookBreakdownView.tsx` lines 283-297 |
| **Row meaning** | Each bar = one sport |
| **What is summed** | `computeStatsByDimension()` by sport, filtered to selected book |
| **Verdict** | ✅ Makes sense |

---

### Widget #27: Bet Table (BetTableView)

| Property | Value |
|----------|-------|
| **Widget Name** | Bet Table |
| **Where it lives** | `views/BetTableView.tsx` |
| **Row meaning** | Each row = one FlatBet (can be ticket header or parlay leg) |
| **What is counted** | All bets, with parlay legs expandable |
| **Data type** | **FlatBet** (derived from `betToFinalRows()`) |
| **Parlay policy** | ✅ INCLUDED - Parlays show as expandable groups |
| **Filter scope** | Independent filters: Sport, Category, Type, Result, Search |
| **Sorting** | Default: Date DESC |
| **Editing** | ✅ Inline editing for most fields |
| **Truth risk** | ✅ **LOW** - Spreadsheet view shows raw data |
| **Verdict** | ✅ Makes sense |

---

## SECTION 3 — COVERAGE + GAPS

### Coverage Matrix

| Category | Status | Notes |
|----------|--------|-------|
| **1. Overall performance** (profit, ROI, win rate) | ✅ Covered well | Main KPIs, QuickStatCards |
| **2. Time trends** (daily/weekly/monthly) | ✅ Covered well | Profit Over Time chart, date filters |
| **3. Sportsbook performance** | ✅ Covered well | Dedicated view, profit by book chart |
| **4. Sport performance** | ✅ Covered well | Dedicated view, sport breakdown table |
| **5. Market performance** (props vs spreads vs totals) | ✅ Covered well | Market Category table, Type breakdowns |
| **6. Entity performance** (player/team) | ⚠️ Covered but confusing | Parlay exclusion not obvious |
| **7. Live vs pre-match** | ✅ Covered well | Dedicated breakdown |
| **8. Over vs under** | ⚠️ Covered but confusing | Parlay exclusion, count/money mismatch |
| **9. Parlays/SGP performance** (as its own thing) | ❌ **MISSING** | No dedicated parlay analytics view |
| **10. Tail performance** | ⚠️ Covered but weak | Only shows if tails exist, no dedicated view |
| **11. Futures tracking** (if supported) | ❌ **MISSING** | No open positions/exposure view |
| **12. Data quality** (unknown entities, mismatches) | ❌ **MISSING** | No visibility into unresolved entities |

---

### Top 10 Missing or Weak Areas (Ranked by User Value)

#### 1. 🔴 **Parlay/SGP Performance View** (HIGH PRIORITY)
**Impact**: Users cannot answer "How am I doing on parlays specifically?"
**Current state**: Parlay money is excluded from entity tables (P4 policy), but there's no dedicated view showing parlay-specific performance.
**User questions unanswered**:
- What's my overall parlay win rate?
- Which SGP combinations are profitable?
- How do my parlays compare to singles?
**Recommendation**: Add dedicated "Parlay Performance" tab or section.

#### 2. 🔴 **Futures Exposure Dashboard** (HIGH PRIORITY)
**Impact**: Users cannot track open futures positions or total exposure.
**Current state**: Futures show in the Bet Table and market category, but there's no view for:
- Open futures positions (pending bets)
- Total futures exposure (sum of stakes on pending futures)
- Futures performance by team/league
**User questions unanswered**:
- How much do I have riding on futures right now?
- What teams do I have futures exposure on?
**Recommendation**: Add "Open Futures" section with exposure breakdown.

#### 3. 🟡 **Count vs Money Mismatch in Player O/U** (MEDIUM PRIORITY)
**Impact**: Users see confusing numbers where bet count includes parlay legs but money doesn't.
**Fix**: Add clear tooltip explaining the policy.

#### 4. 🟡 **Parlay Exclusion Explanation** (MEDIUM PRIORITY)
**Impact**: Users don't understand why parlays don't affect entity tables.
**Current state**: Dashboard has tooltip, but BySportView lacks it.
**Fix**: Add consistent InfoTooltip across all entity tables.

#### 5. 🟡 **O/U Breakdown Missing Parlay Note** (MEDIUM PRIORITY)
**Impact**: Users expect parlay O/U legs to be counted.
**Fix**: Add "Straight bets only" tooltip.

#### 6. 🟢 **Leg-Level Win Rate Tracking** (LOWER PRIORITY)
**Impact**: Users cannot see "I'm 70% on LeBron Points even if parlays lose"
**Current state**: Entity stats show ticket-level wins/losses, not leg accuracy.
**Note**: This is a known limitation documented in `displaySemantics.ts`.

#### 7. 🟢 **Data Quality Dashboard** (LOWER PRIORITY)
**Impact**: Users cannot see unresolved entities or normalization issues.
**Current state**: Unresolved queue exists but isn't surfaced in dashboard.
**Fix**: Add small "Data Quality" indicator or link to resolution queue.

#### 8. 🟢 **Unit Size/Kelly Criterion Tracking** (LOWER PRIORITY)
**Impact**: No bankroll management tools.
**Current state**: Bet amounts shown but no unit tracking.

#### 9. 🟢 **CLV (Closing Line Value) Tracking** (LOWER PRIORITY)
**Impact**: Cannot track line movement performance.
**Current state**: Would require additional data (closing odds).

#### 10. 🟢 **Comparison Periods** (LOWER PRIORITY)
**Impact**: Cannot easily compare "This month vs Last month"
**Current state**: Date filters exist but no comparison mode.

---

## SECTION 4 — RECOMMENDATIONS (No-Code)

### A. Tooltip Copy Additions

#### 1. Dashboard O/U Breakdown
```
Title: Over / Under
Add InfoTooltip: "Straight bets only (excludes parlay/SGP legs)"
Position: Next to title
```

#### 2. BySportView Player & Team Table
```
Add InfoTooltip: "Parlays/SGP/SGP+ contribute $0 stake/net to entity breakdowns (prevents double-counting)."
Position: Same as Dashboard implementation
```

#### 3. PlayerProfileView O/U Breakdown
```
Add InfoTooltip: "Bet counts include parlay legs; stake/net from straight bets only"
Position: Next to "Over vs. Under" title
```

#### 4. PlayerProfileView Header
```
Add note: "(includes parlay appearances)"
Position: Below "Player Profile StatCards" title or in subtitle
```

### B. UI Renames (None Required)
Column naming is consistent across tables:
- "# Bets" = Ticket count
- "Win" / "Loss" = W/L counts
- "Wagered" = Stake
- "Net" = Net profit/loss
- "ROI" = Net / Stake * 100

### C. Add/Remove Tables

#### Add: Parlay Performance Section
**Location**: New section in Dashboard OR new tab in navigation
**Contents**:
- Parlay KPIs (total parlays, parlay win rate, parlay net)
- Parlay breakdown by leg count (2-leg, 3-leg, etc.)
- SGP vs Standard Parlay comparison
- Parlay profit over time

#### Add: Futures Exposure Panel
**Location**: Dashboard or dedicated "Open Positions" view
**Contents**:
- Open futures count
- Total futures exposure (sum of pending stakes)
- Breakdown by sport/team
- Potential payout if all hit

### D. Move Tables (None Required)
Current view organization is logical.

### E. Add Toggles/Filters

#### 1. Include Parlays Toggle (Entity Tables)
**Location**: Player & Team Performance table
**Purpose**: Allow users to optionally include parlay money
**Default**: Off (current behavior)
**Label**: "Include parlay stakes"

#### 2. Show Leg Accuracy Toggle (Entity Tables)
**Location**: Player & Team Performance table
**Purpose**: Show leg-level win/loss vs ticket-level
**Implementation**: Would need new metrics from `displaySemantics.getEntityLegContribution()`

---

## SECTION 5 — "IF WE IMPLEMENT" PLAN

### Phase A: Zero-Logic UI Clarity Changes
**Effort**: < 1 hour
**Risk**: None
**Changes**:
1. Add InfoTooltip to Dashboard O/U Breakdown: "Straight bets only (excludes parlay/SGP legs)"
2. Add InfoTooltip to BySportView entity table (copy from Dashboard)
3. Add InfoTooltip to PlayerProfileView O/U: "Bet counts include parlay legs; stake/net from straight bets only"
4. Add subtitle to PlayerProfileView: "(includes parlay appearances)"

### Phase B: Add 1-3 New Tables
**Effort**: 1-2 days per table
**Risk**: Low (additive only)

#### B1: Parlay Performance Section
**Exact Semantics**:
- **Row meaning**: One row per parlay bet (includes sgp, sgp_plus, parlay)
- **Filter**: `isParlayBetType(bet.betType) === true`
- **Metrics**:
  - `tickets`: Count of parlay bets
  - `stake`: Sum of parlay stakes
  - `net`: Sum of `getNetNumeric(bet)` for parlays
  - `wins`: Parlays where `bet.result === 'win'`
  - `losses`: Parlays where `bet.result === 'loss'`
  - `avgLegs`: Average leg count per parlay
  - `roi`: Net / Stake * 100
- **Breakdowns**:
  - By leg count (2, 3, 4, 5+)
  - By type (SGP vs Standard vs SGP+)
  - Profit over time (parlay-only)

#### B2: Futures Exposure Panel
**Exact Semantics**:
- **Row meaning**: One row per open futures position
- **Filter**: `bet.marketCategory === 'Futures' && bet.result === 'pending'`
- **Metrics**:
  - `openCount`: Count of pending futures
  - `totalExposure`: Sum of pending stakes
  - `potentialPayout`: Sum of pending payouts
  - `maxProfit`: Sum of (payout - stake) if all hit
- **Breakdowns**:
  - By sport
  - By entity (team/player)

#### B3: Parlay Leg Breakdown by Entity
**Exact Semantics**:
- **Row meaning**: One row per entity appearing in parlay legs
- **Filter**: Parlay bets only, then extract entities from legs
- **Metrics** (leg-level, not ticket-level):
  - `legCount`: Number of legs featuring this entity
  - `legWins`: Legs where `leg.result === 'WIN'`
  - `legLosses`: Legs where `leg.result === 'LOSS'`
  - `legAccuracy`: legWins / (legWins + legLosses)
- **Note**: Money NOT attributed (just leg accuracy tracking)

### Phase C: Tests/Invariants

#### C1: Parlay Performance Invariants
```typescript
// INV-15: Parlay section only includes parlay bets
test('Parlay section excludes singles', () => {
  const parlayBets = filterParlays(bets);
  parlayBets.forEach(bet => {
    expect(isParlayBetType(bet.betType)).toBe(true);
  });
});

// INV-16: Parlay totals reconcile
test('Parlay totals reconcile with filtered dashboard', () => {
  const parlayFilter = (bet) => isParlayBetType(bet.betType);
  const parlayBets = bets.filter(parlayFilter);
  const parlayStats = computeOverallStats(parlayBets);
  const dashboardParlayCategory = marketCategoryMap.get('Parlays');
  
  expect(parlayStats.totalBets).toBe(dashboardParlayCategory.count);
});
```

#### C2: Futures Exposure Invariants
```typescript
// INV-17: Open futures only includes pending futures
test('Open futures excludes settled bets', () => {
  const openFutures = getOpenFutures(bets);
  openFutures.forEach(bet => {
    expect(bet.result).toBe('pending');
    expect(bet.marketCategory).toBe('Futures');
  });
});

// INV-18: Exposure sum is correct
test('Total exposure matches sum of pending stakes', () => {
  const openFutures = getOpenFutures(bets);
  const exposure = openFutures.reduce((sum, bet) => sum + bet.stake, 0);
  expect(getExposureTotal(openFutures)).toBe(exposure);
});
```

---

## APPENDIX A: Specific Checks Performed

### 1. Ticket vs Leg Counting Clarity ✅
- All tables clearly count tickets, not legs
- `entityStatsService.ts` counts `stats.tickets++` once per entity per bet
- No double-counting of money per leg detected

### 2. Parlay Policy Consistency ✅
- Entity tables: Explicitly exclude parlays (P4 policy enforced)
- O/U breakdowns: Exclude parlays (PG-3/INV-8 enforced)
- Dashboard KPIs: Include parlays (correct behavior)
- **Gap**: BySportView entity table lacks InfoTooltip

### 3. Player Profile Semantics ⚠️
- **Current behavior**: (b) All bets containing player
- **Assessment**: Product win for showing full activity, but confusion trap for money attribution
- **Recommendation**: Add note clarifying parlay inclusion

### 4. Missing Parlay Performance View ❌
- **Status**: CONFIRMED MISSING
- **Impact**: High - users cannot analyze parlay-specific performance
- **Recommendation**: Add in Phase B

### 5. Tail Field ✅
- `bet.tail` exists and is used
- Tail breakdown table exists (conditional on data)
- No dedicated view, but basic coverage sufficient

### 6. Futures ⚠️
- Futures supported as `marketCategory: 'Futures'`
- **Gap**: No open positions/exposure view
- **Recommendation**: Add Futures Exposure panel in Phase B

### 7. Table UX Sanity ✅
- **Sorting defaults**: Key tables default to Net DESC (most useful)
- **Column naming**: Consistent across all tables
- **Empty states**: Tables explain when empty due to filters

---

## APPENDIX B: Files Reviewed

| File | Purpose | Findings |
|------|---------|----------|
| `views/DashboardView.tsx` | Main dashboard | 10 widgets, well-structured |
| `views/BySportView.tsx` | Sport breakdown | 7 widgets, mirrors dashboard |
| `views/PlayerProfileView.tsx` | Player deep-dive | 5 widgets, O/U count/money mismatch |
| `views/SportsbookBreakdownView.tsx` | Book breakdown | 3 widgets, clean implementation |
| `views/BetTableView.tsx` | Spreadsheet view | Complex but correct |
| `services/aggregationService.ts` | KPI calculations | Clean, well-documented |
| `services/entityStatsService.ts` | Entity stats | P4 policy correctly implemented |
| `services/displaySemantics.ts` | Net/attribution logic | Clear semantic rules |
| `services/overUnderStatsService.ts` | O/U calculations | Parlay exclusion correct |
| `utils/filterPredicates.ts` | Filter logic | Composable, reusable |

---

## CONCLUSION

The BetTracker dashboard is **fundamentally sound** with correct wiring to canonical functions. The main issues are:

1. **Clarity gaps**: Some parlay exclusion policies are not obvious to users
2. **Missing analytics**: No dedicated parlay or futures views

The recommended Phase A changes (tooltips) can be implemented quickly with zero risk. Phase B (new tables) would significantly improve the product for power users who bet parlays and futures.

---

**Review completed by**: Copilot Agent  
**Date**: 2026-01-03
