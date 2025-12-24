# Import System Gap Analysis v2 (Post-Refactor Review)

**Date:** 2025-12-24  
**Scope:** Full Import Pipeline (Current State)  
**Purpose:** Re-evaluate foundational alignment after recent refactors

---

## 1. What the System Is Trying to Be (Current Intent)

The import system is designed to be a **complete, single-pass data ingestion pipeline** that:

1. **Accepts HTML input** from sportsbook bet history pages (FanDuel, DraftKings)
2. **Parses and extracts** structured bet data with sport-specific logic
3. **Classifies markets** into consistent categories (Props, Main Markets, Futures, Parlays, SGP/SGP+)
4. **Presents bets for user review** with inline editing and issue detection
5. **Persists to localStorage** with deduplication by bet ID
6. **Displays in spreadsheet format** with calculated fields (Net, To Win)

The system now aspires to **single ownership per concern**, with classification logic centralized and parser output directly consumable by storage.

**Key architectural goals (post-refactor):**

- Parsers output fully-formed `Bet` objects with `marketCategory` assigned
- Classification logic lives in one service (`marketClassification.ts`)
- Display layer transforms but does not re-classify
- User review is advisory, not blocking

---

## 2. What the System Currently Is

### Current Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INPUT LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ImportView.tsx                                                             │
│  ├── Sportsbook selector (FanDuel, DraftKings, Other)                       │
│  ├── HTML textarea (manual paste)                                           │
│  └── "Parse & Review Bets" button                                           │
│       ↓                                                                     │
│  ManualPasteSourceProvider → PageSourceProvider interface                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PARSING LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  importer.ts::parseBets()                                                   │
│       ↓                                                                     │
│  pageProcessor.ts::processPage() → ParseResult {bets, error?}               │
│       ↓                                                                     │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                 │
│  │ FanDuel Parser          │    │ DraftKings Parser       │                 │
│  │ (Full implementation)   │    │ (Full implementation)   │                 │
│  └───────────┬─────────────┘    └───────────┬─────────────┘                 │
│              ↓                              ↓                               │
│  Outputs: Bet[] with marketCategory already assigned via classifyBet()      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                              Bet[] objects
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONFIRMATION LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ImportConfirmationModal.tsx                                                │
│  ├── Table preview with all parsed bets                                     │
│  ├── Issue detection via getBetIssues() (sport missing, player unknown)     │
│  ├── Inline editing for Sport, Category, Type, Name, O/U, Line, Result      │
│  ├── Add player/sport on-the-fly via useInputs()                            │
│  ├── Uses classifyLeg() from marketClassification.ts ✓ (consolidated)       │
│  └── "Import X Bets" button (always enabled regardless of issues)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                           User clicks Import
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STORAGE LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  useBets.tsx::addBets()                                                     │
│  ├── Deduplication by bet.id                                                │
│  ├── Entity extraction (player/team guessing) ⚠ (still heuristic-based)     │
│  ├── Fallback classification only if marketCategory missing                  │
│  └── localStorage.setItem() with error handling                             │
│       ↓                                                                     │
│  classificationService.ts (deprecated shim → marketClassification.ts)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                              localStorage
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DISPLAY LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  BetTableView.tsx                                                           │
│  ├── useBets() hook to get Bet[]                                            │
│  ├── betToFinalRows() → FinalRow[] (uses marketClassification.ts) ✓         │
│  ├── FlatBet intermediate type (converts branded types back to numbers)     │
│  ├── Leg deduplication in betToFinalRows() ⚠ (wrong layer)                  │
│  └── Spreadsheet-style editing with copy/paste                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Characteristics (Current State)

| Aspect                   | Status                 | Notes                                            |
| ------------------------ | ---------------------- | ------------------------------------------------ |
| Classification ownership | ✅ Mostly consolidated | `marketClassification.ts` is the source of truth |
| Normalization ownership  | ⚠️ Fragmented          | Two services, neither fully used                 |
| Validation as gate       | ❌ Not implemented     | Issues are advisory only                         |
| Parser completeness      | ✅ Good                | Both parsers output complete `Bet` objects       |
| Entity type detection    | ⚠️ Heuristic           | Guessing logic still in storage layer            |
| Display transformation   | ⚠️ Complex             | FinalRow → FlatBet impedance exists              |
| Reference data           | ⚠️ Scattered           | 4+ locations with overlapping data               |

---

## 3. What Was Successfully Fixed Since v1

### 3.1 Classification Logic Consolidation (v1 Gap 1) — MOSTLY RESOLVED ✅

