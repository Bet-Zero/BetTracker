# Phase 5 Preflight: Input Management UX/Performance Pass

## 1) What exists today (with pointers)

### Current Navigation Path
- **Entry Point**: `SettingsView.tsx` (Route: `/settings`)
  - Component: `<InputManagementSection />` (imported from `./InputManagementView`)
  - Mounts at bottom of Settings page under "Input Management" section.

### Component Map
*   **Main Container**: `views/InputManagementView.tsx`
    *   **Tabs**: Managed internally (`EntityTab` state: 'unresolved' | 'teams' | 'players' | 'statTypes')
    *   **Unresolved Tab**: `components/UnresolvedQueueManager.tsx`
    *   **Teams Tab**: Internal `TeamsTab` component (lines 215-354)
    *   **Players Tab**: Internal `PlayersTab` component (lines 522-657)
        *   **Row**: `DenseRow` (Internal, lines 92-191)
        *   **Editor**: `PlayerEditPanel` (Internal, lines 660-776)
    *   **Stat Types Tab**: Internal `StatTypesTab` component (lines 782-900+)

*   **Legacy/Unused**: `views/PlayerAliasManager.tsx`
    *   *Observation*: This file exists but is not imported in `SettingsView` or `InputManagementView`. It appears to be an older standalone implementation.

### Data Sources
*   **Hook**: `useNormalizationData` (`hooks/useNormalizationData.tsx`)
    *   Controls: `teams`, `players`, `statTypes` (arrays) + CRUD methods.
    *   State: Backed by `localStorage` keys (`bettracker-normalization-teams`, etc.).
    *   Updates: Triggers `resolverVersion` increment which flows down to `ImportConfirmationModal`.

---

## 2) Current pain points (measured/observed)

### Rendering & Density
*   **Row Height**: ~45px (36px content + padding/borders).
*   **Render Strategy**: **Naive Mapping**.
    *   `filteredPlayers.map(...)` renders ALL matching items at once.
    *   If "All" sport is selected + search is empty, it renders every known player.
*   **DOM Count**:
    *   For 500 players, generates ~5,000+ DOM nodes (containers, buttons, icons, text text nodes).
    *   `DenseRow` has 5 interactive buttons (Expand, Disable, Enable, Delete, Search/Edit triggers).

### Performance Risks
1.  **Search Input Lag**:
    *   `searchQuery` state lives in the parent tab component.
    *   On every keystroke:
        1.  `filteredPlayers` array is recomputed (`array.filter`).
        2.  **Entire List** re-renders because `filteredPlayers` reference changes.
        3.  React Diffing Algorithm runs on hundreds of `DenseRow` components.
2.  **No Row Virtalization**:
    *   The browser must layout and paint off-screen rows.

### Usage of Search/Filter
*   **Location**: In-component `useMemo` (e.g., lines 532-554 of `InputManagementView.tsx`).
*   **Fields**: Checks `canonical`, `aliases` (array), and `team`.
*   **Efficiency**: Linear scan `O(N)` on render. Fine for < 1000 items, but coupled with DOM rendering, it's the UI bottleneck.

---

## 3) Recommendation: Virtualization Decision

### Verdict: **REQUIRED** (Lightweight Manual Windowing)

**Justification**:
*   While `react-window` is the industry standard, adding a dependency is a non-goal for this preflight.
*   The goal is "scalable" and "dense".
*   Rendering 1000+ rows (future state with full history) will cause noticeable input lag on search.
*   **Approach**: Implement **Manual Windowing** (Render top N, add "Show More" or generic infinite scroll sentinel).
    *   **Why**: Zero dependencies, drastically reduces initial DOM footprint, solves the "search lag" instantly (only render top 20 matches).

**Proposed constraints**:
*   Initial render: 20-50 items.
*   Scroll/Load More: Append next 50.
*   Search reset: Reset to top 50.

---

## 4) Proposed Phase 5 UI Spec

### Layout Structure
*   **Container**: Maximize height within Settings view (or move to standalone route if Settings gets too crowded).
*   **Sticky Header**:
    *   Search Bar (Left, 50% width)
    *   "Show Disabled" Toggle (Right aligned)
    *   "Add New" Button (Primary CTA, Right aligned)
    *   **Below Header**: Sport Pills (Horizontal scrollable or flex wrap).
*   **Tabs**: Maintain existing (Unresolved | Teams | Players | Stat Types).

