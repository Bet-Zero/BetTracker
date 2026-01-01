# Phase 3.3 Preflight Report: Unicode + Punctuation Normalization Hardening

**Date:** January 1, 2025  
**Status:** PREFLIGHT COMPLETE — Execution Recommended  
**Risk Level:** Low (controlled transformations)  
**Scope:** Small (1 file primary, 0 schema changes)

---

## 1) Executive Summary

### What's Broken

The current `toLookupKey()` function applies **trim + space-collapse + lowercase** only. It does **NOT** handle:

| Variant Type | Example | Current Behavior | Impact |
|--------------|---------|------------------|--------|
| Smart apostrophe | `O'Brien` vs `O'Brien` | Treated as different keys | Alias saved with smart quote won't match later lookup |
| Smart double quotes | `"Points"` vs `"Points"` | Treated as different | Rare but possible from copy-paste |
| Em-dash | `Lakers — Total` vs `Lakers - Total` | Different keys | Frequent in sportsbook data |
| En-dash | `Lakers – Total` vs `Lakers - Total` | Different keys | Same issue |
| Non-breaking space | `LeBron James` vs `LeBron James` | Different keys | Invisible whitespace causes silent mismatches |
| Decomposed accents (NFD) | `Jokić` (2 chars) vs `Jokić` (1 char) | Different keys | Copy-paste from different sources |

### What's at Risk

1. **Unresolved queue spam** — Same entity reappears under visually-identical variants
2. **Alias drift** — User maps `O'Brien` (smart quote), but next import sends `O'Brien` (ASCII) — no match
3. **Duplicate UI groups** — Queue shows `Lakers — Total` and `Lakers - Total` as separate groups
4. **Silent failures** — User thinks entity is resolved, but variant slips through

### Why It Matters

Sports betting data comes from multiple sportsbooks with inconsistent text encoding. Copy-paste from web pages introduces smart punctuation. These invisible differences cause user frustration ("I already mapped this!") and pollute statistics.

---

## 2) Current State Map

### 2.1 The Central Function: `toLookupKey()`

**Location:** [normalizationService.ts](../services/normalizationService.ts) (lines 63-66)

```typescript
export function toLookupKey(raw: string): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
```

**What it does:**
- ✅ Trims leading/trailing whitespace
- ✅ Collapses internal whitespace to single space
- ✅ Lowercases all characters

**What it does NOT do:**
- ❌ Unicode normalization (NFC/NFKC)
- ❌ Smart punctuation → ASCII conversion
- ❌ Non-breaking space handling

### 2.2 All Callsites (proved by grep)

| File | Function | Line | Purpose |
|------|----------|------|---------|
| `normalizationService.ts` | `buildTeamLookupMap()` | 474 | Map key for teams |
| `normalizationService.ts` | `buildStatTypeLookupMap()` | 522 | Map key for stat types |
| `normalizationService.ts` | `buildPlayerLookupMap()` | 560, 567 | Map keys for players (scoped + generic) |
| `normalizationService.ts` | `getPlayerInfo()` | 730 | Search key for player lookup |
| `normalizationService.ts` | `getPlayerCollision()` | 761 | Search key for collision check |
| `normalizationService.ts` | `normalizeTeamName()` | 820 | Search key for team resolution |
| `normalizationService.ts` | `normalizeTeamNameWithMeta()` | 883 | Search key for team resolution with meta |
| `normalizationService.ts` | `getSportForTeam()` | 964 | Search key for sport lookup |
| `normalizationService.ts` | `getTeamInfo()` | 993 | Search key for team info |
| `unresolvedQueue.ts` | `generateUnresolvedItemId()` | 80 | Unique ID for queue deduplication |
| `UnresolvedQueueManager.tsx` | `generateGroupKey()` | 93 | Group key for UI grouping |
| `useNormalizationData.tsx` | `dedupeAliases()` | 41 | Alias deduplication on save |

### 2.3 Alias Save Paths

When user maps or creates an entity:

