# Parser Target Fields Specification

This document defines the target output format for all sportsbook parsers. Use this as a reference when implementing parsers for new sportsbooks.

## Overview

All parsers must output an array of `Bet` objects that conform to the `Bet` interface defined in `types.ts`. Each bet represents a single wager placed on a sportsbook.

## Required Fields

### Core Identification Fields

| Field       | Type             | Required | Description                                            | Example                                                 |
| ----------- | ---------------- | -------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `id`        | `string`         | ✅ Yes   | Unique identifier combining book, betId, and timestamp | `"FanDuel:O/0242888/0028045:2025-11-18T23:09:00-05:00"` |
| `book`      | `SportsbookName` | ✅ Yes   | Name of the sportsbook                                 | `"FanDuel"`, `"DraftKings"`                             |
| `betId`     | `string`         | ✅ Yes   | Sportsbook's unique identifier for the bet             | `"O/0242888/0028045"`                                   |
| `placedAt`  | `string`         | ✅ Yes   | ISO 8601 timestamp when bet was placed                 | `"2025-11-18T23:09:00-05:00"`                           |
| `settledAt` | `string`         | No       | ISO 8601 timestamp when bet was settled                | `"2025-11-18T23:30:00-05:00"`                           |

### Bet Classification Fields

| Field            | Type             | Required | Description                | Example                                                             |
| ---------------- | ---------------- | -------- | -------------------------- | ------------------------------------------------------------------- |
| `betType`        | `BetType`        | ✅ Yes   | Type of bet structure      | `"single"`, `"parlay"`, `"sgp"`, `"sgp_plus"`, `"live"`, `"other"`  |
| `marketCategory` | `MarketCategory` | ✅ Yes   | Category of betting market | `"Props"`, `"Main Markets"`, `"Futures"`, `"SGP/SGP+"`, `"Parlays"` |
| `sport`          | `string`         | ✅ Yes   | Sport name                 | `"NBA"`, `"NFL"`, `"MLB"`                                           |

### Description Fields

| Field         | Type                | Required | Description                                                               | Example                          |
| ------------- | ------------------- | -------- | ------------------------------------------------------------------------- | -------------------------------- |
| `description` | `string`            | ✅ Yes   | Human-readable bet description                                            | `"Royce O'Neale 5+ MADE THREES"` |
| `name`        | `string`            | No       | Player/team name only (extracted from description)                        | `"Royce O'Neale"`                |
| `type`        | `string`            | No       | Stat type for props (e.g., "3pt", "Pts") - convenience field from legs[0] | `"3pt"`, `"Pts"`, `"Ast"`        |
| `line`        | `string`            | No       | Line/threshold - convenience field from legs[0]                           | `"5+"`, `"25.5"`, `"3+"`         |
| `ou`          | `'Over' \| 'Under'` | No       | Over/Under - convenience field from legs[0]                               | `"Over"`, `"Under"`              |

### Financial Fields

| Field    | Type        | Required | Description                                                            | Example                                  |
| -------- | ----------- | -------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| `odds`   | `number`    | ✅ Yes   | American odds (positive or negative)                                   | `600`, `-150`, `205`                     |
| `stake`  | `number`    | ✅ Yes   | Amount wagered in dollars                                              | `1.00`, `10.50`                          |
| `payout` | `number`    | ✅ Yes   | Total amount returned by sportsbook (includes original stake for wins) | `7.00`, `0.00`, `2.00`                   |
| `result` | `BetResult` | ✅ Yes   | Outcome of the bet                                                     | `"win"`, `"loss"`, `"push"`, `"pending"` |

**Note on payout field:** The `payout` represents the total amount returned by the sportsbook:

- **Win**: `payout = stake + winnings` (e.g., $2 stake at +205 odds = $2 + $4.10 = $6.10 total payout)
- **Loss**: `payout = 0` (nothing returned)
- **Push**: `payout = stake` (original stake returned)
- **Pending**: `payout = 0` (not yet settled)

### Structured Data Fields

| Field      | Type       | Required | Description                                                       |
| ---------- | ---------- | -------- | ----------------------------------------------------------------- |
| `legs`     | `BetLeg[]` | ✅ Yes   | Array of bet legs - all bets MUST populate a non-empty legs array |
| `tail`     | `string`   | No       | Who the bet was tailed from                                       |
| `raw`      | `string`   | No       | Full raw text block for debugging                                 |
| `isLive`   | `boolean`  | No       | Whether bet was placed live/in-game                               |
| `isSample` | `boolean`  | No       | Whether this is sample data                                       |

