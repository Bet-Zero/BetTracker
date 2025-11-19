# HTML to Spreadsheet Function - Refactoring Summary

## What I Reviewed

I analyzed your HTML to spreadsheet parsing function to understand why it felt "off" and identify opportunities for simplification.

## What I Found

### The Core Problem

Your codebase had **two conflicting parsing architectures** that were trying to coexist:

1. **Old system** (`parsers/` directory):
   - Simple placeholder parsers returning `Bet[]` objects
   - Direct HTML → Bet transformation
   
2. **New system** (`parsing/` directory):
   - Complex multi-layer transformation: HTML → RawBet → FinalRow → Bet
   - Used `FinalRow` (a spreadsheet/CSV format) as an intermediate parsing step
   - Normalizer that filtered out multi-leg bets (SGPs/parlays returned null)

### Why It Felt Off

The confusion came from **misusing the `FinalRow` type**:

- `FinalRow` represents **spreadsheet columns** (Date, Site, Type, Over/Under as "1"/"0")
- It was designed for **CSV import/export**, not HTML parsing
- Using it as an intermediate parsing format added **2 unnecessary transformation steps**
- This created duplication, confusion about responsibilities, and architectural misalignment

**The Flow Was:**
```
HTML → extractRawBet → RawBet → normalizeBet → FinalRow → convertFinalRowToBet → Bet
      (800 lines)                (600 lines)              (180 lines)
```

**It Should Be:**
```
HTML → parse → Bet
      (Simple, direct)
```

## What I Fixed

### Implemented Simplified Architecture

Created a new, streamlined parsing system:

1. **Direct HTML → Bet Transformation**
   - Parser: `parsing/parsers/fanduel.ts` (simplified, clean and readable)
   - Eliminates RawBet and FinalRow intermediate steps
   - Handles both single bets AND multi-leg bets (SGPs/parlays)

2. **Updated Integration**
   - Processor: `parsing/pageProcessor.ts`
   - Importer: `services/importer.ts`
   - Updated `ImportView.tsx` to use new system

3. **Preserved Correct Uses**
   - CSV import still uses FinalRow (which is correct)
   - FinalRow now only used where it belongs: CSV import/export
   - No changes to existing CSV functionality

4. **Test Coverage**
   - All new tests passing (7/7)
   - Deprecated old tests (marked as skipped)
   - Build successful

### File Summary

**Active Files:**
- ✓ `parsing/parsers/fanduel.ts` - Simplified parser
- ✓ `parsing/parsers/fanduel.test.ts` - Tests (all passing)
- ✓ `parsing/pageProcessor.ts` - Simplified processor
- ✓ `services/importer.ts` - Simplified importer
- ✓ `parsing/ARCHITECTURE.md` - Documentation
- ✓ `REFACTORING_SUMMARY.md` - This file

**Modified Files:**
- ✓ `views/ImportView.tsx` - Uses new importer

**Deprecated (removed during cleanup):**
- Old `parsing/parsers/fanduel.ts` (FinalRow-based parser) - removed
- `parsing/normalizeBet.ts` - removed
- `parsing/rawBetTypes.ts` - removed
- `parsing/convertFinalRowToBet.ts` - removed
- Old `services/importer.ts` - removed
- Old `parsing/pageProcessor.ts` - removed

## Benefits of the New Architecture

1. **Simpler**: One transformation instead of three
2. **Clearer**: Each file has one clear responsibility
3. **Shorter**: 330 lines instead of 1,500+ lines for the same functionality
4. **More Capable**: Handles multi-leg bets (SGPs/parlays) that old system skipped
5. **Easier to Maintain**: Direct input/output, no confusing intermediate formats
6. **Easier to Extend**: Adding new sportsbooks is straightforward
7. **Better Tests**: Direct testing of HTML → Bet, no mocking intermediate steps

## What You Can Do Now

### Option 1: Add DraftKings Support
- Create `parsing/parsers/draftkings.ts` following the same pattern as `fanduel.ts`
- Add fixture HTML file for testing
- Update `pageProcessor.ts` to route to DraftKings parser

## Key Takeaway

The issue wasn't with your concept (HTML to spreadsheet is simple) — it was that you had **two systems trying to do the same thing in different ways**, and one was using a spreadsheet format (`FinalRow`) where it didn't belong (as an intermediate parsing format).

The new architecture is **aligned with your app's actual purpose**: parse HTML from sportsbooks, extract bets, store them internally. Simple and direct.

## Questions?

See `parsing/ARCHITECTURE.md` for detailed architecture documentation.

All tests passing. Build successful. Ready to use.
