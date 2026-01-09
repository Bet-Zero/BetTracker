# Phase 2.2 RETURN PACKAGE — Type-to-Edit for Bet Tracker Grid

**DATE**: 2026-01-09
**STATUS**: IMPLEMENTED
**MODE**: EXECUTION

## 1. Overview
This update completes the spreadsheet-like interaction model by implementing **Type-to-Edit**. Users can now select any cell and immediately start typing to overwrite its content (or filter a dropdown), mirroring Excel/Sheets behavior. This removes the need to double-click or press Enter before typing.

## 2. Key Features Implemented

### A. Global Type-to-Edit Trigger
When a cell is focused (but not editing), typing any printable character:
1.  **Enters Edit Mode** immediately.
2.  **Captures the character** as an `editSeed`.
3.  **Passes the seed** to the editor component to initialize its value.

### B. Typeahead for Dropdowns
For dropdown cells (Site, Sport, Category, Type, O/U, Result):
-   The initial typed character immediately filters the dropdown options.
-   Example: Selecting empty **Sport** cell and typing "N" immediately opens the dropdown filtered to "NBA", "NFL", etc.

### C. Overwrite for Text/Numbers
For text and numeric cells (Name, Line, Odds, Bet, Tail):
-   The initial typed character **replaces** the existing value.
-   The cursor is placed after the inserted character.
-   Example: Selecting a **Bet** cell showing "$10.00" and typing "5" changes it to "5|" (cursor after 5).

### D. Result Cell Standardization
-   The **Result** column now follows the standard "View Mode vs Edit Mode" pattern.
-   **View Mode**: Displays static text ("Win", "Loss", etc.).
-   **Edit Mode**: Renders a typeahead dropdown, allowing keystroke selection (e.g., 'W' for Win).

### E. Keyboard Priority Guards
-   **Cmd/Ctrl+Z (Undo)**: Now respects edit mode. If editing text, it performs native text undo. If not editing, it performs row-level undo.
-   **Delete/Backspace**: Validated to continue performing row deletion only when *not* editing text.

## 3. Technical Implementation

### State Management
-   **`editSeed`**: New state variable in `BetTableView` to store the triggering character.
-   **`exitEditMode()`**: Helper to atomically clear both `editingCell` and `editSeed`.

### Component Updates
-   **`TypableDropdown`**: Added `initialQuery` prop. If present, initializes filter text and input value, and opens dropdown immediately.
-   **`EditableCell`**: Added `initialValue` prop. If present, replaces current value and sets selection.
-   **`ResultCell`**: Refactored to wrapper around `TypableDropdown`.

### Interaction Logic
-   **`handleKeyDown`**: Added check for single-character printable keys (excluding modifiers) to trigger edit mode.
-   **Priority Check**: Specific guards added to block global shortcuts (Delete, Undo) when `isEditingContent` is true.

## 4. Verification Steps

1.  **Result Cell Test**:
    -   Click a "Result" cell (select it).
    -   Type "L".
    -   Verify cell enters edit mode, shows "Loss" in dropdown, and "L" in input.
    -   Press Enter.
    -   Verify value saves as "Loss".

2.  **Sport Dropdown Test**:
    -   Click a "Sport" cell.
    -   Type "N".
    -   Verify dropdown opens and filters to NBA/NFL.
    -   Press Enter.
    -   Verify top match is selected.

3.  **Numeric Overwrite Test**:
    -   Click an "Odds" cell (-110).
    -   Type "2".
    -   Verify value changes to "2" (not "-1102" or appended).

4.  **Undo Safety Test**:
    -   Select a row.
    -   Type into a cell (e.g., "Test").
    -   Press Cmd+Z.
    -   Verify it undoes the typing ("Tes"), NOT the last row operation.
    -   Press Escape.
    -   Press Cmd+Z.
    -   Verify it undoes the last row operation (e.g., Delete/Duplicate).
