<!-- PERMANENT DOC - DO NOT DELETE -->

# Import System Regression Checklist

This document provides a quick manual regression checklist for verifying the import pipeline after changes. For automated coverage, see the test suite in `services/importPipeline.test.ts`.

## Quick Manual Regression Checklist

### Before Any Import Refactor (5-8 Steps)

1. **Empty HTML Test**
   - Open Import View, select FanDuel
   - Leave the textarea empty and click "Parse & Review Bets"
   - ✓ Should show error: "Please paste the page source first" or similar

2. **Invalid HTML Test**
   - Paste `<html><body>Not a bet page</body></html>`
   - Click "Parse & Review Bets"
   - ✓ Should show error about no bets found

3. **Valid FanDuel Import**
   - Copy real FanDuel settled bets page source
   - Paste and click "Parse & Review Bets"
   - ✓ Modal should open with bet count
   - ✓ Each bet should show Date, Site, Sport, Category, Result
   - ✓ Parlays should be expandable to show legs

4. **Valid DraftKings Import**
   - Copy real DraftKings settled bets page source
   - Paste and click "Parse & Review Bets"
   - ✓ Modal should open with bet count
   - ✓ Required fields present on each bet

5. **Validation Blockers**
   - Import bets that parse correctly
   - In the modal, look for any red "Cannot Import" state
   - ✓ If blockers exist, Import button should be disabled
   - ✓ Blocker message should explain the issue

6. **Validation Warnings**
   - Import bets that have warnings (yellow highlights)
   - ✓ Import button should still be enabled
   - ✓ Warning count should be shown

7. **Successful Import**
   - Click Import button on valid bets
   - ✓ Success notification should appear
   - ✓ Bets should appear in Bet Table View
   - ✓ Modal should close

8. **Edit Before Import**
   - Parse bets, expand a parlay, click Edit on a leg
   - Modify a field (e.g., Name)
   - ✓ Change should persist in the modal
   - ✓ Import should use the edited value

## What to Check After Any Future Refactor

### Error Handling

- [ ] EMPTY_HTML: Empty paste shows clear error
- [ ] NO_BETS_FOUND: Invalid HTML shows "no bets found"
- [ ] PARSER_FAILED: Malformed data shows graceful error
- [ ] VALIDATION_BLOCKED: Blockers prevent import with message
- [ ] STORAGE_FAILED: Storage errors show user-friendly message

### Parser Output Shape

- [ ] Every bet has: `id`, `betId`, `placedAt`, `stake`, `result`, `betType`
- [ ] Singles have Name and Type populated (for props)
- [ ] Parlays have `legs` array with entities and market
- [ ] SGP/SGP+ bets correctly identify nested legs

### UI Behavior

- [ ] ImportView shows errors in consistent location (notification banner)
- [ ] ImportConfirmationModal distinguishes blockers (red) from warnings (yellow)
- [ ] Import disabled when blockers present
- [ ] Import enabled when only warnings present

### Display Transform

- [ ] Single bets produce 1 FinalRow
- [ ] Parlays produce 1 header + N leg rows
- [ ] Header shows Bet/Odds/ToWin/Net; legs show Name/Type/Line
- [ ] Result shows "Win"/"Loss"/"Push"/"Pending" (title case)

## Automated Test Coverage

Run the minimal test suite to verify core pipeline:

```bash
npm test -- --run services/importPipeline.test.ts
```

Tests cover:
- Result/Error model (`ok()`, `err()`, `createImportError()`)
- Validation gate (blockers vs warnings)
- pageProcessor error codes
- Parser smoke tests (fixture → Bet[])
- betToFinalRows transformation

## Notes

- Tests use fixture files in `parsing/{sportsbook}/fixtures/`
- Do NOT weaken validation rules to make tests pass
- Do NOT add new features during regression fixes
- Focus on consistent error messages and required field coverage
