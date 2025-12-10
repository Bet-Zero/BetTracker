# Artifact Relevance Analysis

## Scope Summary

- Inspected 30+ files across 8 folders/directories
- Count by type:
  - DOC: 3
  - SCRIPT: 9
  - DATA: 15+
  - LOG: 9
  - OTHER: 1 (HTML debug file)

## ⚠️ Test Issues Summary

Found issues in some test files that need attention:

1. **`test-sgp-odds-fix.ts`** - Missing DOM environment setup (DOMParser/global.document) - will crash at runtime
2. **`parsing/parsers/compare-fanduel-fixture.test.ts`** - Depends on generated file `your-html-file_parsed.json` that may not exist
3. **`parsing/testParser.ts`** - References non-existent fixture `fanduel_single_example.html` (already marked for archive)

**Good test files:**
- ✅ `parsing/parsers/fanduel.test.ts` - Fully functional vitest test with proper DOM setup and all fixtures present

## Artifact Classification

### 📌 ACTIVE

- `parsing/ARCHITECTURE.md`
  - Type: DOC
  - Why: Current architecture documentation; referenced in README; describes active system
  - Action: Keep

- `parsing/fixtures/fanduel/expected_fanduel_bets.html`
  - Type: DATA
  - Why: Active test fixture used by `parsing/parsers/fanduel.test.ts` and `fanduelFixtureChecker.ts`
  - Action: Keep

- `parsing/fixtures/fanduel/expected_fanduel_bets.json`
  - Type: DATA
  - Why: Active test fixture used by test suite and fixture checker
  - Action: Keep

- `parsing/fixtures/fanduel/sgp_sample.html`
  - Type: DATA
  - Why: Active test fixture used by `fanduel.test.ts` for SGP parsing tests
  - Action: Keep

- `parsing/fixtures/fanduel/expected_sgp_sample.json`
  - Type: DATA
  - Why: Active test fixture used by test suite
  - Action: Keep

- `parsing/fixtures/fanduel/sgp_plus_sample.html`
  - Type: DATA
  - Why: Active test fixture used by `fanduel.test.ts` for SGP+ parsing tests
  - Action: Keep

- `parsing/fixtures/fanduel/expected_sgp_plus_sample.json`
  - Type: DATA
  - Why: Active test fixture used by test suite
  - Action: Keep

- `parsing/fixtures/fanduel/fanduelFixtureChecker.ts`
  - Type: SCRIPT
  - Why: Active test utility called by `test-fanduel-fixture.ts` which is in package.json scripts
  - Action: Keep

- `parsing/fixtures/fanduel/fanduelSgpSampleChecker.ts`
  - Type: SCRIPT
  - Why: Active test utility called by `test-fanduel-fixture.ts` which is in package.json scripts
  - Action: Keep

- `data/sampleData.ts`
  - Type: DATA
  - Why: Contains sample Bet data used for development/testing
  - Action: Keep

- `parsing/parsers/fanduel.test.ts`
  - Type: SCRIPT
  - Why: Proper vitest test file with all fixtures present; correctly sets up DOM environment; 3 test cases covering single, SGP, and SGP+ bets
  - Action: Keep ✅ (fully functional)

- `test-fanduel-fixture.ts`
  - Type: SCRIPT
  - Why: Referenced in package.json `test:fanduel` script; active test runner
  - Action: Keep

- `test-sgp-odds-fix.ts`
  - Type: SCRIPT
  - Why: Specific test for SGP odds parsing behavior; validates parser fixes
  - ⚠️ ISSUE: Missing DOM environment setup (DOMParser/global.document) - will fail at runtime
  - Action: Keep, but needs fix (add DOM setup like other test scripts)

- `analyze-parser-issues.ts`
  - Type: SCRIPT
  - Why: Referenced in package.json `parse` script; active debugging tool
  - Action: Keep

- `parsing/parsers/compare-fanduel-fixture.test.ts`
  - Type: SCRIPT
  - Why: Active test that compares comprehensive fixture against parsed output; user wants to keep this test setup
  - ⚠️ ISSUE: Depends on generated file `your-html-file_parsed.json` - test will fail if file doesn't exist; requires manual setup step
  - Action: Keep, but needs documentation/fix (either generate file in test setup or skip test gracefully when missing)

- `parsing/fixtures/fanduel/expected_fanduel_comprehensive.json`
  - Type: DATA
  - Why: Required fixture for compare-fanduel-fixture.test.ts; needed for comprehensive test validation
  - Action: Keep

### 📦 LEGACY_BUT_IMPORTANT

- `BEFORE_AND_AFTER.md`
  - Type: DOC
  - Why: Historical documentation of major refactoring; explains architectural decisions and reasoning; valuable context for future maintainers
  - Action: Keep, but mark legacy (consider moving to docs/ or docs/_archive/)

- `REFACTORING_SUMMARY.md`
  - Type: DOC
  - Why: Summary of refactoring work; explains why changes were made; complements BEFORE_AND_AFTER.md
  - Action: Keep, but mark legacy (consider moving to docs/ or docs/_archive/)

