# Import System Gap Analysis (End-to-End Foundation Review)

**Date:** 2025-12-21  
**Scope:** Full Import Process - Input to Storage to Display  
**Approach:** Structural Foundation Analysis (not "does it work" but "is it correctly aligned")

---

## 1. What the System Is Trying to Be

The import system is intended to be a **complete data ingestion pipeline** that transforms raw HTML from sportsbook bet history pages into structured, normalized, and persistent betting records. It aims to:

1. **Accept heterogeneous input** from multiple sportsbooks (FanDuel, DraftKings, etc.)
2. **Parse and extract** structured bet data from unstructured HTML
3. **Normalize and classify** bets into consistent categories, types, and entities
4. **Allow user review and correction** before final import
5. **Persist data** to local storage with deduplication
6. **Display data** in a spreadsheet-like editable interface
7. **Support future extensibility** for new sportsbooks and bet types

The system aspires to be a **single source of truth** for bet tracking, with clean separation between:
- Input/parsing concerns
- Business logic (classification, normalization, calculations)
- State management and persistence
- UI presentation

---

## 2. What the System Currently Is

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            INPUT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ImportView.tsx                                                         │
│  ├── Sportsbook selector                                                │
│  ├── HTML textarea (manual paste)                                       │
│  └── "Parse & Review" button                                            │
│       ↓                                                                 │
│  ManualPasteSourceProvider → PageSourceProvider interface               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                          PARSING LAYER                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  importer.ts::parseBets()                                               │
│       ↓                                                                 │
│  pageProcessor.ts::processPage()                                        │
│       ↓                                                                 │
│  ┌─────────────────┐     ┌─────────────────────┐                        │
│  │ FanDuel Parser  │     │ DraftKings Parser   │                        │
│  │ (Implemented)   │     │ (PLACEHOLDER ONLY)  │                        │
│  └────────┬────────┘     └─────────────────────┘                        │
│           ↓                                                             │
│  parsers/single.ts, parsers/parlay.ts, parsers/common.ts                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                              Bet[] objects
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      CONFIRMATION LAYER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ImportConfirmationModal.tsx                                            │
│  ├── Table preview of parsed bets                                       │
│  ├── Issue detection (missing sport, unknown players)                   │
│  ├── Inline editing capabilities                                        │
│  ├── Add player/sport on-the-fly                                        │
│  └── Confirm/Cancel buttons                                             │
│       ↓                                                                 │
│  getLegCategory() - DUPLICATED logic for market classification          │
│  getBetIssues() - Validation at display time only                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                           User confirms
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        STORAGE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  useBets.tsx::addBets()                                                 │
│  ├── Deduplication by bet.id                                            │
│  ├── Fallback classification (if missing)                               │
│  ├── Entity extraction (players/teams auto-add)                         │
│  └── localStorage persistence                                           │
│       ↓                                                                 │
│  classificationService.ts::classifyBet()                                │
│  normalizationServiceDynamic.ts (reads from localStorage)               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                          localStorage
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                        DISPLAY LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  BetTableView.tsx                                                       │
│  ├── useBets() hook to get Bet[]                                        │
│  ├── betToFinalRows() conversion                                        │
│  ├── FlatBet intermediate type                                          │
│  ├── Spreadsheet-style editing                                          │
│  └── Copy/paste, drag-fill support                                      │
│       ↓                                                                 │
│  betToFinalRows.ts                                                      │
│  ├── Bet → FinalRow[] conversion                                        │
│  ├── Leg deduplication                                                  │
│  ├── Category classification (THIRD location of this logic)             │
│  └── Type determination                                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Characteristics

1. **Working but fragmented**: Each layer functions, but layers don't share a unified model
2. **Classification logic scattered**: Market category determination happens in at least 4 places
3. **Two normalization services**: Static (`normalizationService.ts`) and dynamic (`normalizationServiceDynamic.ts`)
4. **Validation is presentation-only**: `getBetIssues()` runs in the modal but doesn't prevent import
5. **Entity auto-extraction**: Happens during import, guesses player vs team based on keywords
6. **Reference data fragmentation**: Some in `data/referenceData.ts`, some in localStorage, some hardcoded

---

