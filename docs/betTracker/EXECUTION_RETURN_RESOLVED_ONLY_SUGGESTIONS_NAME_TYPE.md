# EXECUTION RETURN PACKAGE — Resolved-Only Name/Type Suggestions

**MODE**: EXECUTION  
**DATE**: 2026-01-10  
**STATUS**: COMPLETE

---

## 1) Summary

Implemented "resolved-only" suggestion logic for Name and Type columns in the BetTable. This ensures:

- **Unresolved entries** (e.g., "ABCD") do NOT pollute the suggestion dropdowns
- **Resolved entries** (known canonicals and aliases) ARE added to suggestions  
- **Queue + badge behavior** unchanged — unresolved entries still show badges and go to unresolvedQueue
- **Map/Create resolution** now adds the canonical to suggestions immediately

---

## 2) Resolver Status Gating

### Name Column (`autoAddEntity()`)

The `autoAddEntity()` function now checks resolver status before adding players/teams to `useInputs` suggestions:

```typescript
// For player markets
const playerResult = resolvePlayer(trimmedEntity, { sport: sport as Sport });
if (playerResult.status === "resolved") {
  addPlayer(sport, playerResult.canonical);
}
// If unresolved, do NOT add - queue flow handles it

// For team markets  
const teamResult = resolveTeamForSport(trimmedEntity, sport as Sport);
if (teamResult.status === "resolved") {
  addTeam(sport, teamResult.canonical);
}
```

### Type Column (`addBetType()`)

All `addBetType()` call sites now check `resolveBetType()` status:

```typescript
const typeResult = resolveBetType(value, row.sport as Sport);
if (typeResult.status === "resolved") {
  addBetType(row.sport, typeResult.canonical);
}
```

**Gating applied in**:
1. `handleSaveCell()` switch case for "type" (lines 2321-2338)
2. Inline Type cell `onSave` handler (lines 3291-3301)

---

## 3) Suggestions Source

Suggestions are stored in `useInputs.tsx`:

| Entity Type | Storage                                | Functions                     |
|-------------|----------------------------------------|-------------------------------|
| Players     | `players: ItemsBySport` (localStorage) | `addPlayer(sport, name)`      |
| Teams       | `teams: ItemsBySport` (localStorage)   | `addTeam(sport, name)`        |
| Bet Types   | `betTypes: ItemsBySport` (localStorage)| `addBetType(sport, type)`     |

These are the "suggestion lists" used by `TypableDropdown` and `EditableCell` components.

**Resolution source** is `services/normalizationService.ts` which provides:
- Team normalization data (with aliases)
- Player normalization data (with aliases)
- Bet type normalization data (with aliases)

The **gate works by**:
1. User types value → resolver checks normalization data
2. If RESOLVED → add **canonical** to useInputs suggestions
3. If UNRESOLVED → do NOT add to suggestions, but queue and show badge

---

## 4) Map/Create Canonical Promotion

When a user resolves via Map or Create, the canonical is now also added to `useInputs` suggestions:

### Map to Existing (`handleMapConfirm`)

```typescript
if (item.entityType === "team") {
  addTeamAlias(targetCanonical, item.rawValue);
  addTeam(sport, targetCanonical);  // NEW: Add to suggestions
} else if (item.entityType === "player") {
  addPlayerAlias(targetCanonical, sport, item.rawValue);
  addPlayer(sport, targetCanonical);  // NEW: Add to suggestions
}
```

### Create New (`handleCreateConfirm`)

```typescript
if (item.entityType === "team") {
  addNormalizationTeam(newTeam);
  addTeam(sport, canonical);  // NEW: Add to suggestions
} else if (item.entityType === "player") {
  addNormalizationPlayer(newPlayer);
  addPlayer(sport, canonical);  // NEW: Add to suggestions
}
```

---

## 5) Manual Test Notes

### Test 1: Unresolved Name Stays Out of Suggestions
1. Open BetTable, select a row with sport = NBA
2. Double-click Name cell → type "XYZTEST123" → press Enter
3. Observe: Amber badge appears next to name
4. Double-click Name cell again → check dropdown
5. **Expected**: "XYZTEST123" does NOT appear in suggestions
6. Check unresolvedQueue in Input Management → entry should exist

### Test 2: Resolved Name Appears in Suggestions
1. Type a known player name (e.g., "LeBron James" with NBA set)
2. Press Enter to commit
3. Double-click Name cell again → check dropdown
4. **Expected**: "LeBron James" appears in suggestions (no badge)

### Test 3: Map Adds Canonical to Suggestions
1. Find row with unresolved name badge
2. Click badge → Map to existing player (e.g., "LeBron James")
3. Confirm mapping
4. Badge should disappear
5. Double-click Name cell → check dropdown
6. **Expected**: "LeBron James" appears in suggestions

### Test 4: Create Adds Canonical to Suggestions
1. Find row with unresolved name badge
2. Click badge → Create new canonical entry
3. Fill in form and confirm
4. Badge should disappear
5. Double-click Name cell → check dropdown
6. **Expected**: New canonical name appears in suggestions

### Test 5: Type Column Same Behavior
1. Double-click Type cell → type unresolved type (e.g., "XYZTYPE")
2. Press Enter
3. Double-click Type cell again
4. **Expected**: "XYZTYPE" does NOT appear in suggestions
5. Type a known type (e.g., "Player Points")
6. **Expected**: Appears in suggestions (if resolved)

---

## 6) Files Changed

| File | Changes |
|------|---------|
| `views/BetTableView.tsx` | Added `resolveBetType` import; gated `autoAddEntity()` with resolver status checks; gated `addBetType()` calls with `resolveBetType()` status; added canonical to `useInputs` suggestions in `handleMapConfirm` and `handleCreateConfirm` |
| `docs/betTracker/BET_TRACKER_ROW_GRID_SPEC.md` | Added Phase 4.1 section documenting resolved-only suggestions behavior |

---

## 7) Deviations from Spec

**None.** Implementation matches the execution prompt exactly:

- ✅ Gate auto-add by resolver status (RESOLVED only)
- ✅ Unresolved still: stays in cell, shows badge, queued
- ✅ Map/Create adds canonical to suggestions
- ✅ Type column receives same treatment as Name
- ✅ Master doc updated with new behavior

---

## 8) Technical Notes

### Performance Consideration
Each name/type commit now calls the resolver, adding a small overhead. However, resolvers are in-memory lookups with O(1) average time, so impact is negligible.

### Canonical vs Raw Value
When adding to suggestions, we now add the **canonical** (not raw value) if resolved. This ensures suggestions contain clean, normalized names.

### Backward Compatibility
- Existing suggestions in localStorage are NOT affected
- Only new commits are gated
- Map/Create behavior enhanced (additive change)
