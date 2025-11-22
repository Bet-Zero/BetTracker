# Parsed HTML Error Report

## Summary

Analysis of `your-html-file_parsed.json` reveals multiple parsing errors across entity extraction, odds parsing, target/line values, and data consistency.

---

## Critical Errors

### 1. Entity Extraction Errors

#### Issue: Incorrect Player Names Extracted

**Bet ID: O/0242888/0028021** (Line 35-63)

- **Error**: `"name": "Jalen Johnson To"`
- **Expected**: `"Jalen Johnson"`
- **Issue**: Parser included "To" from "To RECORD A TRIPLE DOUBLE" in the name field
- **Entities in leg**: Correctly shows `"Jalen Johnson"` ✅

**Bet ID: O/0242888/0028015** (Line 65-107)

- **Error**: `"entities": ["Triple Double Luka Doncic"]` (line 96)
- **Expected**: `"entities": ["Luka Doncic"]`
- **Issue**: Parser captured "Triple Double" as part of the entity name
- **Raw text shows**: "Luka Doncic +410 To Record A Triple Double"

**Bet ID: O/0242888/0028005** (Line 351-379)

- **Error**: `"name": "Franz Wagner Top"`
- **Expected**: `"Franz Wagner"`
- **Issue**: Parser included "Top" from "Top POINTS SCORER"
- **Entities in leg**: Also incorrectly shows `"Franz Wagner Top"` ❌

**Bet ID: O/0242888/0028017** (Line 473-501)

- **Error**: `"name": "Duncan Robinson First"`
- **Expected**: `"Duncan Robinson"`
- **Issue**: Parser included "First" from "First BASKET"
- **Entities in leg**: Also incorrectly shows `"Duncan Robinson First"` ❌

#### Issue: Generic/Invalid Entities

**Bet ID: O/0242888/0027990** (Line 503-570)

- **Error**: `"entities": ["Made"]` (line 527)
- **Expected**: Should extract player name from "Made 8+ 3pt" or skip if no player
- **Issue**: "Made" is not a player name - this appears to be a parsing artifact
- **Also**: `"entities": ["Made"]` appears again at line 649, 761, 769

**Bet ID: O/0242888/0027989** (Line 572-623)

- **Error**: `"entities": ["available Same Game"]` (line 588)
- **Expected**: Should extract actual player name or skip
- **Issue**: Parser captured promotional text "same game parlay available" as an entity
- **Also appears at**: Line 814 (bet O/0242888/0027984)

**Bet ID: O/0242888/0027968** (Line 968-1042)

- **Error**: `"entities": ["Cleveland Browns Quinshon"]` (line 983)
- **Expected**: `"entities": ["Quinshon Judkins"]`
- **Issue**: Parser combined team name with partial player name
- **Also**: `"entities": ["Denver Broncos Rashee"]` (line 991) should be `"Rashee Rice"`

**Bet ID: O/0242888/0027980** (Line 1231-1283)

- **Error**: `"entities": ["Yards"]` (lines 1264, 1272)
- **Expected**: Should extract player names (Ricky Pearsall, Davante Adams)
- **Issue**: Parser captured the stat type "Yards" as an entity
- **Also**: `"entities": ["Ricky Pearsall 50+ Yards"]` (lines 1217, 1246) should be just `"Ricky Pearsall"`

**Bet ID: O/0242888/0027979** (Line 1314-1380)

- **Error**: `"entities": ["Los Angeles Rams"]` (line 1329)
- **Expected**: Should extract player name, not team name
- **Issue**: Team name parsed as entity for a reception prop
- **Also**: `"entities": ["Arizona Cardinals Ricky"]` (line 1337) should be `"Ricky Pearsall"`

**Bet ID: O/0242888/0027973** (Line 1290-1312)

- **Error**: `"entities": ["Ricky Pearsall 3+ Receptions"]` (line 1300)
- **Expected**: `"entities": ["Ricky Pearsall"]`
- **Issue**: Parser included the stat line in the entity name

---

### 2. Missing Odds in Legs

Multiple legs are missing odds values:

- **Bet ID: O/0242888/0028013** (Line 181-220)

  - Leg 3 (Isaiah Collier): Missing `odds` field (line 206)
  - Leg 4 (LeBron James): Missing `odds` field (line 214)

- **Bet ID: O/0242888/0027990** (Line 503-570)

  - All 6 legs missing `odds` fields (lines 518, 526, 534, 542, 550, 558)

- **Bet ID: O/0242888/0027989** (Line 572-623)

  - All 4 legs missing `odds` fields (lines 587, 595, 603, 611)

- **Bet ID: O/0242888/0028000** (Line 625-692)

  - All 6 legs missing `odds` fields (lines 640, 648, 656, 664, 672, 680)

- **Bet ID: O/0242888/0027984** (Line 798-841)

  - All 3 legs missing `odds` fields (lines 813, 821, 829)

- **Bet ID: O/0242888/0027979** (Line 1314-1380)
  - All 6 legs missing `odds` fields (lines 1328, 1336, 1344, 1352, 1360, 1368)

---

### 3. Missing Line/Target Values

**Bet ID: O/0242888/0028018** (Line 223-251)

- **Error**: Missing `line` field at bet level (line 237)
- **Issue**: Bet has `type: "Pts"` but no `line` value
- **Raw text shows**: "Ausar Thompson Under 10.5 -120"
- **Expected**: `"line": "10.5"` and `"ou": "Under"`

**Bet ID: O/0242888/0028019** (Line 253-281)

