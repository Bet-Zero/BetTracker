# Parser Implementation Checklist

Use this checklist when implementing a parser for a new sportsbook. This ensures consistency and completeness across all parsers.

## Pre-Implementation

- [ ] **Collect Sample HTML**
  - [ ] Obtain HTML from sportsbook's settled bets page
  - [ ] Include examples of: singles, parlays, SGPs, wins, losses, pushes, pending
  - [ ] Save samples in `parsing/fixtures/{sportsbook}/`
- [ ] **Study HTML Structure**

  - [ ] Identify bet card/container elements
  - [ ] Locate header vs footer sections
  - [ ] Find bet ID, amounts, dates, results
  - [ ] Identify leg/selection structure
  - [ ] Document CSS classes/selectors used

- [ ] **Reference Existing Parser**
  - [ ] Review `parsing/parsers/fanduel/` as reference implementation
  - [ ] Review `parsing/PARSER_TARGET_FIELDS.md` for output format
  - [ ] Understand `Bet` and `BetLeg` interfaces in `types.ts`

## Implementation Steps

### 1. Project Setup

- [ ] Create parser directory: `parsing/parsers/{sportsbook}/`
- [ ] Create main parser file: `parsing/parsers/{sportsbook}/index.ts`
- [ ] Create test file: `parsing/parsers/{sportsbook}.test.ts`
- [ ] Create fixtures directory: `parsing/fixtures/{sportsbook}/`

### 2. Core Parser Structure

- [ ] Export main parsing function: `export const parse{Sportsbook} = (htmlContent: string): Bet[]`
- [ ] Add alias export: `export const parse = parse{Sportsbook};`
- [ ] Set up DOMParser for HTML parsing
- [ ] Add debug logging (conditional on environment variable)
- [ ] Handle empty/invalid HTML gracefully

### 3. HTML Extraction

- [ ] **Identify bet containers** - Find all bet cards/items in HTML
  - [ ] Selector for container list (e.g., `<ul>`, `<div class="bets">`)
  - [ ] Selector for individual bet cards
- [ ] **Extract header information** - Bet details from card header
  - [ ] Bet description/title
  - [ ] Sport name
  - [ ] Player/team names
  - [ ] Market type (spread, total, prop, etc.)
  - [ ] Odds
  - [ ] Live bet indicator (if applicable)
- [ ] **Extract footer information** - Bet metadata from card footer
  - [ ] Bet ID
  - [ ] Placed date/time
  - [ ] Stake amount
  - [ ] Payout/returned amount
  - [ ] Result indicators (won, lost, pushed, pending)
- [ ] **Extract leg information** - Individual selections
  - [ ] Player/team name(s)
  - [ ] Stat type/market
  - [ ] Line/threshold value
  - [ ] Over/Under indicator
  - [ ] Leg-specific odds (if available)
  - [ ] Leg-specific result (if available)

### 4. Field Normalization

- [ ] **Dates and Times**

  - [ ] Parse date strings to ISO 8601 format
  - [ ] Handle timezone conversions
  - [ ] Generate `id` field: `"{book}:{betId}:{placedAt}"`

- [ ] **Financial Values**

  - [ ] Parse currency strings (remove $, commas)
  - [ ] Convert to numbers
  - [ ] Handle decimal precision

- [ ] **Odds**

  - [ ] Parse odds to American format (integer)
  - [ ] Handle both positive and negative odds
  - [ ] Convert from fractional/decimal if needed

- [ ] **Results**
  - [ ] Map sportsbook terms to standard values
  - [ ] Bet results: "win", "loss", "push", "pending" (lowercase)
  - [ ] Leg results: "WIN", "LOSS", "PUSH", "PENDING" (uppercase)

### 5. Bet Type Detection

- [ ] **Identify bet structure**

  - [ ] Single: 1 selection
  - [ ] Parlay: 2+ selections from different games
  - [ ] SGP: 2+ selections from same game
  - [ ] SGP+: SGP + selections from other games

- [ ] **Classification logic**
  - [ ] Check for explicit type indicators in HTML
  - [ ] Count legs/selections
  - [ ] Check for "same game" markers
  - [ ] Look for leg count patterns (e.g., "3 leg parlay")

### 6. Market Category Classification

- [ ] **Determine category based on bet structure**
  - [ ] Props: Player/team stat bets (points, assists, etc.)
  - [ ] Main Markets: Spread, total, moneyline
  - [ ] Futures: Season-long bets (championships, awards)
  - [ ] SGP/SGP+: Same game parlays
  - [ ] Parlays: Multi-game parlays

### 7. Leg Structure Building

