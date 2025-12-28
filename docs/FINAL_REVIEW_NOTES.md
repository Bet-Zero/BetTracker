# Final Logic & Clarity Review Notes

**Generated:** December 27, 2025  
**Scope:** Post-Ship Sanity Pass  
**Status:** For Documentation Purposes (No Code Changes)

---

## Executive Summary

BetTracker is a functional sports betting analytics application that enables users to import bets from FanDuel and DraftKings via HTML parsing, track betting history in a spreadsheet-like interface, and analyze performance through multiple dashboard views. The core system works well: bets are correctly parsed, stored with versioned persistence, classified into market categories, and aggregated consistently across views. Users can view statistics by sport, player, team, and sportsbook, with proper handling of parlay bets, pending bets, and edge cases like free bets.

The application has solid architectural foundations with centralized services for aggregation, classification, and normalization. However, several areas need attention: UI clarity issues (unclear tooltips and column labels), dual-path entity type checking that could trip up new developers, and documentation gaps around cross-sport collision handling. The system is ready to ship but would benefit from incremental improvements to user experience and developer onboarding.

Major gaps include: lack of export functionality, no advanced filtering capabilities beyond basic date/sport/book filters, and minimal product features for deriving actionable insights from betting data. The technical foundation supports extensibility, but user-facing enhancements would significantly improve the value proposition.

---

## 1. Confirmed Solid Areas

These subsystems are robust and unlikely to cause issues:

### 1.1 P4 Parlay Money Exclusion (Entity Stats)

**Location:** `services/displaySemantics.ts`, `services/entityStatsService.ts`

The parlay money exclusion policy is well-implemented:

- `isParlayBetType()` correctly identifies `sgp`, `sgp_plus`, and `parlay` as parlay variants
- `getEntityMoneyContribution()` returns `{stake: 0, net: 0}` for parlays
- Singles contribute full stake/net to entity breakdowns
- This prevents stake inflation in player/team performance metrics

**Test Coverage:** Protected by `displaySemantics.test.ts`

---

### 1.2 Pending Bet Net = 0 Semantics

**Location:** `services/displaySemantics.ts:67-74`

Pending bets are correctly handled:

- `getNetNumeric(pendingBet)` returns `0` (not `-stake`)
- `getNetDisplay(pendingBet)` returns `""` (blank)
- All KPI aggregations use `getNetNumeric()` consistently
- Pending bets do NOT count as losses in any calculation

**Rationale:** Pending bets are undecided; treating them as `-stake` would incorrectly show losses that haven't occurred.

---

### 1.3 Shared Aggregation Services

**Location:** `services/aggregationService.ts`

All views use the same aggregation functions:

- `computeOverallStats()` - KPI calculations
- `computeProfitOverTime()` - Cumulative profit chart
- `computeStatsByDimension()` - Grouped breakdowns
- `calculateRoi()` - Consistent ROI formula

This ensures Dashboard, BySportView, PlayerProfileView, and SportsbookBreakdownView show consistent numbers.

---

### 1.4 Filter Predicate Consistency

**Location:** `utils/filterPredicates.ts`

Filters are shared and composable:

- `createBetTypePredicate()` - Singles/Parlays/All
- `createDateRangePredicate()` - Time range filters
- `createSportPredicate()` - Sport filter
- `createBookPredicate()` - Sportsbook filter

All views import and use these predicates, eliminating filter logic duplication.

---

### 1.5 Versioned Persistence with Migration

**Location:** `services/persistence.ts`

Storage is robust:

- `STORAGE_VERSION` enables schema evolution
- `migrateIfNeeded()` handles legacy data and version upgrades
- `createCorruptedBackup()` preserves corrupt data before reset
- Shape validation before save prevents silent corruption

---

### 1.6 Market Classification Single Source of Truth

**Location:** `services/marketClassification.ts`

Classification is centralized:

- `classifyBet()` - Primary bet-level classification
- `classifyLeg()` - Leg-level classification for parlays
- `determineType()` - Stat type derivation
- `normalizeCategoryForDisplay()` - Display normalization

No caller re-interprets or overrides classification results.

---

### 1.7 Parser Contract Validation

**Location:** `parsing/parserContract.ts`

Parser output is validated:

- `REQUIRED_BET_FIELDS` defines mandatory fields
- `validateBetContract()` catches parser issues
- `VALID_BET_TYPES`, `VALID_MARKET_CATEGORIES` enforce enums
- Entity type warnings for missing/unknown values

---

