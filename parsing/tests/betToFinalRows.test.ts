import { describe, it, expect } from "vitest";
import { betToFinalRows } from "../shared/betToFinalRows";
import { Bet } from "../../types";

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
      expect(rows[0]).toEqual({
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
        Bet: "1.00",
        "To Win": "4.60",
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
        marketCategory: "SGP/SGP+",
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
      expect(rows[0].Type).toBe("");
      expect(rows[0]._parlayGroupId).toBe("sgp-1");
      expect(rows[0]._legIndex).toBeNull();
      expect(rows[0]._legCount).toBe(2);
      expect(rows[0]._isParlayHeader).toBe(true);
      expect(rows[0]._isParlayChild).toBe(false);
      expect(rows[0].Bet).toBe("5.00");
      expect(rows[0].Odds).toBe("+500");
      expect(rows[0]["To Win"]).toBe("30.00");
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
        marketCategory: "SGP/SGP+",
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
      expect(rows[0].Bet).toBe("10.00");
      expect(rows[1].Bet).toBe("");
      expect(rows[2].Bet).toBe("");

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
        marketCategory: "SGP/SGP+",
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
        marketCategory: "SGP/SGP+",
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
      expect(rows[0].Type).toBe("");
      expect(rows[0].Odds).toBe("+300");
      expect(rows[0].Bet).toBe("20.00");
      expect(rows[0]["To Win"]).toBe("80.00");
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
        marketCategory: "SGP/SGP+",
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
      expect(rows[0].Type).toBe("");
      expect(rows[0].Odds).toBe("+1500");
      expect(rows[0].Bet).toBe("5.00");
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
        marketCategory: "SGP/SGP+",
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

  describe("duplicate leg removal", () => {
    it("should remove duplicate legs where one has a target and another doesn't", () => {
      const bet: Bet = {
        id: "sgp-plus-duplicates",
        book: "FanDuel",
        betId: "SGP+123",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "sgp_plus",
        marketCategory: "SGP/SGP+",
        sport: "NBA",
        description: "SGP+ with duplicates",
        odds: 5000,
        stake: 5.0,
        payout: 0,
        result: "loss",
        legs: [
          {
            isGroupLeg: true,
            market: "Same Game Parlay",
            children: [
              {
                entities: ["Luka Doncic"],
                market: "TD",
                target: "+410",
                ou: "Over",
                result: "loss",
              },
              {
                entities: ["Deni Avdija"],
                market: "TD",
                target: "+1200",
                ou: "Over",
                result: "loss",
              },
            ],
          },
          // Duplicate legs without target values (simulating parser issue)
          {
            entities: ["Luka Doncic"],
            market: "TD",
            ou: "Over",
            result: "loss",
          },
          {
            entities: ["Deni Avdija"],
            market: "TD",
            ou: "Over",
            result: "loss",
          },
        ],
      };

      const rows = betToFinalRows(bet);

      // Should have header + 2 unique legs (duplicates removed)
      expect(rows).toHaveLength(3); // Header + 2 legs

      // Header row
      expect(rows[0].Name).toBe("SGP+ (2)");
      expect(rows[0]._isParlayHeader).toBe(true);

      // Check that we have exactly one row for each player
      const lukaRows = rows.filter((r) => r.Name === "Luka Doncic");
      const deniRows = rows.filter((r) => r.Name === "Deni Avdija");

      expect(lukaRows).toHaveLength(1);
      expect(deniRows).toHaveLength(1);

      // Verify the kept leg has the target value (prefer leg with target)
      const lukaRow = lukaRows[0];
      expect(lukaRow.Line).toBe("+410");
      expect(lukaRow.Type).toBe("TD");
      expect(lukaRow.Over).toBe("1");

      const deniRow = deniRows[0];
      expect(deniRow.Line).toBe("+1200");
      expect(deniRow.Type).toBe("TD");
      expect(deniRow.Over).toBe("1");
    });

    it("should remove duplicate legs in regular SGP bets", () => {
      const bet: Bet = {
        id: "sgp-duplicates",
        book: "FanDuel",
        betId: "SGP456",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "sgp",
        marketCategory: "SGP/SGP+",
        sport: "NBA",
        description: "SGP with duplicates",
        odds: 3000,
        stake: 10.0,
        payout: 0,
        result: "loss",
        legs: [
          {
            isGroupLeg: true,
            market: "Same Game Parlay",
            children: [
              {
                entities: ["Jalen Johnson"],
                market: "TD",
                target: "+500",
                ou: "Over",
                result: "loss",
              },
              {
                entities: ["Cade Cunningham"],
                market: "TD",
                target: "+600",
                ou: "Over",
                result: "loss",
              },
              // Duplicate of first leg without target
              {
                entities: ["Jalen Johnson"],
                market: "TD",
                ou: "Over",
                result: "loss",
              },
            ],
          },
        ],
      };

      const rows = betToFinalRows(bet);

      // Should have header + 2 unique legs (duplicate removed)
      expect(rows).toHaveLength(3); // Header + 2 legs

      const jalenRows = rows.filter((r) => r.Name === "Jalen Johnson");
      const cadeRows = rows.filter((r) => r.Name === "Cade Cunningham");

      expect(jalenRows).toHaveLength(1);
      expect(cadeRows).toHaveLength(1);

      // Verify kept leg has target value
      expect(jalenRows[0].Line).toBe("+500");
      expect(cadeRows[0].Line).toBe("+600");
    });

    it("should prefer leg with target when existing leg doesn't have target", () => {
      const bet: Bet = {
        id: "sgp-reverse-merge",
        book: "FanDuel",
        betId: "SGP999",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "sgp",
        marketCategory: "SGP/SGP+",
        sport: "NBA",
        description: "SGP with leg without target first, then with target",
        odds: 1500,
        stake: 3.0,
        payout: 0,
        result: "loss",
        legs: [
          {
            isGroupLeg: true,
            market: "Same Game Parlay",
            children: [
              {
                entities: ["Stephen Curry"],
                market: "Pts",
                // No target - simulating parser issue
                ou: "Over",
                result: "loss",
              },
              {
                entities: ["Klay Thompson"],
                market: "3pt",
                // No target
                ou: "Over",
                result: "loss",
              },
            ],
          },
          // Later legs with targets (should be preferred)
          {
            entities: ["Stephen Curry"],
            market: "Pts",
            target: "28.5",
            ou: "Over",
            result: "win",
          },
          {
            entities: ["Klay Thompson"],
            market: "3pt",
            target: "4.5",
            ou: "Over",
            result: "win",
          },
        ],
      };

      const rows = betToFinalRows(bet);

      // Should have header + 2 unique legs (duplicates merged, preferring legs with targets)
      expect(rows).toHaveLength(3); // Header + 2 legs

      const curryRows = rows.filter((r) => r.Name === "Stephen Curry");
      const klayRows = rows.filter((r) => r.Name === "Klay Thompson");

      expect(curryRows).toHaveLength(1);
      expect(klayRows).toHaveLength(1);

      // Verify kept legs have target values (prefer leg with target)
      expect(curryRows[0].Line).toBe("28.5");
      expect(curryRows[0].Type).toBe("Pts");
      expect(curryRows[0].Over).toBe("1");
      expect(curryRows[0].Result).toBe("Win"); // Should prefer result from leg with target

      expect(klayRows[0].Line).toBe("4.5");
      expect(klayRows[0].Type).toBe("3pt");
      expect(klayRows[0].Over).toBe("1");
      expect(klayRows[0].Result).toBe("Win"); // Should prefer result from leg with target
    });

    it("should handle duplicates where both legs have different target values", () => {
      const bet: Bet = {
        id: "sgp-different-targets",
        book: "FanDuel",
        betId: "SGP789",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "sgp",
        marketCategory: "SGP/SGP+",
        sport: "NBA",
        description: "SGP with different targets",
        odds: 2000,
        stake: 5.0,
        payout: 0,
        result: "loss",
        legs: [
          {
            isGroupLeg: true,
            market: "Same Game Parlay",
            children: [
              {
                entities: ["Player A"],
                market: "Pts",
                target: "25.5",
                ou: "Over",
                result: "loss",
              },
              {
                entities: ["Player A"],
                market: "Pts",
                target: "30.5",
                ou: "Over",
                result: "loss",
              },
            ],
          },
        ],
      };

      const rows = betToFinalRows(bet);

      // When both have different target values, they should be kept as separate legs
      // (they're different bets, not duplicates)
      expect(rows.length).toBe(3); // Header + 2 legs

      const playerARows = rows.filter((r) => r.Name === "Player A");
      // Both should be kept since they have different targets
      expect(playerARows.length).toBe(2); // Both Player A legs are present
    });

    it("should handle legs when both have no targets (exact match merge)", () => {
      const bet: Bet = {
        id: "sgp-no-targets",
        book: "FanDuel",
        betId: "SGP888",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "sgp",
        marketCategory: "SGP/SGP+",
        sport: "NBA",
        description: "SGP with duplicate legs without targets",
        odds: 1000,
        stake: 2.0,
        payout: 0,
        result: "loss",
        legs: [
          {
            isGroupLeg: true,
            market: "Same Game Parlay",
            children: [
              {
                entities: ["Player X"],
                market: "Reb",
                // No target
                ou: "Over",
                result: "loss",
              },
              {
                entities: ["Player X"],
                market: "Reb",
                // No target - exact duplicate (same exact key)
                ou: "Over",
                result: "win", // Different result, but should merge via exact match
              },
            ],
          },
        ],
      };

      const rows = betToFinalRows(bet);

      // When both have no targets and same exact key, they merge via exact match logic
      // After merge, only 1 leg remains, so no parlay header is created (headers only for >1 leg)
      expect(rows).toHaveLength(1); // Just 1 leg (no header since only 1 leg after merge)

      const playerXRows = rows.filter((r) => r.Name === "Player X");
      expect(playerXRows).toHaveLength(1);
      // When merging exact duplicates, prefer Win > Loss > Push > Pending
      expect(playerXRows[0].Result).toBe("Win");
      // Should not be a parlay since only 1 leg
      expect(playerXRows[0].Category).not.toBe("Parlays");
      expect(playerXRows[0]._isParlayHeader).toBe(false);
      expect(playerXRows[0]._isParlayChild).toBe(false);
    });

    it.each([
      ["win", "pending", "Win"],
      ["win", "loss", "Win"],
      ["win", "push", "Win"],
      ["loss", "pending", "Loss"],
      ["loss", "push", "Loss"],
      ["push", "pending", "Push"],
      // Reverse order to verify order independence
      ["pending", "win", "Win"],
      ["loss", "win", "Win"],
      ["pending", "loss", "Loss"],
    ])(
      "should prefer %s over %s when merging exact duplicates, resulting in %s",
      (result1, result2, expectedResult) => {
        const bet: Bet = {
          id: `sgp-${result1}-${result2}`,
          book: "FanDuel",
          betId: `SGP-${result1}-${result2}`,
          placedAt: "2024-11-18T19:00:00.000Z",
          betType: "sgp",
          marketCategory: "SGP/SGP+",
          sport: "NBA",
          description: `SGP with duplicate legs - ${result1} and ${result2}`,
          odds: 1000,
          stake: 2.0,
          payout: 0,
          result: "pending",
          legs: [
            {
              isGroupLeg: true,
              market: "Same Game Parlay",
              children: [
                {
                  entities: ["Player Test"],
                  market: "Pts",
                  ou: "Over",
                  result: result2 as "win" | "loss" | "push" | "pending",
                },
                {
                  entities: ["Player Test"],
                  market: "Pts",
                  ou: "Over",
                  result: result1 as "win" | "loss" | "push" | "pending",
                },
              ],
            },
          ],
        };

        const rows = betToFinalRows(bet);
        expect(rows).toHaveLength(1);

        const playerRows = rows.filter((r) => r.Name === "Player Test");
        expect(playerRows).toHaveLength(1);
        // When merging exact duplicates, prefer Win > Loss > Push > Pending
        expect(playerRows[0].Result).toBe(expectedResult);
        expect(playerRows[0].Category).not.toBe("Parlays");
      }
    );
        expect(playerRows[0].Result).toBe(expectedResult);
        expect(playerRows[0].Category).not.toBe("Parlays");
      }
    );
  });

  describe("deduplication edge cases", () => {
    it("should merge leg with target and leg without target, preferring the one with target", () => {
      const bet: Bet = {
        id: "dedup-1",
        book: "FanDuel",
        betId: "DEDUP1",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "parlay",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "Parlay with leg that has target and one without",
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: "pending",
        legs: [
          {
            entities: ["LeBron James"],
            market: "Pts",
            // No target
            ou: "Over",
            result: "pending",
          },
          {
            entities: ["LeBron James"],
            market: "Pts",
            target: "25.5", // Has target
            ou: "Over",
            result: "pending",
          },
        ],
      };

      const rows = betToFinalRows(bet);
      // Should merge into one leg with target
      const legRows = rows.filter((r) => r.Name === "LeBron James");
      expect(legRows).toHaveLength(1);
      expect(legRows[0].Line).toBe("25.5");
      expect(legRows[0].Over).toBe("1");
    });

    it("should keep separate legs when multiple different targets share the same loose key", () => {
      const bet: Bet = {
        id: "dedup-2",
        book: "FanDuel",
        betId: "DEDUP2",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "parlay",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "Parlay with same player/market but different targets",
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: "pending",
        legs: [
          {
            entities: ["Stephen Curry"],
            market: "Pts",
            target: "25.5",
            ou: "Over",
            result: "pending",
          },
          {
            entities: ["Stephen Curry"],
            market: "Pts",
            target: "30.5", // Different target
            ou: "Over",
            result: "pending",
          },
        ],
      };

      const rows = betToFinalRows(bet);
      // Should keep both legs as separate (they have different targets)
      const curryRows = rows.filter((r) => r.Name === "Stephen Curry");
      expect(curryRows).toHaveLength(2);
      const lines = curryRows.map((r) => r.Line).sort();
      expect(lines).toEqual(["25.5", "30.5"]);
    });

    it("should treat target of 0 as present (not empty)", () => {
      const bet: Bet = {
        id: "dedup-3",
        book: "FanDuel",
        betId: "DEDUP3",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "parlay",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "Parlay with target of 0",
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: "pending",
        legs: [
          {
            entities: ["Player Zero"],
            market: "Pts",
            target: 0, // Numeric 0
            ou: "Over",
            result: "pending",
          },
          {
            entities: ["Player Zero"],
            market: "Pts",
            // No target
            ou: "Over",
            result: "pending",
          },
        ],
      };

      const rows = betToFinalRows(bet);
      // Should merge, preferring the leg with target (0 is a valid target)
      const playerRows = rows.filter((r) => r.Name === "Player Zero");
      expect(playerRows).toHaveLength(1);
      expect(playerRows[0].Line).toBe("0");
    });

    it("should treat target of '0' as present (not empty)", () => {
      const bet: Bet = {
        id: "dedup-4",
        book: "FanDuel",
        betId: "DEDUP4",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "parlay",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "Parlay with target of '0'",
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: "pending",
        legs: [
          {
            entities: ["Player ZeroStr"],
            market: "Pts",
            target: "0", // String "0"
            ou: "Over",
            result: "pending",
          },
          {
            entities: ["Player ZeroStr"],
            market: "Pts",
            // No target
            ou: "Over",
            result: "pending",
          },
        ],
      };

      const rows = betToFinalRows(bet);
      // Should merge, preferring the leg with target ("0" is a valid target)
      const playerRows = rows.filter((r) => r.Name === "Player ZeroStr");
      expect(playerRows).toHaveLength(1);
      expect(playerRows[0].Line).toBe("0");
    });

    it("should handle edge case where existing leg has target and new leg doesn't", () => {
      const bet: Bet = {
        id: "dedup-5",
        book: "FanDuel",
        betId: "DEDUP5",
        placedAt: "2024-11-18T19:00:00.000Z",
        betType: "parlay",
        marketCategory: "Parlays",
        sport: "NBA",
        description: "Parlay where existing has target, new doesn't",
        odds: 500,
        stake: 5.0,
        payout: 0,
        result: "pending",
        legs: [
          {
            entities: ["Player Existing"],
            market: "Reb",
            target: "10.5", // First leg has target
            ou: "Over",
            result: "win",
          },
          {
            entities: ["Player Existing"],
            market: "Reb",
            // Second leg has no target
            ou: "Over",
            result: "pending",
          },
        ],
      };

      const rows = betToFinalRows(bet);
      // Should merge, keeping the target from the first leg
      const playerRows = rows.filter((r) => r.Name === "Player Existing");
      expect(playerRows).toHaveLength(1);
      expect(playerRows[0].Line).toBe("10.5");
      // Should prefer win over pending
      expect(playerRows[0].Result).toBe("Win");
    });
  });
});
