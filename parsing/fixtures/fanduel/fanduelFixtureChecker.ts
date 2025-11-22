// debug/fanduelFixtureChecker.ts

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
import expected from "./expected_fanduel_bets.json";
import { parseFanDuel } from "../../parsers/fanduel";
import type { Bet } from "../../../types";

export const checkFanDuelFixture = () => {
  // Set up DOM environment for the parser
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  global.DOMParser = dom.window.DOMParser;
  global.document = dom.window.document;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const htmlPath = path.join(__dirname, "expected_fanduel_bets.html");
  const html = fs.readFileSync(htmlPath, "utf-8");

  const parsed = parseFanDuel(html);

  const byId = (bets: Bet[]) =>
    Object.fromEntries(bets.map((b) => [b.betId, b]));

  const parsedById = byId(parsed);
  const expectedById = byId(expected as Bet[]);

  const allIds = Array.from(
    new Set([...Object.keys(parsedById), ...Object.keys(expectedById)])
  );

  console.log("=== FanDuel Fixture Check ===");
  console.log("Parsed count:", parsed.length);
  console.log("Expected count:", (expected as Bet[]).length);

  for (const betId of allIds) {
    const p = parsedById[betId];
    const e = expectedById[betId];

    if (!p) {
      console.error(`❌ Missing parsed bet for betId=${betId}`);
      continue;
    }
    if (!e) {
      console.error(`❌ Extra parsed bet not in fixture betId=${betId}`);
      continue;
    }

    // fields we care about for now
    const fields: (keyof Bet)[] = [
      "betId",
      "betType",
      "marketCategory",
      "description",
      "name",
      "odds",
      "stake",
      "payout",
      "result",
      "type",
      "line",
      "ou",
    ];

    const diffs: string[] = [];

    for (const field of fields) {
      const pv = p[field];
      const ev = e[field];
      // loose equality to avoid tiny float/format differences at first
      if (JSON.stringify(pv) !== JSON.stringify(ev)) {
        diffs.push(
          `${String(field)}: parsed=${JSON.stringify(
            pv
          )}, expected=${JSON.stringify(ev)}`
        );
      }
    }

    if (diffs.length) {
      console.error(
        `❌ betId=${betId} has mismatches:\n  - ${diffs.join("\n  - ")}`
      );
    } else {
      console.log(`✅ betId=${betId} matches fixture`);
    }
  }

  console.log("=== End FanDuel Fixture Check ===");
};