## 2. Potential Concerns (Even If Acceptable)

### 2.1 Cross-Sport Abbreviation Collisions

**Priority:** P2 | **Effort:** S | **Owner:** Docs

**What Could Be Misunderstood:**
Abbreviations like "ATL" match both Atlanta Hawks (NBA) and Atlanta Falcons (NFL). When sport context is unavailable, the first match wins.

**Current Behavior:**

- `normalizationService.ts` logs a console warning on collision
- `normalizeTeamNameWithMeta()` returns collision metadata
- ImportConfirmationModal shows a yellow "Collision" badge

**Why It's Acceptable:**

- Sport is usually available from bet context
- Collision warnings are visible in UI during import
- User can manually correct if needed

**Why It Might Matter Later:**

- If exports are added, collisions could cause confusion in external tools
- Automated workflows wouldn't see the UI badge

**Recommendation:** Document known collisions in the import guide.

**Example:** Add a "Known Collisions" section to `docs/IMPORT_OPERATOR_GUIDE.md` listing ATL (Hawks/Falcons), NY (Knicks/Giants), etc.

---

### 2.2 `entityType: undefined` vs `entityType: "unknown"` Dual-Path

**Priority:** P1 | **Effort:** M | **Owner:** Backend

**What Could Be Misunderstood:**
Legacy data has `entityType: undefined`, while new parsers set `entityType: "unknown"` for ambiguous cases. Consumers must check for both.

**Current Behavior:**

- `types.ts:67-72` documents this explicitly in JSDoc
- `importValidation.ts:237` warns on both `undefined` and `"unknown"`
- `useBets.tsx:109-113` only auto-adds entities when entityType is explicitly `"player"` or `"team"`

**Why It's Acceptable:**

- The dual-check pattern is documented
- UI shows warnings for ambiguous entities
- No silent misclassification occurs

**Why It Might Matter Later:**

- New developers might miss the dual-check requirement
- TypeScript doesn't enforce checking for both conditions

**Recommendation:** Add a helper function like `isKnownEntityType(entityType)` that returns false for both `undefined` and `"unknown"`.

**Example:** Create `utils/entityHelpers.ts` with `isKnownEntityType()` and refactor `useBets.tsx:109-113` to use it.

---

### 2.3 "Parlays" Category vs "Parlays" BetType Filter Semantics

**Priority:** P2 | **Effort:** S | **Owner:** UI

**What Could Be Misunderstood:**
There are two "parlay" concepts:

1. `marketCategory: "Parlays"` - Multi-game parlays (not SGP)
2. `betType` filter "Parlays" - Includes SGP, SGP+, and Parlays

A user might filter to "Parlays" expecting only multi-game parlays but see SGPs too.

**Current Behavior:**

- `filterPredicates.ts:25-27`: `isParlayType()` includes all three variants
- `marketCategory: "SGP/SGP+"` is separate from `marketCategory: "Parlays"`
- Dashboard betType filter uses `isParlayType()` which is correct

**Why It's Acceptable:**

- For P4 money exclusion, all parlay variants should be grouped
- SGPs are structurally parlays (multiple legs, one ticket)

**Why It Might Matter Later:**

- Users who want to see ONLY multi-game parlays can't filter to just that
- The word "Parlays" is overloaded

**Recommendation:** Consider renaming the betType filter to "Multi-Leg Bets" or adding a tooltip explaining what's included.

**Example:** Update `DashboardView.tsx` betType filter label to "Multi-Leg Bets" with tooltip: "Includes SGP, SGP+, and Parlays."

---

### 2.4 Over/Under Breakdown Uses Ticket-Level Attribution

**Priority:** P2 | **Effort:** XS | **Owner:** UI

**What Could Be Misunderstood:**
In BySportView's Over/Under breakdown, a 3-leg parlay with all "Over" legs attributes the FULL ticket stake/net three times (once per leg).

**Current Behavior:**

- `displaySemantics.ts:44-51` documents `STAKE_ATTRIBUTION_POLICY = 'ticket-level'`
- O/U stats are intentionally inflated to answer: "What's my P/L on bets involving Overs?"

**Why It's Acceptable:**

- The policy is documented
- It answers the question users actually ask
- A "split" policy would lose ticket-level context

**Why It Might Matter Later:**

- Summing O/U breakdowns doesn't equal total wagered
- Users expecting "actual risk" numbers will be confused

**Recommendation:** Add a tooltip or info icon on O/U breakdown: "Ticket-level attribution: multi-leg bets count toward each O/U category."