- [ ] **For Single Bets**
  - [ ] Create 1 leg matching bet-level data
  - [ ] Set leg odds = bet odds
  - [ ] Set leg result = bet result
- [ ] **For Parlays**
  - [ ] Create separate leg for each selection
  - [ ] Extract individual leg odds (if available)
  - [ ] Extract individual leg results (if available)
  - [ ] Preserve leg order from HTML
- [ ] **For SGPs**
  - [ ] Create 1 group leg with `isGroupLeg: true`
  - [ ] Set group leg odds = bet odds
  - [ ] Create children array for selections
  - [ ] Set children odds to `undefined`
  - [ ] Extract children results from icons/indicators
- [ ] **For SGP+**
  - [ ] Create group leg for SGP portion
  - [ ] Create separate legs for extra selections
  - [ ] Set individual odds for non-SGP legs
  - [ ] Properly structure nested children

### 8. Description Building

- [ ] **Single bets**
  - [ ] Format: "{Player} {Line} {Stat Type}"
  - [ ] Example: "Royce O'Neale 5+ MADE THREES"
- [ ] **Parlays**
  - [ ] Format: "{Selection1}, {Selection2}, ..."
  - [ ] Example: "Orlando Magic -5.5, Detroit Pistons -5.5"
- [ ] **SGPs**
  - [ ] Format: "Same Game Parlay - {Game}: {Selection1}; {Selection2}; ..."
  - [ ] Example: "Same Game Parlay - Bulls @ Trail Blazers: Player1 10+ Ast; Player2 4+ 3pt"
- [ ] **SGP+**
  - [ ] Format: "{N}-leg Same Game Parlay Plus: SGP ({selections}) + {extra1} + {extra2}"
  - [ ] Example: "4-leg Same Game Parlay Plus: SGP (Adams 50+ Yds, Kupp 3+ Rec) + Pearsall 50+ Yds + Kupp 3+ Yds"

### 9. Convenience Fields

- [ ] **Extract from first leg for singles**
  - [ ] `name`: Player/team name
  - [ ] `type`: Stat type code (e.g., "3pt", "Pts", "Ast")
  - [ ] `line`: Threshold value (e.g., "5+", "25.5")
  - [ ] `ou`: Over/Under indicator

**Purpose:** These convenience fields are surfaced at the bet level to enable fast UI filtering and automated validation without traversing the legs array. For example, they allow quick filtering like "show all Assists props" or "filter by line > 25" without iterating through nested leg structures. Extract these values from `legs[0]` for single bets.

## Testing

### 10. Unit Tests

- [ ] **Create test file** `parsing/parsers/{sportsbook}.test.ts`

- [ ] **Test basic parsing**
  - [ ] Parser returns array
  - [ ] Correct number of bets parsed
  - [ ] No duplicate bet IDs
- [ ] **Test field accuracy**
  - [ ] All required fields present
  - [ ] Field values match expected values
  - [ ] Odds parsed correctly
  - [ ] Amounts parsed correctly
  - [ ] Dates formatted correctly
- [ ] **Test bet types**
  - [ ] Single bets parsed correctly
  - [ ] Parlay bets parsed correctly
  - [ ] SGP bets parsed correctly
  - [ ] SGP+ bets parsed correctly
- [ ] **Test edge cases**
  - [ ] Empty HTML
  - [ ] Malformed HTML
  - [ ] Missing fields
  - [ ] Unusual formatting

### 11. Expected Output Files

- [ ] **Create expected JSON fixtures**
  - [ ] `expected_{sportsbook}_bets.json` - Basic bet samples
  - [ ] `expected_sgp_sample.json` - SGP example (if applicable)
  - [ ] `expected_sgp_plus_sample.json` - SGP+ example (if applicable)
- [ ] **Validate against target fields**
  - [ ] Use `parsing/PARSER_TARGET_FIELDS.md` as reference
  - [ ] Verify all required fields present
  - [ ] Verify field types match specification
  - [ ] Verify nested structures (legs, children) correct

### 12. Integration Testing

- [ ] **Test with real HTML samples**
  - [ ] Save real HTML to fixtures
  - [ ] Run parser on real samples
  - [ ] Verify output matches expected format
- [ ] **Test edge cases**
  - [ ] Very long parlays
  - [ ] Unusual bet types
  - [ ] Special promotions/bonuses
  - [ ] Voided/cancelled bets

## Integration

### 13. Register Parser

**Context:** The `pageProcessor.ts` file is the main parser entry point. It receives raw HTML content, dispatches to the selected sportsbook parser, normalizes the result, and returns or propagates errors to the caller/UI.