### 📁 ARCHIVE_CANDIDATE

- `debug-fanduel-structure.ts`
  - Type: SCRIPT
  - Why: One-off debug script for HTML structure analysis; not referenced anywhere; functionality likely absorbed into parser or tests
  - Action: Move to archive/

- `debug-under-parsing.ts`
  - Type: SCRIPT
  - Why: One-off debug script for specific parsing issue; not referenced; appears to be temporary debugging tool
  - Action: Move to archive/

- `debug-parser.html`
  - Type: OTHER
  - Why: Browser-based debug tool for parser; not referenced; appears to be exploratory development artifact
  - Action: Move to archive/

- `test-fanduel-parser.ts`
  - Type: SCRIPT
  - Why: Debug script that duplicates functionality of `analyze-parser-issues.ts` and test suite; not referenced in package.json
  - Action: Move to archive/

- `parsing/testParser.ts`
  - Type: SCRIPT
  - Why: References non-existent fixture `fanduel_single_example.html`; appears to be outdated test script; functionality covered by test suite
  - Action: Move to archive/


- `analyze-parsed-errors.ts`
  - Type: SCRIPT
  - Why: Analyzes parsed JSON output for errors; appears to be a post-processing validation tool; less critical than analyze-parser-issues.ts
  - Action: Review then archive (may still be useful for validation)

### 🗑️ PROBABLY_TRASH

- `tmp/compare-fanduel-*.json` (9 files)
  - Type: LOG
  - Why: Test output artifacts from compare-fanduel-fixture.test.ts; can be regenerated; consider adding tmp/ to .gitignore
  - Action: Review (can delete if not needed for history, or keep as test artifacts; consider .gitignore)

- `your-html-file_parsed.json`
  - Type: LOG
  - Why: Temporary output from analyze-parser-issues.ts; generated file not tracked; only used by compare-fanduel-fixture.test.ts
  - Action: Review then delete (or add to .gitignore if needed temporarily)

- `your-html-file_issues.json`
  - Type: LOG
  - Why: Temporary output from analyze-parser-issues.ts; generated debug file
  - Action: Review then delete

- `your-html-file.html`
  - Type: DATA
  - Why: Temporary input file referenced by package.json parse script; appears to be user's test HTML file
  - Action: Review (may be user's test data; should be in tmp/ or data/ if kept)

- `data/fanduel_sample.html`
  - Type: DATA
  - Why: Empty file (0 bytes); referenced by debug-fanduel-structure.ts but never populated
  - Action: Review then delete (or populate if needed)

### ❓ UNKNOWN

## Redundancy Report

- `test-fanduel-parser.ts` & `analyze-parser-issues.ts`
  - Winner: `analyze-parser-issues.ts` (referenced in package.json)
  - Duplicate: `test-fanduel-parser.ts` → ARCHIVE_CANDIDATE

- `expected_fanduel_bets.json` & `expected_fanduel_comprehensive.json`
  - Both are ACTIVE: `expected_fanduel_bets.json` used by main test suite; `expected_fanduel_comprehensive.json` used by compare test
  - Different purposes: `expected_fanduel_bets.json` for unit tests, `expected_fanduel_comprehensive.json` for comprehensive validation

## Summary by Status

- ACTIVE: 15
- LEGACY_BUT_IMPORTANT: 2
- ARCHIVE_CANDIDATE: 5
- PROBABLY_TRASH: 6
- UNKNOWN: 0

## Suggested Cleanup Script (Safe)

```bash
### Suggested Cleanup Script (manual, safe)

# Create archive directory for legacy docs
mkdir -p docs/_archive

# Create archive directory for scripts
mkdir -p scripts/_archive

# Archive legacy documentation (keep but organize)
mv BEFORE_AND_AFTER.md docs/_archive/
mv REFACTORING_SUMMARY.md docs/_archive/

# Archive debug/exploratory scripts
mkdir -p scripts/_archive/debug
mv debug-fanduel-structure.ts scripts/_archive/debug/
mv debug-under-parsing.ts scripts/_archive/debug/
mv debug-parser.html scripts/_archive/debug/

# Archive redundant test scripts
mkdir -p scripts/_archive/tests
mv test-fanduel-parser.ts scripts/_archive/tests/
mv parsing/testParser.ts scripts/_archive/tests/

# Archive analysis scripts (keep for reference but not in root)
mkdir -p scripts/_archive/analysis
mv analyze-parsed-errors.ts scripts/_archive/analysis/

# Potential deletions (commented for safety - review first)
# Test output artifacts (can be regenerated; consider adding tmp/ to .gitignore)
# rm tmp/compare-fanduel-*.json

# Temporary parsed output files
# rm your-html-file_parsed.json
# rm your-html-file_issues.json

# Empty/unused data file
# rm data/fanduel_sample.html

# Temporary HTML input (review - may be user's test data)
# rm your-html-file.html

# Note: compare-fanduel-fixture.test.ts is kept as active test (user preference)
# Note: Consider adding tmp/ and your-html-file* patterns to .gitignore to prevent committing test outputs
```

