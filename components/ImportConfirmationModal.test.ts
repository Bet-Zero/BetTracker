import { describe, expect, it } from "vitest";
import {
  clearResolutionDecisionForField,
  clearResolutionDecisionsForBet,
  ResolutionDecisionMap,
} from "./ImportConfirmationModal";

describe("ImportConfirmationModal resolution decision invalidation", () => {
  it("clears only the edited Name/Type decision key", () => {
    const decisions: ResolutionDecisionMap = {
      "bet-1:Name:0": "defer",
      "bet-1:Type:0": "map",
      "bet-1:Name:1": "create",
      "bet-2:Name:0": "defer",
    };

    const result = clearResolutionDecisionForField(decisions, "bet-1", "Name", 0);

    expect(result).toEqual({
      "bet-1:Type:0": "map",
      "bet-1:Name:1": "create",
      "bet-2:Name:0": "defer",
    });
    expect(decisions["bet-1:Name:0"]).toBe("defer");
  });

  it("clears all decisions for a bet when sport changes", () => {
    const decisions: ResolutionDecisionMap = {
      "bet-1:Name:0": "defer",
      "bet-1:Type:0": "map",
      "bet-1:Name:1": "create",
      "bet-2:Name:0": "defer",
      "bet-3:Type:0": null,
    };

    const result = clearResolutionDecisionsForBet(decisions, "bet-1");

    expect(result).toEqual({
      "bet-2:Name:0": "defer",
      "bet-3:Type:0": null,
    });
    expect(decisions["bet-1:Type:0"]).toBe("map");
  });
});
