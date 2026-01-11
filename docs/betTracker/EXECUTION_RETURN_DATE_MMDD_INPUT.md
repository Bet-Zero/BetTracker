# EXECUTION RETURN — Date Cell UX: Digits-Only MMDD Input

## Summary of Changes
Implemented a specialized date input editor for the Bet Data Grid that allows rapid "digits-only" entry (e.g., typing "0112" results in "01/12"). This replaces the generic text input for the Date column to improve data entry speed and accuracy.

## Key Features

### 1. Digits-Only Input with Auto-Format
- User types digits only: `0`, `1`, `1`, `2`.
- Input auto-formats to `MM/DD`: `0`, `01`, `01/1`, `01/12`.
- Backspace and editing works naturally on the raw digits.
- Slash `/` is inserted automatically.

### 2. Validation & Parsing
- Input is parsed as `MM/DD` (month and day).
- **Validation**:
  - Month must be 1-12.
  - Day must be valid for the given month (e.g., Feb 30 is rejected).
  - Uses the **current year** for calendar validation.
- **Commit Rule**:
  - Only commits if the date is valid.
  - If invalid (e.g., "13/01" or incomplete), reverts to original value on blur/enter.

### 3. Data Persistence
- On commit, constructs a full ISO string (`bet.placedAt`).
- **Year Rule**: Uses the **current year** at the time of commit (e.g., 2026).
- **Time Rule**: Sets time to `12:00:00` local time to avoid timezone edge cases (Option B from prompt).
- Existing `placedAt` values are preserved until edited.

## Implementation Details

### Files Changed

| File | Changes |
| :--- | :--- |
| `utils/formatters.ts` | Added `formatMMDDInput`, `parseMMDDInput`, `isValidMMDD`, `buildIsoFromMMDD` helpers. |
| `views/BetTableView.tsx` | Defined custom `DateCell` component. Replaced `EditableCell` usage for "date" column with `DateCell`. |

### Formatting Logic

```typescript
// formatMMDDInput("0112") -> "01/12"
export function formatMMDDInput(rawDigits: string): string {
  const digits = rawDigits.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
```

### Validation Logic

```typescript
// Uses current year to validate calendar days (e.g. leap years)
const testDate = new Date(currentYear, month - 1, day, 12, 0, 0);
const isValid = testDate.getMonth() === month - 1 && testDate.getDate() === day;
```

## Manual Verification Steps

1.  **Type-to-Edit**:
    *   Select a date cell.
    *   Type `1` -> enters edit mode, shows "1".
    *   Type `2` -> "12".
    *   Type `2` -> "12/2".
    *   Type `5` -> "12/25".
    *   Press Enter -> Saves as current year, Dec 25th.
2.  **Double-Click Edit**:
    *   Double-click date cell.
    *   Input shows current MMDD (e.g. "01/05").
    *   Edit to "0228".
    *   Blur -> Saves.
3.  **Invalid Input**:
    *   Type "1301" (Month 13) -> Enter/Blur -> Reverts to original value.
    *   Type "0230" (Feb 30) -> Enter/Blur -> Reverts.
4.  **Sorting**:
    *   Verify rows resort correctly if date changes significantly.

## Documentation
Updated `docs/betTracker/BET_TRACKER_ROW_GRID_SPEC.md` with "Phase 5 Implemented Behavior".