**Example:** Add `<InfoIcon>` component next to "Over/Under" header in `BySportView.tsx` with the tooltip text.

---

### 2.5 Win% Denominator Excludes Pending and Pushes

**Priority:** P2 | **Effort:** XS | **Owner:** UI

**What Could Be Misunderstood:**
Win rate is calculated as `wins / (wins + losses)`, not `wins / totalBets`. Pushes and pending bets are excluded.

**Current Behavior:**

- `aggregationService.ts:121-123`: `decidedBets = wins + losses`
- This is the standard sports betting definition

**Why It's Acceptable:**

- This matches industry convention
- Including pushes would artificially deflate win rate

**Why It Might Matter Later:**

- Users unfamiliar with betting stats might expect different denominator
- "50% win rate" on 100 bets could mean 30-30-40 (30 wins, 30 losses, 40 pushes)

**Recommendation:** Label should say "Win % (excl. pushes)" or add tooltip explaining the formula.

**Example:** Update column header in `BySportView.tsx` from "Win %" to "Win % (excl. pushes)" or add tooltip: "Wins / (Wins + Losses), excludes pushes and pending."

---

### 2.6 StatsTable "Singles Wagered/Net/ROI" Column Labels

**Priority:** P2 | **Effort:** S | **Owner:** UI

**What Could Be Misunderstood:**
In BySportView's Player & Team Performance table, columns show "Singles Wagered", "Singles Net", "Singles ROI" but users might not understand why.

**Current Behavior:**

- These columns ONLY reflect single bets due to P4 policy
- Parlay money is excluded to prevent inflation
- Labels correctly say "Singles" but rationale isn't explained

**Why It's Acceptable:**

- Labels are accurate
- P4 policy is correct for entity-level attribution

**Why It Might Matter Later:**

- Users might think their parlay bets are missing
- "Why does my total not match Dashboard?" questions

**Recommendation:** Add column header tooltip: "Parlay bets excluded from money stats to prevent stake inflation. See Legs/Leg Win% for parlay performance."

**Example:** Add tooltip to "Singles Wagered", "Singles Net", and "Singles ROI" column headers in `BySportView.tsx` StatsTable component.

---

### 2.7 Leg Result Format: Uppercase vs Lowercase

**Priority:** P3 | **Effort:** M | **Owner:** Backend

**What Could Be Misunderstood:**
Bet-level results are lowercase (`"win"`, `"loss"`) while leg-level results are uppercase (`"WIN"`, `"LOSS"`).

**Current Behavior:**

- `types.ts:2`: `LegResult = "WIN" | "LOSS" | "PUSH" | "PENDING" | "UNKNOWN"`
- `types.ts:1`: `BetResult = "win" | "loss" | "push" | "pending"`
- `displaySemantics.ts:248` normalizes to lowercase for comparison

**Why It's Acceptable:**

- The distinction is intentional (legs come from parsers with different conventions)
- Code handles both via normalization

**Why It Might Matter Later:**

- Inconsistency could cause bugs if someone forgets to normalize
- TypeScript protects most cases but not string comparisons

**Recommendation:** Consider unifying to lowercase everywhere in a future refactor, or document the convention prominently.

**Example:** Update `types.ts:2` to change `LegResult` to lowercase values, or add prominent JSDoc explaining the uppercase convention for leg results.

---

### 2.8 "Other" BetType Ambiguity

**Priority:** P2 | **Effort:** S | **Owner:** Backend

**What Could Be Misunderstood:**
`betType: "other"` exists but is rarely used. Its classification behavior is unclear.

**Current Behavior:**

- `marketClassification.ts:117`: `"other"` is grouped with `"single"` and `"live"` for classification
- `filterPredicates.ts:38`: "singles" filter includes only `betType === "single"`, NOT "other"

**Why It's Acceptable:**

- "other" is a fallback for edge cases
- Few bets should ever be "other"

**Why It Might Matter Later:**

- "other" bets won't appear in either "singles" or "parlays" filters
- They appear only in "all" filter, which could seem like data loss

**Recommendation:** Either include "other" in singles filter, or add a note that rare bet types only appear in "all" view.

**Example:** Update `filterPredicates.ts:38` to include `betType === "other"` in singles filter, or add UI note in `DashboardView.tsx` filter section.

---

### 2.9 `live` BetType vs `isLive` Flag Redundancy

**Priority:** P2 | **Effort:** XS | **Owner:** Docs