1. **Map flow:** `UnresolvedQueueManager.tsx` → `handleMapConfirm()` → pushes `group.rawValue` to aliases array
2. **Create flow:** `UnresolvedQueueManager.tsx` → `handleCreateConfirm()` → uses `group.rawValue` in initial aliases
3. **Storage:** `useNormalizationData.tsx` → `updateTeam()/updatePlayer()` → `dedupeAliases()` → localStorage

**Key point:** Raw values are preserved in storage. The `dedupeAliases()` function uses `toLookupKey()` to detect duplicates, but if a smart quote variant gets through, it will be stored as-is.

---

## 3) Variant Examples (Realistic Failure Cases)

### Case 1: Smart Apostrophe (O'Brien)

| Step | Input | `toLookupKey()` Output | Result |
|------|-------|------------------------|--------|
| Import 1 | `O'Brien` (curly `'` U+2019) | `o'brien` | Unresolved → mapped |
| Alias stored | `O'Brien` | — | In localStorage |
| Import 2 | `O'Brien` (ASCII `'` U+0027) | `o'brien` | **MISS** — key differs |

### Case 2: D'Angelo Russell Variants

| Source | Raw Value | `toLookupKey()` | Match? |
|--------|-----------|-----------------|--------|
| DraftKings | `D'Angelo Russell` | `d'angelo russell` | ✅ (if stored) |
| FanDuel | `D'Angelo Russell` (smart) | `d'angelo russell` | ❌ Different |
| Copy-paste | `D'Angelo Russell` | `d'angelo russell` | ❌ Different |

### Case 3: Team Totals with Dashes

| Source | Raw Value | `toLookupKey()` | Match? |
|--------|-----------|-----------------|--------|
| Sportsbook A | `LA Clippers - Team Total` | `la clippers - team total` | ✅ |
| Sportsbook B | `LA Clippers — Team Total` (em-dash) | `la clippers — team total` | ❌ Different |
| Sportsbook C | `LA Clippers – Team Total` (en-dash) | `la clippers – team total` | ❌ Different |

### Case 4: Non-Breaking Spaces

| Step | Input | `toLookupKey()` Output | Issue |
|------|-------|------------------------|-------|
| Import | `LeBron James` (with NBSP U+00A0) | `lebron james` | NBSP not collapsed to space |
| Stored alias | `LeBron James` (regular space) | `lebron james` | ✅ Match |

**The Problem:** NBSP (`\u00A0`) is not matched by `\s+` regex in JavaScript — **WAIT, it actually is**. Let me verify...

> **Correction:** JavaScript `\s` **does** match NBSP. However, some Unicode spaces (thin space, hair space, zero-width space) may not be matched. This is lower risk but worth addressing with NFKC.

### Case 5: Composed vs Decomposed Accents (Jokić)

| Source | Representation | `toLookupKey()` | Match? |
|--------|----------------|-----------------|--------|
| NFC (composed) | `Jokić` (ć = U+0107) | `jokić` | ✅ |
| NFD (decomposed) | `Jokić` (c + ◌́ = U+0063 U+0301) | `jokić` (longer) | ❌ Different byte sequence |

---

## 4) Proposed Normalization Spec

### 4.1 Proposed Function: Extend `toLookupKey()`

Rather than creating a V2 function, I recommend **extending the existing `toLookupKey()`** with Unicode normalization and smart punctuation conversion. This is the cleanest approach because all callsites already use this function.

```typescript
/**
 * Phase 3.3: Normalize a string for use as a lookup key.
 * This is the SINGLE SOURCE OF TRUTH for key normalization.
 *
 * Steps (in order):
 * 1. Return "" for null/undefined/empty
 * 2. Apply Unicode NFKC normalization
 * 3. Convert smart punctuation to ASCII equivalents
 * 4. Trim leading/trailing whitespace
 * 5. Collapse internal whitespace to single space
 * 6. Convert to lowercase
 *
 * Does NOT:
 * - Strip accents (José ≠ Jose — user preference)
 * - Remove punctuation (O'Brien ≠ OBrien)
 * - Apply fuzzy matching
 */
export function toLookupKey(raw: string): string {
  if (!raw) return "";
  
  // Step 1: Unicode NFKC normalization
  // - Converts composed/decomposed variants to canonical form
  // - Converts compatibility characters (e.g., ﬁ → fi)
  let normalized = raw.normalize('NFKC');
  
  // Step 2: Smart punctuation → ASCII
  normalized = normalized
    // Smart single quotes → ASCII apostrophe
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    // Smart double quotes → ASCII double quote
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    // Dashes (em-dash, en-dash, figure dash, horizontal bar) → hyphen-minus
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-')
    // Non-breaking space, narrow no-break space → regular space
    .replace(/[\u00A0\u202F]/g, ' ');
  
  // Step 3: Existing normalization (unchanged)
  return normalized.trim().replace(/\s+/g, " ").toLowerCase();
}
```