- **Error**: Missing `line` field at bet level (line 267)
- **Issue**: Bet has `type: "Reb"` but no `line` value
- **Raw text shows**: "Onyeka Okongwu Over 8.5 -128"
- **Expected**: `"line": "8.5"` and `"ou": "Over"`

---

### 4. Incorrect Target Values

**Bet ID: O/0242888/0028015** (Line 65-107)

- **Error**: `"target": "+410"` (line 99)
- **Expected**: Should be `undefined` or empty (triple double bets don't have numeric targets)
- **Issue**: Parser captured odds value "+410" as the target

**Bet ID: O/0242888/0027987** (Line 694-744)

- **Error**: `"target": "+1200"` (line 736)
- **Expected**: Should be `undefined` (triple double bet)
- **Issue**: Parser captured odds value "+1200" as the target

**Bet ID: O/0242888/0027980** (Line 1231-1283)

- **Error**: `"target": "+1200"` and `"target": "+430"` (lines 1267, 1275)
- **Expected**: Should be `"50+"` for both (both are 50+ yards bets)
- **Issue**: Parser captured odds values as targets instead of the stat line

---

### 5. Sport Field Issues

**Bet ID: O/0242888/0027990** (Line 503-570)

- **Error**: `"sport": ""` (line 509)
- **Expected**: Should be "NBA" (bet contains NBA players: Isaiah Collier, Jalen Smith, etc.)
- **Issue**: Parser failed to detect sport for SGP

**Bet ID: O/0242888/0027989** (Line 572-623)

- **Error**: `"sport": ""` (line 578)
- **Expected**: Should be "NBA" (bet contains NBA players)

**Bet ID: O/0242888/0028000** (Line 625-692)

- **Error**: `"sport": ""` (line 631)
- **Expected**: Should be "NBA"

**Bet ID: O/0242888/0027974** (Line 1044-1074)

- **Error**: `"sport": ""` (line 1050)
- **Expected**: Should be "NFL" (bet is for NFL player Ricky Pearsall)

**Bet ID: O/0242888/0027963** (Line 1076-1104)

- **Error**: `"sport": ""` (line 1082)
- **Expected**: Should be "NFL"

**Bet ID: O/0242888/0027981** (Line 1202-1229)

- **Error**: `"sport": "NBA"` (line 1208)
- **Expected**: Should be "NFL" (bet contains NFL players: Davante Adams, Cooper Kupp, Ricky Pearsall)

**Bet ID: O/0242888/0027980** (Line 1231-1283)

- **Error**: `"sport": "NBA"` (line 1237)
- **Expected**: Should be "NFL" (bet contains NFL players)

**Bet ID: O/0242888/0027973** (Line 1290-1312)

- **Error**: `"sport": "NBA"` (line 1291)
- **Expected**: Should be "NFL"

**Bet ID: O/0242888/0027979** (Line 1314-1380)

- **Error**: `"sport": "NBA"` (line 1320)
- **Expected**: Should be "NFL"

---

### 6. Description Quality Issues

**Bet ID: O/0242888/0027989** (Line 572-623)

- **Error**: `"description": "available Same Game 2+ 3pt, Ace Bailey 2+ 3pt, Patrick Williams 2+ 3pt, Jalen Smith 2+ 3pt"`
- **Issue**: Description starts with "available Same Game" which is promotional text

**Bet ID: O/0242888/0027984** (Line 798-841)

- **Error**: `"description": "available Same Game 3+ 3pt, Saddiq Bey 3+ 3pt, Will Richard 3+ 3pt"`
- **Issue**: Same promotional text issue

---

## Statistics

- **Total bets parsed**: 30
- **Bets with entity errors**: 12 (40%)
- **Bets with missing odds in legs**: 6 (20%)
- **Bets with missing line values**: 2 (7%)
- **Bets with incorrect target values**: 3 (10%)
- **Bets with sport field errors**: 8 (27%)

---

## Recommendations

1. **Improve entity extraction**:

   - Strip common suffixes like "To", "Top", "First" from player names
   - Filter out generic words like "Made", "Yards", "available Same Game"
   - Better handling of team name + player name combinations
   - Remove stat lines from entity names (e.g., "50+ Yards" should not be in entity)

2. **Extract odds for all legs**:

   - Ensure odds are extracted from leg rows for SGPs and parlays
   - Fallback to description parsing if row parsing fails

3. **Fix target/line extraction**:

   - Distinguish between odds values and stat targets
   - Ensure Over/Under bets have line values extracted
   - Don't use odds as targets for non-numeric markets (like triple doubles)

4. **Improve sport detection**:

   - Use player names and team names to infer sport
   - Check market types (NFL uses Yds/Rec, NBA uses Pts/Reb/Ast)
   - Better handling for cross-sport parlays

5. **Clean descriptions**:
   - Remove promotional text like "available Same Game" from descriptions
   - Ensure descriptions are built from actual bet legs, not raw HTML text

---

## Sample Fixes Needed

### Example 1: Entity Extraction

```json
// Current (WRONG):
{
  "name": "Jalen Johnson To",
  "entities": ["Jalen Johnson"]
}

// Should be:
{
  "name": "Jalen Johnson",
  "entities": ["Jalen Johnson"]
}
```

### Example 2: Missing Line

```json
// Current (WRONG):
{
  "type": "Pts",
  "ou": undefined,
  "line": undefined
}

// Should be:
{
  "type": "Pts",
  "ou": "Under",
  "line": "10.5"
}
```

### Example 3: Incorrect Target

```json
// Current (WRONG):
{
  "entities": ["Triple Double Luka Doncic"],
  "target": "+410"
}

// Should be:
{
  "entities": ["Luka Doncic"],
  "target": undefined
}
```