- [ ] **Update pageProcessor.ts**

  - [ ] Import new parser: `import { parse as parse{Sportsbook} } from './parsers/{sportsbook}';`
  - [ ] Add case to switch statement that calls the parser and awaits its normalized output
  - [ ] Wrap the parser call in try/catch to log clear, descriptive error messages including the sportsbook name and original error details
  - [ ] Return or rethrow a standardized error/response so the caller/UI can handle it appropriately

- [ ] **Update UI** (if needed)
  - [ ] Add sportsbook to dropdown in ImportView
  - [ ] Update help text/instructions

### 14. Documentation

- [ ] **Update README.md**
  - [ ] Add sportsbook to supported list
  - [ ] Update parser directory listing
- [ ] **Update PARSERS.md**
  - [ ] Add parser to structure section
  - [ ] Document any special considerations
- [ ] **Add parser-specific docs** (if needed)
  - [ ] Create `parsing/parsers/{sportsbook}/README.md`
  - [ ] Document HTML structure specifics
  - [ ] Document known limitations/quirks

### 15. Store Memory

- [ ] **Save implementation facts**

Store important implementation details that will help with future maintenance and debugging. Examples include:

- HTML element patterns and selector heuristics (e.g., "bet cards use `<li class='bet-card'>` structure")
- Edge-case parsing rules (e.g., "SGP+ bets have nested group legs with null odds for children")
- Retry/timeout handling strategies
- Known flaky pages or anti-patterns that recur
- Build/test commands (e.g., `npm test -- parsers/{sportsbook}.test.ts`)
- Reproduction steps for complex edge cases

**When to store:** On first parser rollout, after major fixes, or when an anti-pattern recurs.

**Suggested format:**

- Key: Short identifier (e.g., "DraftKings SGP structure")
- Context: What HTML pattern or behavior this addresses
- Rationale: Why this approach was chosen
- Reproduction: Steps to reproduce the scenario
- Commands: Any relevant build/test commands

## Final Validation

### Mandatory Testing Requirements

- [ ] **Unit tests** - Run parser-specific tests: `npm test -- parsing/parsers/{sportsbook}.test.ts`
  - [ ] All test suites pass
  - [ ] Minimum 85% overall code coverage
  - [ ] Minimum 90% coverage for parser core modules (main parser functions, HTML extraction logic, field normalization, bet type detection)
- [ ] **Integration tests** - Run FanDuel reference compatibility tests
  - [ ] Verify output matches expected JSON fixtures
  - [ ] Include regression tests for any discrepancies vs FanDuel reference
- [ ] **End-to-end tests** - Test in UI

  - [ ] Paste real HTML and verify import works
  - [ ] Verify all bet types display correctly in table
  - [ ] Check filtering and sorting work with parsed data

- [ ] **Code quality**

  - [ ] Run linter: `npm run lint` (if available)
  - [ ] Code review: Use automated code review tools if available
  - [ ] Security scan: Use static analysis tools if available

- [ ] **CI gating** (if CI pipeline exists)
  - [ ] Fail pipeline on test failures
  - [ ] Fail pipeline if coverage drops below threshold
  - [ ] Block merge until all tests pass

**Optional tests:** Performance benchmarks, stress tests with large HTML files

## Reference Implementation

See `parsing/parsers/fanduel/` for a complete reference implementation covering all bet types and edge cases.

## Common Pitfalls

⚠️ **Watch out for:**

- Inconsistent date formats across different pages
- Currency symbols and thousand separators in amounts
- Positive vs negative odds formatting
- Case sensitivity in result values (bet vs leg)
- Missing odds for SGP inner legs (should be undefined)
- Description formatting consistency (commas vs semicolons)
- Leg order preservation in parlays
- Nested structure for SGP+ (group leg + children + extra legs)

## Success Criteria

Your parser is complete when:

- ✅ All unit tests pass with required coverage (85% overall, 90% parser core)
- ✅ All expected JSON fixtures match actual output
- ✅ Integration tests with real HTML succeed
- ✅ Target fields validation passes (see `PARSER_TARGET_FIELDS.md` → "Validation Checklist" section)
  - [ ] Run through validation checklist in `PARSER_TARGET_FIELDS.md`
  - [ ] Verify all validation rules pass against parsed output
  - [ ] Record and fix any discrepancies until aligned with checklist
- ✅ Code review passes with no critical issues
- ✅ Security scan shows no vulnerabilities
- ✅ UI import works end-to-end with real data
- ✅ All required fields present and correctly formatted
- ✅ Edge cases handled gracefully
- ✅ Regression tests added for any FanDuel reference implementation discrepancies