**What Could Be Misunderstood:**
There's both `betType: "live"` and `isLive: boolean` on Bet objects.

**Current Behavior:**

- `betType: "live"` is a primary classification (mutually exclusive with single/parlay)
- `isLive: boolean` is an orthogonal flag (a parlay can also be isLive: true)
- Both exist for historical/flexibility reasons

**Why It's Acceptable:**

- `isLive` flag is the canonical "was this placed in-game" indicator
- `betType: "live"` exists but modern parsers use "single" + `isLive: true`

**Why It Might Matter Later:**

- Confusion about which to check
- Some bets might have `betType: "live"` and some might have `isLive: true`

**Recommendation:** Document that `isLive` is the preferred flag; `betType: "live"` is legacy.

**Example:** Add JSDoc comment to `types.ts` Bet interface clarifying that `isLive` is canonical and `betType: "live"` is legacy.

---

### 2.10 Free Bet Handling (stake = 0)

**Priority:** P2 | **Effort:** M | **Owner:** Backend

**What Could Be Misunderstood:**
`importValidation.ts:119` allows `stake === 0` for "free bet scenarios", but there's no special handling for free bets in display.

**Current Behavior:**

- stake = 0 passes validation
- ROI calculation divides by stake, so 0 stake = 0 ROI (handled by `calculateRoi`)
- Net profit = payout - 0 = payout (correct for free bets)

**Why It's Acceptable:**

- Free bets are correctly handled mathematically
- No crashes on division

**Why It Might Matter Later:**

- Free bets have undefined ROI (not 0%) - showing 0% is technically wrong
- No visual indicator that a bet was a free bet

**Recommendation:** Add `isFreebet?: boolean` flag in future, or show "N/A" for ROI when stake = 0.

**Example:** Add `isFreebet?: boolean` to `types.ts` Bet interface and update `formatters.ts` to display "N/A" for ROI when `stake === 0`.

---

## 3. Clarification Recommendations

### 3.1 UI Copy Improvements

| Location                       | Current           | Suggested                                                          |
| ------------------------------ | ----------------- | ------------------------------------------------------------------ |
| BySportView StatsTable headers | "Singles Wagered" | "Singles Wagered ℹ️" (tooltip: "Parlay bets excluded")             |
| Dashboard Win Rate             | "Win Rate"        | "Win Rate ℹ️" (tooltip: "Wins ÷ (Wins + Losses), excludes pushes") |
| O/U Breakdown                  | "Over vs. Under"  | Add info icon with attribution explanation                         |
| Filters                        | "Parlays"         | Consider "Multi-Leg Bets" or tooltip listing SGP/SGP+/Parlay       |

**Template Text for Implementation:**

**BySportView StatsTable Header - "Singles Wagered ℹ️":**

```
Header Label: "Singles Wagered ℹ️"
Tooltip Text: "Parlay bets excluded from money stats to prevent stake inflation. Parlay performance tracked via Legs and Leg Win %."
```

**Dashboard Win Rate:**

```
Header Label: "Win Rate ℹ️"
Tooltip Text: "Wins ÷ (Wins + Losses), excludes pushes"
```

**O/U Breakdown Tooltip:**

```
Tooltip Text: "Over/Under breakdown uses ticket-level attribution. Each leg's full stake is counted, so totals may exceed your total wagered. This shows your performance when betting Overs vs. Unders, not the stake allocation."
```

**Filters - Parlays Label:**

```
Option 1 - Label Change: "Multi-Leg Bets"
Option 2 - Keep "Parlays" with Tooltip: "Includes all multi-leg bet types: Single-Game Parlays (SGP), SGP+, and Traditional Parlays"
```

### 3.2 Code Comments for Tribal Knowledge

| File                              | Line                     | Suggested Comment                                                              |
| --------------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `types.ts:38-44`                  | BetType enum             | Add comment: "`live` is legacy; prefer `single` + `isLive: true` for new bets" |
| `displaySemantics.ts:44-51`       | STAKE_ATTRIBUTION_POLICY | Already documented well, consider adding link to GAP_ANALYSIS                  |
| `aggregationService.ts:121`       | decidedBets calculation  | Add: "Standard betting win rate excludes pushes and pending"                   |
| `normalizationService.ts:328-340` | Collision handling       | Add: "First match wins; collision metadata available via `WithMeta` variant"   |

**Code Comment Templates for Implementation:**

**`types.ts:38-44` - BetType enum:**

