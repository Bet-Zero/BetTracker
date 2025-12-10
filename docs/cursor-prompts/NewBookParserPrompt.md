# ✅ UNIVERSAL SPORTSBOOK PARSER CHECKLIST

**Task:**  
When implementing a new sportsbook parser (FanDuel, DraftKings, Caesars, BetMGM, etc), follow the exact requirements below.  
Do *not* refactor unrelated files.  
Do *not* rewrite shared logic like `betToFinalRows`.  
Only ensure this parser produces valid `Bet[]` and `BetLeg[]` objects that meet the universal requirements.

This checklist defines what **every sportsbook parser MUST populate** so the rest of the system works correctly.

---

## 🔵 SECTION 1 — REQUIRED `Bet` FIELDS (every book must provide these)

Populate the following fields for each parsed bet:

1. **`book: SportsbookName`**
   - Hardcode to this book’s name (e.g., `"FanDuel"`, `"DraftKings"`, `"Caesars"`).
   - Feeds `FinalRow.Site`.

2. **`betId: string`**
   - Parse the sportsbook’s bet ID if available.
   - If unavailable: generate a stable ID like `BOOK-<placedAt>-<index>`.

3. **`placedAt: string`** (ISO timestamp)
   - Parse the “placed” date/time from the slip.
   - Convert to ISO (`YYYY-MM-DDTHH:mm:ssZ`).
   - Feeds `FinalRow.Date`.

4. **`sport: string`**
   - Parse from slip headers (e.g., “NBA”, “NFL”, etc).
   - If unknown, use `"Unknown"`.

5. **`marketCategory: MarketCategory`**
   Classify as one of:
   - `"Props"`
   - `"Main Markets"` (Spread/Total/Moneyline)
   - `"Futures"`
   - `"Parlay"`
   - `"SGP"` or `"SGP_PLUS"`

6. **`betType: BetType`**
   - `"SINGLE"`, `"PARLAY"`, `"SGP"`, `"SGP_PLUS"`.

7. **`odds: number`**
   - Overall bet odds (American format: -120, +360).
   - Feeds `FinalRow.Odds`.

8. **`stake: number`**
   - Bet amount as a number (no dollar sign).
   - Feeds `FinalRow.Bet`.

9. **`payout: number`**
   - Total return if the bet wins (stake + profit).
   - Used for `FinalRow["To Win"]` and `FinalRow.Net`.

10. **`result: BetResult`**
    - `"won" | "lost" | "push" | "pending" | "cashout"`.
    - Feeds `FinalRow.Result`.

11. **`legs: BetLeg[]`**
    - Single bets: `legs.length === 1`
    - Parlays/SGPs: `legs.length > 1`
    - Each leg must meet the requirements below.

---

## 🔶 SECTION 2 — REQUIRED `BetLeg` FIELDS

Every leg (selection) in the bet must include:

1. **`market: string`**
   - Full text of the selection.
   - Used to derive Type, Name fallback, and Line.

2. **`entities?: string[]`**
   - Player/team names referenced in the leg.
   - `entities[0]` becomes `FinalRow.Name`.

3. **`target?: number | string`**
   - Line/threshold (e.g., `24.5`, `-3.5`, `210.5`).
   - Strings allowed for odd formats.

4. **`ou?: "Over" | "Under"`**
   - For props/totals.
   - Used to set `FinalRow.Over`/`FinalRow.Under`.

5. **`result?: LegResult | BetResult`**
   - Leg-level result if visible.
   - If not available, omit.

---

## 🟩 SECTION 3 — OPTIONAL FIELDS (recommended if available)

- `settledAt?: string`  
- `name?: string`  
- `actual?: number | string`  
- `odds?: number | null`  
- `isLive?: boolean`  
- `raw?: string`  
- `isGroupLeg?: boolean`  
- `children?: BetLeg[]`  

These improve accuracy but are not required.

---

## 🟧 SECTION 4 — SUCCESS CRITERIA

A new sportsbook parser is valid when:

1. **It returns `Bet[]` with all required fields populated.**
2. **Every `Bet` has at least one `BetLeg`.**
3. **`betToFinalRows(Bet[])` produces correct `FinalRow` entries**, including:
   - Correct Date formatting  
   - Correct Category and Type  
   - Correct Name  
   - Correct Over/Under and Line  
   - Correct Odds, Bet, To Win, Net  
   - Correct Result formatting  
   - Live and Tail columns correct (Tail usually blank)  
4. **No required `FinalRow` field ends up `undefined` or empty unless allowed.**

---

## 🟥 SECTION 5 — FAIL CONDITIONS

Do NOT consider the parser complete if:

- `legs` is empty  
- `sport` missing  
- `placedAt` missing or invalid  
- `stake` or `odds` is `NaN`  
- `marketCategory` wrong  
- `market` missing for any leg  
- `betToFinalRows` produces incorrect spreadsheet output  

---

## 🟦 SECTION 6 — IMPORTANT NOTE

**DO NOT modify `FinalRow` or `betToFinalRows`.**  
All normalization (Type, Category, Line, Over/Under, To Win, Net, Result, etc.) happens in shared logic.

Each new parser must output correct `Bet[]` and `BetLeg[]` according to this checklist.

