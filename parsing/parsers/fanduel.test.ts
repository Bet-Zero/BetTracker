import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parse } from "./fanduel";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("FanDuel Parser V2 - Single Bet", () => {
  let fixtureHtml: string;

  beforeAll(() => {
    const fixturePath = join(
      __dirname,
      "../fixtures/fanduel/expected_fanduel_bets.html"
    );
    fixtureHtml = readFileSync(fixturePath, "utf-8");
  });

  it("should parse exactly 1 bet from the single fixture", () => {
    const bets = parse(fixtureHtml);
    expect(bets).toHaveLength(1);
  });

  it("should parse the single bet correctly", () => {
    const bets = parse(fixtureHtml);
    const bet = bets[0];

    expect(bet).toBeDefined();
    expect(bet.betId).toBe("O/0242888/0027982");
    expect(bet.book).toBe("FanDuel");
    expect(bet.betType).toBe("single");
    expect(bet.odds).toBe(360);
    expect(bet.stake).toBe(1.0);
    expect(bet.payout).toBe(4.6);
    expect(bet.result).toBe("win");
    expect(bet.sport).toBe("NBA");
    expect(bet.marketCategory).toBe("Props");

    // Check placedAt date
    expect(bet.placedAt).toBeDefined();
    const placedDate = new Date(bet.placedAt);
    expect(placedDate.getFullYear()).toBe(2025);
    expect(placedDate.getMonth()).toBe(10); // November (0-indexed)
    expect(placedDate.getDate()).toBe(16);
  });

  it("should parse legs correctly", () => {
    const bets = parse(fixtureHtml);
    const bet = bets[0];

    expect(bet.legs).toBeDefined();
    expect(bet.legs).toHaveLength(1);

    const leg = bet.legs![0];
    expect(leg.entities).toContain("Will Richard");
    expect(leg.market).toBe("3pt");
    expect(leg.target).toBe("3+");
    expect(leg.result).toBe("win");
  });

  it("should generate correct description", () => {
    const bets = parse(fixtureHtml);
    const bet = bets[0];

    expect(bet.description).toContain("Will Richard");
    expect(bet.description).toContain("3pt");
  });
});

describe("FanDuel Parser V2 - SGP Bets", () => {
  let fixtureHtml: string;

  beforeAll(() => {
    const fixturePath = join(__dirname, "../fixtures/fanduel/sgp_sample.html");
    fixtureHtml = readFileSync(fixturePath, "utf-8");
  });

  it("should parse exactly 2 bets from the SGP fixture", () => {
    const bets = parse(fixtureHtml);
    expect(bets).toHaveLength(2);
  });

  it("should parse the first SGP bet correctly", () => {
    const bets = parse(fixtureHtml);
    const bet1 = bets.find((b) => b.betId === "O/0242888/0027999");

    expect(bet1).toBeDefined();
    expect(bet1?.betId).toBe("O/0242888/0027999");
    expect(bet1?.book).toBe("FanDuel");
    expect(bet1?.betType).toBe("sgp");
    expect(bet1?.odds).toBe(31607);
    expect(bet1?.stake).toBe(0.5);
    expect(bet1?.payout).toBe(0.0);
    expect(bet1?.result).toBe("loss");

    // Check placedAt date
    expect(bet1?.placedAt).toBeDefined();
    const placedDate = new Date(bet1!.placedAt);
    expect(placedDate.getFullYear()).toBe(2025);
    expect(placedDate.getMonth()).toBe(10); // November (0-indexed)
    expect(placedDate.getDate()).toBe(16);
  });

  it("should parse legs correctly for the first SGP bet", () => {
    const bets = parse(fixtureHtml);
    const bet1 = bets.find((b) => b.betId === "O/0242888/0027999");

    expect(bet1?.legs).toBeDefined();
    expect(bet1?.legs?.length).toBeGreaterThanOrEqual(3); // Should have at least 3 legs

    // Check that legs have the expected structure
    const legs = bet1!.legs!;
    legs.forEach((leg) => {
      expect(leg.entities).toBeDefined();
      expect(leg.entities!.length).toBeGreaterThan(0);
      expect(leg.market).toBeDefined();
      expect(leg.result).toBeDefined();
      expect(["win", "loss", "pending"]).toContain(leg.result);
    });
  });
});
