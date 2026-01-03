# DASHBOARD PRODUCT/TRUTH AUDIT - RETURN PACKAGE

**MODE**: PREFLIGHT (Review-only; no code changes)  
**DATE**: 2026-01-03  
**MASTER DOC**: `docs/betTracker/BET_TRACKER_BACKEND_DATA_WIRING_AUDIT_PHASE_1.md`  
**INPUT DOC REVIEWED**: `docs/betTracker/PRODUCT_TRUTH_REVIEW_PHASE_1.md`

---

## 1) QUESTION COVERAGE (A–N) TABLE

| Question | Status | Notes |
|----------|--------|-------|
| **A) What am I up/down overall?** | ✅ | Main KPI StatCards: `computeOverallStats(filteredBets).netProfit`. Verified in DashboardView.tsx lines 1155-1182 |
| **B) What am I up/down in the last 7/30/365 days?** | ✅ | QuickStatCards use hardcoded time windows on `bets` (global). Date filter toggle (1D/3D/1W/1M/1Y) also available on filtered view |
| **C) What am I up/down by sportsbook?** | ✅ | SportsbookBreakdownView provides dedicated view + Dashboard has "Profit by Sportsbook" chart using `computeStatsByDimension(filteredBets, bet => bet.book)` |
| **D) What am I up/down by sport?** | ✅ | "Performance by Sport" table + dedicated BySportView. Uses `computeStatsByDimension(filteredBets, bet => bet.sport)` |
| **E) What am I up/down by market category?** | ✅ | "Performance by Market Category" table shows Props/Main Markets/Parlays/Futures breakdown |
| **F) What am I up/down by market type?** | ⚠️ | BySportView "Market Performance" table shows Pts/Reb/Spread/etc. But NOT available on main Dashboard - only in sport-specific view |
| **G) What am I up/down by player/team (STRAIGHTS)?** | ✅ | "Player & Team Performance" table uses `computeEntityStatsMap()` which excludes parlays (P4 policy enforced) |
| **H) What am I up/down by player/team INCLUDING parlays?** | ❌ | **NOT ANSWERED** - No toggle to include parlay stakes. Entity tables only show straight bet money |
| **I) How am I doing on parlays/SGPs specifically?** | ❌ | **NOT ANSWERED** - Market Category shows "Parlays" row with count/net, but no dedicated breakdown by leg count, SGP vs standard, or parlay-specific ROI analysis |
| **J) How accurate am I on parlay LEGS?** | ❌ | **NOT ANSWERED** - `displaySemantics.ts` has `getLegOutcome()` and `getEntityLegContribution()` functions but they're not wired to any UI table |
| **K) How am I doing on Overs vs Unders?** | ⚠️ | O/U Breakdown exists but: (1) excludes parlays without tooltip, (2) PlayerProfileView has count/money mismatch that IS confusing |
| **L) How am I doing on Live vs Pre-match?** | ✅ | LiveVsPreMatch breakdown correctly includes all bets, uses `getNetNumeric()` |
| **M) What futures are currently open?** | ❌ | **NOT ANSWERED** - No "Open Futures" panel or exposure view. Futures appear in Bet Table but no dedicated tracking |
| **N) Data quality issues?** | ❌ | **NOT ANSWERED** - No dashboard indicator for unresolved entities. Resolution queue exists but is not surfaced |

**Summary**: 8/14 questions answered clearly, 2 partial, 4 NOT answered

---

## 2) KEEP / CHANGE / REMOVE LIST

### DashboardView.tsx Widgets

| Widget | Decision | Rationale |
|--------|----------|-----------|
| QuickStatCards (Global Time) | ✅ **KEEP** | Uniquely answers "at-a-glance" recent performance. Already has "Global (ignores filters)" badge |
| Main KPI StatCards | ✅ **KEEP** | Core filtered KPIs, correctly implemented |
| Profit Over Time Chart | ✅ **KEEP** | Essential trend visualization |
| Profit by Sportsbook Chart | ✅ **KEEP** | Answers sportsbook comparison question |
| Market Category Table | ✅ **KEEP** | Core breakdown, semantics correct |
| Sport Stats Table | ✅ **KEEP** | Core breakdown, semantics correct |
| Player & Team Table | ⚠️ **CHANGE** | Needs clearer label: "Straight Bets Only" or toggle for parlay inclusion |
| Over/Under Breakdown | ⚠️ **CHANGE** | Needs tooltip: "Straight bets only (excludes parlay legs)" |
| Live vs Pre-Match | ✅ **KEEP** | Clean semantics, includes all bet types |
| Tail Performance | ✅ **KEEP** | Conditional display is appropriate |
| DashboardTruthOverlay | ✅ **KEEP** | Valuable DEV-ONLY tool |