```typescript
/**
 * Bet type classification.
 *
 * @breaking Note: `"live"` is a legacy bet type. Modern parsers should use
 * `betType: "single"` with `isLive: true` instead. The `isLive` boolean flag
 * is the canonical way to indicate whether a bet was placed during live play.
 * `betType: "live"` is preserved for backward compatibility with older data.
 */
export enum BetType {
  single = "single",
  parlay = "parlay",
  live = "live", // Legacy: prefer single + isLive: true
  other = "other",
}
```

**`aggregationService.ts:121` - decidedBets calculation:**

```typescript
// Standard betting win rate calculation excludes pushes and pending bets.
// Formula: Wins ÷ (Wins + Losses). Push outcomes and pending bets are
// filtered out before this calculation to match industry-standard win rate metrics.
const decidedBets = bets.filter(
  (b) => b.result === "win" || b.result === "loss"
);
```

**`normalizationService.ts:328-340` - Collision handling:**

```typescript
// Collision Resolution: When multiple entities match the same abbreviation
// (e.g., "ATL" could be Hawks or Falcons), the first match wins. This prevents
// import blocking while allowing sport context to usually resolve ambiguity.
// Collision metadata is available via the `WithMeta` variant if callers need
// to detect or handle ambiguous matches explicitly.
```

### 3.3 Documentation Additions

| Document                    | Content to Add                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `IMPORT_TROUBLESHOOTING.md` | Section on cross-sport collision resolution                                         |
| `README.md`                 | Brief note on P4 parlay policy for entity stats                                     |
| `docs/DATA_MODEL_NOTES.md`  | Explain BetType vs isLive, entityType undefined vs unknown, result case conventions |

---

## 4. Explicit "We Accept This" Decisions

### 4.1 Ticket-Level Attribution is Intentional Double-Counting

**Decision:** When a parlay has 3 Over legs, the O/U breakdown attributes the full ticket stake 3 times.

**Rationale:** This answers "What's my P/L on bets involving Overs?" rather than "What portion of my stake went to Overs?"

**Trade-off:** O/U totals don't sum to total wagered. This is acceptable because:

- The alternative (splitting stake) loses ticket-level context
- Users want to know "how did I do when I bet Overs" not "what fraction of parlays were Overs"

**How to Validate:**

1. **Support Tickets:** Monitor tickets about O/U breakdown totals not summing to total wagered. Baseline: <5 tickets/month. Red flag: >15 tickets/month suggests users expect sums to match.
2. **User Surveys:** Semi-annual survey question: "Do you understand why Over/Under breakdown totals may exceed your total wagered?" Target: >75% understand ticket-level attribution. Red flag: <50% understanding indicates need for UI clarification.
3. **Telemetry:** Track clicks on O/U breakdown info icon/tooltip. Low engagement (<20% of users who view O/U breakdown) may indicate missing or unclear explanation.
4. **Action Trigger:** If >20 tickets/month about O/U totals OR survey shows <40% understanding, add prominent tooltip or documentation explaining ticket-level attribution policy.

---

### 4.2 Parlay Money Excluded from Entity Stats

**Decision:** Player/team money stats (wagered, net, ROI) only count single bets.

**Rationale:** If a $10 parlay with 3 players counted $10 toward each player, total entity wagered would be $30 but actual wagered is $10.

**Trade-off:** Parlay performance is only visible via leg counts and leg win rate, not money. This is acceptable because:

- Prevents misleading totals
- Leg accuracy is the meaningful metric for entity-level parlay analysis

**How to Validate:**

1. **Support Tickets:** Monitor tickets asking why player/team totals don't include parlay money. Baseline: <3 tickets/month. Red flag: >10 tickets/month suggests users expect parlay money in entity stats.
2. **User Surveys:** Quarterly survey question: "Do player/team money stats include parlay bets?" Target: >80% correctly understand parlay money is excluded. Red flag: <60% understanding indicates UI clarity issue.
3. **Leg Win% Correlation:** Verify that entity-level parlay performance (leg win%) correlates with user betting decisions. If users frequently bet parlays with players they have low leg win% on, the exclusion may be confusing their analysis.
4. **Action Trigger:** If >15% of active users submit tickets about missing parlay money OR survey shows <50% understanding, consider adding UI tooltip or documentation explaining the policy.

---

### 4.3 First-Match-Wins for Abbreviation Collisions

**Decision:** When "ATL" could mean Hawks or Falcons, the first defined team (Hawks) wins.

**Rationale:** Making this an error would block valid imports. Sport context usually resolves ambiguity anyway.