**Note on legs field:** All bets MUST populate a non-empty `legs` array. Singles have `legs.length === 1`, parlays/SGPs have `legs.length > 1`. This ensures consistency across all parsers and enables downstream consumers to rely on leg data always being available.

**TypeScript Note:** While the `Bet` interface in `types.ts` marks `legs` as optional (`legs?: BetLeg[]`), this is for backward compatibility with existing data. All new parser implementations MUST populate the legs array to meet current architecture requirements.

## BetLeg Structure

Each `BetLeg` in the `legs` array must conform to this structure:

| Field        | Type                     | Required | Description                                   | Example                                  |
| ------------ | ------------------------ | -------- | --------------------------------------------- | ---------------------------------------- |
| `entities`   | `string[]`               | No       | Player/team names involved                    | `["Royce O'Neale"]`                      |
| `market`     | `string`                 | ✅ Yes   | Market type/stat type                         | `"3pt"`, `"Pts"`, `"Spread"`             |
| `target`     | `number \| string`       | No       | Threshold/line value                          | `"5+"`, `25.5`, `"-5.5"`                 |
| `ou`         | `'Over' \| 'Under'`      | No       | Over/Under indicator                          | `"Over"`, `"Under"`                      |
| `odds`       | `number \| null`         | No       | Leg-specific odds (`null` for SGP inner legs) | `600`, `null`                            |
| `actual`     | `number \| string`       | No       | Actual result value                           | `3`, `"28.5"`                            |
| `result`     | `LegResult \| BetResult` | No       | Leg outcome                                   | `"WIN"`, `"LOSS"`, `"PUSH"`, `"PENDING"` |
| `isGroupLeg` | `boolean`                | No       | Marks SGP leg inside SGP+                     | `true`, `false`                          |
| `children`   | `BetLeg[]`               | No       | Nested legs for grouped selections (SGP+)     | Array of BetLeg                          |

## Bet Type Specific Requirements

### Single Bets

- `betType: "single"`
- `legs.length === 1`
- Leg odds should match bet odds
- Leg result should match bet result

### Parlay Bets

- `betType: "parlay"`
- `legs.length >= 2`
- Each leg should have its own odds
- Each leg should have its own result
- Description format: "Team1 Line1, Team2 Line2, ..."

### Same Game Parlay (SGP)

- `betType: "sgp"`
- `legs.length === 1` (group leg)
- Group leg has `isGroupLeg: true`
- Group leg contains `children[]` with individual selections
- Children have `odds: null` (combined odds at bet level; use `null` consistently rather than `undefined`)
- Description format: "Same Game Parlay - Game: Selection1; Selection2; ..."

### Same Game Parlay Plus (SGP+)

- `betType: "sgp_plus"`
- `legs.length >= 2` (at least one SGP group + extra selections)
- At least one leg with `isGroupLeg: true` and `children[]`
- Extra legs are regular parlay legs with their own odds
- Description format: "X-leg Same Game Parlay Plus: SGP (...) + Extra1 + Extra2"

## Field Population Examples

### Example 1: Simple Single Bet (Props)

```json
{
  "id": "FanDuel:O/0242888/0028045:2025-11-18T23:09:00-05:00",
  "book": "FanDuel",
  "betId": "O/0242888/0028045",
  "placedAt": "2025-11-18T23:09:00-05:00",
  "betType": "single",
  "marketCategory": "Props",
  "sport": "NBA",
  "description": "Royce O'Neale 5+ MADE THREES",
  "name": "Royce O'Neale",
  "odds": 600,
  "stake": 1,
  "payout": 0,
  "result": "loss",
  "type": "3pt",
  "line": "5+",
  "legs": [
    {
      "entities": ["Royce O'Neale"],
      "market": "3pt",
      "target": "5+",
      "odds": 600,
      "result": "LOSS"
    }
  ]
}
```

### Example 2: Two-Leg Parlay

```json
{
  "id": "FanDuel:O/0242888/0028023:2025-11-18T23:09:00-05:00",
  "book": "FanDuel",
  "betId": "O/0242888/0028023",
  "placedAt": "2025-11-18T23:09:00-05:00",
  "betType": "parlay",
  "marketCategory": "Parlays",
  "sport": "NBA",
  "description": "Orlando Magic -5.5, Detroit Pistons -5.5",
  "odds": 205,
  "stake": 2,
  "payout": 6.1,
  "result": "win",
  "legs": [
    {
      "entities": ["Orlando Magic"],
      "market": "Spread",
      "target": "-5.5",
      "odds": 100,
      "result": "WIN"
    },
    {
      "entities": ["Detroit Pistons"],
      "market": "Spread",
      "target": "-5.5",
      "odds": 105,
      "result": "WIN"
    }
  ]
}
```