### 4.2 Transformation Order Rationale

| Order | Step | Reason |
|-------|------|--------|
| 1 | NFKC | Must come first to normalize composed/decomposed forms before any string ops |
| 2 | Smart punctuation | Done on normalized string for consistency |
| 3 | Trim | Standard cleanup |
| 4 | Collapse spaces | Handles multiple spaces, tabs, etc. |
| 5 | Lowercase | Final step, ensures case-insensitive matching |

### 4.3 Why NFKC (not NFC)

| Form | What It Does | Recommendation |
|------|--------------|----------------|
| NFC | Canonical composition (é = single char) | Safe, minimal change |
| NFD | Canonical decomposition (é = e + ◌́) | Not useful for us |
| NFKC | Compatibility composition + canonical | **Recommended** — also normalizes compat chars like `ﬁ` → `fi`, `™` → `TM` |
| NFKD | Compatibility decomposition | Too aggressive |

NFKC is the safer choice for lookup keys because it handles both encoding variants AND some typographic variants.

---

## 5) Collision / Risk Assessment

### Decision Table

| Proposed Transform | Benefit | Collision Risk | Recommendation |
|--------------------|---------|----------------|----------------|
| NFKC normalization | Unifies composed/decomposed accents | Very low — no distinct entities differ only by unicode form | ✅ **Include** |
| Smart quotes → ASCII | `O'Brien` variants unify | None — no names intentionally use smart vs ASCII quotes | ✅ **Include** |
| Em/en-dash → hyphen | `Lakers — Total` unifies | None — dashes are interchangeable in this domain | ✅ **Include** |
| NBSP → space | Invisible whitespace fixed | None — NBSP is never intentional in entity names | ✅ **Include** |
| Accent stripping | `José` → `Jose` | **High** — these can be distinct user preferences | ❌ **Do NOT include** |
| Period removal | `St.` → `St` | **Medium** — can cause `St. Louis` vs `St Louis` to collide | ❌ **Do NOT include** |

### Risk Level: LOW

All proposed transformations are:
- **Deterministic** — same input always produces same output
- **Reversible conceptually** — original value preserved in storage
- **Domain-safe** — no sports entities differ only by smart quote or dash type

---

## 6) Recommended Implementation Surface

### Primary Change (Single Function)

| File | Change |
|------|--------|
| [normalizationService.ts](../services/normalizationService.ts) | Modify `toLookupKey()` to add NFKC + smart punctuation conversion |

### No Changes Needed

| File | Reason |
|------|--------|
| `unresolvedQueue.ts` | Already uses `toLookupKey()` |
| `UnresolvedQueueManager.tsx` | Already uses `toLookupKey()` |
| `useNormalizationData.tsx` | Already uses `toLookupKey()` via `dedupeAliases()` |
| `resolver.ts` | Uses resolve functions which use `toLookupKey()` |

### Storage Changes: NONE

- localStorage schema is unchanged
- Stored aliases remain as-is (raw values preserved)
- The fix is in the **lookup key** generation, not storage
- Existing clean aliases will continue to match

### Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| Existing alias `O'Brien` (ASCII) | Still matches — `toLookupKey()` output unchanged for ASCII input |
| Existing alias `O'Brien` (smart) stored | Now matches both ASCII and smart variants on lookup |
| New import with smart quote | Matches any existing alias regardless of quote style |

