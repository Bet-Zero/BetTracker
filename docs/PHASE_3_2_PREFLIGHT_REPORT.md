# Phase 3.2 Preflight Report: Alias Normalization Hardening

**Date:** December 29, 2024  
**Status:** PREFLIGHT COMPLETE — Execution Recommended  
**Risk Level:** Low  
**Scope:** Small (3-4 files, ~100 lines)

---

## Executive Summary

The audit found **one significant inconsistency** in the normalization pipeline:

| Issue                           | Location                                                                                                                               | Impact                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Whitespace collapse missing** | Resolver → Player lookup uses `normalizePlayerNameBasic()` (trim + collapse spaces) but map-build keys use only `toLowerCase().trim()` | Players with multiple internal spaces (e.g., "LeBron James") may not resolve |
| Order inconsistency             | Some paths use `.toLowerCase().trim()`, others use `.trim().toLowerCase()`                                                             | **Functionally equivalent** — no bug, but inconsistent style                 |
| No Unicode normalization        | None of the paths apply NFKC normalization                                                                                             | Minor risk for smart quotes/dashes from copy-paste                           |

**Recommendation:** Implement a single shared `toLookupKey()` function and use it everywhere. This is a low-risk, high-value fix.

---

## A) Findings Summary

### 1. Current Normalization Functions

The codebase has **no single shared key-normalization function**. Instead, there are multiple ad-hoc patterns:

| Pattern                                                                             | Usage Count | Files                                                                      |
| ----------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| `.toLowerCase()` only                                                               | 3           | `buildTeamLookupMap`, `buildStatTypeLookupMap`                             |
| `.toLowerCase().trim()`                                                             | 5           | `unresolvedQueue.ts`, `UnresolvedQueueManager.tsx`, player map keys        |
| `.trim().toLowerCase()`                                                             | 4           | `normalizeTeamName`, `normalizeStatType`, `getTeamInfo`, `getSportForTeam` |
| `normalizePlayerNameBasic()` → `.trim().replace(/\s+/g, " ")` then `.toLowerCase()` | 2           | `getPlayerInfo`, `getPlayerCollision`                                      |

### 2. Specific Code Locations

**Map Building (where lookup keys are computed):**

```typescript
// buildTeamLookupMap (line 446)
const lowerKey = key.toLowerCase(); // NO TRIM

// buildStatTypeLookupMap (line 494)
const lowerKey = key.toLowerCase(); // NO TRIM

// buildPlayerLookupMap (lines 532, 539)
return `${sport}::${name.toLowerCase().trim()}`; // TRIM PRESENT
return name.toLowerCase().trim(); // TRIM PRESENT
```

**Resolution (where raw input is normalized before lookup):**

```typescript
// normalizeTeamName (line 782)
const normalized = teamName.trim();
const lowerSearch = normalized.toLowerCase(); // TRIM + LOWERCASE

// normalizeStatType (line 1009)
const normalized = statType.trim();
const lowerSearch = normalized.toLowerCase(); // TRIM + LOWERCASE

// getPlayerInfo / getPlayerCollision (lines 702-735)
const normalized = normalizePlayerNameBasic(playerName); // TRIM + COLLAPSE
const lowerSearch = normalized.toLowerCase(); // THEN LOWERCASE
```

**Queue Grouping:**

```typescript
// UnresolvedQueueManager.tsx (line 91)
const normalizedRawValue = item.rawValue.toLowerCase().trim();

// unresolvedQueue.ts (line 77) - ID generation
const parts = [rawValue.toLowerCase().trim(), betId];
```

### 3. The Gap: Team/StatType Map Keys Don't Trim

**Root Cause:** When `buildTeamLookupMap` and `buildStatTypeLookupMap` add entries, they use:

```typescript
const lowerKey = key.toLowerCase(); // NO TRIM
```

But the canonical names and aliases in `referenceData.ts` are clean strings (no leading/trailing spaces), so this works in practice. However:

- If a user adds an alias with trailing whitespace via the UI (e.g., " Lakers "), it gets stored with whitespace
- The map key becomes `" lakers "` (with spaces, lowercase)
- When resolving `"Lakers"` (no spaces), the lookup key is `"lakers"` (trim + lowercase)
- **Miss!** The map has `" lakers "` but we're looking for `"lakers"`

This is the "looks-the-same-but-doesn't-resolve" bug.

### 4. Player Normalization is Different (but consistent with itself)

`normalizePlayerNameBasic()` does:

```typescript
return raw.trim().replace(/\s+/g, " "); // Collapse internal whitespace
```

This is then lowercased for lookup. **Both map-build and resolve use this same function**, so players are internally consistent. However, players are treated differently from teams/stats.

