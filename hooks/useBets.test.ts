import { beforeEach, describe, expect, it, vi } from "vitest";
import { Bet } from "../types";
import { canonicalizeImportedBets, collectResolvedImportInputs } from "./useBets";
import * as resolver from "../services/resolver";

vi.mock("../services/resolver", async () => {
  const actual = await vi.importActual("../services/resolver");
  return {
    ...actual,
    resolvePlayer: vi.fn(),
    resolveTeamForSport: vi.fn(),
    resolveBetType: vi.fn(),
  };
});

const baseBet: Bet = {
  id: "bet-1",
  book: "FanDuel",
  betId: "bet-1",
  placedAt: new Date().toISOString(),
  betType: "single",
  marketCategory: "Props",
  sport: "NBA",
  description: "Test bet",
  stake: 10,
  payout: 19,
  result: "pending",
};

describe("collectResolvedImportInputs", () => {
  beforeEach(() => {
    vi.mocked(resolver.resolvePlayer).mockImplementation((value) =>
      value.toLowerCase().includes("unknown")
        ? { status: "unresolved", canonical: value, raw: value }
        : { status: "resolved", canonical: "LeBron James", raw: value }
    );
    vi.mocked(resolver.resolveTeamForSport).mockImplementation((value) =>
      value.toLowerCase().includes("unknown")
        ? { status: "unresolved", canonical: value, raw: value }
        : { status: "resolved", canonical: "Los Angeles Lakers", raw: value }
    );
    vi.mocked(resolver.resolveBetType).mockImplementation((value) => {
      if (value.toLowerCase().includes("unknown")) {
        return { status: "unresolved", canonical: value, raw: value };
      }
      const canonicalMap: Record<string, string> = {
        Points: "Pts",
        Rebounds: "Reb",
        Assists: "Ast",
      };
      return {
        status: "resolved",
        canonical: canonicalMap[value] ?? value,
        raw: value,
      };
    });
  });

  it("collects only resolved canonical values for players, teams, and bet types", () => {
    const bets: Bet[] = [
      {
        ...baseBet,
        type: "Points",
        legs: [
          { market: "Rebounds", entityType: "player", entities: ["LeBron James"] },
          { market: "Unknown Stat Type", entityType: "team", entities: ["Unknown Team XYZ"] },
          { market: "Moneyline", entityType: "team", entities: ["LAL"] },
        ],
      },
    ];

    const result = collectResolvedImportInputs(bets);

    expect(Array.from(result.players.get("NBA") ?? [])).toEqual(["LeBron James"]);
    expect(Array.from(result.teams.get("NBA") ?? [])).toEqual(["Los Angeles Lakers"]);
    expect(new Set(Array.from(result.betTypes.get("NBA") ?? []))).toEqual(
      new Set(["Pts", "Reb", "Moneyline"])
    );
  });

  it("collects child legs from grouped/parlay structures", () => {
    const bets: Bet[] = [
      {
        ...baseBet,
        id: "bet-2",
        betId: "bet-2",
        betType: "sgp_plus",
        legs: [
          {
            market: "Same Game Parlay",
            isGroupLeg: true,
            children: [
              { market: "Assists", entityType: "player", entities: ["LeBron James"] },
              { market: "Spread", entityType: "team", entities: ["LAL"] },
            ],
          },
        ],
      },
    ];

    const result = collectResolvedImportInputs(bets);

    expect(Array.from(result.players.get("NBA") ?? [])).toEqual(["LeBron James"]);
    expect(Array.from(result.teams.get("NBA") ?? [])).toEqual(["Los Angeles Lakers"]);
    expect(new Set(Array.from(result.betTypes.get("NBA") ?? []))).toEqual(
      new Set(["Ast", "Spread"])
    );
  });
});

describe("canonicalizeImportedBets", () => {
  beforeEach(() => {
    vi.mocked(resolver.resolvePlayer).mockImplementation((value) =>
      value.toLowerCase().includes("unknown")
        ? { status: "unresolved", canonical: value, raw: value }
        : { status: "resolved", canonical: "LeBron James", raw: value }
    );
    vi.mocked(resolver.resolveTeamForSport).mockImplementation((value) =>
      value.toLowerCase().includes("unknown")
        ? { status: "unresolved", canonical: value, raw: value }
        : { status: "resolved", canonical: "Los Angeles Lakers", raw: value }
    );
    vi.mocked(resolver.resolveBetType).mockImplementation((value) => {
      const canonicalMap: Record<string, string> = {
        Points: "Pts",
        Rebounds: "Reb",
        Assists: "Ast",
      };
      if (value.toLowerCase().includes("unknown")) {
        return { status: "unresolved", canonical: value, raw: value };
      }
      return {
        status: "resolved",
        canonical: canonicalMap[value] ?? value,
        raw: value,
      };
    });
  });

  it("rewrites resolved type, markets, and entities to canonical values across nested legs", () => {
    const bets: Bet[] = [
      {
        ...baseBet,
        type: "Points",
        legs: [
          {
            market: "Same Game Parlay",
            isGroupLeg: true,
            children: [
              { market: "Rebounds", entityType: "player", entities: ["LeBron"] },
              { market: "Spread", entityType: "team", entities: ["LAL"] },
            ],
          },
        ],
      },
    ];

    const result = canonicalizeImportedBets(bets);
    const childLegs = result[0].legs?.[0]?.children ?? [];

    expect(result[0].type).toBe("Pts");
    expect(childLegs[0].market).toBe("Reb");
    expect(childLegs[0].entities?.[0]).toBe("LeBron James");
    expect(childLegs[1].entities?.[0]).toBe("Los Angeles Lakers");
  });

  it("keeps unresolved values unchanged", () => {
    const bets: Bet[] = [
      {
        ...baseBet,
        type: "Unknown Stat Type",
        legs: [
          { market: "Unknown Stat Type", entityType: "player", entities: ["Unknown Player"] },
          { market: "Spread", entityType: "team", entities: ["Unknown Team"] },
        ],
      },
    ];

    const result = canonicalizeImportedBets(bets);

    expect(result[0].type).toBe("Unknown Stat Type");
    expect(result[0].legs?.[0].market).toBe("Unknown Stat Type");
    expect(result[0].legs?.[0].entities?.[0]).toBe("Unknown Player");
    expect(result[0].legs?.[1].entities?.[0]).toBe("Unknown Team");
  });
});
