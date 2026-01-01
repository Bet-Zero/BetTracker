# Phase 5: Bet Types Taxonomy Return Package

## Summary
The "Stat Types" management system has been upgraded to a broader "Bet Types" taxonomy. The UI nowsupports four distinct categories: **Props**, **Main Markets**, **Parlays**, and **Futures**. Canonical seed data for Parlays and Futures has been added and refined to be sport-specific where appropriate (e.g., "NBA MVP" vs "NFL MVP"). All existing functionality (editing, aliases, disabling) remains intact.

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
**NBA**
- NBA Championship
- NBA MVP
- NBA DPOY
- NBA ROY
- NBA 6MOY
- NBA MIP
- NBA COTY
- NBA Conference Winner
- NBA Division Winner

**NFL**
- Super Bowl
- NFL MVP
- NFL OPOY
- NFL DPOY
- NFL OROY
- NFL DROY
- NFL CPOY
- NFL COTY
- NFL Conference Winner
- NFL Division Winner

**MLB**
- World Series
- MLB MVP
- Cy Young
- MLB ROY
- MLB Manager of the Year

**NHL**
- Stanley Cup
- Hart Trophy
- Vezina Trophy
- Norris Trophy
- Calder Trophy

**Generic**
- Win Total
- Make Playoffs
- Miss Playoffs

### Props
- *Default category for all other stat types (Points, Rebounds, Assists, etc.)*

## Changes Summary

| File | Purpose |
|------|---------|
| `views/InputManagementView.tsx` | Renamed "Stat Types" tab to "Bet Types". |
| `components/InputManagement/StatTypesManager.tsx` | Implemented 4-category tabs and filtering logic. Now uses `betTypeUtils` for categorization. |
| `data/referenceData.ts` | Added `PARLAY_TYPES` and `FUTURE_TYPES` (exploded to sport-specific awards). |
| `services/normalizationService.ts` | Updated `loadStatTypes` to include Main Markets, Futures, and Parlays in the base seed data. |
| `utils/betTypeUtils.ts` | **[NEW]** Centralized grouping logic and canonical definition sets. |
| `utils/betTypeUtils.test.ts` | **[NEW]** Unit tests ensuring correct bucket assignment. |

## Validation Results
- **Unit Tests:** `utils/betTypeUtils.test.ts` passed (verified sport-specific categorization).
- **Manual Check:**
    - "Bet Types" tab label verified.
    - Futures imported as distinct sport-specific types (e.g., NBA MVP).
    - Parlays and Main Markets categorize correctly.

