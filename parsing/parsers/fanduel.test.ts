import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { JSDOM } from "jsdom";
import { parse } from "./fanduel";
import type { Bet } from "../../types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureDir = join(__dirname, "../fixtures/fanduel");

const setupDom = () => {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  // @ts-ignore jsdom provides DOMParser in the test environment
  global.DOMParser = dom.window.DOMParser;
  // @ts-ignore expose document for any selectors used by the parser
  global.document = dom.window.document;
};

const byId = (bets: Bet[]) => new Map(bets.map((b) => [b.betId, b]));

describe("FanDuel parser fixtures", () => {
  beforeAll(() => {
    setupDom();
  });

  it("matches expected_fanduel_bets fixture", () => {
    const html = readFileSync(
      join(fixtureDir, "expected_fanduel_bets.html"),
      "utf-8"
    );
    const expectedBets = JSON.parse(
      readFileSync(join(fixtureDir, "expected_fanduel_bets.json"), "utf-8")
    ) as Bet[];

    const parsed = parse(html);
    const parsedMap = byId(parsed);
    const expectedMap = byId(expectedBets);

    expect(parsed.length).toBe(expectedBets.length);
    expect([...parsedMap.keys()].sort()).toEqual(
      [...expectedMap.keys()].sort()
    );

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

    for (const exp of expectedBets) {
      const parsedBet = parsedMap.get(exp.betId);
      expect(parsedBet).toBeDefined();
      if (!parsedBet) continue;

      fields.forEach((field) => {
        expect(parsedBet[field]).toEqual(exp[field]);
      });

      expect(parsedBet.legs?.length ?? 0).toBe(exp.legs?.length ?? 0);
    }
  });

  it("matches SGP sample fixture", () => {
    const html = readFileSync(join(fixtureDir, "sgp_sample.html"), "utf-8");
    const expectedBets = JSON.parse(
      readFileSync(join(fixtureDir, "expected_sgp_sample.json"), "utf-8")
    ) as Bet[];

    const parsed = parse(html);
    const parsedMap = byId(parsed);
    const expectedMap = byId(expectedBets);

    expect(parsed.length).toBe(expectedBets.length);
    expect([...parsedMap.keys()].sort()).toEqual(
      [...expectedMap.keys()].sort()
    );

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

    for (const exp of expectedBets) {
      const parsedBet = parsedMap.get(exp.betId);
      expect(parsedBet).toBeDefined();
      if (!parsedBet) continue;

      fields.forEach((field) => {
        expect(parsedBet[field]).toEqual(exp[field]);
      });

      expect(parsedBet.legs?.length ?? 0).toBe(exp.legs?.length ?? 0);
    }
  });
});
