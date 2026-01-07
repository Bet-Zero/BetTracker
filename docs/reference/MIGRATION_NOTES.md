<!-- PERMANENT DOC - DO NOT DELETE -->

# Migration Notes

## Breaking Change: BetLeg.odds Type Change

**Date:** 2025-12-15

**Change:** The `odds` property on `BetLeg` interface was changed from `number | null` to `number | undefined` (still optional).

**Impact:** This is a breaking change for any code that:

- Assigns `null` to `odds` property
- Checks for `odds === null` or `odds !== null`

**Migration Steps:**

1. **Replace null assignments with undefined:**

   ```typescript
   // Before
   leg.odds = null;

   // After
   leg.odds = undefined;
   // or simply omit the field
   ```

2. **Update null checks:**

   ```typescript
   // Before
   if (leg.odds === null || leg.odds === undefined) { ... }
   if (leg.odds !== null && leg.odds !== undefined) { ... }

   // After
   if (leg.odds === undefined) { ... }
   if (leg.odds !== undefined) { ... }

   // Or use loose equality (checks both null and undefined)
   if (leg.odds == null) { ... }
   if (leg.odds != null) { ... }
   ```

3. **Update function return types:**
   - `extractOdds()` now returns `number | undefined` instead of `number | null`
   - `normalizeOdds()` now accepts `number | undefined` instead of `number | null | undefined`

**Files Updated:**

- `types.ts` - BetLeg interface
- `parsing/fanduel/parsers/common.ts` - extractOdds, normalizeOdds, ParseLegOptions, BuildLegsFromRowsOptions
- `parsing/shared/betToFinalRows.ts` - normalizeOdds function
- `parsing/fanduel/parsers/parlay.ts` - buildGroupLegFromContainer and related functions
- `views/BetTableView.tsx` - formatOdds function
- `components/ImportConfirmationModal.tsx` - odds display logic

**Rationale:** Using `undefined` instead of `null` for optional properties is more idiomatic in TypeScript and aligns with how optional properties work in the type system.