---

## 7) Test Plan

### 7.1 Existing Test File to Extend

**File:** [normalizationService.lookupKey.test.ts](../services/normalizationService.lookupKey.test.ts)

This file already tests `toLookupKey()`. Add new describe blocks for Phase 3.3.

### 7.2 Proposed New Test Cases

```typescript
// In normalizationService.lookupKey.test.ts

describe('Phase 3.3: Unicode normalization', () => {
  it('normalizes composed and decomposed accents to same key', () => {
    const composed = 'Jokić'; // ć = U+0107
    const decomposed = 'Jokic\u0301'; // c + combining acute
    expect(toLookupKey(composed)).toBe(toLookupKey(decomposed));
  });

  it('handles accented characters correctly', () => {
    expect(toLookupKey('Jokić')).toBe('jokić');
    expect(toLookupKey('José')).toBe('josé'); // Accent preserved
  });
});

describe('Phase 3.3: Smart punctuation conversion', () => {
  describe('apostrophes', () => {
    it('converts smart single quotes to ASCII apostrophe', () => {
      expect(toLookupKey("O'Brien")).toBe("o'brien"); // Smart right
      expect(toLookupKey("O'Brien")).toBe("o'brien"); // ASCII
      expect(toLookupKey("O'Brien")).toBe(toLookupKey("O'Brien")); // Must match
    });

    it('handles D\'Angelo Russell variants', () => {
      const ascii = "D'Angelo Russell";
      const smart = "D'Angelo Russell";
      expect(toLookupKey(ascii)).toBe(toLookupKey(smart));
      expect(toLookupKey(ascii)).toBe("d'angelo russell");
    });
  });

  describe('dashes', () => {
    it('converts em-dash to hyphen', () => {
      expect(toLookupKey('Lakers — Total')).toBe('lakers - total');
    });

    it('converts en-dash to hyphen', () => {
      expect(toLookupKey('Lakers – Total')).toBe('lakers - total');
    });

    it('unifies all dash variants', () => {
      const emDash = 'LA Clippers — Team Total';
      const enDash = 'LA Clippers – Team Total';
      const hyphen = 'LA Clippers - Team Total';
      expect(toLookupKey(emDash)).toBe(toLookupKey(enDash));
      expect(toLookupKey(enDash)).toBe(toLookupKey(hyphen));
    });
  });

  describe('spaces', () => {
    it('converts non-breaking space to regular space', () => {
      const nbsp = 'LeBron\u00A0James'; // NBSP
      const regular = 'LeBron James';
      expect(toLookupKey(nbsp)).toBe(toLookupKey(regular));
    });
  });

  describe('double quotes', () => {
    it('converts smart double quotes to ASCII', () => {
      expect(toLookupKey('"Points"')).toBe('"points"');
      expect(toLookupKey('"Points"')).toBe('"points"');
    });
  });
});

describe('Phase 3.3: Integration with existing behavior', () => {
  it('preserves existing behavior for ASCII input', () => {
    // These should produce identical output to Phase 3.P1
    expect(toLookupKey('  Phoenix Suns  ')).toBe('phoenix suns');
    expect(toLookupKey('LeBron  James')).toBe('lebron james');
    expect(toLookupKey("O'Brien")).toBe("o'brien");
    expect(toLookupKey('St. Louis Cardinals')).toBe('st. louis cardinals');
  });

  it('does NOT strip accents', () => {
    expect(toLookupKey('José')).toBe('josé');
    expect(toLookupKey('José')).not.toBe('jose'); // Would be a bug
  });

  it('does NOT remove periods', () => {
    expect(toLookupKey('St. Louis')).toBe('st. louis');
    expect(toLookupKey('Jr.')).toBe('jr.');
  });
});
```

### 7.3 How to Run Tests

```bash
# Run all tests
npm test

# Run only lookup key tests
npm test -- --testPathPattern="normalizationService.lookupKey"

# Watch mode for development
npm run test:watch
```

### 7.4 Test Matrix Summary

