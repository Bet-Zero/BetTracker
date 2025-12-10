import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { JSDOM } from "jsdom";
import { parse } from "../parsers";
import type { Bet } from "../../../types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixtureDir = join(__dirname, "../fixtures");

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

    // Spot check leg-level results pulled from icons on the parlay
    const parlay = parsedMap.get("O/0242888/0028023");
    expect(parlay?.betType).toBe("parlay");
    expect(parlay?.odds).toBe(205);
    expect(parlay?.legs?.map((l) => l.result)).toEqual(["WIN", "WIN"]);
    expect(parlay?.legs?.every((leg) => leg.odds !== parlay?.odds)).toBe(true);

    const single = parsedMap.get("O/0242888/0028020");
    expect(single?.betType).toBe("single");
    expect(single?.legs?.[0]?.odds).toBe(single?.odds);
    expect(single?.legs?.[0]?.result).toBe("LOSS");
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

    // Leg odds should be null/absent for SGP inner legs; results come from icons when present
    const sgp = parsedMap.get("O/0242888/0028078");
    expect(sgp?.betType).toBe("sgp");
    expect(sgp?.odds).toBe(6058);
    expect(sgp?.legs?.length).toBe(1);

    const groupLeg = sgp?.legs?.[0];
    expect(groupLeg?.isGroupLeg).toBe(true);
    expect(groupLeg?.odds).toBe(6058);
    expect(groupLeg?.children?.length).toBe(4);
    expect(groupLeg?.children?.every((child) => child.odds === null)).toBe(true);
    expect(new Set(groupLeg?.children?.map((child) => child.result))).toEqual(
      new Set(["PENDING"])
    );
  });

  it("matches SGP+ sample fixture", () => {
    const html = readFileSync(join(fixtureDir, "sgp_plus_sample.html"), "utf-8");
    const expectedBets = JSON.parse(
      readFileSync(join(fixtureDir, "expected_sgp_plus_sample.json"), "utf-8")
    ) as Bet[];

    const parsed = parse(html);
    const parsedMap = byId(parsed);
    const expectedMap = byId(expectedBets);

    expect(parsed.length).toBe(expectedBets.length);
    expect([...parsedMap.keys()].sort()).toEqual(
      [...expectedMap.keys()].sort()
    );

    const target = expectedBets[0];
    const parsedBet = parsedMap.get(target.betId);
    expect(parsedBet).toBeDefined();
    if (!parsedBet) return;

    const coreFields: (keyof Bet)[] = [
      "betId",
      "betType",
      "odds",
      "stake",
      "payout",
      "result",
      "description",
    ];
    coreFields.forEach((field) => {
      expect(parsedBet[field]).toEqual(target[field]);
    });

    expect(parsedBet.betType).toBe("sgp_plus");
    expect(parsedBet.legs?.length ?? 0).toBe(2);

    const groupLeg = parsedBet.legs?.find((leg) => leg.isGroupLeg);
    const extraLeg = parsedBet.legs?.find((leg) => !leg.isGroupLeg);

    expect(groupLeg?.odds).toBe(2997);
    expect(groupLeg?.children?.length).toBe(2);
    expect(groupLeg?.children?.map((c) => c.odds)).toEqual([null, null]);
    expect(groupLeg?.children?.map((c) => c.result)).toEqual(["LOSS", "WIN"]);

    expect(extraLeg?.odds).toBe(1100);
    expect(extraLeg?.result).toBe("LOSS");

    // Ensure the nested SGP is represented as a group leg
    expect(groupLeg?.isGroupLeg).toBe(true);
    expect(groupLeg?.children?.length).toBeGreaterThan(0);
  });
});

