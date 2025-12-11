// parsing/draftkings/fixtures/draftkingsFixtureChecker.ts

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
import { parseDraftKingsHTML } from "../parsers";
import type { Bet } from "../../../types";

export const checkDraftKingsFixture = () => {
  // Set up DOM environment for the parser
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  (global as any).DOMParser = dom.window.DOMParser;
  (global as any).document = dom.window.document;
  (global as any).Element = dom.window.Element;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Check if draftkings-html-test.html exists
  const htmlPath = path.join(__dirname, "draftkings-html-test.html");
  if (!fs.existsSync(htmlPath)) {
    console.error("❌ draftkings-html-test.html not found!");
    console.log("   Please paste your DraftKings bet history HTML into:");
    console.log(`   ${htmlPath}`);
    return;
  }
  
  const html = fs.readFileSync(htmlPath, "utf-8");
  if (html.trim().length === 0) {
    console.error("❌ draftkings-html-test.html is empty!");
    console.log("   Please paste your DraftKings bet history HTML into the file.");
    return;
  }

  console.log("=== DraftKings Local Parser Test ===\n");
  console.log("Parsing draftkings-html-test.html...\n");

  const parsed = parseDraftKingsHTML(html);

  console.log(`Found ${parsed.length} bets\n`);
  console.log("─".repeat(80));

  for (let i = 0; i < parsed.length; i++) {
    const bet = parsed[i];
    console.log(`\n📌 Bet ${i + 1}: ${bet.betId}`);
    console.log("─".repeat(40));
    
    // Core fields
    console.log(`  Sport:       ${bet.sport}`);
    console.log(`  Type:        ${bet.type || "(not set)"}`);
    console.log(`  Name:        ${bet.name || "(not set)"}`);
    console.log(`  Description: ${bet.description}`);
    console.log(`  Bet Type:    ${bet.betType}`);
    console.log(`  Odds:        ${bet.odds}`);
    console.log(`  Stake:       $${bet.stake}`);
    console.log(`  Payout:      $${bet.payout}`);
    console.log(`  Result:      ${bet.result}`);
    console.log(`  Is Live:     ${bet.isLive ? "Yes" : "No"}`);
    console.log(`  Line:        ${bet.line || "(not set)"}`);
    console.log(`  Over/Under:  ${bet.ou || "(not set)"}`);
    
    // Legs
    if (bet.legs && bet.legs.length > 0) {
      console.log(`  Legs (${bet.legs.length}):`);
      for (const leg of bet.legs) {
        if (leg.isGroupLeg) {
          console.log(`    • [GROUP] ${leg.market} (odds: ${leg.odds})`);
          if (leg.children) {
            for (const child of leg.children) {
              const childName = child.entities?.[0] ? `[${child.entities[0]}] ` : '';
              console.log(`      ↳ ${childName}${child.market} ${child.target || ""} → ${child.result}`);
            }
          }
        } else {
          const legName = leg.entities?.[0] ? `[${leg.entities[0]}] ` : '';
          console.log(`    • ${legName}${leg.market} ${leg.target || ""} → ${leg.result}`);
        }
      }
    }
  }

  console.log("\n" + "─".repeat(80));
  console.log("\n=== End DraftKings Parser Test ===\n");

  // Save parsed output to JSON file
  const outputPath = path.join(__dirname, "draftkings-html-test_parsed.json");
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 2));
  console.log(`✅ Parsed output saved to: ${outputPath}`);
  
  // If expected file exists, compare
  const expectedPath = path.join(__dirname, "expected_draftkings_bets.json");
  if (fs.existsSync(expectedPath)) {
    console.log("\n--- Comparison with expected output ---\n");
    const expected = JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as Bet[];
    
    const byId = (bets: Bet[]) =>
      Object.fromEntries(bets.map((b) => [b.betId, b]));

    const parsedById = byId(parsed);
    const expectedById = byId(expected);

    const allIds = Array.from(
      new Set([...Object.keys(parsedById), ...Object.keys(expectedById)])
    );

    for (const betId of allIds) {
      const p = parsedById[betId];
      const e = expectedById[betId];

      if (!p) {
        console.error(`❌ Missing parsed bet for betId=${betId}`);
        continue;
      }
      if (!e) {
        console.log(`📝 New bet not in expected: betId=${betId}`);
        continue;
      }

      // Fields to compare
      const fields: (keyof Bet)[] = [
        "sport",
        "betType",
        "marketCategory",
        "description",
        "name",
        "type",
        "odds",
        "stake",
        "payout",
        "result",
        "line",
        "ou",
        "isLive",
      ];

      const diffs: string[] = [];

      for (const field of fields) {
        const pv = p[field];
        const ev = e[field];
        if (JSON.stringify(pv) !== JSON.stringify(ev)) {
          diffs.push(
            `${String(field)}: parsed=${JSON.stringify(pv)}, expected=${JSON.stringify(ev)}`
          );
        }
      }

      if (diffs.length) {
        console.error(
          `❌ betId=${betId} has mismatches:\n  - ${diffs.join("\n  - ")}`
        );
      } else {
        console.log(`✅ betId=${betId} matches expected`);
      }
    }
  }
};