---

## B) Normalization Consistency Table

| Entity Type   | Map-Build Normalization                    | Resolve Normalization                      | Queue Grouping          | Save (Alias)                 | Mismatch?                             |
| ------------- | ------------------------------------------ | ------------------------------------------ | ----------------------- | ---------------------------- | ------------------------------------- |
| **Team**      | `.toLowerCase()`                           | `.trim().toLowerCase()`                    | `.toLowerCase().trim()` | Raw value (no normalization) | **Y** - map doesn't trim              |
| **Stat Type** | `.toLowerCase()`                           | `.trim().toLowerCase()`                    | `.toLowerCase().trim()` | Raw value (no normalization) | **Y** - map doesn't trim              |
| **Player**    | `normalizePlayerNameBasic().toLowerCase()` | `normalizePlayerNameBasic().toLowerCase()` | `.toLowerCase().trim()` | Raw value (no normalization) | **Y** - queue doesn't collapse spaces |

**Key Findings:**

1. **Teams/Stats:** Map-build doesn't trim, but resolve does. Dirty aliases won't match.
2. **Players:** Map uses space-collapse, but queue grouping doesn't. Two queue items `"LeBron James"` and `"LeBron  James"` could appear as separate groups but resolve to the same player.
3. **Alias Save:** All paths save `rawValue` as-is (from `group.rawValue` in `UnresolvedQueueManager.tsx`). No cleaning.

---

## C) Recommended Minimal Fix Scope

### Files to Modify

| File                               | Changes                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `services/normalizationService.ts` | Add `toLookupKey()` function, update `buildTeamLookupMap`, `buildStatTypeLookupMap`, `buildPlayerLookupMap`, resolve functions |
| `services/unresolvedQueue.ts`      | Use `toLookupKey()` in `generateUnresolvedItemId`                                                                              |
| `views/UnresolvedQueueManager.tsx` | Use `toLookupKey()` in `generateGroupKey`                                                                                      |
| `hooks/useNormalizationData.tsx`   | (Optional) Add alias deduplication before saving                                                                               |

### Proposed `toLookupKey()` Function

```typescript
/**
 * Normalize a string for use as a lookup key.
 * This is the SINGLE SOURCE OF TRUTH for key normalization.
 *
 * Steps:
 * 1. Trim leading/trailing whitespace
 * 2. Collapse internal whitespace to single space
 * 3. Convert to lowercase
 *
 * Does NOT:
 * - Remove punctuation (can cause collisions: "St. Louis" vs "St Louis")
 * - Apply fuzzy matching
 * - Unicode normalize (NFKC) — future enhancement
 */
export function toLookupKey(raw: string): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
```

### Why This is Safe

1. **No collisions introduced:** Collapsing whitespace is safe — nobody intentionally uses multiple spaces in names
2. **No punctuation removal:** We keep "O'Brien" vs "OBrien" distinct
3. **No fuzzy matching:** Pure deterministic transformation
4. **Backward compatible:** Existing clean aliases will match exactly as before

---

## D) Risk Assessment

### Low Risk

| Scenario                            | Risk     | Mitigation                                                                 |
| ----------------------------------- | -------- | -------------------------------------------------------------------------- |
| Existing aliases stop matching      | Very Low | Existing reference data has clean strings; new function is more permissive |
| Collisions from whitespace collapse | None     | No real names differ only by internal whitespace count                     |

### Medium Risk (Future)

| Scenario                                 | Risk   | Mitigation                                                                    |
| ---------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Unicode variants (smart quotes, em-dash) | Medium | Phase 3.3 could add `raw.normalize('NFKC')` and apostrophe/dash normalization |
| Punctuation variants (Jr. vs Jr)         | Medium | Not addressed in Phase 3.2; would require careful analysis                    |

### Deferred to Phase 3.3

- Unicode NFKC normalization
- Smart quote → ASCII apostrophe conversion (`'` → `'`)
- Em-dash → hyphen conversion (`—` → `-`)
- Alias deduplication on save

---

## E) Proposed Acceptance Criteria for Phase 3.2 Execution

### Must Pass

1. [ ] All existing tests pass (`npm test`)
2. [ ] New tests for `toLookupKey()` pass:
   - `toLookupKey("  Phoenix Suns  ")` → `"phoenix suns"`
   - `toLookupKey("LeBron  James")` → `"lebron james"`
   - `toLookupKey("")` → `""`
   - `toLookupKey("O'Brien")` → `"o'brien"` (punctuation preserved)
3. [ ] Alias with trailing space saved via UI resolves correctly on next import
4. [ ] Queue groups items with whitespace variants together
5. [ ] No localStorage schema changes required

