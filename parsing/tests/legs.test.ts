import { describe, expect, it } from "vitest";
import type { BetLeg } from "../../types";
import { collectLeafLegs } from "../utils/legs";

describe("collectLeafLegs", () => {
  it("returns single leg when not grouped", () => {
    const leg: BetLeg = { market: "Pts", target: "25+", result: "pending" };

    expect(collectLeafLegs(leg)).toEqual([leg]);
  });

  it("flattens nested group legs recursively", () => {
    const childA: BetLeg = { market: "Pts", target: "20+", result: "pending" };
    const childB: BetLeg = { market: "Ast", target: "4+", result: "pending" };
    const childGroup: BetLeg = {
      market: "2 Pick SGP",
      isGroupLeg: true,
      children: [childA, childB],
      result: "pending",
    };
    const parent: BetLeg = {
      market: "Parlay",
      isGroupLeg: true,
      children: [childGroup],
      result: "pending",
    };

    expect(collectLeafLegs(parent)).toEqual([childA, childB]);
  });
});