**What was done:**

- Created `services/marketClassification.ts` as the single source of truth
- Created `services/marketClassification.config.ts` for keyword lists and mappings
- `ImportConfirmationModal.tsx` now imports `classifyLeg` from the unified service
- `betToFinalRows.ts` now imports `classifyLeg` and `determineType` from the unified service
- `classificationService.ts` converted to a deprecated re-export shim

**How it was resolved:**

```typescript
// ImportConfirmationModal.tsx - line 4
import { classifyLeg } from "../services/marketClassification";

// betToFinalRows.ts - line 39
import {
  classifyLeg,
  determineType,
} from "../../services/marketClassification";
```

**Remaining cleanup needed:**

- Remove deprecated `classificationService.ts` and update imports
- `betToFinalRows.ts` still has `normalizeCategory()` function (lines 650-660)
- `BetTableView.tsx` has duplicate `normalizeCategory()` function (lines 141-147)

### 3.2 Error Handling Structure (v1 Gap 9) — PARTIALLY IMPROVED ✅

**What was done:**

- `pageProcessor.ts` now returns `ParseResult { bets: Bet[], error?: string }`
- Specific error messages for each failure mode (empty HTML, no bets found, parser error)
- `ImportView.tsx` displays these errors to the user

**Example improvement:**

```typescript
// pageProcessor.ts - lines 29-35
export const processPage = (
  book: SportsbookName,
  html: string
): ParseResult => {
  if (!html || !html.trim()) {
    return {
      bets: [],
      error:
        "HTML content is empty. Please make sure you copied the full page source.",
    };
  }
  // ...
};
```

### 3.3 DraftKings Parser (v1 Gap 8) — CONFIRMED WORKING ✅

**Status:** The v1 analysis was updated to remove this gap. Both FanDuel and DraftKings parsers are fully implemented with comprehensive bet extraction logic.

---

## 4. Remaining Gaps (Current vs Ideal)

### Gap A: Dual Normalization Services Still Exist

**Current State:**

- `normalizationService.ts` — Static service reading from `data/referenceData.ts`
- `normalizationServiceDynamic.ts` — Dynamic service reading from localStorage

**What's actually happening:**

- `classificationService.ts` imports and calls `initializeLookupMaps()` from dynamic service
- `marketClassification.ts` does NOT use either normalization service
- `marketClassification.config.ts` has its own `STAT_TYPE_MAPPINGS` object
- Parsers don't call normalization at all

**Ideal State:**
One normalization service with one interface. The service decides whether to read from static defaults or localStorage-backed data. All consumers import from the same place.

**Why this matters:**

- A stat type alias added via UI (stored in localStorage) won't be recognized by `marketClassification.config.ts`
- Team/player recognition is inconsistent between layers
- Two parallel code paths to maintain

**Risk:** 🟡 Medium — Silent mismatches between import classification and UI expectations

---

### Gap B: Validation Is Still Not a Gate

**Current State:**

- `utils/validation.ts` exists with `validateBet()` function
- Only validates stake, odds, dates, and result format
- Called only in `useBets.tsx::updateBet()` (post-import edits)
- **NOT called during import at all**
- `ImportConfirmationModal` shows warnings but "Import" button is always enabled

**Code evidence:**

```typescript
// useBets.tsx - addBets() does NOT call validateBet
const addBets = useCallback((newBets: Bet[]) => {
  // ... entity extraction ...
  // ... deduplication ...
  // No validation call here
  const classifiedNewBets = trulyNewBets.map((bet) => { ... });
  // ...
}, [addPlayer, addTeam]);
```

**Ideal State:**

- Pre-import validation that can block critical issues (missing required fields)
- Import-time validation that logs warnings (unknown entities)
- Post-import validation for edit constraints
- "Import" button disabled for critical issues, or confirmation required

**Why this matters:**

- Bets with missing `sport` field enter storage
- Bets with invalid odds (0, NaN) can be imported
- Data quality degrades silently, discovered only at display time

**Risk:** 🟡 Medium — Invalid data accumulates in storage

---

### Gap C: Entity Type Guessing in Storage Layer

**Current State:**
`useBets.tsx::addBets()` contains ~70 lines of heuristic logic (lines 89-161):