### Dense Row Design (Target 36px)
*   **Columns**:
    1.  **Expand Chevron** (w-6)
    2.  **Canonical Name** (Flex-shrink, Bold)
    3.  **Meta Details** (Text-xs, Gray) - *Teams: Sport | Players: Team Name | Stat: Description*
    4.  **Badges** (Flex-shrink-0) - *Count of aliases (e.g., "+3 aliases")*
    5.  **Status** (Icon only) - *Disabled/Active*
    6.  **Actions** (Hover only) - *Edit, Delete*

### Expanded Editor
*   **Design**: **Inline Expansion** (Accordion style, pushing rows down).
    *   *Reason*: Keeps context of the list. Side panel fights with the main "Settings" sidebar layout.
*   **Content**:
    *   Canonical Name (Editable)
    *   Sport (Locked if existing, editable if new)
    *   Description / Team (Editable)
    *   **Aliases List**: Flex-wrap tags with remove (X) buttons.
    *   **Quick Add Alias**: Input + Enter key.

---

## 5) "Must Not Break" Checklist

### 1. Inline Import Resolution
*   **Current State**: `ImportConfirmationModal.tsx` calls `addTeam`/`addPlayer`.
*   **Constraint**: Phase 5 changes to `InputManagementView` must NOT change the internal `add*` / `update*` signatures in `useNormalizationData`.
*   **Verification**: The `InputManagementView` is a *consumer* of `useNormalizationData`, just like the Modal. As long as hooks remain stable, this won't break.

### 2. Disabled Enforcement
*   **Logic**: `normalizationService.ts` explicitly skips `disabled: true` items during `build*LookupMap`.
*   **Constraint**: The UI must correctly flip the `disabled` boolean in `TeamData`/`PlayerData`.
*   **Verification**: Toggling "Disable" in UI must immediately make that entity un-resolvable in the Import Modal.

### 3. Resolver Version Refresh
*   **Logic**: `refreshLookupMaps()` increments `resolverVersion`.
*   **Constraint**: `ImportConfirmationModal` depends on `resolverVersion` (line 349).
*   **Risk**: If we optimize `useNormalizationData` to not trigger updates effectively, the Modal might become stale.

---

## 6) Execution Plan (Phase 5)

### Files to Change
1.  `views/InputManagementView.tsx` (Heavy Refactor)
    *   Extract `TeamsTab`, `PlayersTab`, `StatTypesTab` into dedicated components to reduce file size (1000+ lines).
    *   Implement "Manual Windowing" logic.
2.  `components/DenseRow.tsx` (New/Extract)
    *   Create a pure, memoized row component to prevent unnecessary re-renders.

### Step-by-Step Tasks
1.  **Refactor**: Split `InputManagementView.tsx` into:
    *   `components/InputManagement/TeamsManager.tsx`
    *   `components/InputManagement/PlayersManager.tsx`
    *   `components/InputManagement/StatTypeManager.tsx`
    *   `components/InputManagement/DenseRow.tsx`
2.  **Optimization**: Implement `useVirtualList` hook or logic inside Managers.
    *   State: `visibleCount` (default 50).
    *   Effect: Reset `visibleCount` when `searchQuery` or `tab` changes.
    *   UI: "Show More" button or IntersectionObserver at bottom.
3.  **Enhancement**: Update `DenseRow` visual design to match "36px target".
    *   Refine padding/font-sizes.
    *   Ensure "Hover actions" pattern is accessible (or fallback to visible).
4.  **Search**: Optimize search.
    *   Extract search logic to `useEntitySearch(entities, query, sport)` hook.
    *   Debounce the input if list > 500 items.

### Risks + Mitigations
*   **Risk**: Splitting files breaks imports in `SettingsView`.
    *   *Mitigation*: Keep `InputManagementView.tsx` as the main export/barrel file.
*   **Risk**: Manual windowing makes "Ctrl+F" (Browser search) fail.
    *   *Mitigation*: Acceptable trade-off for performant app. Users should use the in-app Search bar.

---

## 7) Quick Sanity Test Plan (Manual)
1.  **Performance**: Load 500+ items (mock or import). Is typing in Search bar instant?
2.  **Navigation**: Switch between tabs. Does scroll position reset?
3.  **CRUD**: Add a new Player. Does it appear immediately?
4.  **Disabled**: Disable a player. Go to Import. try to resolve a bet to that player. It should NOT auto-match.
5.  **Edit**: Rename a Team canonical. Verify `useNormalizationData` updates and persists.
