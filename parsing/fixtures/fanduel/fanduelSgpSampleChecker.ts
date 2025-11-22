import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
import { parseFanDuel } from "../../parsers/fanduel";
import type { Bet } from "../../../types";

// Set up DOM environment for the parser
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
// @ts-ignore
global.DOMParser = dom.window.DOMParser;
// @ts-ignore
global.document = dom.window.document;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const htmlPath = path.join(__dirname, "sgp_sample.html");
const expectedPath = path.join(__dirname, "expected_sgp_sample.json");

const html = fs.readFileSync(htmlPath, "utf-8");
const expected = JSON.parse(fs.readFileSync(expectedPath, "utf-8")) as Bet[];

const parsed = parseFanDuel(html);

const byId = (bets: Bet[]) =>
  Object.fromEntries(bets.map((b) => [b.betId, b]));

const parsedById = byId(parsed);
const expectedById = byId(expected);

const allIds = Array.from(
  new Set([...Object.keys(parsedById), ...Object.keys(expectedById)])
);

console.log("=== FanDuel SGP Sample Check ===");
console.log("Parsed count:", parsed.length);
console.log("Expected count:", expected.length);

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

  const fields: (keyof Bet)[] = [
    "betId",
    "betType",
    "marketCategory",
    "description",
    "odds",
    "stake",
    "payout",
    "result",
  ];

  const diffs: string[] = [];

  for (const field of fields) {
    const pv = p[field];
    const ev = e[field];
    if (JSON.stringify(pv) !== JSON.stringify(ev)) {
      diffs.push(
        `${String(field)}: parsed=${JSON.stringify(
          pv
        )}, expected=${JSON.stringify(ev)}`
      );
    }
  }

  if (p.legs?.length !== e.legs?.length) {
    diffs.push(
      `legs.length: parsed=${p.legs?.length ?? 0}, expected=${
        e.legs?.length ?? 0
      }`
    );
  }

  if (diffs.length) {
    console.error(
      `❌ betId=${betId} has mismatches:\n  - ${diffs.join("\n  - ")}`
    );
  } else {
    console.log(`✅ betId=${betId} matches fixture`);
  }
}

console.log("=== End FanDuel SGP Sample Check ===");
