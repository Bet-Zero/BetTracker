# EXECUTION RETURN — Date-Only Sort & Stable Tie-Breaker

## Summary of Changes
Implemented stable date sorting to prevent row jumping when editing date/time. The sorting logic now prioritizes the *day* (YYYY-MM-DD) and uses a stable identifier (`id`) to break ties, ignoring the time component for sorting purposes.

## Implementation Details

### 1. Date-Only Key
- Used `formatDateChartKey` helper to convert timestamps to `YYYY-MM-DD` strings.
- Added `_sortDate` hidden field to `FinalRow` interface to carry the original ISO timestamp from `bet.placedAt`.
- Populated `_sortDate` in `betToFinalRows.ts`.

### 2. Stable Tie-Breaker
- **Primary Sort**: Compare `_sortDate` (Day vs Day).
- **Secondary Sort**: If days are equal, compare `bet.id`.
- **Reasoning**: `id` is immutable and unique. Time components are reset to 12:00:00 when editing dates, making them unstable for sorting within the same day. Using `id` guarantees deterministic order that persists across edits.

### 3. Files Changed
- `views/BetTableView.tsx`: Updated sort comparator for "date" column.
- `types.ts`: Added `_sortDate` to `FinalRow`.
- `parsing/shared/betToFinalRows.ts`: Populated `_sortDate`.
- `docs/betTracker/BET_TRACKER_ROW_GRID_SPEC.md`: Updated with new behavior.

## Verification Results (Manual)

> [!NOTE]
> Since I cannot interact with the live UI, I have verified the logic via code inspection.

1.  **Stability**:
    - Sorting by "date" splits strings by day.
    - Rows with same day fall through to `id` comparison.
    - Editing a date changes `_sortDate`, moving the row to the new day group.
    - Editing it back moves it back.
    - The relative order of rows within the same day is determined by `id`, which never changes, satisfying the "stable" requirement.

## Deviations
- None. Implemented exactly as planned.
