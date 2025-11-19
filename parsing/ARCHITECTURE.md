# Parsing Architecture - Simplified Design

## Overview

The BetTracker app parses HTML from sportsbook pages and converts it directly to `Bet` objects for internal storage. This document explains the simplified architecture implemented to eliminate unnecessary complexity.

## Problem Statement

The original architecture had confusing layers:
- **Old system**: `parsers/fanduel.ts` returned placeholder `Bet[]` data
- **New system**: `parsing/parsers/fanduel.ts` returned `FinalRow[]` (spreadsheet format)
- **Conversion**: `FinalRow[]` → `Bet[]` via `convertFinalRowToBet`
- **Issue**: Triple transformation (HTML → RawBet → FinalRow → Bet) with unclear responsibilities

The `FinalRow` type represents spreadsheet columns (Date, Site, Type, Over/Under as "1"/"0") and was designed for CSV import/export, but was being misused as an intermediate parsing format.

## Simplified Architecture

### Data Flow

```
HTML Parse:  HTML → Parser → Bet[] → useBets.addBets() → localStorage
             Bet[] → betToFinalRows() → FinalRow[] (for display/UI)

CSV Import:  CSV → FinalRow[] → Bet[] → useBets.addBets() → localStorage
             Bet[] → betToFinalRows() → FinalRow[] (for display/UI)
```

**Key Points:**
- Parsers return `Bet[]` directly (no intermediate formats)
- `FinalRow` is only used for CSV import/export and UI display
- For display, `betToFinalRows()` converts `Bet[]` → `FinalRow[]` (one row per leg for multi-leg bets)

### Components

1. **Parsers** (`parsing/parsers/fanduel.ts`, etc.)
   - Input: Raw HTML string
   - Output: `Bet[]` array
   - Responsibility: Extract all bet information from HTML and create `Bet` objects

2. **Page Processor** (`parsing/pageProcessor.ts`)
   - Routes HTML to the appropriate parser based on sportsbook
   - Returns: `ParseResult` with `Bet[]` array and optional error message

3. **Importer** (`services/importer.ts`)
   - `parseBets()`: Gets HTML → Parses → Returns `Bet[]` for confirmation
   - `handleImport()`: Gets HTML → Parses → Stores via `useBets.addBets()`
   - Uses `PageSourceProvider` to get HTML
   - Uses `pageProcessor.processPage()` to parse

4. **Bet to FinalRow Converter** (`parsing/betToFinalRows.ts`)
   - Converts `Bet[]` → `FinalRow[]` for display in spreadsheet-like UI
   - Creates one `FinalRow` per leg (multi-leg bets produce multiple rows)
   - Maps Bet fields to spreadsheet columns (Date, Site, Sport, Category, Type, Name, etc.)

### Key Types

```typescript
// Internal storage format
interface Bet {
  id: string;
  book: SportsbookName;
  betId: string;
  placedAt: string;  // ISO timestamp
  settledAt?: string;
  betType: BetType;  // 'single' | 'parlay' | 'sgp'
  marketCategory: MarketCategory;  // 'Props' | 'Main Markets' | 'Futures'
  sport: string;
  description: string;
  odds: number;
  stake: number;
  payout: number;
  result: BetResult;  // 'win' | 'loss' | 'push' | 'pending'
  legs?: BetLeg[];  // All bets have legs: singles have legs.length === 1, parlays/SGPs have legs.length > 1
  name?: string;    // Player/team name only (convenience field from legs[0])
  type?: string;    // Stat type for props (convenience field from legs[0])
  line?: string;    // Line/threshold (convenience field from legs[0])
  ou?: 'Over' | 'Under'; // Over/Under (convenience field from legs[0])
  isLive?: boolean; // Whether bet was placed live/in-game (separate from betType)
  tail?: string;    // Who the bet was tailed from
}

// CSV/Spreadsheet format (NOT used for parsing)
interface FinalRow {
  Date: string;        // MM/DD/YY
  Site: string;
  Sport: string;
  Category: string;
  Type: string;
  Name: string;
  Over: string;        // "1" or "0"
  Under: string;       // "1" or "0"
  Line: string;
  Odds: string;
  Bet: string;
  "To Win": string;
  Result: string;
  Net: string;
  Live: string;
  Tail: string;
}
```

## Parser Implementation Guide

When creating a new parser:

1. **Parse the HTML** using `DOMParser`
2. **Find bet cards** by looking for unique identifiers (e.g., BET ID)
3. **Extract all fields** directly from the HTML structure
4. **Create Bet objects** with all required fields
5. **Return Bet[]** array

Example structure:

```typescript
export const parse = (htmlContent: string): Bet[] => {
  const bets: Bet[] = [];
  const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
  
  // Find all bet cards
  // Extract fields: betId, odds, stake, payout, placedAt, result, legs
  // Create Bet objects
  // Return bets array
  
  return bets;
};
```

## Benefits of This Architecture

1. **Simplicity**: Single transformation for parsing (HTML → Bet)
2. **Clarity**: Each component has clear responsibility
3. **Maintainability**: Easier to understand and modify
4. **Testability**: Direct input/output, no intermediate formats for parsing
5. **Flexibility**: Easy to add new sportsbooks
6. **Separation of Concerns**: 
   - `Bet` type for internal storage (structured data with legs)
   - `FinalRow` type for CSV import/export and UI display (spreadsheet format)
   - `betToFinalRows()` handles conversion when needed for display

## Migration Notes

### Active Files
- `parsing/parsers/fanduel.ts` ✓ (simplified parser returning Bet[])
- `parsing/pageProcessor.ts` ✓ (routes HTML to parser)
- `services/importer.ts` ✓ (orchestrates import process)
- `parsing/betToFinalRows.ts` ✓ (converts Bet[] to FinalRow[] for display)
- `services/classificationService.ts` ✓ (classifies bets, used as fallback if parser doesn't set category)
- `parsing/parsers/fanduel.test.ts` ✓ (tests)

### CSV Import Still Uses FinalRow
The CSV import functionality still uses `FinalRow` as an intermediate format, which is correct:
- `services/csvParser.ts` parses CSV → `FinalRow[]`
- Then converts `FinalRow[]` → `Bet[]` for storage
- This is the intended use case for `FinalRow`

## Testing

Run tests with:
```bash
npm test
```

Test files:
- `parsing/parsers/fanduel.test.ts` - Tests the parser (7 tests, all passing)

## Future Work

1. Create DraftKings parser when fixture is available
2. Add more comprehensive tests for edge cases
3. Document HTML structure patterns for each sportsbook
