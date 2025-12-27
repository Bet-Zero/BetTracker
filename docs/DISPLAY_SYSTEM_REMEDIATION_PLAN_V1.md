# Display System Remediation Plan v1

> [!NOTE]
> **This is remediation planning; separate from diagnostic gap analysis.**
> 
> This document was extracted from the Gap Analysis to maintain separation of concerns.
> The Gap Analysis remains diagnostic-only; this document contains actionable fix recommendations.

---

## Initial Fix Direction (NO CODE YET)

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

## Priority Fixes

### P1: Semantic Alignment — SGP+ Handling

**Issue:** DashboardView excludes `sgp_plus` from the "parlays" filter; PlayerProfileView includes it.

**DashboardView.tsx:724 (current):**
```typescript
if (bet.betType !== "sgp" && bet.betType !== "parlay") return false;
```

**PlayerProfileView.tsx:478-484 (current):**
```typescript
filtered = filtered.filter(
  bet =>
    bet.betType === "sgp" ||
    bet.betType === "sgp_plus" ||
    bet.betType === "parlay"
);
```

> ⚠️ Both are logically correct, but they differ in whether `sgp_plus` is considered a parlay type.

**Recommended Fix:** Align DashboardView to include `sgp_plus`:

```typescript
// DashboardView.tsx:724 — ALIGNED
if (bet.betType !== "sgp" && bet.betType !== "sgp_plus" && bet.betType !== "parlay") return false;
```

**Alternative:** Create a shared predicate in `utils/filterPredicates.ts`:

```typescript
export const isParlayType = (betType: string): boolean =>
  betType === "sgp" || betType === "sgp_plus" || betType === "parlay";
```

Then both views use `isParlayType(bet.betType)`.

### P1: Unify Date Format Locale

1. **Align date format locale** — SportsbookBreakdownView uses 'en-CA'; PlayerProfileView uses 'en-CA'; DashboardView/BySportView use default locale
2. **Recommendation:** Standardize on `toLocaleDateString('en-CA')` for YYYY-MM-DD chart grouping, or create `utils/formatters.ts` with explicit format functions

### P2: Code Quality

1. **Extract shared filter predicates**
2. **Extract shared aggregation utilities**
3. **Remove redundant `bets` dependency from DashboardView processedData useMemo**

---

*End of Display System Remediation Plan v1*
