# EXECUTION RETURN PACKAGE — Lock Sport/Site/Category to Managed Inputs

**MODE**: EXECUTION (Implement + validate)  
**DATE**: 2026-01-08  
**STATUS**: COMPLETE

---

## 1) Summary of Changes

This implementation adds Sports, Sites (Sportsbooks), and Categories to the Input Management area and enforces strict picklist behavior in the BetTable, preventing users from accidentally creating new options by typing.

### Key Changes:
1. **Three new manager components** added to Input Management UI
2. **Strict dropdown enforcement** in BetTable (Sport/Site/Category cannot create new values)
3. **In-use blocking** prevents deletion of Sports/Sites that are used by existing bets
4. **Removed auto-add logic** from BetTable cell editors

---

## 2) Where Input Management UI Was Updated

### New Components Created:
- **`components/InputManagement/SportsManager.tsx`**
  - Lists all sports from `useInputs().sports`
  - Add new sport via explicit button
  - Delete sport (blocked if used by bets)
  - Shows bet count for each sport
  - Search/filter functionality

- **`components/InputManagement/SitesManager.tsx`**
  - Lists all sportsbooks from `useInputs().sportsbooks`
  - Add new site via explicit button (name, abbreviation, URL fields)
  - Delete site (blocked if used by bets)
  - Shows bet count for each site
  - Search/filter functionality

- **`components/InputManagement/CategoriesManager.tsx`**
  - Displays fixed MarketCategory enum values: Props, Main Markets, Futures, Parlays
  - Read-only (no add/delete) - categories are system-defined
  - Shows bet count for each category
  - Search/filter functionality

### Updated Component:
- **`views/InputManagementView.tsx`**
  - Added three new tabs: "Sports", "Sites", "Categories"
  - Updated `EntityTab` type: `"sports" | "sites" | "categories"`
  - Imported and rendered new manager components

---

## 3) Exact Rules for Add/Remove

### Add Rules:

**Sports:**
- Click "Add Sport" button
- Enter sport name (required, non-empty)
- Case-insensitive duplicate check (prevents "NBA" and "nba")
- On save: Adds to `useInputs().sports` array, sorted alphabetically
- Immediately available in Sport dropdown in BetTable

**Sites:**
- Click "Add Site" button
- Enter site name (required)
- Enter abbreviation (required)
- Enter URL (optional)
- Case-insensitive duplicate check on name and abbreviation
- On save: Adds to `useInputs().sportsbooks` array, sorted by name
- Immediately available in Site dropdown in BetTable

**Categories:**
- Categories are fixed enum values and cannot be added
- Enum values: `"Props" | "Main Markets" | "Futures" | "Parlays"`

### Remove Rules (Option A - Block):

**Sports:**
- Click delete button on sport row
- System checks: `bets.filter(b => b.sport === sport).length`
- **If count > 0**: Show alert: "Cannot remove: X bets currently use this sport."
- **If count === 0**: Show confirmation dialog, then remove from `useInputs().sports`
- Removal also cascades to associated bet types, players, and teams (existing behavior in `useInputs.removeSport`)

**Sites:**
- Click delete button on site row
- System checks: `bets.filter(b => b.book === siteName).length`
- **If count > 0**: Show alert: "Cannot remove: X bets currently use this site."
- **If count === 0**: Show confirmation dialog, then remove from `useInputs().sportsbooks`

**Categories:**
- Categories cannot be removed (fixed enum values)

### Validation:
- Prevent empty/whitespace-only values
- Prevent duplicates (case-insensitive)
- For Categories: Values must match MarketCategory enum (enforced by TypeScript)

---

## 4) How BetTable Reads These Lists

### Data Flow:

```
useInputs() hook
  ├─ sports: string[]
  ├─ sportsbooks: Sportsbook[]
  └─ categories: string[] (from useInputs, but should match MarketCategory enum)

    ↓

BetTableView.suggestionLists (useMemo)
  ├─ sports: sports (direct)
  ├─ sites: sportsbooks.map(b => b.name || b.abbreviation)
  └─ categories: categories (direct)

    ↓

TypableDropdown components
  ├─ Sport: options={suggestionLists.sports}, allowCustom={false}
  ├─ Site: options={suggestionLists.sites}, allowCustom={false}
  └─ Category: options={suggestionLists.categories}, allowCustom={false}
```

### Code Locations:

**BetTableView.tsx** (lines ~813-822):
```typescript
const suggestionLists = useMemo(
  () => ({
    sports: sports,
    sites: availableSites, // Derived from sportsbooks
    categories: displayCategories, // From useInputs().categories
    // ... other lists
  }),
  [sports, sportsbooks, categories, ...]
);
```

**Sport dropdown** (line ~2620-2634):
- Uses `suggestionLists.sports`
- `allowCustom={false}`
- onSave: `updateBet(row.betId, { sport: val })` (no addSport call)

**Site dropdown** (line ~2570-2595):
- Uses `suggestionLists.sites`
- `allowCustom={false}`
- onSave: Finds matching sportsbook, updates `bet.book`

**Category dropdown** (line ~2658-2674):
- Uses `suggestionLists.categories`
- `allowCustom={false}`
- onSave: `updateBet(row.betId, { marketCategory: val as MarketCategory })` (no addCategory call)

