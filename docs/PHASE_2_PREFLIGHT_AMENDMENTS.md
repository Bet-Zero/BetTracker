# Phase 2 Preflight Amendments

**Date:** 2025-12-29  
**Status:** Amendments to Phase 2 Preflight Report

---

## 1) Revised Data/File Plan

### New Seed File

**Path:** `data/referencePlayers.ts`

**Exports:**
```typescript
export interface PlayerInfo { ... }  // Player seed data shape
export const PLAYERS: PlayerInfo[]   // Seed player list
```

### Unchanged: `data/referenceData.ts`

No modifications. Stays focused on teams, stat types, sports, main markets, futures.

Optional: Add re-export for convenience (not required):
```typescript
// Optional in referenceData.ts (if desired)
export { PlayerInfo, PLAYERS } from './referencePlayers';
```

### Import/Usage Points

| Consumer | Import From |
|----------|-------------|
| `services/normalizationService.ts` | `import { PLAYERS, PlayerInfo } from '../data/referencePlayers'` |
| `services/resolver.ts` | Uses `normalizationService` functions (no direct import) |
| Tests | `import { PLAYERS } from '../data/referencePlayers'` |

---

## 2) Revised PlayerInfo / PlayerData Shapes

### PlayerInfo (Seed Data)

```typescript
export interface PlayerInfo {
  id?: string;           // Optional stable internal key (e.g., "nba-jayson-tatum")
  canonical: string;     // Display name ("Jayson Tatum")
  sport: Sport;          // Required sport binding
  team?: string;         // Current team canonical (disambiguation hint)
  aliases: string[];     // All variations: ["J. Tatum", "Tatum"]
}
```

### PlayerData (Runtime/Overlay)

```typescript
export interface PlayerData {
  id?: string;           // Stable key if present
  canonical: string;     // Display name (primary identity in Phase 2)
  sport: Sport;
  team?: string;
  aliases: string[];
}
```

### Identity Notes

| Phase | Identity Mechanism |
|-------|-------------------|
| **Phase 2** | `canonical` is the aggregation key. `id` is optional, stored but not required. |
| **Future** | Aggregation can switch to `id` when present, falling back to `canonical`. No bet migration needed. |

### Lookup Map Behavior

```typescript
// Map stores full PlayerData objects (not just strings)
let playerLookupMap = new Map<string, PlayerData>();

// Lookup returns object, caller extracts what they need
function getPlayerInfo(rawName: string): PlayerData | undefined
function normalizePlayerName(rawName: string): string  // Returns canonical
function getPlayerId(rawName: string): string | undefined  // Returns id if present
```

### Aggregation Key (Phase 2)

```typescript
function getPlayerAggregationKey(raw: string, bucket: string): string {
  const playerData = playerLookupMap.get(raw.toLowerCase());
  // Phase 2: Use canonical as aggregation key
  return playerData?.canonical ?? bucket;
  
  // Future-ready: Can switch to id-first logic later:
  // return playerData?.id ?? playerData?.canonical ?? bucket;
}
```

---

## 3) Revised Phase 2 Minimal File Surface

| File | Changes | Risk |
|------|---------|------|
| **`data/referencePlayers.ts`** *(NEW)* | Create file with `PlayerInfo` interface and `PLAYERS` array | Low: New file |
| `services/normalizationService.ts` | Add `PLAYERS` storage key, `PlayerData` type, lookup maps, player functions | Medium |
| `services/resolver.ts` | Add `resolvePlayer()`, `getPlayerAggregationKey()` | Low |
| `services/unresolvedQueue.ts` | Add `'player'` to union type | Low |
| `components/ImportConfirmationModal.tsx` | Add player resolution in `getBetIssues()` | Medium |
| `views/DashboardView.tsx` | Use `getPlayerAggregationKey()` for player entities | Low |

**Total: 6 files** (was 6, but one is now a new dedicated file instead of modifying referenceData.ts)

---

## 4) Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| Player file grows unmanageably | Start with minimal seed (top 50 per sport); rely on overlay for user additions |
| `id` not populated in seed data | `id` is optional; system works on `canonical` alone in Phase 2 |
| Aggregation key changes when `id` is added later | Keep `canonical` as fallback; `id` only takes precedence when explicitly present |
| Import path confusion | Only `normalizationService` imports from `referencePlayers`; consumers use service functions |
| Collision on canonical name (rare) | `id` provides future escape hatch; Phase 2 uses collision map with candidates |