**Trade-off:** Rare incorrect assignments possible. Acceptable because:

- Console warns on collision
- Import modal shows collision badge
- User can manually correct

**How to Validate:**

1. **Support Tickets:** Monitor tickets reporting incorrect team/player assignments from collisions. Baseline: <2 tickets/month. Red flag: >8 tickets/month suggests collision frequency or severity is higher than expected.
2. **Console Warning Frequency:** Track collision warnings in logs. Baseline: <5% of imports trigger collisions. Red flag: >15% collision rate indicates normalization gaps or ambiguous abbreviations increasing.
3. **User Corrections:** Track manual corrections to collision-assigned entities post-import. Baseline: <10% of collisions require correction. Red flag: >30% correction rate suggests first-match-wins is too error-prone.
4. **Action Trigger:** If >12 collision-related tickets/month OR correction rate >40%, consider adding sport-context hints to normalization or documenting known collisions more prominently.

---

### 4.4 Unknown EntityType Treated Same as Undefined

**Decision:** Both `entityType: undefined` and `entityType: "unknown"` prevent auto-adding entities to reference lists.

**Rationale:** We shouldn't auto-populate player/team lists with potentially wrong data.

**Trade-off:** Users must manually add unknown entities. Acceptable because:

- Prevents garbage in reference lists
- UI clearly shows which entities need attention

**How to Validate:**

1. **Support Tickets:** Monitor tickets about missing entities or confusion about why entities aren't auto-added. Baseline: <4 tickets/month. Red flag: >12 tickets/month suggests manual entry burden is too high.
2. **User Surveys:** Annual survey question: "How often do you manually add unknown players/teams?" Target: <50% of users report this as a frequent annoyance. Red flag: >75% report frequent annoyance indicates need for better entity recognition.
3. **Unknown Entity Count:** Track percentage of bets with unknown/undefined entityType. Baseline: <10% of bets. Red flag: >25% unknown rate suggests parser improvements needed or normalization gaps.
4. **Action Trigger:** If >18 tickets/month about unknown entities OR >80% of users report manual entry as frequent burden, consider enhancing entity recognition or adding bulk entity import functionality.

---

### 4.5 Win Rate Excludes Pushes

**Decision:** Win % = Wins ÷ (Wins + Losses), not Wins ÷ Total.

**Rationale:** This is the industry-standard definition in sports betting.

**Trade-off:** Users unfamiliar with betting stats might expect different formula. Acceptable because:

- Matches what sportsbooks and tipsters use
- Pushes are "no decision" - including them would artificially deflate win rate

**How to Validate:**

1. **Support Tickets:** Monitor tickets questioning win rate calculations or asking why pushes are excluded. Baseline: <3 tickets/month. Red flag: >10 tickets/month suggests formula needs better UI explanation.
2. **User Surveys:** Quarterly survey question: "Do you understand that win rate excludes pushes?" Target: >85% understand the standard definition. Red flag: <60% understanding indicates need for tooltip or documentation.
3. **Telemetry:** Track tooltip/info icon clicks on win rate displays. Low engagement (<15% of users who view win rate) may indicate missing or unclear explanation.
4. **Action Trigger:** If >15 tickets/month about win rate formula OR survey shows <50% understanding, add prominent tooltip explaining "Wins ÷ (Wins + Losses), excludes pushes and pending" formula.

---

## 5. Future Extensibility Notes

### 5.1 Adding a New Sport

**What Would Need to Change:**

- `data/referenceData.ts`: Add to `SPORTS` array, add teams and stat types
- `services/marketClassification.config.ts`: Add sport-specific stat mappings if needed
- `normalizationService.ts`: Auto-picks up new entries on next `refreshLookupMaps()`

**Files to Change:**

- `data/referenceData.ts`: Add sport to `SPORTS` array (line 16), add `TeamInfo[]` entries to `TEAMS` array (line 43), add stat type entries to `STAT_TYPES` array
- `services/marketClassification.config.ts`: Add sport-specific stat mappings in `SPORT_STAT_MAPPINGS` if needed
- `normalizationService.ts`: No code changes required (auto-picks up new entries via `refreshLookupMaps()`)

**Test Checklist:**

