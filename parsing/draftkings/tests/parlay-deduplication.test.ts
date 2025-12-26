import { describe, it, expect } from "vitest";
import { dedupeLegs } from "../parsers/common";
import { BetLeg } from "../../../types";

/**
 * Tests for DraftKings leg deduplication.
 * 
 * The dedupeLegs function handles:
 * - Exact duplicates (same entity/market/target/ou)
 * - Loose duplicates (same entity/market/ou, one with target, one without)
 * - Keeps legs with different targets as separate entries
 * - Merges results using priority: win > loss > push > pending
 */
describe("DraftKings dedupeLegs", () => {
  it("should remove exact duplicates", () => {
    const legs: BetLeg[] = [
      {
        entities: ["LeBron James"],
        market: "Pts",
        target: "25.5",
        ou: "Over",
        result: "win",
      },
      {
        entities: ["LeBron James"],
        market: "Pts",
        target: "25.5",
        ou: "Over",
        result: "pending",
      },
    ];

    const result = dedupeLegs(legs);

    expect(result).toHaveLength(1);
    expect(result[0].entities?.[0]).toBe("LeBron James");
    expect(result[0].target).toBe("25.5");
    // Should prefer win over pending
    expect(result[0].result).toBe("win");
  });

  it("should merge leg with target and leg without target", () => {
    const legs: BetLeg[] = [
      {
        entities: ["Stephen Curry"],
        market: "Pts",
        // No target
        ou: "Over",
        result: "pending",
      },
      {
        entities: ["Stephen Curry"],
        market: "Pts",
        target: "28.5",
        ou: "Over",
        result: "win",
      },
    ];

    const result = dedupeLegs(legs);

    expect(result).toHaveLength(1);
    expect(result[0].entities?.[0]).toBe("Stephen Curry");
    // Should have the target from the leg that has it
    expect(result[0].target).toBe("28.5");
    // Should prefer win over pending
    expect(result[0].result).toBe("win");
  });

  it("should keep legs with different targets as separate entries", () => {
    const legs: BetLeg[] = [
      {
        entities: ["Kevin Durant"],
        market: "Pts",
        target: "25.5",
        ou: "Over",
        result: "win",
      },
      {
        entities: ["Kevin Durant"],
        market: "Pts",
        target: "30.5",
        ou: "Over",
        result: "loss",
      },
    ];

    const result = dedupeLegs(legs);

    // Both should remain because they have different targets
    expect(result).toHaveLength(2);
    const targets = result.map((l) => l.target).sort();
    expect(targets).toEqual(["25.5", "30.5"]);
  });

  it("should prefer higher priority results when merging", () => {
    // Test win > loss
    const legsWinLoss: BetLeg[] = [
      {
        entities: ["Player A"],
        market: "Reb",
        ou: "Over",
        result: "loss",
      },
      {
        entities: ["Player A"],
        market: "Reb",
        ou: "Over",
        result: "win",
      },
    ];
    expect(dedupeLegs(legsWinLoss)[0].result).toBe("win");

    // Test win > push
    const legsWinPush: BetLeg[] = [
      {
        entities: ["Player B"],
        market: "Ast",
        ou: "Over",
        result: "push",
      },
      {
        entities: ["Player B"],
        market: "Ast",
        ou: "Over",
        result: "win",
      },
    ];
    expect(dedupeLegs(legsWinPush)[0].result).toBe("win");

    // Test loss > pending
    const legsLossPending: BetLeg[] = [
      {
        entities: ["Player C"],
        market: "3pt",
        ou: "Over",
        result: "pending",
      },
      {
        entities: ["Player C"],
        market: "3pt",
        ou: "Over",
        result: "loss",
      },
    ];
    expect(dedupeLegs(legsLossPending)[0].result).toBe("loss");
  });
});