## 3. The Ideal Foundation

A well-designed import system should have:

### 3.1 Clear Data Flow with Single Source of Truth

```
HTML Input
    ↓
┌──────────────────┐
│   Parse Layer    │  Output: RawBet (unvalidated, unnormalized)
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Validation Layer │  Output: ValidatedBet or ValidationErrors
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Normalization    │  Output: NormalizedBet (canonical names, types)
│    Layer         │  Single source: NormalizationService
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Classification   │  Output: ClassifiedBet (category assigned)
│    Layer         │  Single source: ClassificationService
└────────┬─────────┘
         ↓
┌──────────────────┐
│ User Review &    │  Output: FinalBet (user-approved)
│ Correction       │  
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Storage Layer    │  Persistence with deduplication
└────────┬─────────┘
         ↓
┌──────────────────┐
│ Display Layer    │  Pure transformation Bet → UI
└──────────────────┘
```

### 3.2 Single Ownership Per Concern

| Concern | Single Owner | Current State |
|---------|--------------|---------------|
| Market Classification | ClassificationService | 4+ locations |
| Stat Type Normalization | NormalizationService | 2 services |
| Entity Normalization | NormalizationService | Partial, localStorage-based |
| Bet Validation | ValidationService | Modal-only, post-hoc |
| Calculations | BetCalculations | Duplicated in hooks/views |
| Type Definitions | types.ts | Correct |

### 3.3 Clean Extensibility Points

- **Parser Interface**: Abstract contract for sportsbook parsers
- **Normalization Data**: Single, extensible reference data source
- **Validation Rules**: Pluggable validators
- **Storage Abstraction**: Interface over localStorage for future backend

---

## 4. The Gaps

### Gap 1: Market Classification Logic is Fragmented

**Current State:**
- `classificationService.ts::classifyBet()` - Main classification
- `betToFinalRows.ts::classifyLegCategory()` - Leg-level classification
- `ImportConfirmationModal.tsx::getLegCategory()` - UI classification
- `parsing/shared/betToFinalRows.ts::determineType()` - Type extraction

**Ideal State:**  
Single `ClassificationService` that all layers call.

**Why It Matters:**
- A bet classified as "Props" in the parser could be reclassified as "Main Markets" in the modal
- Leg-level and bet-level classification use different keyword lists
- Debugging classification issues requires checking 4 files

**Risk: HIGH** - Foundational inconsistency that compounds over time

---

### Gap 2: Dual Normalization Services

**Current State:**
- `normalizationService.ts` - Static, imports from `referenceData.ts`
- `normalizationServiceDynamic.ts` - Reads from localStorage

**Which is Used Where:**
- `classificationService.ts` imports from dynamic service
- `parsing/shared/utils/index.ts` imports from static service
- UI uses `useInputs()` which manages its own lists

**Ideal State:**  
One normalization service with one data source (could be localStorage-backed but with single interface).

**Why It Matters:**
- A team alias added via UI may not be recognized by parsers
- Static service has hardcoded NBA/NFL teams; dynamic starts empty
- No synchronization between the two

**Risk: HIGH** - Silent mismatches between import and display

---

### Gap 3: Validation is Not a Gate

**Current State:**
- `getBetIssues()` runs in `ImportConfirmationModal.tsx`
- Returns warnings like "Player not in database", "Sport missing"
- **User can click "Import" anyway** with unresolved issues
- `utils/validation.ts` exists but only validates after import in `updateBet()`

**Ideal State:**  
Validation pipeline with:
1. Pre-import validation (blocking critical issues)
2. Import-time validation (logged warnings)
3. Post-import validation (edit constraints)

**Why It Matters:**
- Invalid bets get into localStorage
- Downstream calculations may fail or produce NaN
- Data quality degrades silently

**Risk: MEDIUM** - Works until edge case corrupts data

---

### Gap 4: Entity Type Guessing (Player vs Team)

**Current State:**  
`useBets.tsx::addBets()` contains 40 lines of heuristic logic to guess if an entity is a player or team:

```typescript
const teamMarketKeywords = ['moneyline', 'ml', 'spread', 'total', ...];
const playerMarketKeywords = ['player', 'prop', 'yards', 'points', ...];
// ...guessing logic...
if (teamSports.includes(bet.sport)) {
  addTeam(bet.sport, entity);
} else {
  addPlayer(bet.sport, entity);
}
```

**Ideal State:**  
- Parser knows entity type based on bet structure
- Normalization service provides canonical entity with type
- No guessing in state management layer

**Why It Matters:**
- "Phoenix Suns Over 220.5" - "Phoenix Suns" added as player in some contexts
- Team totals vs player totals distinguished only by keyword matching
- Entity lists grow with garbage entries

**Risk: MEDIUM** - Data pollution, hard to clean up

---

### Gap 5: FinalRow ↔ Bet Impedance Mismatch

**Current State:**
- `Bet` is the storage model
- `FinalRow` is the spreadsheet display model
- `FlatBet` is a third intermediate model in `BetTableView.tsx`
- Conversion: `Bet` → `betToFinalRows()` → `FinalRow[]` → `flattenedBets()` → `FlatBet[]`

**Problems:**
- `FinalRow.Type` is extracted from `leg.market` or `bet.type` with fallback logic
- `FlatBet` re-extracts values from `FinalRow` strings (parsing formatted strings)
- Parlay legs have parent bet metadata duplicated per row

**Ideal State:**
- Display model derived directly from storage model
- No string parsing of formatted values
- Single transformation layer

**Risk: MEDIUM** - Complexity, potential for display ≠ storage

---

### Gap 6: Leg Deduplication at Wrong Layer

**Current State:**  
`betToFinalRows.ts` contains complex deduplication logic (lines 472-579):
- Builds key from `entity|market|target|ou`
- Merges legs with same loose key
- Handles cases where one leg has target, other doesn't

**Why This is Wrong:**
- Deduplication is a **parsing concern**, not a display concern
- Parser should output deduplicated legs
- Current approach hides parser bugs at display time

**Ideal State:**  
Parser outputs clean, deduplicated legs. Display trusts parser output.

**Risk: LOW-MEDIUM** - Works but masks upstream issues

---

### Gap 7: Reference Data Has No Single Source

**Current State:**
| Data Type | Location |
|-----------|----------|
| Teams | `referenceData.ts` (static), localStorage (dynamic) |
| Stat Types | `referenceData.ts` (static), localStorage (dynamic), `betToFinalRows.ts` (inline mappings) |
| Market Types | `betToFinalRows.ts::MAIN_MARKET_TYPES`, `classificationService.ts` keywords |
| Future Types | `referenceData.ts`, `betToFinalRows.ts::FUTURES_TYPES` |
| Sports | `referenceData.ts`, `useInputs.tsx` defaults |

**Ideal State:**  
Single reference data module that all services import from.

**Risk: MEDIUM** - Drift between sources causes classification inconsistencies

---

### Gap 8: DraftKings Parser is Non-Functional

**Current State:**  
`parsing/draftkings/parsers/index.ts` returns hardcoded sample bets:

```typescript
// The DraftKings parser doesn't actually parse HTML.
// It just returns two hardcoded example bets.
```

**Impact:**
- Users selecting DraftKings get fake data
- No indication in UI that it's non-functional
- Listed in sportsbook dropdown as available option

**Risk: HIGH** - Actively misleading users

---

### Gap 9: Error Handling Philosophy is Inconsistent

**Current State:**
| Layer | Error Handling |
|-------|----------------|
| Parser | Returns empty array, logs to console |
| Importer | Throws Error, caught by ImportView |
| Confirmation Modal | Shows warning icons, allows import |
| Storage | Silent localStorage errors |
| Display | Renders "Invalid" for unparseable dates |

**Ideal State:**  
Consistent Result type (`{ success: T } | { error: string }`) or structured errors.

**Risk: MEDIUM** - Debugging requires checking multiple layers

---

### Gap 10: Live Bet Detection is Inconsistent

**Current State:**
- `Bet.isLive` is a boolean field
- `Bet.betType` has a `"live"` variant (never used)
- Parser doesn't detect live bets (always `isLive: false`)
- `betToFinalRows.ts` uses `bet.isLive`, not `bet.betType === 'live'`

