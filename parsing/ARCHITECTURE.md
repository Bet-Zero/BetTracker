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
CSV Import:  CSV → FinalRow → Bet  ✓ (correct use of FinalRow)
HTML Parse:  HTML → Bet            ✓ (direct, no intermediate steps)
```

### Components

1. **Parsers** (`parsing/parsers/fanduel.ts`, etc.)
   - Input: Raw HTML string
   - Output: `Bet[]` array
   - Responsibility: Extract all bet information from HTML and create `Bet` objects

2. **Page Processor** (`parsing/pageProcessor.ts`)
   - Routes HTML to the appropriate parser based on sportsbook
   - Returns: `Bet[]` array

3. **Importer** (`services/importer.ts`)
   - Orchestrates: Get HTML → Parse → Store
   - Uses `PageSourceProvider` to get HTML
   - Uses `pageProcessor` to parse
   - Returns parsed bets for confirmation or imports directly

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
  legs?: BetLeg[];  // For parlays/SGPs
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

1. **Simplicity**: Single transformation (HTML → Bet)
2. **Clarity**: Each component has clear responsibility
3. **Maintainability**: Easier to understand and modify
4. **Testability**: Direct input/output, no intermediate formats
5. **Flexibility**: Easy to add new sportsbooks
6. **No Duplication**: FinalRow only for CSV, Bet for storage

## Migration Notes

### Deprecated Files
- `parsing/parsers/fanduel.ts` (old parser returning FinalRow[])
- `parsing/normalizeBet.ts` (no longer needed for parsing)
- `parsing/rawBetTypes.ts` (no longer needed)
- `parsing/convertFinalRowToBet.ts` (no longer needed for parsing)
- `services/importer.ts` (old importer)
- `parsing/pageProcessor.ts` (old processor)

### Active Files
- `parsing/parsers/fanduel.ts` ✓ (simplified parser)
- `parsing/pageProcessor.ts` ✓ (processor)
- `services/importer.ts` ✓ (importer)
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
