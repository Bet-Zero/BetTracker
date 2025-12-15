import { describe, it, expect } from "vitest";
import { hasEntities } from "../parsers/common";

describe("hasEntities", () => {
  it("returns true when entities array has length > 0", () => {
    expect(hasEntities(["Player 1"])).toBe(true);
    expect(hasEntities(["Player 1", "Player 2"])).toBe(true);
    expect(hasEntities(["Single Entity"])).toBe(true);
  });

  it("returns false when entities is undefined", () => {
    expect(hasEntities(undefined)).toBe(false);
  });

  it("returns false when entities is null", () => {
    expect(hasEntities(null as any)).toBe(false);
  });

  it("returns false when entities is an empty array", () => {
    expect(hasEntities([])).toBe(false);
  });

  it("returns false when entities is not provided", () => {
    expect(hasEntities()).toBe(false);
  });
});
