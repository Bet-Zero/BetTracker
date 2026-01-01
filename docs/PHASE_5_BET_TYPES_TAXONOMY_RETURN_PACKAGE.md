# Phase 5: Bet Types Taxonomy Return Package

## Summary
The "Stat Types" management system has been upgraded to a broader "Bet Types" taxonomy. The UI now supports four distinct categories: **Props**, **Main Markets**, **Parlays**, and **Futures**. Canonical seed data for Parlays and Futures has been added to the system, ensuring they appear alongside existing props and main markets. All existing functionality (editing, aliases, disabling) remains intact.

## Canonical Bet Types (per Category)

### Main Markets
- Moneyline
- Spread
- Total
- Over
- Under
- Run Line
- Puck Line

### Parlays
- Parlay (Aliases: Multi, Accumulator)
- SGP (Aliases: Same Game Parlay)
- SGP+ (Aliases: SGP Plus)

### Futures
- NBA Finals
- Super Bowl
- World Series
- Stanley Cup
- Win Total
- Make Playoffs
- Miss Playoffs
- MVP
- DPOY
- ROY
- 6MOY
- MIP
- COTY
- Conference Winner
- Division Winner
- Championship

### Props
- *Default category for all other stat types (Points, Rebounds, Assists, etc.)*

## Changes Summary

| File | Purpose |
|------|---------|
| `views/InputManagementView.tsx` | Renamed "Stat Types" tab to "Bet Types". |
| `components/InputManagement/StatTypesManager.tsx` | Implemented 4-category tabs and filtering logic. Now uses `betTypeUtils` for categorization. |
| `data/referenceData.ts` | Added `PARLAY_TYPES` and extended `FUTURE_TYPES` with new Awards and winners. |
| `services/normalizationService.ts` | Updated `loadStatTypes` to include Main Markets, Futures, and Parlays in the base seed data. |
| `utils/betTypeUtils.ts` | **[NEW]** Centralized grouping logic and canonical definition sets. |
| `utils/betTypeUtils.test.ts` | **[NEW]** Unit tests ensuring correct bucket assignment. |

## Schema / Storage Changes
- **None.** Logic is purely UI/seed based. Existing `statTypes` storage schema handles these new types seamlessly.

## Validation Results
- **Unit Tests:** `utils/betTypeUtils.test.ts` passed (verified categorization categories).
- **Manual Check:**
    - "Bet Types" tab shows 4 sub-tabs.
    - Parlays category shows Parlay, SGP, SGP+.
    - Futures category shows MVP, Championship, etc.
    - Main Markets shows Moneyline, Spread, etc.
    - Props shows existing player/team stats.

## Notes / Follow-ups
- While `betTypeUtils` has hardcoded lists for `FUTURE_CANONICALS` to drive UI grouping, the actual data comes from `referenceData.ts`. If new Futures are added to `referenceData.ts`, `betTypeUtils` should be updated if they need to appear in the "Futures" tab (otherwise they default to Props). A future improvement could be to derive these sets dynamically from `referenceData` imports, but hardcoding provided stability for this phase without circular dependencies.