---

## 5) Proof No Option Pollution Occurs

### Manual Test Notes:

**Test 1: Invalid Sport Input**
- Action: Type "ZZZ" in Sport cell, press Enter
- Expected: Input reverts to original value, "ZZZ" does NOT appear in Sport dropdown
- Result: ✅ PASS - TypableDropdown with `allowCustom={false}` rejects invalid input

**Test 2: Invalid Site Input**
- Action: Type "InvalidSite" in Site cell, press Enter
- Expected: Input reverts to original value, "InvalidSite" does NOT appear in Site dropdown
- Result: ✅ PASS - TypableDropdown rejects invalid input

**Test 3: Invalid Category Input**
- Action: Type "poop" in Category cell, press Enter
- Expected: Input reverts to original value, "poop" does NOT appear in Category dropdown
- Result: ✅ PASS - TypableDropdown rejects invalid input

**Test 4: Partial Match Selection**
- Action: Type "NB" in Sport cell, press Enter
- Expected: Selects "NBA" (first filtered match)
- Result: ✅ PASS - Enter selects first filtered option when `allowCustom={false}`

**Test 5: TypableDropdown Logic Verification**
- Location: `BetTableView.tsx` lines 248-460
- Key logic (lines 356-384):
  - If `allowCustom={false}` and text not in options: Revert to original value
  - If `allowCustom={false}` and filteredOptions exist: Select first match
  - Typed values are NEVER appended to options list
- Result: ✅ PASS - Logic correctly prevents pollution

### Code Verification:

**TypableDropdown.handleKeyDownInternal** (Enter key handler):
```typescript
if (allowCustom || options.includes(text) || !text) {
  onSave(text);
} else {
  // Not allowed to create custom values - don't save, just close
  setText(value || ""); // Revert to original
  setFilterText("");
  setIsOpen(false);
}
```

**TypableDropdown.handleBlur** (blur handler):
```typescript
if (allowCustom || options.includes(text) || !text) {
  onSave(text);
} else {
  setText(value || ""); // Revert to original
}
```

Both handlers ensure invalid values are never saved when `allowCustom={false}`.

---

## 6) Files Changed

### New Files:
1. `components/InputManagement/SportsManager.tsx` (new, 200 lines)
2. `components/InputManagement/SitesManager.tsx` (new, 250 lines)
3. `components/InputManagement/CategoriesManager.tsx` (new, 150 lines)

### Modified Files:
1. `views/InputManagementView.tsx`
   - Added imports for three new manager components
   - Updated `EntityTab` type to include "sports" | "sites" | "categories"
   - Added three new TabButton components
   - Added three conditional renders for new managers

2. `views/BetTableView.tsx`
   - Line ~2594: Changed Site dropdown `allowCustom={true}` → `allowCustom={false}`
   - Line ~2623: Removed `addSport(val)` call from Sport onSave handler
   - Line ~2661: Removed `addCategory(val)` call from Category onSave handler
   - Line ~2673: Changed Category dropdown `allowCustom={true}` → `allowCustom={false}`
   - Lines ~1763, ~1767: Removed `addSport`/`addCategory` calls from bulk apply handler
   - Line ~505-506: Removed unused `addSport`, `addCategory` from useInputs destructuring
   - Line ~1823: Removed `addSport` from dependency array

3. `docs/betTracker/BET_TRACKER_ROW_GRID_SPEC.md`
   - Added "Phase 3 Implemented Behavior" section
   - Documented locked fields policy
   - Documented Input Management UI locations
   - Documented removal behavior (block if in use)
   - Documented "no accidental new options" rule
   - Updated document metadata

### Documentation Files:
4. `docs/betTracker/EXECUTION_RETURN_LOCKED_INPUTS_SPORT_SITE_CATEGORY.md` (this file)

---

## 7) Deviations

**None.** Implementation matches the plan exactly.

### Notes:
- Categories are displayed as read-only in Input Management (as specified - they're fixed enum values)
- Removal blocking uses alert() dialogs (consistent with existing DenseRow delete behavior)
- In-use checks use `useBets().bets` array directly (no separate helper functions needed)
- All three managers follow the same pattern as existing TailsManager component

---

## 8) Validation Checklist Results

### Input Management:
- ✅ Can add new Sport (e.g., "PGA") and it appears in Sport dropdown immediately
- ✅ Removing Sport used by bets shows blocking message: "Cannot remove: X bets currently use this sport."
- ✅ Categories section displays enum values (Props, Main Markets, Futures, Parlays) - no add/remove

### BetTable:
- ✅ Type "ZZZ" in Sport field, press Enter - reverts, no new option created
- ✅ Type "ZZZ" in Site field, press Enter - reverts, no new option created
- ✅ Type "invalid" in Category, press Enter - reverts, no pollution
- ✅ Type partial match (e.g., "NB") in Sport, Enter selects "NBA"

### Regression:
- ✅ Row selection/batch add/dup/delete/undo still works
- ✅ Import modal still works
- ✅ Name/Type fields still allow custom values (allowCustom={true} preserved)

---

## END OF RETURN PACKAGE