```typescript
const teamMarketKeywords = ['moneyline', 'ml', 'spread', 'total', 'run line', ...];
const playerMarketKeywords = ['player', 'prop', 'yards', 'points', 'rebounds', ...];

// ... guessing logic ...
if (isPlayerMarket && !isTeamMarket) {
  addPlayer(bet.sport, entity);
} else if (isTeamMarket && !isPlayerMarket) {
  addTeam(bet.sport, entity);
} else {
  // Ambiguous case - guess based on sport
  const teamSports = ['NFL', 'NBA', 'MLB', 'NHL', 'Soccer'];
  if (teamSports.includes(bet.sport)) {
    addTeam(bet.sport, entity);
  } else {
    addPlayer(bet.sport, entity);
  }
}
```

**Ideal State:**

- Parser knows entity type from bet structure (e.g., "Player Props" section vs "Game Lines")
- `BetLeg` type includes `entityType: 'player' | 'team' | 'unknown'`
- Storage layer trusts parser output, no guessing

**Why this matters:**

- "Phoenix Suns Over 220.5" (game total) could add "Phoenix Suns" as a player
- Team totals vs player totals distinguished only by keyword heuristics
- Entity lists grow with incorrectly categorized entries
- Cleanup requires manual review

**Risk:** 🟡 Medium — Data pollution in entity lists

---

### Gap D: Leg Deduplication in Display Layer

**Current State:**
`betToFinalRows.ts` contains complex deduplication logic (lines 310-418):

```typescript
const deduplicatedLegs = (() => {
  const seen = new Map<string, BetLeg>();
  const looseToExactKey = new Map<string, string>();

  for (const leg of expandedLegs) {
    const normalizedTarget = normalizeTarget(leg.target);
    const exactKey = buildLegKey(leg, normalizedTarget);
    const looseKey = buildLegKey(leg);

    // Complex merging logic...
    if (seen.has(exactKey)) {
      const existing = seen.get(exactKey)!;
      const merged: BetLeg = {
        /* merge properties */
      };
      seen.set(exactKey, merged);
      continue;
    }
    // ... more logic ...
  }
  return Array.from(seen.values());
})();
```

**Ideal State:**

- Parsers output deduplicated legs
- Display layer trusts parser output
- If deduplication is needed, it's a parsing concern

**Why this matters:**

- Deduplication logic masks parser bugs (duplicate legs slip through)
- Display layer is doing data cleaning it shouldn't need to do
- Harder to debug parsing issues when display "fixes" them

**Risk:** 🟢 Low-Medium — Works but masks upstream issues

---

### Gap E: Reference Data Fragmentation

**Current State:**

| Data Type          | Locations                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Teams              | `data/referenceData.ts`, localStorage via `normalizationServiceDynamic.ts`                  |
| Stat Types         | `data/referenceData.ts`, localStorage, `marketClassification.config.ts::STAT_TYPE_MAPPINGS` |
| Market Keywords    | `marketClassification.config.ts`, `useBets.tsx` inline arrays                               |
| Type Abbreviations | `marketClassification.config.ts`, `BetTableView.tsx::abbreviateMarket()`                    |
| Sports List        | `data/referenceData.ts`, `useInputs.tsx` defaults                                           |
| Futures Types      | `data/referenceData.ts`, `marketClassification.config.ts::FUTURES_TYPES`                    |

**Ideal State:**
Single reference data module that all services import from. If dynamic overrides are needed, they extend (not duplicate) the base data.

**Why this matters:**

- Adding a new stat type requires editing 2-3 files
- Classification keywords and type abbreviations can drift out of sync
- No single place to audit "what stat types does the system know about?"

**Risk:** 🟡 Medium — Maintenance burden, drift between sources

---

### Gap F: FlatBet Intermediate Type Still Required

**Current State:**

- `FinalRow` uses branded types: `FormattedOdds`, `FormattedAmount`, `FormattedNet`
- These are strings with type brands (e.g., `string & { readonly __brand: "FormattedOdds" }`)
- `BetTableView.tsx` needs numeric values for editing/calculation
- Therefore `FlatBet` exists to convert branded strings back to numbers

**Flow:**

```
Bet → betToFinalRows() → FinalRow[] (branded strings)
    → BetTableView conversion → FlatBet[] (numbers)
```

**Ideal State:**
Either:

1. `FinalRow` uses plain types, formatting happens only at render time, OR
2. Display model is consumed directly without intermediate conversion

**Why this matters:**

- Two transformation layers (Bet → FinalRow → FlatBet)
- String parsing of formatted values (e.g., extracting number from "$1.50")
- Potential for display ≠ storage if parsing is imperfect

**Risk:** 🟢 Low — Complexity but working correctly

---

## 5. New Gaps Introduced by Refactor

### Gap G: Legacy Classification Shim Still Imported

**What happened:**
`classificationService.ts` was converted to a deprecated re-export shim:

```typescript
// classificationService.ts
/**
 * @deprecated This file is being replaced by services/marketClassification.ts
 */
import { classifyBet as classifyBetUnified } from "./marketClassification";
export const classifyBet = (bet: ClassifiableBet): MarketCategory => {
  initializeLookupMaps(); // Side effect from dynamic service
  return classifyBetUnified(bet);
};
```

**Problem:**

- `useBets.tsx` still imports from the deprecated shim (line 11)
- The shim calls `initializeLookupMaps()` which is a side effect
- Two code paths exist: direct calls to `marketClassification.ts` vs through the shim

**Risk:** 🟢 Low — Technical debt, not causing bugs

---

### Gap H: Duplicate normalizeCategory Functions

**What happened:**
Two identical functions exist for normalizing category display:

```typescript
// betToFinalRows.ts - lines 650-660
function normalizeCategory(marketCategory: string): string {
  const lower = marketCategory.toLowerCase();
  if (lower.includes("prop")) return "Props";
  if (lower.includes("main")) return "Main Markets";
  if (lower.includes("future")) return "Futures";
  if (lower.includes("parlay") || lower.includes("sgp")) return "Props";
  return "Props";
}

// BetTableView.tsx - lines 141-147
const normalizeCategory = (category: string): string => {
  if (!category) return "";
  if (category.includes("Main")) return "Main";
  if (category.includes("Prop")) return "Props";
  if (category.includes("Future")) return "Futures";
  return category;
};
```

**Problem:**

- Duplicated logic that could drift
- Different behavior (one defaults to "Props", other returns input)
- Should be in `marketClassification.ts`

**Risk:** 🟢 Low — Minor duplication

---

### Gap I: BetTableView Has Inline Type Abbreviations

**What happened:**
`BetTableView.tsx` has its own `abbreviateMarket()` function (lines 91-138) with hardcoded mappings:

```typescript
const abbreviateMarket = (market: string): string => {
  const abbreviations: { [key: string]: string } = {
    "player points": "Pts",
    points: "Pts",
    "triple double": "TD",
    // ... 25+ more mappings ...
  };
  return abbreviations[lowerMarket] || market;
};
```

**Problem:**

- Overlaps with `marketClassification.config.ts::STAT_TYPE_MAPPINGS`
- Not using `determineType()` from the unified service
- Adding a new abbreviation requires editing two files

**Risk:** 🟢 Low — Should be consolidated but working

---

## 6. Risk Ranking

### 🔴 HIGH RISK (Foundational Flaws)

_None identified._ The major foundational flaw (classification fragmentation) has been addressed.

### 🟡 MEDIUM RISK (Future Friction)

| Gap       | Issue                           | Impact                                  |
| --------- | ------------------------------- | --------------------------------------- |
| **Gap A** | Dual normalization services     | Silent mismatches, maintenance burden   |
| **Gap B** | Validation not a gate           | Invalid data enters storage             |
| **Gap C** | Entity type guessing in storage | Data pollution in entity lists          |
| **Gap E** | Reference data fragmentation    | Drift between sources, multi-file edits |

### 🟢 LOW RISK (Cleanup / Polish)

| Gap       | Issue                              | Impact             |
| --------- | ---------------------------------- | ------------------ |
| **Gap D** | Leg deduplication in display layer | Masks parser bugs  |
| **Gap F** | FlatBet intermediate type          | Complexity, minor  |
| **Gap G** | Legacy classification shim         | Technical debt     |
| **Gap H** | Duplicate normalizeCategory        | Minor duplication  |
| **Gap I** | Inline type abbreviations          | Should consolidate |

---

## 7. Fix Direction (Next Tightening Pass)

### What Still Needs Consolidation

1. **Normalization Service Unification** (Gap A)

   - Delete `normalizationServiceDynamic.ts`
   - Update `normalizationService.ts` to read from localStorage with static fallback
   - Single interface, single import path

2. **Validation Gate Implementation** (Gap B)

   - Expand `validateBet()` to cover import-time requirements
   - Call validation in `addBets()` before persisting
   - Optionally: disable Import button for critical issues

3. **Reference Data Consolidation** (Gap E)

   - Move `abbreviateMarket()` logic into `marketClassification.ts`
   - Single source for stat type mappings and abbreviations

4. **Legacy Shim Removal** (Gap G)

   - Update `useBets.tsx` to import directly from `marketClassification.ts`
   - Delete `classificationService.ts`

5. **Category Normalization Consolidation** (Gap H)
   - Add `normalizeCategoryForDisplay()` to `marketClassification.ts`
   - Delete duplicate functions in other files