- [ ] New sport appears in sport filter dropdowns across all views (DashboardView, BySportView, BetTableView, PlayerProfileView)
- [ ] Import from sportsbook HTML containing new sport parses correctly (test with sample HTML)
- [ ] Market classification assigns correct `MarketCategory` for new sport's bet types
- [ ] Entity stats (player/team) include bets from new sport in aggregation calculations
- [ ] Team/player normalization resolves abbreviations correctly for new sport (test collision scenarios)
- [ ] BySportView displays new sport in stats table with correct totals (wagered, net, win rate)
- [ ] DashboardView includes new sport bets in overall totals and KPIs
- [ ] Cross-sport collision detection works correctly (e.g., shared abbreviations like "ATL" resolve appropriately)

**Fragility Risk:** Low. The system is designed for sport extensibility.

---

### 5.2 Adding a New Bet Type

**What Would Need to Change:**

- `types.ts`: Add to `BetType` union
- `filterPredicates.ts`: Decide if it's "parlay-like" for filter purposes
- `displaySemantics.ts`: Decide if `isParlayBetType()` should include it

**Files to Change:**

- `types.ts`: Add new bet type to `BetType` union (line 38)
- `utils/filterPredicates.ts`: Update `isParlayType()` function (line 25) if new type is parlay-like
- `services/displaySemantics.ts`: Update `isParlayBetType()` function (line 204) if new type should be treated as parlay
- `services/entityStatsService.ts`: Verify `isParlayBetType()` usage (line 79) handles new type correctly
- `services/aggregationService.ts`: Verify parlay exclusion logic handles new type if applicable
- `views/*.tsx`: Check all views that filter by bet type (BetTableView, DashboardView, BySportView)

**Test Checklist:**

- [ ] New bet type appears in bet type filter dropdowns (if exposed in UI)
- [ ] Import from sportsbook HTML containing new bet type parses correctly and assigns correct `betType` field
- [ ] Market classification assigns appropriate `MarketCategory` for new bet type
- [ ] If parlay-like: Entity stats exclude new bet type from money calculations (wagered, net, ROI)
- [ ] If parlay-like: Filter predicates correctly identify new bet type as parlay (test "Parlays" filter)
- [ ] If single-like: Entity stats include new bet type in money calculations
- [ ] Collision detection works correctly for new bet type (if applicable to entity matching)
- [ ] DashboardView and BySportView metrics correctly include/exclude new bet type based on parlay classification

**Fragility Risk:** Medium. The `isParlayBetType()` check is used in multiple places and must be updated consistently.

**Recommendation:** If adding a new bet type, audit all usages of `isParlayBetType()`.

---

### 5.3 Adding Export Functionality

**What Would Need to Change:**

- New export module consuming `Bet[]` or `FinalRow[]`
- CSV/JSON serialization logic
- Consider whether to export raw bets or transformed rows

**Files to Change:**

- `services/exportService.ts`: Create new export module (or extend existing)
- `views/SettingsView.tsx`: Add export UI controls (button, format selector) - note: basic CSV export exists (line 149)
- `views/BetTableView.tsx`: Consider adding export button in table view if needed
- `types.ts`: Verify `FinalRow` interface supports all export requirements

**Test Checklist:**

- [ ] Export button/control appears in SettingsView (or target view) and is accessible
- [ ] Export handles all bet types correctly (single, parlay, sgp, sgp_plus, live, other)
- [ ] Export preserves parlay structure (header + children) in readable format (CSV/JSON)
- [ ] Cross-sport collision metadata is included or export warns about potential collisions
- [ ] Exported data matches displayed data (verify totals, dates, amounts match UI)
- [ ] Export includes all required fields (Date, Site, Sport, Category, Type, Name, Over/Under, Line, Odds, Bet, To Win, Result, Net, Live, Tail)
- [ ] Export handles edge cases (pending bets, pushes, missing fields, undefined values)
- [ ] Exported file can be re-imported successfully (round-trip test) or clearly documents format differences

**Fragility Risk:** Low. The data model is well-defined.

**Considerations:**

- Cross-sport collision metadata should be preserved or warnings regenerated
- Parlay structure (header + children) needs clear export format

---

### 5.4 Changing Attribution Policy

**What Would Need to Change:**

- `displaySemantics.ts`: Change `STAKE_ATTRIBUTION_POLICY` to `'split'`
- `getAttributedStakeAndNet()`: Already has split logic implemented
- Views using ticket-level attribution would automatically use split

**Files to Change:**

