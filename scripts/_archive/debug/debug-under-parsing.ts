#!/usr/bin/env tsx

import { readFileSync } from "fs";
import { parseFanDuel } from "./parsing/parsers/fanduel";
import { JSDOM } from "jsdom";

// Set up DOM environment
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
global.DOMParser = dom.window.DOMParser;
global.document = dom.window.document;

// Load the fixture
const html = readFileSync(
  "./parsing/fixtures/fanduel/expected_fanduel_bets.html",
  "utf-8"
);
const bets = parseFanDuel(html);

// Find the specific failing bet
const problematicBet = bets.find((bet) => bet.betId === "O/0242888/0028003");

if (problematicBet) {
  console.log("=== Problematic Bet Analysis ===");
  console.log("betId:", problematicBet.betId);
  console.log("description (current):", problematicBet.description);
  console.log("type:", problematicBet.type);
  console.log("line:", problematicBet.line);
  console.log("ou:", problematicBet.ou);
  console.log("name:", problematicBet.name);
  console.log('Expected description: "Under 224.5 Total Points"');

  if (problematicBet.legs && problematicBet.legs.length > 0) {
    console.log("Leg info:");
    problematicBet.legs.forEach((leg, i) => {
      console.log(`  Leg ${i + 1}:`, {
        market: leg.market,
        target: leg.target,
        ou: leg.ou,
        entities: leg.entities,
      });
    });
  }
} else {
  console.log("Bet O/0242888/0028003 not found");
  console.log(
    "Available betIds:",
    bets.map((b) => b.betId)
  );
}