| Entity Type | Variant | Test Coverage |
|-------------|---------|---------------|
| Player | Smart apostrophe (`O'Brien`) | ✅ |
| Player | D'Angelo Russell variants | ✅ |
| Team | Em-dash in totals | ✅ |
| Stat Type | Non-breaking space | ✅ |
| All | Composed/decomposed accents | ✅ |
| All | Existing ASCII behavior preserved | ✅ |

### 7.5 What We Explicitly Do NOT Normalize

| Pattern | Reason |
|---------|--------|
| Accent stripping (`José` → `Jose`) | User preference / cultural correctness |
| Period removal (`St.` → `St`) | Can cause collisions |
| All punctuation removal | Would break `O'Brien`, `A&M`, etc. |

---

## 8) Acceptance Criteria for Phase 3.3 Execution

### Must Pass (Automated)

- [ ] All existing tests pass (`npm test`)
- [ ] New Phase 3.3 tests pass:
  - [ ] `O'Brien` (smart) matches `O'Brien` (ASCII)
  - [ ] `D'Angelo Russell` variants unify
  - [ ] `Lakers — Total` (em-dash) matches `Lakers - Total` (hyphen)
  - [ ] Composed/decomposed `Jokić` variants produce same key
  - [ ] NBSP treated as regular space
  - [ ] Accents are **preserved** (no stripping)
  - [ ] Periods are **preserved** (no removal)

### Must Pass (Manual Validation)

- [ ] Import bets with smart apostrophe player name
- [ ] Map to existing player (using ASCII apostrophe)
- [ ] Re-import same bet — player should resolve
- [ ] Verify queue does not show duplicate groups for dash variants

### No-Change Verification

- [ ] localStorage schema unchanged
- [ ] Existing aliases continue to resolve correctly
- [ ] No new files created (all changes in `normalizationService.ts`)

---

## 9) Appendix: Source Pointers

### Key Files

| File | Purpose | Lines of Interest |
|------|---------|-------------------|
| [normalizationService.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.ts) | Central normalization logic | 63-66 (`toLookupKey`) |
| [unresolvedQueue.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/unresolvedQueue.ts) | Queue ID generation | 75-86 (`generateUnresolvedItemId`) |
| [UnresolvedQueueManager.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/views/UnresolvedQueueManager.tsx) | Queue UI grouping | 92-96 (`generateGroupKey`) |
| [useNormalizationData.tsx](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/hooks/useNormalizationData.tsx) | Alias save deduplication | 37-48 (`dedupeAliases`) |
| [normalizationService.lookupKey.test.ts](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/services/normalizationService.lookupKey.test.ts) | Existing tests | Lines 1-92 |

### Unicode Character References

| Character | Name | Code Point | Replacement |
|-----------|------|------------|-------------|
| `'` | Right single quote | U+2019 | `'` (U+0027) |
| `'` | Left single quote | U+2018 | `'` (U+0027) |
| `"` | Left double quote | U+201C | `"` (U+0022) |
| `"` | Right double quote | U+201D | `"` (U+0022) |
| `—` | Em dash | U+2014 | `-` (U+002D) |
| `–` | En dash | U+2013 | `-` (U+002D) |
| ` ` | Non-breaking space | U+00A0 | ` ` (U+0020) |

### Related Documentation

- [INPUT_SYSTEM_MASTER.md](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/docs/INPUT_SYSTEM_MASTER.md) — Phase 3.P1 context
- [PHASE_3_2_PREFLIGHT_REPORT.md](file:///Volumes/Samsung%20PSSD%20T7/Personal/TEMP/BetTracker/docs/PHASE_3_2_PREFLIGHT_REPORT.md) — Predecessor phase

---

## Stop Conditions Evaluated

| Condition | Result |
|-----------|--------|
| `toLookupKey()` already applies Unicode normalization? | **NO** — Current implementation is trim + collapse + lowercase only |
| Unicode normalization would cause meaningful collisions? | **NO** — All proposed transforms are collision-safe in this domain |
| Smart punctuation conversion would cause collisions? | **NO** — No entities differ only by quote/dash style |

**Recommendation:** Proceed with Phase 3.3 execution.
