---
name: new-book-parser
description: Implement or fix a sportsbook parser so it satisfies the universal Bet/BetLeg requirements.
---

You are running the **/new-book-parser** command in Cursor.

The user selects the TARGET_SCOPE using @-mentions or #codebase.
This will usually include:
- The new sportsbook HTML fixture(s)
- The parser file(s) for that book
- Any closely-related parsing helpers

---

## Instructions

1. Load and follow the full parser requirements stored in:

   `docs/cursor-prompts/NewBookParserPrompt.md`

2. Treat everything the user selected as **TARGET_SCOPE**, plus any directly-related parser files you discover (for the same book).

3. Your primary goals:

   - Ensure this sportsbook’s parser:
     - Parses its HTML into `Bet[]` and `BetLeg[]` objects.
     - Fully satisfies the **universal Bet/BetLeg requirements** defined in `NewBookParserPrompt.md`.
   - Do **not** modify:
     - `FinalRow` type
     - `betToFinalRows`
     - Any shared/global schema files
   - Make only the minimal changes necessary outside TARGET_SCOPE to wire up the parser (e.g., index exports, book registry, or test imports).

4. After implementing or updating the parser:

   - Make sure `betToFinalRows(Bet[])` works correctly with this book’s output.
   - If the project has existing parse tests for this book, update them to reflect the new behavior.
   - If no tests exist and the user has provided fixtures, add a focused test that:
     - Parses the fixture HTML for this book.
     - Compares the result to an expected `Bet[]` or `FinalRow[]` fixture, as appropriate.

---

## Response Format

When you respond, briefly summarize:

1. **What you changed**
   - Files touched
   - New or updated functions
   - Any new helpers or utilities

2. **How the changes satisfy `NewBookParserPrompt.md`**
   - Confirm that all REQUIRED `Bet` fields are populated.
   - Confirm that all REQUIRED `BetLeg` fields are populated.
   - Note any optional fields that are populated when available.

3. **Tests and verification**
   - Which tests you ran (e.g. `npm test`, `pnpm test:parse`, specific Vitest file).
   - Whether the new/updated parser passes those tests.
   - Any known edge cases or limitations that remain and why.

Do not rewrite unrelated code.
Do not perform large refactors.
Focus strictly on making this sportsbook parser conform to the universal parser requirements.