- `services/displaySemantics.ts`: Change `STAKE_ATTRIBUTION_POLICY` constant (line 51) from `'ticket-level'` to `'split'`
- `services/displaySemantics.ts`: Verify `getAttributedStakeAndNet()` function (line ~100) split logic is correct
- `views/DashboardView.tsx`: Verify O/U breakdown calculations use new policy
- `views/BySportView.tsx`: Verify entity stats calculations use new policy
- `views/PlayerProfileView.tsx`: Verify player stats calculations use new policy
- `views/SportsbookBreakdownView.tsx`: Verify breakdown calculations use new policy

**Test Checklist:**

- [ ] O/U breakdown totals now sum to total wagered (verify with multi-leg parlay containing multiple O/U bets)
- [ ] Entity stats (player/team) show split stake attribution in wagered/net calculations
- [ ] DashboardView O/U breakdown displays correctly with split attribution (no double-counting)
- [ ] BySportView entity stats reflect split attribution (verify totals match expected split amounts)
- [ ] PlayerProfileView shows split attribution for player-level stats
- [ ] Multi-leg parlay attribution divides stake/net by leg count correctly
- [ ] Single bets remain unchanged (full stake attributed, no division)
- [ ] If policy toggle exists: UI correctly switches between ticket-level and split modes

**Fragility Risk:** Low. The policy is designed to be configurable.

**Recommendation:** Keep as opt-in flag if ever exposed to users.

---

## Prioritized Roadmap

### 1. Entity Type Helper Function (P1, Medium Effort, High Business Impact)

Create a centralized helper function to handle the dual-path entity type checking (`undefined` vs `"unknown"`). This eliminates a common source of bugs and improves developer experience. Impact: Prevents misclassification issues and makes the codebase more maintainable. Effort: ~4 hours to implement and refactor existing usages.

### 2. UI Clarity Improvements (P2, Small Effort, Medium Business Impact)

Add tooltips and clarifying labels to column headers and filters. Update "Win Rate" to "Win % (excl. pushes)", add info icons to "Singles Wagered" columns explaining parlay exclusion, and clarify "Parlays" filter semantics. Impact: Reduces user confusion and support questions. Effort: ~2-3 hours for design and implementation.

### 3. Cross-Sport Collision Documentation (P2, Small Effort, Low Business Impact)

Document known abbreviation collisions (ATL, NY, etc.) in the import guide with resolution strategies. Impact: Helps users understand and resolve import warnings proactively. Effort: ~1 hour to document existing behavior.

### 4. Data Model Documentation (P2, Small Effort, Low Business Impact)

Create `docs/DATA_MODEL_NOTES.md` explaining BetType vs isLive conventions, entityType semantics, and result case conventions. Impact: Onboards new developers faster and prevents tribal knowledge loss. Effort: ~2 hours to write comprehensive notes.

### 5. Code Comment Cleanup (P2, Extra Small Effort, Low Business Impact)

Add strategic comments to key decision points (entity type checking, attribution policy, win rate calculation) to preserve rationale. Impact: Reduces time spent understanding code intent. Effort: ~1 hour to add comments to critical sections.

---

## Product Opportunities

### 1. Export Functionality

Enable users to export their betting data as CSV or JSON for backup, sharing, or analysis in external tools. This addresses a common user need and unlocks workflows beyond the app. Implementation would leverage existing `FinalRow[]` format and add serialization logic.

### 2. Advanced Filtering & Search

Add full-text search across bet descriptions, date range presets (Last 7 Days, This Month, This Season), and multi-select filters for sports/books. Would significantly improve usability for users with large betting histories.

### 3. Performance Comparison Views

Allow users to compare performance across time periods (e.g., "This Month vs Last Month") or sportsbooks side-by-side. Provides actionable insights about betting patterns and helps identify profitable strategies or book advantages.

### 4. Bet Pattern Analysis

Surface insights like "win rate by day of week", "performance by bet type", or "best performing stat types" to help users optimize their betting strategy. Could identify trends like "I perform better on weekends" or "Over/Under bets are more profitable than spreads."

### 5. Alerts & Notifications (Future)

For a future version with backend integration, add notifications for bet settlements, profit/loss thresholds, or performance milestones. Could also include weekly summary emails with key statistics.

---

## Summary

The BetTracker system is well-architected with clear separation of concerns. The primary areas requiring awareness are:

1. **Dual-path entity type checking** - Remember to check both `undefined` and `"unknown"`
2. **Parlay filter semantics** - "Parlays" includes SGP variants
3. **Attribution policy** - Ticket-level is intentional, not a bug
4. **Cross-sport collisions** - First match wins, badges warn users

All identified concerns have acceptable trade-offs documented above. The system is ready to ship with these behaviors understood.

---

_End of Final Review Notes_
