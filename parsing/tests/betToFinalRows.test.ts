import { describe, it, expect } from "vitest";
import { betToFinalRows } from "../shared/betToFinalRows";
import { Bet } from "../../types";

/**
 * Helper to verify raw numeric fields with explicit precision
 */
function expectRawFields(
  row: any,
  {
    bet,
    odds,
    toWin,
    net,
  }: { bet?: number; odds?: number; toWin?: number; net?: number }
) {
  if (bet !== undefined) expect(row._rawBet).toBe(bet);
  if (odds !== undefined) expect(row._rawOdds).toBe(odds);
  if (toWin !== undefined) expect(row._rawToWin).toBeCloseTo(toWin, 2);
  if (net !== undefined) expect(row._rawNet).toBeCloseTo(net, 2);
}

describe("betToFinalRows", () => {
  describe("single bet without legs", () => {
    it("should convert a simple single bet to FinalRow", () => {
      const bet: Bet = {
        id: "test-1",
        book: "FanDuel",
        betId: "ABC123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Will Richard: 3+ Made Threes",
        name: "Will Richard",
        odds: 360,
        stake: 1.0,
        payout: 4.6,
        result: "win",
        type: "3pt",
        line: "3+",
        ou: "Over",
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        Date: "11/18/24",
        Site: "FanDuel",
        Sport: "NBA",
        Category: "Props",
        Type: "3pt",
        Name: "Will Richard",
        Over: "1",
        Under: "0",
        Line: "3+",
        Odds: "+360",
        Bet: "$1.00",
        "To Win": "$4.60",
        Result: "Win",
        Net: "3.60",
        Live: "",
        Tail: "",
        _parlayGroupId: null,
        _legIndex: null,
        _legCount: null,
        _isParlayHeader: false,
        _isParlayChild: false,
      });
      // Verify raw numeric fields are also populated
      expectRawFields(rows[0], {
        bet: 1,
        odds: 360,
        toWin: 4.6,
        net: 3.6,
      });
    });

    it("should handle negative odds", () => {
      const bet: Bet = {
        id: "test-2",
        book: "FanDuel",
        betId: "ABC124",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Player Points",
        name: "LeBron James",
        odds: -120,
        stake: 12.0,
        payout: 0,
        result: "loss",
        type: "Pts",
        line: "25.5",
        ou: "Over",
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0].Odds).toBe("-120");
      expect(rows[0].Result).toBe("Loss");
      expect(rows[0].Net).toBe("-12.00");
      expectRawFields(rows[0], {
        bet: 12.0,
        odds: -120,
        toWin: 22.0,
        net: -12.0,
      });
    });

    it("should handle push result", () => {
      const bet: Bet = {
        id: "test-3",
        book: "FanDuel",
        betId: "ABC125",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Main Markets",
        sport: "NBA",
        description: "Spread",
        name: "Lakers",
        odds: -110,
        stake: 10.0,
        payout: 10.0,
        result: "push",
        type: "Spread",
        line: "-5.5",
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0].Result).toBe("Push");
      expect(rows[0].Net).toBe("0.00");
      expectRawFields(rows[0], { bet: 10.0, odds: -110, toWin: 10.0, net: 0 });
    });

    it("should set Live flag for live bets", () => {
      const bet: Bet = {
        id: "test-4",
        book: "FanDuel",
        betId: "ABC126",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Live bet",
        name: "Player",
        odds: 200,
        stake: 5.0,
        payout: 0,
        result: "pending",
        isLive: true,
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0].Live).toBe("1");
    });

    it("should set Tail flag when tail is present", () => {
      const bet: Bet = {
        id: "test-5",
        book: "FanDuel",
        betId: "ABC127",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Tailed bet",
        name: "Player",
        odds: 150,
        stake: 2.0,
        payout: 0,
        result: "pending",
        tail: "Expert123",
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0].Tail).toBe("1");
    });
  });

  describe("multi-leg bets (SGP/Parlay)", () => {
    it("should create one FinalRow per leg", () => {
      const bet: Bet = {
        id: "sgp-1",
        book: "FanDuel",
        betId: "SGP123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "sgp",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "SGP: Player A 3pt / Player B Pts",
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: "loss",
        legs: [
          {
            entities: ["Player A"],
            market: "3pt",
            target: "3+",
            result: "win",
          },
          {
            entities: ["Player B"],
            market: "Pts",
            target: "25.5",
            ou: "Over",
            result: "loss",
          },
        ],
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(3); // Header + 2 legs

      // Header row
      expect(rows[0].Name).toBe("SGP (2)");
      expect(rows[0].Category).toBe("Parlays");
      expect(rows[0].Type).toBe("SGP");
      expect(rows[0]._parlayGroupId).toBe("sgp-1");
      expect(rows[0]._legIndex).toBeNull();
      expect(rows[0]._legCount).toBe(2);
      expect(rows[0]._isParlayHeader).toBe(true);
      expect(rows[0]._isParlayChild).toBe(false);
      expect(rows[0].Bet).toBe("$5.00");
      expect(rows[0].Odds).toBe("+500");
      expect(rows[0]["To Win"]).toBe("$30.00");
      expect(rows[0].Net).toBe("-5.00");
      expect(rows[0].Result).toBe("Loss"); // bet.result

      // First leg
      expect(rows[1].Name).toBe("Player A");
      expect(rows[1].Type).toBe("3pt");
      expect(rows[1].Line).toBe("3+");
      expect(rows[1].Result).toBe("Win"); // leg.result
      expect(rows[1].Over).toBe("1"); // "+" implies Over

      // Second leg
      expect(rows[2].Name).toBe("Player B");
      expect(rows[2].Type).toBe("Pts");
      expect(rows[2].Line).toBe("25.5");
      expect(rows[2].Result).toBe("Loss"); // leg.result
      expect(rows[2].Over).toBe("1");
      expect(rows[2].Under).toBe("0");

      // Child legs don't have monetary values
      expect(rows[1].Bet).toBe("");
      expect(rows[2].Bet).toBe("");
      expect(rows[1].Odds).toBe("");
      expect(rows[2].Odds).toBe("");
      expect(rows[1]["To Win"]).toBe("");
      expect(rows[2]["To Win"]).toBe("");
      expect(rows[1].Net).toBe("");
      expect(rows[2].Net).toBe("");

      // Parlay metadata for legs
      expect(rows[1]._parlayGroupId).toBe("sgp-1");
      expect(rows[2]._parlayGroupId).toBe("sgp-1");
      expect(rows[1]._legIndex).toBe(1);
      expect(rows[2]._legIndex).toBe(2);
      expect(rows[1]._legCount).toBeNull();
      expect(rows[2]._legCount).toBeNull();
      expect(rows[1]._isParlayHeader).toBe(false);
      expect(rows[2]._isParlayHeader).toBe(false);
      expect(rows[1]._isParlayChild).toBe(true);
      expect(rows[2]._isParlayChild).toBe(true);
    });

    it("should calculate Net based on bet result for multi-leg bets, not individual leg results", () => {
      const bet: Bet = {
        id: "sgp-2",
        book: "FanDuel",
        betId: "SGP456",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "sgp",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "SGP with mixed leg results",
        odds: 500,
        stake: 10.0,
        payout: 0, // Lost overall
        result: "loss", // Overall bet lost
        legs: [
          {
            entities: ["Player A"],
            market: "3pt",
            target: "3+",
            result: "win", // This leg won
          },
          {
            entities: ["Player B"],
            market: "Pts",
            target: "25.5",
            ou: "Over",
            result: "loss", // This leg lost
          },
        ],
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(3); // Header + 2 legs

      // Only header shows monetary values
      expect(rows[0].Net).toBe("-10.00"); // Header shows bet loss
      expect(rows[1].Net).toBe(""); // Child leg has no monetary values
      expect(rows[2].Net).toBe(""); // Child leg has no monetary values
      expect(rows[0].Bet).toBe("$10.00");
      expect(rows[1].Bet).toBe("");
      expect(rows[2].Bet).toBe("");

      // Verify raw fields on header
      expectRawFields(rows[0], {
        bet: 10.0,
        odds: 500,
        toWin: 60.0,
        net: -10.0,
      });

      // Result: header shows bet result, children show leg results
      expect(rows[0].Result).toBe("Loss"); // bet.result
      expect(rows[1].Result).toBe("Win"); // leg 0 result
      expect(rows[2].Result).toBe("Loss"); // leg 1 result
    });

    it("should handle single-leg bets with legs structure correctly", () => {
      // FanDuel parser creates legs even for single bets
      const bet: Bet = {
        id: "single-with-leg",
        book: "FanDuel",
        betId: "SINGLE123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Single bet with leg structure",
        odds: 200,
        stake: 5.0,
        payout: 15.0,
        result: "win",
        legs: [
          {
            entities: ["Player Name"],
            market: "Pts",
            target: "25.5",
            ou: "Over",
            result: "win",
          },
        ],
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);

      // For single-leg bet, Net should still be based on leg result
      // (which matches bet result anyway)
      expect(rows[0].Net).toBe("10.00"); // Payout - stake
      expect(rows[0].Result).toBe("Win");
      expect(rows[0].Name).toBe("Player Name");
      expect(rows[0].Type).toBe("Pts");
    });
  });

  describe("Category normalization", () => {
    it("should normalize Props category", () => {
      const bet: Bet = {
        id: "test-6",
        book: "FanDuel",
        betId: "ABC128",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Category).toBe("Props");
    });

    it("should normalize Main Markets category", () => {
      const bet: Bet = {
        id: "test-7",
        book: "FanDuel",
        betId: "ABC129",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Main Markets",
        sport: "NBA",
        description: "Test",
        name: "Team",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Category).toBe("Main");
    });

    it("should normalize Futures category", () => {
      const bet: Bet = {
        id: "test-8",
        book: "FanDuel",
        betId: "ABC130",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Futures",
        sport: "NBA",
        description: "Test",
        name: "Team",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Category).toBe("Futures");
    });
  });

  describe("Type detection based on Category", () => {
    it("should map Props stat types correctly", () => {
      const testCases = [
        { market: "made threes", expected: "3pt" },
        { market: "points", expected: "Pts" },
        { market: "rebounds", expected: "Reb" },
        { market: "assists", expected: "Ast" },
        { market: "steals", expected: "Stl" },
        { market: "blocks", expected: "Blk" },
        { market: "points rebounds assists", expected: "PRA" },
        { market: "points rebounds", expected: "PR" },
        { market: "first basket", expected: "FB" },
        { market: "top scorer", expected: "Top Pts" },
        { market: "double double", expected: "DD" },
        { market: "triple double", expected: "TD" },
      ];

      testCases.forEach(({ market, expected }) => {
        const bet: Bet = {
          id: "test",
          book: "FanDuel",
          betId: "TEST",
          placedAt: "2024-11-18T19:00:00.000Z",
          betType: "single",
          marketCategory: "Props",
          sport: "NBA",
          description: market,
          name: "Player",
          odds: 100,
          stake: 1.0,
          payout: 0,
          result: "pending",
          type: market,
        };

        const rows = betToFinalRows(bet);
        expect(rows[0].Type).toBe(expected);
      });
    });

    it("should return empty Type for unmapped Props", () => {
      const bet: Bet = {
        id: "test-9",
        book: "FanDuel",
        betId: "ABC131",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Unknown stat",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        type: "unknown stat type",
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Type).toBe("");
    });

    it("should map Main Markets types correctly", () => {
      const testCases = [
        { market: "spread", expected: "Spread" },
        { market: "total", expected: "Total" },
        { market: "over", expected: "Total" },
        { market: "under", expected: "Total" },
        { market: "moneyline", expected: "Moneyline" },
      ];

      testCases.forEach(({ market, expected }) => {
        const bet: Bet = {
          id: "test",
          book: "FanDuel",
          betId: "TEST",
          placedAt: "2024-11-18T19:00:00.000Z",
          betType: "single",
          marketCategory: "Main Markets",
          sport: "NBA",
          description: market,
          name: "Team",
          odds: 100,
          stake: 1.0,
          payout: 0,
          result: "pending",
          type: market,
        };

        const rows = betToFinalRows(bet);
        expect(rows[0].Type).toBe(expected);
      });
    });
  });

  describe("Over/Under detection", () => {
    it("should set Over=1/Under=0 for Over bets", () => {
      const bet: Bet = {
        id: "test-10",
        book: "FanDuel",
        betId: "ABC132",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        ou: "Over",
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Over).toBe("1");
      expect(rows[0].Under).toBe("0");
    });

    it("should set Over=0/Under=1 for Under bets", () => {
      const bet: Bet = {
        id: "test-11",
        book: "FanDuel",
        betId: "ABC133",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        ou: "Under",
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Over).toBe("0");
      expect(rows[0].Under).toBe("1");
    });

    it("should set Over=1/Under=0 for milestone bets (X+)", () => {
      const bet: Bet = {
        id: "test-12",
        book: "FanDuel",
        betId: "ABC134",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        line: "3+",
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Over).toBe("1");
      expect(rows[0].Under).toBe("0");
    });

    it("should set both blank for non-O/U bets", () => {
      const bet: Bet = {
        id: "test-13",
        book: "FanDuel",
        betId: "ABC135",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Main Markets",
        sport: "NBA",
        description: "Moneyline",
        name: "Team",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        type: "Moneyline",
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Over).toBe("");
      expect(rows[0].Under).toBe("");
    });

    it("should prefer explicit ou field over line with '+' when both are present", () => {
      const bet: Bet = {
        id: "test-ou-priority",
        book: "FanDuel",
        betId: "ABC136",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        line: "3+",
        ou: "Under", // Explicit Under should take precedence
      };

      const rows = betToFinalRows(bet);
      // ou field should take precedence over line "+"
      expect(rows[0].Over).toBe("0");
      expect(rows[0].Under).toBe("1");
    });

    it("should not treat line with '-' as Over", () => {
      const bet: Bet = {
        id: "test-line-minus",
        book: "FanDuel",
        betId: "ABC137",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        line: "3-", // Minus sign should not be treated as Over
      };

      const rows = betToFinalRows(bet);
      // "-" should not trigger Over detection
      expect(rows[0].Over).toBe("");
      expect(rows[0].Under).toBe("");
    });

    it("should handle lowercase 'over' in ou field (case-sensitive check)", () => {
      const bet: Bet = {
        id: "test-ou-lowercase",
        book: "FanDuel",
        betId: "ABC138",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        // @ts-expect-error - testing edge case with invalid value
        ou: "over", // Lowercase should not match
      };

      const rows = betToFinalRows(bet);
      // Lowercase "over" should not match, so should fall back to target check
      // Since no target with "+", should return blank
      expect(rows[0].Over).toBe("");
      expect(rows[0].Under).toBe("");
    });

    it("should handle empty string in ou field", () => {
      const bet: Bet = {
        id: "test-ou-empty",
        book: "FanDuel",
        betId: "ABC139",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        line: "25.5",
        // @ts-expect-error - testing edge case with invalid value
        ou: "", // Empty string should not match
      };

      const rows = betToFinalRows(bet);
      // Empty string should not match, so should fall back to target check
      // Since no target with "+", should return blank
      expect(rows[0].Over).toBe("");
      expect(rows[0].Under).toBe("");
    });

    it("should handle line with '+' when ou is not provided", () => {
      const bet: Bet = {
        id: "test-line-plus-only",
        book: "FanDuel",
        betId: "ABC140",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        line: "3+", // Should trigger Over detection
      };

      const rows = betToFinalRows(bet);
      // Line with "+" should trigger Over detection
      expect(rows[0].Over).toBe("1");
      expect(rows[0].Under).toBe("0");
    });
  });

  describe("betType should never appear in Type field", () => {
    it("should not use betType=single in Type field", () => {
      const bet: Bet = {
        id: "test-14",
        book: "FanDuel",
        betId: "ABC136",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Test",
        name: "Player",
        odds: 100,
        stake: 1.0,
        payout: 0,
        result: "pending",
        type: "Pts",
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Type).not.toBe("single");
      expect(rows[0].Type).toBe("Pts");
    });

    it("should not use betType=parlay in Type field", () => {
      const bet: Bet = {
        id: "test-15",
        book: "FanDuel",
        betId: "ABC137",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "parlay",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "Parlay",
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: "pending",
        legs: [
          {
            entities: ["Player A"],
            market: "Pts",
            target: "25.5",
            result: "pending",
          },
        ],
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Type).not.toBe("parlay");
      expect(rows[0].Type).toBe("Pts");
    });

    it("should not use betType=sgp in Type field", () => {
      const bet: Bet = {
        id: "test-16",
        book: "FanDuel",
        betId: "ABC138",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "sgp",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "SGP",
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: "pending",
        legs: [
          {
            entities: ["Player A"],
            market: "Reb",
            target: "10.5",
            result: "pending",
          },
        ],
      };

      const rows = betToFinalRows(bet);
      expect(rows[0].Type).not.toBe("sgp");
      expect(rows[0].Type).toBe("Reb");
    });
  });

  describe("parlay metadata", () => {
    it("should set all metadata to null/false for single bets", () => {
      const bet: Bet = {
        id: "single-1",
        book: "FanDuel",
        betId: "SINGLE123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Single bet",
        name: "Player",
        odds: 200,
        stake: 10.0,
        payout: 30.0,
        result: "win",
        type: "Pts",
        line: "25.5",
        ou: "Over",
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(1);
      expect(rows[0]._parlayGroupId).toBeNull();
      expect(rows[0]._legIndex).toBeNull();
      expect(rows[0]._legCount).toBeNull();
      expect(rows[0]._isParlayHeader).toBe(false);
      expect(rows[0]._isParlayChild).toBe(false);
    });

    it("should set correct metadata for 2-leg parlay", () => {
      const bet: Bet = {
        id: "parlay-2leg",
        book: "FanDuel",
        betId: "PARLAY123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "parlay",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "2-leg parlay",
        odds: 300,
        stake: 20.0,
        payout: 80.0,
        result: "win",
        legs: [
          {
            entities: ["Player A"],
            market: "Pts",
            target: "25.5",
            ou: "Over",
            result: "win",
          },
          {
            entities: ["Player B"],
            market: "Reb",
            target: "10.5",
            ou: "Over",
            result: "win",
          },
        ],
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(3); // Header + 2 legs

      // Header row
      expect(rows[0]._parlayGroupId).toBe("parlay-2leg");
      expect(rows[0]._legIndex).toBeNull();
      expect(rows[0]._legCount).toBe(2);
      expect(rows[0]._isParlayHeader).toBe(true);
      expect(rows[0]._isParlayChild).toBe(false);
      expect(rows[0].Name).toBe("Parlay (2)");
      expect(rows[0].Category).toBe("Parlays");
      expect(rows[0].Type).toBe("Parlay");
      expect(rows[0].Odds).toBe("+300");
      expect(rows[0].Bet).toBe("$20.00");
      expect(rows[0]["To Win"]).toBe("$80.00");
      expect(rows[0].Net).toBe("60.00");
      expect(rows[0].Result).toBe("Win"); // bet.result

      // First leg row
      expect(rows[1]._parlayGroupId).toBe("parlay-2leg");
      expect(rows[1]._legIndex).toBe(1);
      expect(rows[1]._legCount).toBeNull();
      expect(rows[1]._isParlayHeader).toBe(false);
      expect(rows[1]._isParlayChild).toBe(true);
      expect(rows[1].Name).toBe("Player A");
      expect(rows[1].Odds).toBe("");
      expect(rows[1].Bet).toBe("");
      expect(rows[1]["To Win"]).toBe("");
      expect(rows[1].Net).toBe("");
      expect(rows[1].Result).toBe("Win"); // leg.result

      // Second leg row
      expect(rows[2]._parlayGroupId).toBe("parlay-2leg");
      expect(rows[2]._legIndex).toBe(2);
      expect(rows[2]._legCount).toBeNull();
      expect(rows[2]._isParlayHeader).toBe(false);
      expect(rows[2]._isParlayChild).toBe(true);
      expect(rows[2].Name).toBe("Player B");
      expect(rows[2].Odds).toBe("");
      expect(rows[2].Bet).toBe("");
      expect(rows[2]["To Win"]).toBe("");
      expect(rows[2].Net).toBe("");
      expect(rows[2].Result).toBe("Win"); // leg.result
    });

    it("should set correct metadata for 4+ leg parlay", () => {
      const bet: Bet = {
        id: "parlay-4leg",
        book: "DraftKings",
        betId: "PARLAY456",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "sgp",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "4-leg SGP",
        odds: 1500,
        stake: 5.0,
        payout: 0,
        result: "loss",
        legs: [
          {
            entities: ["Player A"],
            market: "Pts",
            target: "25.5",
            ou: "Over",
            result: "win",
          },
          {
            entities: ["Player B"],
            market: "Reb",
            target: "10.5",
            ou: "Over",
            result: "win",
          },
          {
            entities: ["Player C"],
            market: "Ast",
            target: "8.5",
            ou: "Over",
            result: "loss",
          },
          {
            entities: ["Player D"],
            market: "3pt",
            target: "3+",
            result: "win",
          },
        ],
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(5); // Header + 4 legs

      // All rows share same parlayGroupId
      rows.forEach((row) => {
        expect(row._parlayGroupId).toBe("parlay-4leg");
      });

      // Header row
      expect(rows[0]._legIndex).toBeNull();
      expect(rows[0]._legCount).toBe(4);
      expect(rows[0]._isParlayHeader).toBe(true);
      expect(rows[0]._isParlayChild).toBe(false);
      expect(rows[0].Name).toBe("SGP (4)");
      expect(rows[0].Category).toBe("Parlays");
      expect(rows[0].Type).toBe("SGP");
      expect(rows[0].Odds).toBe("+1500");
      expect(rows[0].Bet).toBe("$5.00");
      expect(rows[0].Result).toBe("Loss"); // bet.result

      // Child rows (all 4 legs)
      for (let i = 1; i < 5; i++) {
        expect(rows[i]._legIndex).toBe(i);
        expect(rows[i]._legCount).toBeNull();
        expect(rows[i]._isParlayHeader).toBe(false);
        expect(rows[i]._isParlayChild).toBe(true);
        expect(rows[i].Odds).toBe("");
        expect(rows[i].Bet).toBe("");
        expect(rows[i]["To Win"]).toBe("");
        expect(rows[i].Net).toBe("");
      }

      // Results: header shows bet.result, children show leg.result
      expect(rows[0].Result).toBe("Loss"); // bet.result
      expect(rows[1].Result).toBe("Win"); // leg 0 result
      expect(rows[2].Result).toBe("Win"); // leg 1 result
      expect(rows[3].Result).toBe("Loss"); // leg 2 result
      expect(rows[4].Result).toBe("Win"); // leg 3 result

      // Verify all legs are shown
      expect(rows[1].Name).toBe("Player A");
      expect(rows[2].Name).toBe("Player B");
      expect(rows[3].Name).toBe("Player C");
      expect(rows[4].Name).toBe("Player D");
    });

    it("should have consistent parlayGroupId across all legs", () => {
      const bet: Bet = {
        id: "consistent-id",
        book: "FanDuel",
        betId: "CONSISTENT",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "parlay",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "3-leg parlay",
        odds: 500,
        stake: 10.0,
        payout: 0,
        result: "pending",
        legs: [
          { entities: ["A"], market: "Pts", result: "pending" },
          { entities: ["B"], market: "Reb", result: "pending" },
          { entities: ["C"], market: "Ast", result: "pending" },
        ],
      };

      const rows = betToFinalRows(bet);

      expect(rows).toHaveLength(4); // Header + 3 legs
      const groupId = rows[0]._parlayGroupId;
      expect(groupId).toBe("consistent-id");
      rows.forEach((row) => {
        expect(row._parlayGroupId).toBe(groupId);
      });
    });
  });

  // NOTE: Leg deduplication tests have been moved to parsing/draftkings/tests/parlay-deduplication.test.ts
  // and parsing/fanduel/tests/parlay-deduplication.test.ts since deduplication now happens in the parser layer.
  // betToFinalRows trusts parsers to output deduplicated legs.

  // ===========================================================================
  // PG-1 / INV-3: Pending bet net behavior (Phase 2B enforcement)
  // ===========================================================================
  describe("PG-1 / INV-3: pending net behavior", () => {
    it("should output blank Net for pending single bet (not '0', not '-stake')", () => {
      const pendingBet: Bet = {
        id: "pending-net-test",
        book: "FanDuel",
        betId: "PENDING123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Pending bet",
        name: "Player",
        odds: 200,
        stake: 10.0,
        payout: 0,
        result: "pending",
      };

      const rows = betToFinalRows(pendingBet);

      expect(rows).toHaveLength(1);
      // Net MUST be blank string, NOT "0" and NOT "-10.00"
      expect(rows[0].Net).toBe("");
      // Raw net MUST be undefined (not 0 and not -10)
      expect(rows[0]._rawNet).toBeUndefined();
    });

    it("should output numeric Net for settled win (payout - stake)", () => {
      const winBet: Bet = {
        id: "win-net-test",
        book: "FanDuel",
        betId: "WIN123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Win bet",
        name: "Player",
        odds: 200,
        stake: 10.0,
        payout: 30.0,
        result: "win",
      };

      const rows = betToFinalRows(winBet);

      expect(rows).toHaveLength(1);
      // Net should be 30 - 10 = 20
      expect(rows[0].Net).toBe("20.00");
      expect(rows[0]._rawNet).toBe(20);
    });

    it("should output negative Net for settled loss (-stake)", () => {
      const lossBet: Bet = {
        id: "loss-net-test",
        book: "FanDuel",
        betId: "LOSS123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Loss bet",
        name: "Player",
        odds: 200,
        stake: 10.0,
        payout: 0,
        result: "loss",
      };

      const rows = betToFinalRows(lossBet);

      expect(rows).toHaveLength(1);
      // Net should be 0 - 10 = -10
      expect(rows[0].Net).toBe("-10.00");
      expect(rows[0]._rawNet).toBe(-10);
    });

    it("should output zero Net for push (payout - stake = 0)", () => {
      const pushBet: Bet = {
        id: "push-net-test",
        book: "FanDuel",
        betId: "PUSH123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "single",
        marketCategory: "Props",
        sport: "NBA",
        description: "Push bet",
        name: "Player",
        odds: -110,
        stake: 10.0,
        payout: 10.0,
        result: "push",
      };

      const rows = betToFinalRows(pushBet);

      expect(rows).toHaveLength(1);
      // Net should be 10 - 10 = 0
      expect(rows[0].Net).toBe("0.00");
      expect(rows[0]._rawNet).toBe(0);
    });

    it("should output blank Net for pending parlay header", () => {
      const pendingParlay: Bet = {
        id: "pending-parlay-net-test",
        book: "FanDuel",
        betId: "PPARLAY123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "parlay",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "Pending parlay",
        odds: 500,
        stake: 10.0,
        payout: 0,
        result: "pending",
        legs: [
          { entities: ["Player A"], market: "Pts", result: "pending" },
          { entities: ["Player B"], market: "Reb", result: "pending" },
        ],
      };

      const rows = betToFinalRows(pendingParlay);

      // Header + 2 legs
      expect(rows).toHaveLength(3);
      // Header Net should be blank for pending
      expect(rows[0].Net).toBe("");
      expect(rows[0]._rawNet).toBeUndefined();
      // Child legs always have blank Net
      expect(rows[1].Net).toBe("");
      expect(rows[2].Net).toBe("");
    });
  });
});