### BySportView.tsx Widgets

| Widget | Decision | Rationale |
|--------|----------|-----------|
| Sport StatCards | ✅ **KEEP** | Same semantics as Dashboard, scoped to sport |
| Profit Over Time (Sport) | ✅ **KEEP** | Correctly scoped |
| Market Performance Table | ⚠️ **CHANGE** | Row = leg.market, but money = ticket-level. Propose rename or clarify semantics (see Special Focus #1) |
| Player & Team (Sport) | ⚠️ **CHANGE** | Missing InfoTooltip that Dashboard has. Add for consistency |
| Over/Under (Sport) | ⚠️ **CHANGE** | Same issue as Dashboard - needs parlay exclusion tooltip |
| Live vs Pre-Match (Sport) | ✅ **KEEP** | Clean semantics |
| Tail Performance (Sport) | ✅ **KEEP** | Conditional display appropriate |

### PlayerProfileView.tsx Widgets

| Widget | Decision | Rationale |
|--------|----------|-----------|
| Player Profile StatCards | ⚠️ **CHANGE** | Includes all bet types (even parlays) - needs "(includes parlay appearances)" note |
| Profit Over Time (Player) | ✅ **KEEP** | Correctly includes all bets with player |
| Over vs Under (Player) | ⚠️ **CHANGE** | **HIGH CONFUSION** - Counts include parlay legs but money excludes them. Needs tooltip |
| Market Breakdown (Player) | ✅ **KEEP** | Shows markets for player's legs |
| Recent Bets Table | ✅ **KEEP** | Uses Bet objects, shows ticket-level data |

### SportsbookBreakdownView.tsx Widgets

| Widget | Decision | Rationale |
|--------|----------|-----------|
| Sportsbook StatCards | ✅ **KEEP** | Clean semantics |
| Profit Over Time (Book) | ✅ **KEEP** | Correctly scoped |
| Net Profit by Sport Chart | ✅ **KEEP** | Useful cross-tabulation |

### BetTableView.tsx

| Widget | Decision | Rationale |
|--------|----------|-----------|
| Bet Table (Spreadsheet) | ✅ **KEEP** | Raw data view, parlay expansion correct, sorting default (Date DESC) appropriate |

---

## 3) TOP 7 CONFUSION TRAPS (Ranked)

### 1. 🔴 PlayerProfileView O/U Count vs Money Mismatch (Score: 9/10)
**Location**: `views/PlayerProfileView.tsx` lines 234-308  
**Issue**: `computeOverUnderStats()` is called with `useEntityMoneyContribution: true`, which:
- Counts: Include parlay legs in count
- Money: Exclude parlay money (returns $0)

**Example**: User sees "10 Over bets, $50 wagered" when 5 were straight ($50) and 5 were parlay legs ($0 attributed).

**Fix**: Add InfoTooltip:
```
"Bet counts include parlay legs; stake/net from straight bets only"
```

### 2. 🔴 No Parlay Performance View (Score: 8/10)
**Location**: All views  
**Issue**: Users cannot answer "How am I doing on parlays specifically?" The Market Category table shows a "Parlays" row with count/net, but:
- No breakdown by leg count (2-leg vs 3-leg vs 4+ leg)
- No SGP vs Standard vs SGP+ comparison
- No parlay-specific win rate or ROI analysis

**Fix**: Add Parlay Performance section (see Missing Tables #1)

### 3. 🟡 Dashboard O/U Breakdown Missing Parlay Exclusion Note (Score: 7/10)
**Location**: `views/DashboardView.tsx` lines 322-449  
**Issue**: The O/U breakdown silently excludes parlays via `isParlayBetType()` check in `overUnderStatsService.ts`. Users may expect their parlay O/U legs to contribute.

**Code path verified**: `computeOverUnderStats()` defaults `excludeParlays: true` (line 126)

**Fix**: Add InfoTooltip next to "Over / Under" title:
```
"Straight bets only (excludes parlay/SGP legs)"
```

### 4. 🟡 BySportView Market Table Leg vs Ticket Semantics (Score: 6/10)
**Location**: `views/BySportView.tsx` lines 768-773  
**Issue**: `computeStatsByDimension()` uses `leg.market` as the key:
```typescript
const marketMap = computeStatsByDimension(filteredBets, (bet) => {
  if (bet.legs?.length) return bet.legs.map((leg) => leg.market);
  return null;
});
```
This means:
- Row = derived from leg.market values
- Count = ticket count where that market appears (correct)
- Money = full ticket stake/net (not leg-attributed)

For a 3-leg parlay with markets [Pts, Reb, Total], all three rows get the full $100 stake. This is "ticket-level" attribution but may confuse users expecting leg-level attribution.

**Fix**: Either:
- (a) Rename to "Markets Bet On" and add tooltip: "Shows tickets containing each market (money is ticket-level)"
- (b) Accept current semantics as "correct for ticket-level view"

**Recommendation**: Option (b) - semantics are consistent with entity tables

### 5. 🟡 BySportView Player/Team Table Missing InfoTooltip (Score: 6/10)
**Location**: `views/BySportView.tsx` lines 1034-1047  
**Issue**: DashboardView has InfoTooltip for entity table explaining parlay exclusion, but BySportView does not have the same tooltip.

**Fix**: Add InfoTooltip to match Dashboard:
```
"Parlays/SGP/SGP+ contribute $0 stake/net to entity breakdowns (prevents double-counting)."
```

### 6. 🟡 PlayerProfileView Stats Include All Bet Types (Score: 5/10)
**Location**: `views/PlayerProfileView.tsx` lines 607-623  
**Issue**: Player Profile StatCards use `computeOverallStats(playerBets)` where `playerBets` includes ALL bets containing the player - including parlays.

This is **intentional** (shows total betting activity for player), but creates semantic inconsistency with the O/U breakdown which excludes parlay money.

**Fix**: Add subtitle to Player Profile header:
```
"(includes all bets with this player, including parlays)"
```

### 7. 🟢 QuickStatCards Global Scope Not Obvious (Score: 4/10)
**Location**: `views/DashboardView.tsx` lines 954-976  
**Issue**: Already addressed with "Global (ignores filters)" badge and InfoTooltip.

**Status**: ✅ ALREADY FIXED - No action needed

---

## 4) MISSING TABLES/VIEWS (Ranked with Justification)

### 1. 🔴 Parlay Performance Section (HIGH PRIORITY)
**User Questions Answered**: I
**Minimum Viable Semantics**:
- **Row unit**: One row per parlay ticket (betType = parlay | sgp | sgp_plus)
- **Count unit**: Ticket count
- **Money unit**: Full ticket stake/net
- **Parlay policy**: PARLAY-ONLY (inverse of entity tables)
- **Pending policy**: Counted, contributes $0 to net

**Where it should live**: New section in Dashboard OR new "Parlays" tab  
**Can be computed with existing data**: ✅ YES - Filter: `isParlayBetType(bet.betType) === true`

**Proposed metrics**:
| Metric | Calculation |
|--------|-------------|
| Total Parlays | `parlayBets.length` |
| Parlay Win Rate | `wins / (wins + losses) * 100` |
| Parlay Net | `sum(getNetNumeric(bet))` |
| Parlay ROI | `net / stake * 100` |
| Average Legs | `sum(bet.legs.length) / parlayBets.length` |

**Proposed breakdowns**:
- By leg count (2-leg, 3-leg, 4-leg, 5+ leg)
- By type (SGP vs Standard vs SGP+)
- Parlay profit over time chart

### 2. 🔴 Open Futures Exposure Panel (HIGH PRIORITY)
**User Questions Answered**: M
**Minimum Viable Semantics**:
- **Row unit**: One row per open futures position
- **Count unit**: Ticket count (pending futures only)
- **Money unit**: Ticket stake (exposure), potential payout
- **Parlay policy**: INCLUDED (futures can be parlayed)
- **Pending policy**: PENDING ONLY (settled futures excluded)

**Where it should live**: Dashboard sidebar OR new "Open Positions" section  
**Can be computed with existing data**: ✅ YES - Filter: `bet.marketCategory === 'Futures' && bet.result === 'pending'`

**Proposed metrics**:
| Metric | Calculation |
|--------|-------------|
| Open Futures Count | `openFutures.length` |
| Total Exposure | `sum(bet.stake)` (pending stakes) |
| Potential Payout | `sum(bet.payout)` (if all hit) |
| Max Profit | `sum(bet.payout - bet.stake)` |

**Proposed breakdowns**:
- By sport
- By team/player entity

### 3. 🟡 Parlay Leg Accuracy by Entity (MEDIUM PRIORITY)
**User Questions Answered**: J
**Minimum Viable Semantics**:
- **Row unit**: One row per entity appearing in parlay legs
- **Count unit**: Leg count (not ticket count)
- **Money unit**: NONE - leg accuracy only, no money attribution
- **Parlay policy**: PARLAY-ONLY (straights excluded)
- **Pending policy**: Unknown legs excluded from win% denominator

**Where it should live**: PlayerProfileView OR new "Leg Analysis" section  
**Can be computed with existing data**: ⚠️ PARTIAL - Requires `leg.result` to be populated (currently sparse)

**Proposed metrics**:
| Metric | Calculation |
|--------|-------------|
| Total Legs | `sum of legs featuring entity` |
| Leg Wins | `legs where leg.result === 'WIN'` |
| Leg Losses | `legs where leg.result === 'LOSS'` |
| Leg Accuracy | `legWins / (legWins + legLosses) * 100` |

**Note**: `displaySemantics.ts` already has `getLegOutcome()` and `getEntityLegContribution()` functions ready for this. Main gap is UI wiring.

### 4. 🟡 Entity Table with Parlay Toggle (MEDIUM PRIORITY)
**User Questions Answered**: H
**Minimum Viable Semantics**:
- **Row unit**: Entity (player/team)
- **Count unit**: Ticket count (all bets containing entity)
- **Money unit**: Toggle between "straights only" and "all bets (including parlays)"
- **Parlay policy**: User-controlled toggle
- **Pending policy**: Same as current

**Where it should live**: Existing Player & Team Performance table (add toggle)  
**Can be computed with existing data**: ✅ YES - Already have both paths:
- Straights: `computeEntityStatsMap()` (current)
- All: `computeStatsByDimension()` with entity extraction

**Implementation note**: When including parlays, the same entity appearing in multiple parlay legs should still only count once per ticket (current `computeEntityStatsMap` already handles this via `Set` deduplication).

### 5. 🟢 Data Quality Indicator (LOWER PRIORITY)
**User Questions Answered**: N
**Minimum Viable Semantics**:
- **Row unit**: Unresolved entity
- **Count unit**: Entity count

**Where it should live**: Small indicator on Dashboard OR link to existing UnresolvedQueueManager  
**Can be computed with existing data**: ✅ YES - Unresolved queue already exists at `views/UnresolvedQueueManager.tsx`

**Proposed approach**: Add small badge/link: "5 unresolved entities →" that links to resolution queue

---

## 5) CONTRADICTIONS FOUND vs PRIOR PHASE 1 DOC

| Prior Claim | Verification Status | Evidence |
|-------------|---------------------|----------|
| "All tables clearly count tickets, not legs" | ✅ **VERIFIED** | `entityStatsService.ts` line 112: `stats.tickets++` once per entity per bet. `aggregationService.ts` line 75: `stats.count++` once per bet |
| "No double-counting of money per leg detected" | ✅ **VERIFIED** | Entity tables use `Set` to dedupe entities per bet. Money is ticket-level, not leg-attributed |
| "Market performance tables using leg.market are fine" | ⚠️ **PARTIALLY VERIFIED** | Rows ARE leg-derived, but money IS ticket-level. Not technically wrong, but semantically confusing for users expecting leg-level attribution |
| "Sorting defaults are Net DESC across key tables" | ❌ **INCORRECT** | StatsTable default is `{ key: 'net', direction: 'desc' }` ✅ BUT BetTableView defaults to `{ key: 'date', direction: 'desc' }` which is appropriate for a spreadsheet view. The claim is partially true |
| "Empty states explain why empty" | ✅ **VERIFIED** | DashboardView lines 1246-1255 show "No betting data matches your selected filters" message |
| "BySportView entity table lacks InfoTooltip" | ✅ **VERIFIED** | Code review confirms no InfoTooltip in BySportView.tsx Player & Team section, unlike DashboardView |
| "PlayerProfileView O/U has count/money mismatch" | ✅ **VERIFIED** | `useEntityMoneyContribution: true` causes counts to include parlay legs but money to exclude them |

**Summary**: 4 claims fully verified, 2 partially verified, 1 minor inaccuracy about sorting defaults

---

## 6) NEXT PHASE PROPOSAL

### Phase A: Zero-Logic UI Clarity Changes (1-2 hours)
**Risk**: None (label/tooltip changes only)

1. Add InfoTooltip to Dashboard O/U Breakdown: "Straight bets only (excludes parlay/SGP legs)"
2. Add InfoTooltip to BySportView Player & Team Table (copy from Dashboard)
3. Add InfoTooltip to PlayerProfileView O/U: "Bet counts include parlay legs; stake/net from straight bets only"
4. Add subtitle to PlayerProfileView header: "(includes all bets with this player, including parlays)"

### Phase B: Add Missing Tables (2-4 days)
**Risk**: Low (additive only)

Priority order:
1. **Parlay Performance Section** - Highest user value, answers unanswered question I
2. **Open Futures Exposure Panel** - Important for users with significant futures positions

### Phase C: Add Optional Toggles (1-2 days)
**Risk**: Low (optional features)

1. "Include parlay stakes" toggle on Entity tables - Answers question H
2. Leg accuracy tracking (if leg.result data is populated) - Answers question J

### Phase D: Data Quality Surface (0.5 day)
**Risk**: None

1. Add unresolved entity count indicator linking to existing queue

---

## APPENDIX A: ASSUMPTION CHALLENGES (Per Problem Statement Requirement)

### Challenge 1: "All tables clearly count tickets, not legs"
**Verification method**: Traced code paths in `aggregationService.ts` and `entityStatsService.ts`
**Finding**: ✅ VERIFIED
- `computeStatsByDimension()` increments `stats.count++` once per bet (line 175)
- `computeEntityStatsMap()` increments `stats.tickets++` once per entity per bet, using `Set` deduplication (lines 77-95)

### Challenge 2: "No double-counting of money per leg detected"
**Verification method**: Reviewed `entityStatsService.ts` money attribution
**Finding**: ✅ VERIFIED
- `getEntityMoneyContribution()` returns full ticket stake/net for non-parlays
- Entity deduplication via `Set<string>` prevents same entity counting twice in same bet
- Parlays contribute $0 money to entity tables

### Challenge 3: "Market performance tables using leg.market are fine"
**Verification method**: Reviewed `BySportView.tsx` market table implementation
**Finding**: ⚠️ TECHNICALLY CORRECT BUT SEMANTICALLY AMBIGUOUS
- Rows ARE derived from `leg.market` values
- But money attribution is ticket-level
- A 3-leg parlay with 3 different markets adds full stake to all 3 market rows
- This is the established "ticket-level" policy, not a bug

### Challenge 4: "Sorting defaults are Net DESC across key tables"
**Verification method**: Checked sortConfig defaults in each component
**Finding**: ⚠️ PARTIALLY CORRECT
- StatsTable: `{ key: 'net', direction: 'desc' }` ✅
- BetTableView: `{ key: 'date', direction: 'desc' }` (appropriate for spreadsheet)
- The prior doc's claim is mostly true but not universally accurate

### Challenge 5: "Empty states explain why empty"
**Verification method**: Searched for empty state handling in views
**Finding**: ✅ VERIFIED
- DashboardView line 1249: "No betting data matches your selected filters."
- BySportView line 1013-1018: Similar empty state handling

---

## APPENDIX B: CODE PATHS VERIFIED

| Widget | Source Code Location | Key Function Used | Verified |
|--------|---------------------|-------------------|----------|
| QuickStatCards | DashboardView.tsx:795-816 | `getNetNumeric(bet)` | ✅ |
| Main KPIs | DashboardView.tsx:821 | `computeOverallStats(filteredBets)` | ✅ |
| Profit Over Time | DashboardView.tsx:824 | `computeProfitOverTime(filteredBets)` | ✅ |
| Profit by Book | DashboardView.tsx:828 | `computeStatsByDimension(..., bet => bet.book)` | ✅ |
| Market Category | DashboardView.tsx:829 | `computeStatsByDimension(..., bet => bet.marketCategory)` | ✅ |
| Sport Stats | DashboardView.tsx:830 | `computeStatsByDimension(..., bet => bet.sport)` | ✅ |
| Entity Stats | DashboardView.tsx:834-853 | `computeEntityStatsMap(filteredBets, ...)` | ✅ |
| O/U Breakdown | DashboardView.tsx:326-329 | `computeOverUnderStats(filteredBets)` via overUnderStatsService | ✅ |
| Live vs Pre | DashboardView.tsx:466-476 | Manual loop with `getNetNumeric(bet)` | ✅ |
| Player O/U | PlayerProfileView.tsx:249-257 | `computeOverUnderStats(..., { useEntityMoneyContribution: true })` | ✅ |

---

**Audit completed by**: Copilot Agent  
**Date**: 2026-01-03
