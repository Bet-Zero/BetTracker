# DraftKings vs FanDuel Parser Comparison

This document compares the DraftKings and FanDuel parsers, highlighting key differences in implementation and naming conventions.

## Overview

**FanDuel Parser**: The blueprint/standard for all parsers. Comprehensive implementation with extensive utilities and robust parsing logic.

**DraftKings Parser**: Simpler implementation tailored to DraftKings' HTML structure and naming conventions.

## Key Architectural Differences

### HTML Structure

**FanDuel:**
- Uses generic HTML with classes and aria-labels
- Bet cards: `<li>` elements with varying class patterns
- Legs identified by aria-label attributes
- Footer/header are separate `<li>` elements (siblings)
- Leg rows: Various div structures with aria-labels

**DraftKings:**
- Uses data-test-id attributes extensively
- Bet cards: `<div data-test-id="bet-card-{id}">`
- Legs in collapsible panels with id patterns like "{n}-body"
- Selection items: `<div data-test-id="selection-list-item">`
- More structured and testable with data attributes

### Naming Conventions

| Concept | FanDuel | DraftKings | Normalized |
|---------|---------|------------|------------|
| Same Game Parlay Plus | SGP+ | SGPx | sgp_plus |
| Simple Same Game Parlay | SGP | SGP | parlay (for DK), sgp (for FD) |
| Regular Parlay | Parlay | Parlay | parlay |

**Important Note on betType Classification:**

This intentional divergence exists because DraftKings and FanDuel have different internal representations:

- **FanDuel**: Distinguishes simple SGPs from regular parlays at the betType level (`sgp` vs `parlay`)
- **DraftKings**: Uses betType `parlay` for both simple SGPs and regular parlays, differentiating them via the `marketCategory` field (`SGP/SGP+` vs `Parlays`)

This difference is preserved in the parsers because:
1. It reflects how each book actually represents these bets in their HTML
2. The marketCategory field still allows proper filtering and classification
3. Only nested/multi-group SGPs (SGPx/SGP+) are universally classified as `sgp_plus`

When consuming the parsed data, always check BOTH `betType` and `marketCategory` to properly identify same-game parlays across books.

**Truth Table for Bet Type Mapping:**

| Book | Scenario | betType | marketCategory | Normalized |
|------|----------|---------|----------------|------------|
| DraftKings | Simple SGP | parlay | SGP/SGP+ | sgp |
| DraftKings | Nested/Multi-group SGP (SGPx) | sgp_plus | SGP/SGP+ | sgp_plus |
| DraftKings | Regular Parlay | parlay | Parlays | parlay |
| FanDuel | Simple SGP | sgp | SGP/SGP+ | sgp |
| FanDuel | Nested/Multi-group SGP (SGP+) | sgp_plus | SGP/SGP+ | sgp_plus |
| FanDuel | Regular Parlay | parlay | Parlays | parlay |

### Bet Type Detection

**FanDuel:**
- Checks for "X leg parlay" patterns in text
- Looks for "Same Game Parlay" text markers
- Checks aria-labels for parlay indicators
- Infers from structure (multiple leg rows)

**DraftKings:**
- Checks for `data-test-id="sgp-{id}"` attributes (most reliable)
- Looks for "SGPx" text for SGP+ bets
- Checks for nested `selection-list-item` structures
- Examines subtitle text for indicators

### Player Name / Entity Extraction

**FanDuel:**
- Multiple extraction strategies from aria-labels
- Complex pattern matching for "Player Name To Record X+ Stat"
- Extensive cleaning of team prefixes, market suffixes
- Handles various formats: "Over {line}", "{target}+", etc.

**DraftKings:**
- Extracts from `data-test-id="bet-selection-subtitle-{id}"` elements
- Simpler pattern: "{Player Name} {Stat Type}" → extract both
- Less cleaning needed due to more structured HTML
- Uses `extractNameAndType()` utility

### Odds Extraction

**FanDuel:**
- Searches for `span[aria-label^="Odds"]`
- Multiple fallback strategies (parent, sibling, text patterns)
- Handles unicode minus (−) character

