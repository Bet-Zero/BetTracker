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
4. Parsed bets are normalized into `Bet` objects matching the app's data model
5. Bets are classified and added to the store via `useBets.addBets()`

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
- Use `classifyBet()` to set `marketCategory`

