#!/usr/bin/env tsx

/**
 * Test to verify that SGP bets don't extract individual leg odds
 * and that odds values aren't being used as targets.
 */

import { parseFanDuel } from "../parsers";
import { readFileSync } from "fs";
import { join } from "path";

console.log("=== Testing SGP Odds Fix ===");

// Load SGP sample HTML
const sgpHtmlPath = "../fixtures/sgp_sample.html";
const sgpHtml = readFileSync(sgpHtmlPath, "utf-8");

// Parse the SGP bets
const bets = parseFanDuel(sgpHtml);

console.log(`Parsed ${bets.length} bet(s) from SGP sample`);

bets.forEach((bet, index) => {
  console.log(`\n--- Bet ${index + 1}: ${bet.betId} ---`);
  console.log(`Type: ${bet.betType}`);
  console.log(`Total odds: ${bet.odds}`);
  console.log(`Legs: ${bet.legs?.length || 0}`);

  if (bet.legs) {
    bet.legs.forEach((leg, legIndex) => {
      console.log(`  Leg ${legIndex + 1}:`);
      console.log(`    Market: ${leg.market}`);
      console.log(`    Entities: ${leg.entities?.join(", ") || "none"}`);
      console.log(`    Target: ${leg.target || "none"}`);
      console.log(`    Odds: ${leg.odds || "none"}`);

      // Check for issues
      const issues: string[] = [];

      // 1. SGP legs should not have individual odds
      if (bet.betType === "sgp" && leg.odds) {
        issues.push(`❌ SGP leg has individual odds: ${leg.odds}`);
      }

      // 2. Target should not look like odds
      if (leg.target && typeof leg.target === "string") {
        const target = leg.target.replace(/\s+/g, "");
        if (
          /^[+\-]?\d{3,}$/.test(target) ||
          /^[+\-]1[0-9]{2,}$/.test(target) ||
          /^[+\-][2-9]\d{2,}$/.test(target)
        ) {
          issues.push(`❌ Target looks like odds: ${leg.target}`);
        }
      }

      if (issues.length > 0) {
        issues.forEach((issue) => console.log(`    ${issue}`));
      } else {
        console.log(`    ✅ No issues found`);
      }
    });
  }
});

console.log("\n=== Summary ===");
const sgpBets = bets.filter((bet) => bet.betType === "sgp");
const legsWithOdds = sgpBets
  .flatMap((bet) => bet.legs || [])
  .filter((leg) => leg.odds);
const targetsLookingLikeOdds = bets
  .flatMap((bet) => bet.legs || [])
  .filter((leg) => {
    if (!leg.target || typeof leg.target !== "string") return false;
    const target = leg.target.replace(/\s+/g, "");
    return (
      /^[+\-]?\d{3,}$/.test(target) ||
      /^[+\-]1[0-9]{2,}$/.test(target) ||
      /^[+\-][2-9]\d{2,}$/.test(target)
    );
  });

console.log(`SGP bets found: ${sgpBets.length}`);
console.log(`SGP legs with individual odds: ${legsWithOdds.length}`);
console.log(`Targets that look like odds: ${targetsLookingLikeOdds.length}`);

if (legsWithOdds.length === 0 && targetsLookingLikeOdds.length === 0) {
  console.log("✅ SUCCESS: SGP fix is working correctly!");
} else {
  console.log("❌ ISSUES FOUND: SGP fix needs more work");
  if (legsWithOdds.length > 0) {
    console.log("  - SGP legs still have individual odds");
  }
  if (targetsLookingLikeOdds.length > 0) {
    console.log("  - Some targets still look like odds values");
  }
}

