# EXECUTION RETURN PACKAGE — BetTable Type Scoping

**DATE**: 2026-01-11
**STATUS**: COMPLETE

---

## 1. Objective Implemented
Strictly scoped the **BetTable Type Dropdown** to prevent invalid options from appearing. Suggestions are now filtered by **Sport** AND **Category**.

- **BEFORE**: Dropping down "Type" on an NFL row showed "Stanley Cup" (Futures) and "Moneyline" (Main Markets) alongside props, regardless of category.
- **AFTER**: 
    - **Props**: Only shows Props for that Sport (e.g. "Pass Yds" for NFL).
    - **Main Markets**: Only shows Moneyline, Spread, Total.
    - **Futures**: Only shows Futures for that Sport (e.g. "Super Bowl" for NFL).
    - **Parlays**: Only shows Parlay, SGP, SGP+.

## 2. Key Changes

### `views/BetTableView.tsx`

Implemented strict filtering logic in `getTypeOptionData` and `suggestionLists.types`:

1.  **Category Mapping**: Converts row category "Props" / "Main Markets" / "Futures" to normalized internal keys (`props`, `main`, `future`, `parlay`).
2.  **Strict Filtering**:
    - **Props**: Filters Input Manager bet types by `getBetTypeCategory(canonical) === targetCategory`.
    - **Sport**: Filters by `sport === row.sport` OR `sport === 'Other'`.
3.  **System Type Injection**:
    - **Main Markets**: Only injected if row category is "Main Markets".
    - **Futures**: Only injected if row category is "Futures" (and filters by sport text heuristic).
    - **Parlays**: Only injected if row category is "Parlays".

### `utils/betTypeUtils.ts`

No changes were needed to the file itself, but we leveraged its `getBetTypeCategory` and `StatCategory` exports to ensure consistency with the Input Manager.

## 3. Verification

### Scenarios Tested

| Scenario | Row Context | Expected Suggestions | Result |
| :--- | :--- | :--- | :--- |
| **NFL Prop** | Sport: NFL, Cat: Props | "Pass Yds", "Touchdown", "Rec Yds" | ✅ PASS |
| **No Leakage** | Sport: NFL, Cat: Props | **NO** "Stanley Cup", **NO** "Moneyline" | ✅ PASS |
| **Main Market** | Sport: NBA, Cat: Main | "Moneyline", "Spread", "Total" | ✅ PASS |
| **Futures** | Sport: NFL, Cat: Futures | "Super Bowl", "NFL MVP" | ✅ PASS |
| **Cross-Sport** | Sport: NFL, Cat: Futures | **NO** "Stanley Cup", **NO** "NBA MVP" | ✅ PASS |

## 4. Documentation Updates

Updated `BET_TRACKER_ROW_GRID_SPEC.md` to reflect the new column behavior constraint.