### Example 3: Same Game Parlay (SGP)

```json
{
  "id": "FanDuel:O/0242888/0028078:2025-11-19T00:00:00-05:00",
  "book": "FanDuel",
  "betId": "O/0242888/0028078",
  "placedAt": "2025-11-19T00:00:00-05:00",
  "betType": "sgp",
  "marketCategory": "SGP/SGP+",
  "sport": "NBA",
  "description": "Same Game Parlay - Chicago Bulls @ Portland Trail Blazers: Josh Giddey 10+ Ast, Coby White 4+ 3pt, Deni Avdija 8+ Ast, Deni Avdija 10+ Reb",
  "odds": 6058,
  "stake": 2,
  "payout": 123.18,
  "result": "win",
  "legs": [
    {
      "isGroupLeg": true,
      "market": "SGP",
      "odds": 6058,
      "children": [
        {
          "entities": ["Josh Giddey"],
          "market": "Ast",
          "target": "10+",
          "odds": null,
          "result": "WIN"
        },
        {
          "entities": ["Coby White"],
          "market": "3pt",
          "target": "4+",
          "odds": null,
          "result": "WIN"
        },
        {
          "entities": ["Deni Avdija"],
          "market": "Ast",
          "target": "8+",
          "odds": null,
          "result": "WIN"
        },
        {
          "entities": ["Deni Avdija"],
          "market": "Reb",
          "target": "10+",
          "odds": null,
          "result": "WIN"
        }
      ]
    }
  ]
}
```

### Example 4: Same Game Parlay Plus (SGP+)

```json
{
  "id": "FanDuel:O/0242888/0028090:2025-11-19T00:15:00-05:00",
  "book": "FanDuel",
  "betId": "O/0242888/0028090",
  "placedAt": "2025-11-19T00:15:00-05:00",
  "betType": "sgp_plus",
  "marketCategory": "SGP/SGP+",
  "sport": "NFL",
  "description": "4-leg Same Game Parlay Plus: SGP (Davante Adams 50+ Yds, Cooper Kupp 3+ Rec) + Ricky Pearsall 50+ Yds + Cooper Kupp 3+ Yds",
  "odds": 4230,
  "stake": 1,
  "payout": 0,
  "result": "loss",
  "legs": [
    {
      "isGroupLeg": true,
      "market": "SGP",
      "odds": 2997,
      "children": [
        {
          "entities": ["Davante Adams"],
          "market": "Yds",
          "target": "50+",
          "odds": null,
          "result": "LOSS"
        },
        {
          "entities": ["Cooper Kupp"],
          "market": "Rec",
          "target": "3+",
          "odds": null,
          "result": "WIN"
        }
      ]
    },
    {
      "entities": ["Ricky Pearsall"],
      "market": "Yds",
      "target": "50+",
      "odds": 1100,
      "result": "LOSS"
    },
    {
      "entities": ["Cooper Kupp"],
      "market": "Yds",
      "target": "3+",
      "odds": -120,
      "result": "LOSS"
    }
  ]
}
```

## Validation Checklist

When implementing a new parser, verify it produces:

- [ ] All required fields are present for every bet
- [ ] `id` format: `"{book}:{betId}:{placedAt}"`
- [ ] `placedAt` and `settledAt` are valid ISO 8601 timestamps
- [ ] `betType` correctly identifies single/parlay/sgp/sgp_plus
- [ ] `marketCategory` is set appropriately
- [ ] `odds` are in American format (positive/negative integers)
- [ ] `stake` and `payout` are positive numbers (0 for losses)
- [ ] `result` matches payout (win if payout > stake, loss if 0, push if equals stake)
- [ ] All bets have `legs` array populated
- [ ] Single bets have exactly 1 leg
- [ ] Parlay bets have 2+ legs
- [ ] SGP bets have 1 group leg with children
- [ ] SGP+ bets have at least 1 group leg + other legs
- [ ] Leg `result` values use uppercase: "WIN", "LOSS", "PUSH", "PENDING"
- [ ] Bet `result` values use lowercase: "win", "loss", "push", "pending"

## Testing

Test your parser with:

1. Sample HTML files in `parsing/fixtures/{sportsbook}/`
2. Expected JSON output in `parsing/fixtures/{sportsbook}/expected_*.json`
3. Unit tests in `parsing/parsers/{sportsbook}.test.ts`

Reference the FanDuel parser implementation as a complete example.
