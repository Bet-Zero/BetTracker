# RETURN PACKAGE: Phase Team ID Linking (Stable IDs)

## 1) What Changed
- **Team IDs**: Added stable, sport-scoped `id` (e.g., `NBA:LAL`) to `TeamData`.
- **Player-Team Linking**: `PlayerData` now allows linking to `teamId` instead of just a string alias.
- **Migration**: Implemented auto-migration on app load (in `useNormalizationData.tsx`):
  - Generates IDs for teams missing them.
  - Resolves string `team` references to `teamId` for players.
- **UI**: Updated `PlayersManager.tsx` to use a **Team Selector Dropdown** instead of a text input.
- **Helpers**: Added `generateTeamId` and `getTeamById` (O(1) lookup).

## 2) Files Changed / Created

| Path | Type | Purpose |
| :--- | :--- | :--- |
| `services/normalizationService.ts` | Modified | Add `id`/`teamId` to interfaces, helpers, lookup map logic. |
| `hooks/useNormalizationData.tsx` | Modified | Implement migration logic in `useEffect`. |
| `components/InputManagement/PlayersManager.tsx` | Modified | Replace input with Select, use `getTeamById` for display. |
| `services/normalizationService.ids.test.ts` | Created | Unit tests for ID generation and lookup. |

## 3) localStorage Impact

### TeamData
**Before:**
```json
{ "canonical": "Lakers", "sport": "NBA", "abbreviations": ["LAL"], "aliases": [] }
```
**After:**
```json
{ "canonical": "Lakers", "sport": "NBA", "abbreviations": ["LAL"], "aliases": [], "id": "NBA:LAL" }
```

### PlayerData
**Before:**
```json
{ "canonical": "LeBron James", "sport": "NBA", "team": "Lakers", "aliases": [] }
```
**After:**
```json
{ "canonical": "LeBron James", "sport": "NBA", "team": "Lakers", "teamId": "NBA:LAL", "aliases": [] }
```

## 4) Test Results

- **Command**: `npm test services/normalizationService`
- **Result**: **93 passed**, 0 failed.
- **Command**: `npm test services/normalizationService.ids.test.ts`
- **Result**: **4 passed**, 0 failed.
  - Verified `generateTeamId` logic.
  - Verified `getTeamById` lookup.

## 5) Manual Verification Notes
- [x] Confirmed existing tests pass.
- [x] Confirmed new ID logic tests pass.
- [ ] **Action Required**: Open the app.
  - Verify "Teams" tab loads and sets IDs (check Storage).
  - Verify "Players" tab loads and resolves Legacy team strings.
  - Edit a player: Confirm Team dropdown works.
  - Rename a team: Confirm player link stays intact (since it uses ID now).

## 6) Follow-ups / Risks
- `player.team` (string) is currently **deprecated but preserved** for backward compatibility. It should be removed in a future cleanup phase after verifying no other consumers rely on it.
- **Risk**: If a user has a player linked to a team that doesn't exist (or is disabled), the dropdown might show "(No Team)" or handle it gracefully (current logic shows `id` if not found in list, or falls back to legacy string for list display).
