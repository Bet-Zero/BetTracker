<!-- PERMANENT DOC - DO NOT DELETE -->

# HTML Parsers

This directory contains parsers for converting sportsbook HTML pages into normalized `Bet` objects.

## Structure

- `parsers/fanduel.ts` - FanDuel settled bets page parser
- `parsers/draftkings.ts` - DraftKings settled bets page parser
- `utils.ts` - Shared parsing utilities
- `fixtures/` - Sample HTML files for testing parsers

## How It Works

1. User pastes HTML from their sportsbook's settled bets page
2. `pageProcessor.ts` routes to the appropriate parser based on sportsbook selection
3. Parser uses `DOMParser` to extract bet information from HTML
4. Parsed bets are converted into `Bet` objects matching the app's data model
5. Each `Bet` object includes: id, book, betId, placedAt, odds, stake, payout, result, legs, description, sport, marketCategory
6. Bets are stored via `useBets.addBets()` (which will call `classifyBet()` as a fallback if category is missing)

## Updating Parsers

If a sportsbook changes their HTML structure:

1. Capture a new sample HTML file in `fixtures/`
2. Update the parser's selectors/patterns to match the new structure
3. Test with the new fixture

## Parser Requirements

Each parser must:
- Accept `htmlContent: string` as input
- Return `Bet[]` matching the `Bet` type from `types.ts`
- Handle malformed HTML gracefully (skip bad bets, log warnings)
- Extract: betId, placedAt, stake, payout, odds, result, legs, description, sport
- Set `marketCategory` directly (e.g., based on legs presence, betType, etc.) OR use `classifyBet()` from `services/classificationService.ts`
  - The FanDuel parser sets it directly based on simple heuristics (e.g., if legs.length > 0, then "Props", else "Main Markets")
  - The DraftKings parser uses `classifyBet()` for more sophisticated classification
  - `useBets.addBets()` will call `classifyBet()` as a fallback if `marketCategory` is missing