### Manual Validation

1. Clear localStorage, import sample bets
2. In Unresolved Queue, map a player with manually-added trailing space
3. Re-import same sample — player should resolve

---

## F) Suggested Tests to Lock Behavior

### New Test File: `services/normalizationService.lookupKey.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { toLookupKey } from "./normalizationService";

describe("toLookupKey", () => {
  it("trims leading and trailing whitespace", () => {
    expect(toLookupKey("  Phoenix Suns  ")).toBe("phoenix suns");
  });

  it("collapses internal whitespace to single space", () => {
    expect(toLookupKey("LeBron  James")).toBe("lebron james");
    expect(toLookupKey("LeBron\t\nJames")).toBe("lebron james");
  });

  it("converts to lowercase", () => {
    expect(toLookupKey("PHOENIX SUNS")).toBe("phoenix suns");
  });

  it("preserves punctuation", () => {
    expect(toLookupKey("O'Brien")).toBe("o'brien");
    expect(toLookupKey("St. Louis")).toBe("st. louis");
  });

  it("handles empty and null-ish inputs", () => {
    expect(toLookupKey("")).toBe("");
    expect(toLookupKey("   ")).toBe("");
  });
});
```

### Extend Existing Tests

In `resolver.test.ts`:

```typescript
describe("whitespace handling", () => {
  it("resolves team with extra whitespace", () => {
    const result = resolveTeam("  Lakers  ");
    expect(result.status).toBe("resolved");
  });

  it("resolves team with internal whitespace", () => {
    const result = resolveTeam("Los  Angeles  Lakers");
    expect(result.status).toBe("resolved");
    expect(result.canonical).toBe("Los Angeles Lakers");
  });
});
```

---

## G) Evidence / Repro Notes

### Simulated Failure Scenario

Without Phase 3.2 fix, the following would fail:

1. User imports bet with player "LeBron James" (double space)
2. Player goes to unresolved queue
3. User maps to "LeBron James" canonical
4. Alias "LeBron James" saved as-is
5. Map key becomes `"lebron  james"` (double space, lowercase)
6. User imports same bet again
7. Resolver looks up `"lebron james"` (single space, after `normalizePlayerNameBasic`)
8. **Miss!** Double-space key doesn't match single-space lookup

### Real-World Variant Examples (Potential)

| Raw Value                                | Expected Key    | Could Fail?             |
| ---------------------------------------- | --------------- | ----------------------- |
| `"LeBron James"`                         | `lebron james`  | No                      |
| `"LeBron  James"` (double space)         | `lebron  james` | Yes - if saved as alias |
| `"Lakers "` (trailing space)             | `lakers `       | Yes - map key has space |
| `"O'Brien"` vs `"O'Brien"` (smart quote) | Different       | Not addressed in 3.2    |

---

## Files Touched in Preflight

**NONE** — This is a pure analysis document.

---

## Phase 3.2 Execution Tasks

If approved, implement the following:

### Task 1: Create `toLookupKey()` function

- Add to `services/normalizationService.ts`
- Export for use by other modules

### Task 2: Update map-building functions

- `buildTeamLookupMap`: Use `toLookupKey(key)` instead of `key.toLowerCase()`
- `buildStatTypeLookupMap`: Same
- `buildPlayerLookupMap`: Update `makeKey()` and `makeGenericKey()` to use `toLookupKey()`

### Task 3: Update resolve functions

- `normalizeTeamName`, `normalizeTeamNameWithMeta`: Use `toLookupKey()` for search
- `normalizeStatType`: Same
- `getPlayerInfo`, `getPlayerCollision`: Use `toLookupKey()` for search

### Task 4: Update queue/grouping

- `unresolvedQueue.ts`: Use `toLookupKey()` in `generateUnresolvedItemId`
- `UnresolvedQueueManager.tsx`: Use `toLookupKey()` in `generateGroupKey`

### Task 5: Add tests

- Create `normalizationService.lookupKey.test.ts`
- Add whitespace handling tests to `resolver.test.ts`

### Task 6: (Optional) Alias deduplication

- In `useNormalizationData.tsx`, before adding alias, check if `toLookupKey(alias)` already exists

---

## Stop Conditions Evaluated

| Condition                                     | Result                                        |
| --------------------------------------------- | --------------------------------------------- |
| Single shared function already exists?        | **NO** — Multiple ad-hoc patterns found       |
| Punctuation stripping would cause collisions? | **N/A** — Not proposing punctuation stripping |
| Unicode normalization would cause collisions? | **Deferred** — Not proposing in Phase 3.2     |

**Recommendation:** Proceed with Phase 3.2 execution.