**Why This Matters:**
- User has to manually check "Live" for every in-game bet
- `betType: 'live'` in the type definition is dead code

**Risk: LOW** - Inconvenience, not data corruption

---

## 5. Risk Ranking

### 🔴 HIGH RISK (Foundational Flaws)

| Gap | Issue | Impact |
|-----|-------|--------|
| **Gap 1** | Classification logic in 4+ places | Data inconsistency, hard to fix |
| **Gap 2** | Dual normalization services | Silent mismatches import vs display |
| **Gap 8** | DraftKings parser is fake | Actively misleading users |

### 🟡 MEDIUM RISK (Future Friction)

| Gap | Issue | Impact |
|-----|-------|--------|
| **Gap 3** | Validation not a gate | Invalid data enters storage |
| **Gap 4** | Player/team guessing | Data pollution in entity lists |
| **Gap 5** | FinalRow/Bet/FlatBet impedance | Complexity, potential mismatch |
| **Gap 7** | Reference data fragmentation | Classification drift |
| **Gap 9** | Inconsistent error handling | Difficult debugging |

### 🟢 LOW RISK (Cleanup)

| Gap | Issue | Impact |
|-----|-------|--------|
| **Gap 6** | Leg dedup at wrong layer | Masks parser bugs |
| **Gap 10** | Live bet detection | Minor inconvenience |

---

## 6. Fix Direction

### High-Level Strategy: Consolidation Before Extension

The system needs **consolidation of concerns** before adding new sportsbooks or features. The current "working parts" approach will become unmaintainable.

### Phase 1: Consolidate Classification (Fix Gap 1)

**What to do:**
1. Create `services/marketClassification.ts` as single source
2. Move `classifyBet()`, `classifyLegCategory()` there
3. Delete duplicate implementations in modal and betToFinalRows
4. All layers import and call the same service

**What NOT to preserve:**
- Inline keyword lists in `betToFinalRows.ts`
- `getLegCategory()` in `ImportConfirmationModal.tsx`

### Phase 2: Unify Normalization (Fix Gap 2)

**What to do:**
1. Delete `normalizationServiceDynamic.ts`
2. Make `normalizationService.ts` read from localStorage if available, fallback to `referenceData.ts`
3. Single service, single interface

**What NOT to preserve:**
- Two parallel services with different data sources

### Phase 3: Add Validation Gate (Fix Gap 3)

**What to do:**
1. Expand `utils/validation.ts` with `validateBet()` for all required fields
2. Call validation in `parseBets()` before returning
3. Import button disabled until critical issues resolved

**What NOT to preserve:**
- "Import anyway" with unresolved critical issues

### Phase 4: Fix DraftKings or Remove (Fix Gap 8)

**Decision required:**
- **Option A**: Implement real DraftKings parser (significant work)
- **Option B**: Remove DraftKings from dropdown, document limitation

**What NOT to preserve:**
- Placeholder parser returning fake data while appearing functional

### Phase 5: Simplify Display Model (Fix Gap 5)

**What to do:**
1. Remove `FlatBet` intermediate type
2. `BetTableView` consumes `FinalRow[]` directly
3. `betToFinalRows()` is the only transformation

**What NOT to preserve:**
- Multiple transformation layers with string parsing

### Future Considerations

- **Parser Interface**: When adding new sportsbooks, create abstract `Parser` interface
- **Storage Abstraction**: Wrap localStorage in interface for future backend
- **Test Coverage**: Each service should have unit tests before refactoring

---

## Summary

The import system is a **collection of working parts** that achieves its functional goals but is **not structurally sound**. The main issues are:

1. **Scattered ownership**: Classification, normalization, and validation logic duplicated across layers
2. **No single source of truth**: Reference data in multiple locations with no sync
3. **Permissive validation**: Invalid data can enter storage
4. **Hidden non-functionality**: DraftKings parser is fake

The system should be **refactored incrementally**, starting with classification consolidation, before adding new features. The goal is to establish **clear ownership per concern** and **single data flow** so that:

- Changing classification rules requires editing one file
- Adding a new sportsbook parser follows a clear interface
- Data quality is enforced at import time, not discovered at display time

**Bottom line**: The foundation needs re-centering around unified services before the system can scale reliably.
