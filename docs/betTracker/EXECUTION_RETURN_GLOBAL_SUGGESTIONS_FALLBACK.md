# EXECUTION RETURN PACKAGE — Global Name Suggestions & Resolved Inputs Fix

**MODE**: EXECUTION (Complete)  
**DATE**: 2026-01-10  
**STATUS**: COMPLETE

---

## 1) Problem Summary

User reported two related issues:
1. "Duncan Robinson" (a resolved input) was not appearing in Name suggestions even though the sport was correct.
2. Specifically, **"resolved inputs"** (managed by the normalizer) were missing, while manual inputs (typed directly) worked.

**Root Cause**:
- `BetTableView` suggestions were driven ONLY by `useInputs` (manual input storage).
- `normalizationService` (resolved entities) is a separate storage.
- Although the resolution flow *tries* to sync them via `addPlayer`, this sync might be failing or incomplete.
- Additionally, suggestions were strictly scoped to the exact sport key, causing fallouts if data was mismatched.

---

## 2) Fix Implemented

**1. Global Fallback**:
Suggestion lists now include players/teams from **ALL sports**, ensuring robustness against key mismatches.

**2. Merging Resolved Entities**:
Modified `suggestionLists` in `BetTableView.tsx` to explicitly fetch and merge **known resolved entities** from `normalizationService` (`getReferenceDataSnapshot()`).

```typescript
// BetTableView.tsx
const snapshot = getReferenceDataSnapshot();
snapshot.players.forEach((p) => {
  all.add(p.canonical); // Explicitly add resolved players
});
```

This ensures that **any** player known to the resolution system (e.g. "Duncan Robinson") will appear in suggestions, even if they haven't been successfully synced to the manual input list.

---

## 3) Files Changed

| File | Changes |
|------|---------|
| `views/BetTableView.tsx` | Updated `suggestionLists` to merge `getReferenceDataSnapshot().players` and `.teams` into the dropdown options. |
| `docs/betTracker/BET_TRACKER_ROW_GRID_SPEC.md` | Updated Phase 4.3 documentation to include Resolved Entity Merging. |

---

## 4) Verification

**Manual Test**:
1. Select a row.
2. Type a name that you have previously resolved (e.g. via Map or Create modal).
3. **Verify**: The name appears in the suggestion dropdown.
4. Type a name that is from a different sport.

---

## 5) UX Improvement — Name Column Autocomplete

**Problem**:
The Name column used a standard input with a native `<datalist>`. This meant:
- No auto-selection of the top match.
- Pressing `Enter` would submit the partial text (e.g., "Dun") instead of the suggestion ("Duncan Robinson") unless manually selected.

**Fix**:
Replaced `EditableCell` with `TypableDropdown` for the Name column.
- **Behavior**: Acts like a combobox.
- **Enter Key**: Automatically selects the top highlighted suggestion.
- **Custom Values**: Still allows typing new names not in the list.

**Files Changed**:
- `views/BetTableView.tsx`: Replaced Name column editor component.


---

## 6) Logic Update — Resolved-Only Suggestions

**Change**:
Restricted the source of suggestions for Players and Teams to **Resolved (Canonical) Entities Only**.

-   **Removed**: Manual inputs from `useInputs` (aggregated history).
-   **Kept**: `normalizationService` snapshot (official database).
-   **Why**: To prevent pollution of the dropdown with unresolved typos or duplicates, and to enforce a clean "Resolved" workflow.

**Files Changed**:
-   `views/BetTableView.tsx`: Updated `suggestionLists` logic.