**DraftKings:**
- Direct query: `span[data-test-id^="bet-details-displayOdds-"]`
- Also handles unicode minus (−) character
- More straightforward due to consistent structure

### Result Detection

**FanDuel:**
- SVG icon analysis (fill colors: #128000 = win, #d22839 = loss)
- Checks for specific icon IDs (tick-circle, cross-circle)
- Text analysis for "VOID" patterns
- Footer text analysis ("WON ON FANDUEL", "RETURNED")

**DraftKings:**
- SVG circle stroke/fill colors (#53D337 = win, #E9344A = loss)
- SVG title text ("X sign" = loss)
- Status div text ("Won", "Lost", "Void")
- Simpler due to explicit status elements

### Sport/League Detection

**FanDuel:**
- Infers from text patterns (team names, keywords)
- Market type analysis (Yards/Receptions → NFL, Points/Assists → NBA)
- Extensive team name dictionary
- Priority system: markets > explicit mentions > team names

**DraftKings:**
- Extracts from team logo URLs: `/teams/{league}/{team}.png`
- Example: `/teams/nba/PHX.png` → "NBA"
- Much simpler and more reliable
- Falls back to "Unknown" if no event card present

### Description Formatting

**FanDuel:**
- Extensive formatting utilities
- Removes promotional text ("Same Game Parlay Available", "Parlay™")
- Cleans aria-label artifacts
- Rebuilds descriptions for Over/Under bets
- Handles malformed patterns like "Name Over Name"

**DraftKings:**
- Simpler approach using market + target
- For spreads/totals: just the type ("Spread", "Total")
- For props: uses the full market description
- Less aggressive cleaning needed

### SGP/SGP+ Structure

**FanDuel SGP+:**
- Group legs with `isGroupLeg: true`
- Children array contains nested SGP selections
- Each child has `odds: null` (combined odds on group)
- Target field contains matchup info
- Complex nested structure with matchup extraction

**DraftKings SGPx:**
- Similar group leg structure
- Uses nested `selection-list-item` elements
- Parses hierarchy: top-level → group → children
- Simpler matchup handling (from event-card)
- Group legs identified by nested container patterns

## Common Utilities

Both parsers share these concepts (with different implementations):

1. **Money Parsing**: Strip non-numeric chars, convert to float
2. **Space Normalization**: Collapse multiple spaces to single space
3. **Odds Normalization**: Handle +/- prefixes, unicode minus
4. **Result Mapping**: win/loss/push/pending enum
5. **Market Type Detection**: Pts, Ast, Reb, 3pt, Spread, Total, Moneyline, etc.

## Best Practices

Based on the comparison, these patterns emerged as best practices:

1. **Use data attributes when available** (DraftKings approach) - more reliable than text/class patterns
2. **Multiple extraction strategies** (FanDuel approach) - provides robustness
3. **Explicit status indicators** (DraftKings) - clearer than icon inference
4. **Structured market types** - Use consistent abbreviations (Pts, Ast, Reb, 3pt, Yds, Rec)
5. **Normalize bet types** - Map book-specific terms to standard types
6. **Preserve nuances** - Keep book-specific differences where meaningful (e.g., DK's parlay vs sgp distinction)

## Implementation Recommendations

1. **For new parsers**: Use DraftKings' structured approach if the book's HTML has data attributes
2. **For existing parsers**: Adopt FanDuel's robustness patterns (multiple strategies, extensive cleaning)
3. **Standardization**: All parsers should normalize to the same betType values (single, parlay, sgp, sgp_plus)
4. **Market categories**: Keep consistent categories across books (Main Markets, Props, SGP/SGP+, Parlays)
5. **Sport detection**: Prefer explicit indicators (logo URLs, league attributes) over text inference

## Testing Strategy

Both parsers use fixture-based testing:

1. **HTML fixtures**: Real HTML captures from book websites
2. **Expected JSON**: Known-good parsed output for comparison
3. **Field-by-field validation**: Compare each bet field individually
4. **Leg structure validation**: Ensure nested structures are correct

This approach catches regressions and validates improvements effectively.
