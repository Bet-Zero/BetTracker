# Phase 3.3 Return Package — Unicode + Punctuation Normalization Hardening

**Date:** January 1, 2026  
**Status:** ✅ COMPLETE  
**Test Result:** All 461 tests pass

---

## 1) Summary

Extended `toLookupKey()` to handle Unicode normalization and smart punctuation variants, ensuring visually-identical strings resolve to the same canonical Key across teams, players, stat types, and unresolved queue grouping.

**Changes Applied (in order):**
1. **NFKC Unicode normalization** — unifies composed/decomposed accent forms (e.g., `Jokić` NFC = NFD)
2. **Smart single quotes → ASCII `'`** — `O'Brien` (U+2019) matches `O'Brien` (U+0027)
3. **Smart double quotes → ASCII `"`** — `"Points"` unifies with `"Points"`
4. **Dash variants → ASCII `-`** — em-dash, en-dash, figure dash, minus sign all become hyphen-minus
5. **NBSP/narrow NBSP → regular space** — invisible whitespace variants collapse correctly

**Explicitly NOT Changed:**
- ❌ No accent stripping (`José` → `josé`, NOT `jose`)
- ❌ No period removal (`St. Louis` remains `st. louis`)
- ❌ No localStorage schema changes
- ❌ No fuzzy matching

---

## 2) Files Changed/Created

| File | Change Type | Description |
|------|-------------|-------------|
| `services/normalizationService.ts` | **Modified** | Extended `toLookupKey()` with NFKC + smart punctuation conversion |
| `services/normalizationService.lookupKey.test.ts` | **Modified** | Added 27 new Phase 3.3 tests |
| `docs/PHASE_3_3_RETURN_PACKAGE.md` | **Created** | This return package document |

---

## 3) `toLookupKey()` Final Implementation

```typescript
/**
 * Phase 3.3: Single shared lookup-key function for consistent normalization.
 *
 * This is the SINGLE SOURCE OF TRUTH for key normalization.
 *
 * Steps (in order):
 * 1. Return "" for null/undefined/empty
 * 2. Apply Unicode NFKC normalization (unifies composed/decomposed forms)
 * 3. Convert smart punctuation to ASCII equivalents
 * 4. Trim leading/trailing whitespace
 * 5. Collapse internal whitespace to single space (\s+ -> " ")
 * 6. Convert to lowercase
 *
 * IMPORTANT - Does NOT:
 * - Strip accents (José → josé, NOT jose — user preference)
 * - Remove punctuation (O'Brien → o'brien, NOT obrien)
 * - Apply fuzzy matching
 *
 * Use everywhere lookup keys are generated or compared:
 * - Map-building (teams/stat types/players)
 * - Resolution (teams/stat types/players)
 * - Unresolved queue ID generation
 * - Unresolved queue grouping keys
 */
export function toLookupKey(raw: string): string {
  if (!raw) return "";

  // Step 1: Unicode NFKC normalization
  // - Converts composed/decomposed variants to canonical form
  // - Converts compatibility characters (e.g., ﬁ → fi)
  let normalized = raw.normalize("NFKC");

  // Step 2: Smart punctuation → ASCII
  normalized = normalized
    // Smart single quotes → ASCII apostrophe
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    // Smart double quotes → ASCII double quote
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    // Dashes (em-dash, en-dash, figure dash, horizontal bar, minus sign) → hyphen-minus
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    // Non-breaking space, narrow no-break space → regular space
    .replace(/[\u00A0\u202F]/g, " ");

  // Step 3: Existing normalization (unchanged)
  return normalized.trim().replace(/\s+/g, " ").toLowerCase();
}
```

---

## 4) New/Updated Tests

### Unicode Normalization Suite (3 tests)
| Test | Description |
|------|-------------|
| `normalizes composed and decomposed accents to same key` | Proves `Jokić` NFC = NFD forms |
| `preserves accents in output (does NOT strip)` | Confirms `José` → `josé`, not `jose` |
| `handles various accented characters correctly` | Tests `Müller`, `Özil`, `Piñata` |

### Smart Punctuation Suite (17 tests)
| Category | Tests |
|----------|-------|
| **Apostrophes** | Smart right/left quotes → ASCII, D'Angelo Russell variants, prime mark |
| **Double Quotes** | Smart left/right double quotes → ASCII |
| **Dashes** | Em-dash, en-dash, figure dash, minus sign → hyphen; unification test |
| **Spaces** | NBSP → space, narrow NBSP → space, multiple NBSP collapse |

### Regression Guardrails Suite (4 tests)
| Test | Description |
|------|-------------|
| `preserves existing ASCII behavior` | Verifies Phase 3.P1 outputs unchanged for ASCII input |
| `does NOT strip accents` | Guards against accent-stripping regression |
| `does NOT remove periods` | Guards against period-removal regression |
| `does NOT remove punctuation broadly` | Guards against punctuation-stripping |

---

## 5) Test Results

```
> npm test

 ✓ services/normalizationService.lookupKey.test.ts (41)
 ✓ services/normalizationService.test.ts (50)
 ✓ [21 other test files...]

 Test Files  23 passed | 1 skipped (24)
      Tests  461 passed | 1 skipped (462)
   Duration  44.63s
Exit code: 0
```

**Key metrics:**
- **41 tests** in `normalizationService.lookupKey.test.ts` (was 14, added 27)
- **All 461 tests pass** (no regressions)

---

## 6) Notes / Edge Cases

### Verified
- ✅ `String.prototype.normalize()` is supported in Node.js (ES6+, native support since Node v4)
- ✅ No meaningful collisions from NFKC or punctuation normalization in sports domain
- ✅ All callsites already use `toLookupKey()` — no manual `.toLowerCase().trim()` patterns in lookup key paths

### Observations
- Parser files (e.g., `fanduel/parsers/common.ts`) use `.toLowerCase().trim()` locally for classification logic — this is intentional and unrelated to lookup key generation
- Team collisions logged (e.g., `MIN` → Timberwolves vs Vikings) are cross-sport and handled by first-entry policy — Phase 3.3 changes do not affect this

### Future Considerations
- Could add hair space (U+200A), thin space (U+2009) to space normalization if ever encountered
- Zero-width characters (U+200B, U+FEFF) could be stripped, but not seen in sportsbook data
