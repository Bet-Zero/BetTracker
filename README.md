<!-- PERMANENT DOC - DO NOT DELETE -->

# BetTracker

A web application for tracking sports bets from multiple sportsbooks. Parse HTML from your settled bets pages and track your betting history with a spreadsheet-like interface.

## Features

- **HTML Parsing**: Paste HTML from FanDuel, DraftKings, or other sportsbooks to automatically extract bet information
- **CSV Import/Export**: Import bets from CSV files or export your data for backup
- **Bet Tracking**: Track bets across multiple categories (Props, Main Markets, Futures, Parlays, SGPs)
- **Statistics**: View breakdowns by sport, sportsbook, category, and player
- **Edit & Review**: Review and edit bets before importing, with validation and error detection

## How It Works

### Data Flow

**HTML Import:**

1. Paste HTML from your sportsbook's settled bets page
2. Parser extracts bet information (odds, stake, payout, legs, etc.)
3. Bets are stored as `Bet` objects internally
4. For display, bets are converted to `FinalRow` format (spreadsheet columns)

**CSV Import:**

1. Upload a CSV file matching the spreadsheet format
2. CSV is parsed into `FinalRow[]` format
3. `FinalRow[]` is converted to `Bet[]` for storage

**Storage & Display:**

- Bets are stored internally as `Bet` objects with structured data (legs, entities, etc.)
- For the table view, `Bet` objects are converted to `FinalRow[]` (one row per leg for multi-leg bets)
- All data is stored in browser localStorage

### Field Definitions

**Name**: Subject only (player or team name), not the full market text

**Type**: Depends on Category:

- **Props** → Stat type code (Pts, Ast, 3pt, Reb, PRA, etc.)
- **Main** → {Spread, Total, Moneyline}
- **Futures** → {Win Total, NBA Finals, Super Bowl, Make Playoffs, etc.}
- Type must NEVER contain bet form concepts (single/parlay/sgp/etc.)

**Category**: {Props, Main Markets, Futures, SGP/SGP+, Parlays}

**Over/Under**: "1" or "0" flags (or "" when not applicable)

**Line**: The numeric threshold (e.g., "3+", "25.5")

**Live**: "1" or "" flag (uses `isLive` field on Bet, not `betType`)

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the app:

   ```bash
   npm run dev
   ```

3. Open your browser to the URL shown in the terminal (typically `http://localhost:5173`)

## Project Structure

- `parsing/parsers/` - HTML parsers for each sportsbook (FanDuel, DraftKings)
- `parsing/betToFinalRows.ts` - Converts Bet objects to FinalRow format for display
- `parsing/pageProcessor.ts` - Routes HTML to the appropriate parser
- `services/` - Import, classification, CSV parsing services
- `views/` - Main UI views (Dashboard, Bet Table, Import, Settings)
- `types.ts` - TypeScript type definitions (Bet, FinalRow, etc.)
- `docs/` - Architecture and parser documentation

## Documentation

See `docs/` for detailed documentation:

- `ARCHITECTURE.md` - Parsing architecture and data flow
- `PARSERS.md` - Parser requirements and implementation guide
- `reference/DATA_MODEL_NOTES.md` - Data model semantics (BetType vs isLive, entityType handling, result conventions, parlay attribution)

### Architecture Notes

- **Entity Statistics**: Entity stats (player/team breakdowns) exclude parlay bets from stake and net calculations—only single bets count toward money totals. Parlay legs still contribute to leg-accuracy metrics (win/loss records). See [DATA_MODEL_NOTES.md](./docs/reference/DATA_MODEL_NOTES.md#parlay-leg-attribution-semantics) for attribution semantics details.
