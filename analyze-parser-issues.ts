/**
 * Analyze parser issues by comparing what's extracted vs what should be extracted
 * Usage: npx tsx analyze-parser-issues.ts [path-to-html-file]
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { JSDOM } from "jsdom";
import { parseFanDuel } from "./parsing/parsers/fanduel";
import type { Bet } from "./types";

// Set up DOM environment
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.DOMParser = dom.window.DOMParser;
global.document = dom.window.document;

const htmlPath = process.argv[2];

if (!htmlPath || !existsSync(htmlPath)) {
  console.error("❌ Please provide a valid HTML file path");
  console.error("Usage: npx tsx analyze-parser-issues.ts <path-to-html>");
  process.exit(1);
}

console.log(`Analyzing: ${htmlPath}\n`);
const html = readFileSync(htmlPath, "utf-8");

const bets = parseFanDuel(html);

console.log(`Parsed ${bets.length} bets\n`);

if (bets.length === 0) {
  console.log("❌ No bets parsed - checking HTML structure...\n");

  const doc = new DOMParser().parseFromString(html, "text/html");
  const ul = doc.querySelector("ul.t.h.di") ?? doc.querySelector("ul");
  console.log(`UL found: ${ul ? "YES" : "NO"}`);

  if (ul) {
    const lis = Array.from(ul.querySelectorAll("li"));
    console.log(`Total <li> elements: ${lis.length}`);
    const betIdLis = lis.filter((li) =>
      (li.textContent ?? "").includes("BET ID:")
    );
    console.log(`<li> with "BET ID:": ${betIdLis.length}`);

    if (betIdLis.length > 0 && bets.length === 0) {
      console.log(
        "\n⚠️  Found footers but parser returned 0 bets - extraction is failing!"
      );
    }
  }
  process.exit(1);
}

// Analyze extraction quality
console.log("=== Extraction Quality Analysis ===\n");

const stats = {
  missingBetId: 0,
  missingDescription: 0,
  zeroOdds: 0,
  zeroStake: 0,
  nullPayout: 0,
  missingResult: 0,
  missingType: 0,
  missingName: 0,
};

bets.forEach((bet) => {
  if (!bet.betId) stats.missingBetId++;
  if (!bet.description || bet.description.trim() === "")
    stats.missingDescription++;
  if (bet.odds === 0 && bet.betType !== "parlay" && bet.betType !== "sgp")
    stats.zeroOdds++;
  if (bet.stake === 0) stats.zeroStake++;
  if (bet.payout === null || bet.payout === undefined) stats.nullPayout++;
  if (!bet.result || bet.result === "pending") stats.missingResult++;
  if (!bet.type) stats.missingType++;
  if (!bet.name && bet.betType === "single") stats.missingName++;
});

console.log("Issues found:");
Object.entries(stats).forEach(([key, count]) => {
  if (count > 0) {
    console.log(
      `  ${key}: ${count} bets (${((count / bets.length) * 100).toFixed(1)}%)`
    );
  }
});

// Show worst offenders
console.log("\n=== Sample of Problematic Bets ===\n");

const problematic = bets
  .filter(
    (bet) =>
      !bet.description ||
      bet.odds === 0 ||
      bet.stake === 0 ||
      bet.payout === null
  )
  .slice(0, 5);

problematic.forEach((bet, i) => {
  console.log(`Problem Bet ${i + 1}:`);
  console.log(`  BetId: ${bet.betId || "MISSING"}`);
  console.log(`  Description: ${bet.description || "MISSING"}`);
  console.log(`  Odds: ${bet.odds}`);
  console.log(`  Stake: $${bet.stake}`);
  console.log(`  Payout: $${bet.payout ?? "NULL"}`);
  console.log(`  Type: ${bet.type || "MISSING"}`);
  console.log(`  Name: ${bet.name || "MISSING"}`);
  console.log("");
});

// Save parsed bets to JSON for inspection
const outputPath = htmlPath.replace(".html", "_parsed.json");
writeFileSync(outputPath, JSON.stringify(bets, null, 2));
console.log(`\n✅ Saved parsed bets to: ${outputPath}`);
console.log("   You can inspect this file to see what was extracted.\n");

// Summary
const totalIssues = Object.values(stats).reduce((a, b) => a + b, 0);
if (totalIssues === 0) {
  console.log("✅ No obvious extraction issues found!");
} else {
  console.log(
    `⚠️  Found ${totalIssues} total issues across ${bets.length} bets`
  );
  console.log("   Review the sample bets above to identify patterns.");
}

// Create detailed issues report
const issuesReportPath = htmlPath.replace(".html", "_issues.json");
const issuesReport = {
  analyzedFile: htmlPath,
  analyzedAt: new Date().toISOString(),
  totalBets: bets.length,
  totalIssues,
  issuesSummary: stats,
  issuesPercentages: Object.entries(stats).reduce((acc, [key, count]) => {
    acc[key] = `${((count / bets.length) * 100).toFixed(1)}%`;
    return acc;
  }, {} as Record<string, string>),
  problematicBets: bets
    .map((bet, index) => {
      const issues: string[] = [];
      if (!bet.betId) issues.push("missingBetId");
      if (!bet.description || bet.description.trim() === "")
        issues.push("missingDescription");
      if (bet.odds === 0 && bet.betType !== "parlay" && bet.betType !== "sgp")
        issues.push("zeroOdds");
      if (bet.stake === 0) issues.push("zeroStake");
      if (bet.payout === null || bet.payout === undefined)
        issues.push("nullPayout");
      if (!bet.result || bet.result === "pending") issues.push("missingResult");
      if (!bet.type) issues.push("missingType");
      if (!bet.name && bet.betType === "single") issues.push("missingName");

      if (issues.length === 0) return null;

      return {
        betIndex: index,
        betId: bet.betId || "MISSING",
        description: bet.description || "MISSING",
        issues,
        bet,
      };
    })
    .filter((item) => item !== null),
};

writeFileSync(issuesReportPath, JSON.stringify(issuesReport, null, 2));
console.log(`\n📋 Saved detailed issues report to: ${issuesReportPath}`);
console.log(
  `   This file contains all ${issuesReport.problematicBets.length} bets with issues.`
);