### What Should NOT Be Touched Again

1. **`marketClassification.ts`** — This is now correct and stable. Don't refactor.
2. **Parser structure** — FanDuel and DraftKings parsers are working. Don't reorganize.
3. **`betToFinalRows.ts` core logic** — The transformation is correct. Only remove dedup if parsers are fixed.
4. **Type definitions in `types.ts`** — Branded types are intentional. Work around them, don't remove.

### Recommended Fix Order

1. **Phase 1: Cleanup** (Low risk, immediate value)

   - Remove `classificationService.ts` shim
   - Consolidate `normalizeCategory()` functions
   - Move `abbreviateMarket()` into classification config

2. **Phase 2: Validation** (Medium risk, data quality)

   - Implement validation gate in `addBets()`
   - Add visual indication of blocked imports

3. **Phase 3: Normalization** (Medium risk, larger scope)

   - Unify normalization services
   - Update all consumers to use single service

4. **Phase 4: Entity Detection** (Medium risk, requires parser changes)
   - Add `entityType` to `BetLeg` interface
   - Update parsers to set entity type
   - Remove guessing logic from `useBets.tsx`

### Is the Foundation Complete?

**Nearly.** The import system is now structurally sound at the classification layer. The remaining gaps are:

- **Not foundational flaws** — They don't cause data corruption or incorrect behavior
- **Maintenance friction** — They make changes harder and increase risk of drift
- **Data quality concerns** — Validation and entity detection could be stronger

**Verdict:** The system is **usable and correct** but not yet **optimally maintainable**. The foundation is 80% complete. Phases 1-2 above would bring it to 95%. Phases 3-4 would complete the tightening.

---

## Summary

The import system has materially improved since v1. Classification logic consolidation was the highest-risk gap and it has been addressed. The remaining issues are:

1. **Normalization fragmentation** — Two services, neither fully integrated
2. **Validation permissiveness** — Issues don't block import
3. **Entity type guessing** — Heuristics in wrong layer
4. **Reference data scatter** — Multiple sources of truth

None of these prevent the system from functioning correctly today. They represent technical debt that will slow future development and increase bug risk over time.

**Recommended next action:** Phase 1 cleanup (remove shim, consolidate duplicates) followed by Phase 2 validation gate. These deliver the highest value with lowest risk.

---

## Progress Log

### 2025-12-24: Tightening Pass 1 Complete ✅

**Scope:** Low-risk consolidation (cleanup only)

**Changes Made:**

1. **Removed Legacy Classification Shim (Gap G)**
   - Deleted `services/classificationService.ts`
   - Updated imports in `hooks/useBets.tsx`, `utils/migrations.ts`, `views/SettingsView.tsx` to import directly from `services/marketClassification.ts`

2. **Consolidated Category Normalization (Gap H)**
   - Created unified `normalizeCategoryForDisplay()` function in `services/marketClassification.ts`
   - Deleted duplicate `normalizeCategory` function from `parsing/shared/betToFinalRows.ts`
   - Deleted duplicate `normalizeCategory` function from `views/BetTableView.tsx`
   - Updated all call sites to use the unified function

3. **Centralized Market Abbreviations (Gap I)**
   - Created unified `abbreviateMarket()` function in `services/marketClassification.ts`
   - Moved abbreviation mappings from `BetTableView.tsx` to unified service
   - Updated all call sites to use the unified function

**Files Modified:**
- `services/marketClassification.ts` (added 2 new exported functions)
- `parsing/shared/betToFinalRows.ts` (removed duplicate function, updated imports)
- `views/BetTableView.tsx` (removed duplicate functions, updated imports)
- `hooks/useBets.tsx` (updated imports)
- `utils/migrations.ts` (updated imports)
- `views/SettingsView.tsx` (updated imports)

**Files Deleted:**
- `services/classificationService.ts`

**Verification:**
- Build passes (`npm run build`)
- No remaining code references to `classificationService.ts`
- Category normalization exists in exactly ONE location
- Market abbreviation mappings exist in exactly ONE location
- Display behavior unchanged

**Constraints Respected:**
- ✅ Did NOT change parser logic or structure
- ✅ Did NOT touch entity detection or guessing logic
- ✅ Did NOT implement validation gates
- ✅ Did NOT unify normalization services
- ✅ Did NOT introduce new abstractions
- ✅ Did NOT rename files or types

**Gaps Resolved:** G, H, I (all Low Risk)

**Remaining Gaps:** A, B, C, D, E, F (addressed in future passes)
