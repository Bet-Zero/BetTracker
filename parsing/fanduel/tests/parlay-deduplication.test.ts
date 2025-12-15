import { describe, it, expect } from "vitest";
import type { BetLeg } from "../../../../types";

// Helper functions that mirror the internal logic in parlay.ts
// These are used to test the deduplication behavior

/**
 * Normalizes a target value to a string for use in deduplication keys.
 * Converts numbers to strings, trims whitespace, and handles null/undefined/empty values.
 *
 * @param target - The target value to normalize (string, number, undefined, or null)
 * @returns Empty string for null/undefined/empty values, otherwise a trimmed string
 *
 * @example
 * normalizeTargetForKey("  over 2.5  ") // "over 2.5"
 * normalizeTargetForKey(2.5) // "2.5"
 * normalizeTargetForKey(undefined) // ""
 * normalizeTargetForKey(null) // ""
 * normalizeTargetForKey("") // ""
 */
const normalizeTargetForKey = (
  target: string | number | undefined | null
): string => {
  if (target === undefined || target === null || target === "") {
    return "";
  }
  return String(target).trim();
};

/**
 * Checks if a target value is empty after normalization.
 * Returns true for null, undefined, empty strings, or strings that normalize to empty.
 *
 * @param target - The target value to check (string, number, undefined, or null)
 * @returns True if the normalized target is empty, false otherwise
 *
 * @example
 * isTargetEmpty("  over 2.5  ") // false
 * isTargetEmpty(2.5) // false
 * isTargetEmpty(undefined) // true
 * isTargetEmpty(null) // true
 * isTargetEmpty("") // true
 * isTargetEmpty("   ") // true (whitespace-only strings normalize to empty)
 */
const isTargetEmpty = (target: string | number | undefined | null): boolean => {
  const normalized = normalizeTargetForKey(target);
  return normalized === "";
};

const legKeysLoose = (leg: BetLeg): string[] => {
  const entity = (leg.entities?.[0] || "").trim().toLowerCase();
  const market = (leg.market || "").trim().toLowerCase();
  const target = normalizeTargetForKey(leg.target);

  const keys: string[] = [];
  // Always add the full key (entity|market|target)
  keys.push([entity, market, target].join("|"));

  // If target is empty, also add a wildcard key (entity|market) that matches any target
  if (isTargetEmpty(leg.target)) {
    keys.push([entity, market].join("|"));
  }

  return keys;
};

// Helper to extract entity|market part from a BetLeg (lowercased)
// This mirrors the production logic for extracting the entity+market portion of keys
// Uses .trim() to match the test helper legKeysLoose behavior
const getEntityMarketPart = (leg: BetLeg): string => {
  const entity = (leg.entities?.[0] || "").trim().toLowerCase();
  const market = (leg.market || "").trim().toLowerCase();
  return [entity, market].join("|");
};

// Helper to check if a leg matches any key in a set, with wildcard support
// - For empty-target legs: checks if any of its keys (including wildcard) are in the set
// - For non-empty-target legs: checks if its full key is in the set, OR if its entity+market
//   matches any wildcard key in the set (to match empty-target legs)
const legMatchesKeySet = (leg: BetLeg, keySet: Set<string>): boolean => {
  const legKeys = legKeysLoose(leg);
  // Check if any of the leg's keys are in the set
  if (legKeys.some((key) => keySet.has(key))) {
    return true;
  }
  // For non-empty targets, also check if entity+market matches any wildcard key in the set
  // This allows non-empty-target legs to match empty-target legs
  if (!isTargetEmpty(leg.target)) {
    const entity = (leg.entities?.[0] || "").toLowerCase();
    const market = (leg.market || "").toLowerCase();
    const wildcardKey = [entity, market].join("|");
    if (keySet.has(wildcardKey)) {
      return true;
    }
  }
  // For empty targets, check if the wildcard key matches any full key's entity+market part
  // This allows empty-target legs to match non-empty-target legs
  if (isTargetEmpty(leg.target)) {
    const entity = (leg.entities?.[0] || "").toLowerCase();
    const market = (leg.market || "").toLowerCase();
    const wildcardKey = [entity, market].join("|");
    // Check if any key in the set starts with the wildcard key followed by "|"
    // (meaning it's a full key with the same entity+market)
    for (const key of keySet) {
      if (key === wildcardKey || key.startsWith(wildcardKey + "|")) {
        return true;
      }
    }
  }
  return false;
};

describe("Parlay leg deduplication with wildcard matching", () => {
  describe("legKeysLoose key generation", () => {
    it("should generate full key for leg with non-empty target", () => {
      const leg: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      expect(keys).toEqual(["player a|pts|25.5"]);
      expect(keys.length).toBe(1);
    });

    it("should generate full key and wildcard key for leg with empty target", () => {
      const leg: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      expect(keys).toContain("player a|pts|");
      expect(keys).toContain("player a|pts");
      expect(keys.length).toBe(2);
    });

    it("should generate full key and wildcard key for leg with undefined target", () => {
      const leg: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      expect(keys).toContain("player a|pts|");
      expect(keys).toContain("player a|pts");
      expect(keys.length).toBe(2);
    });

    it("should generate full key and wildcard key for leg with null target", () => {
      const leg: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: null,
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      expect(keys).toContain("player a|pts|");
      expect(keys).toContain("player a|pts");
      expect(keys.length).toBe(2);
    });

    it("should normalize numeric targets to the same string key as string targets", () => {
      const legWithNumericTarget: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: 25.5,
        result: "pending",
      };

      const legWithStringTarget: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const numericKeys = legKeysLoose(legWithNumericTarget);
      const stringKeys = legKeysLoose(legWithStringTarget);

      // Both should generate the same key
      expect(numericKeys).toEqual(stringKeys);
      expect(numericKeys[0]).toBe("player a|pts|25.5");
      expect(stringKeys[0]).toBe("player a|pts|25.5");
    });

    it("should normalize integer targets to the same string key as string targets", () => {
      const legWithIntegerTarget: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: 25,
        result: "pending",
      };

      const legWithStringTarget: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25",
        result: "pending",
      };

      const integerKeys = legKeysLoose(legWithIntegerTarget);
      const stringKeys = legKeysLoose(legWithStringTarget);

      expect(integerKeys).toEqual(stringKeys);
      expect(integerKeys[0]).toBe("player a|pts|25");
    });

    it("should produce the same lower-cased keys for entities in different cases", () => {
      const legUpperCase: BetLeg = {
        entities: ["PLAYER A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const legLowerCase: BetLeg = {
        entities: ["player a"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const legMixedCase: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const upperKeys = legKeysLoose(legUpperCase);
      const lowerKeys = legKeysLoose(legLowerCase);
      const mixedKeys = legKeysLoose(legMixedCase);

      // All should produce the same lower-cased key
      expect(upperKeys[0]).toBe("player a|pts|25.5");
      expect(lowerKeys[0]).toBe("player a|pts|25.5");
      expect(mixedKeys[0]).toBe("player a|pts|25.5");
      expect(upperKeys).toEqual(lowerKeys);
      expect(lowerKeys).toEqual(mixedKeys);
    });

    it("should produce the same lower-cased keys for markets in different cases", () => {
      const legUpperCase: BetLeg = {
        entities: ["Player A"],
        market: "PTS",
        target: "25.5",
        result: "pending",
      };

      const legLowerCase: BetLeg = {
        entities: ["Player A"],
        market: "pts",
        target: "25.5",
        result: "pending",
      };

      const legMixedCase: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const upperKeys = legKeysLoose(legUpperCase);
      const lowerKeys = legKeysLoose(legLowerCase);
      const mixedKeys = legKeysLoose(legMixedCase);

      // All should produce the same lower-cased key
      expect(upperKeys[0]).toBe("player a|pts|25.5");
      expect(lowerKeys[0]).toBe("player a|pts|25.5");
      expect(mixedKeys[0]).toBe("player a|pts|25.5");
      expect(upperKeys).toEqual(lowerKeys);
      expect(lowerKeys).toEqual(mixedKeys);
    });

    it("should trim whitespace from targets", () => {
      const legWithWhitespace: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "  25.5  ",
        result: "pending",
      };

      const legWithoutWhitespace: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const whitespaceKeys = legKeysLoose(legWithWhitespace);
      const cleanKeys = legKeysLoose(legWithoutWhitespace);

      // Both should produce the same trimmed key
      expect(whitespaceKeys).toEqual(cleanKeys);
      expect(whitespaceKeys[0]).toBe("player a|pts|25.5");
    });

    it("should handle entities with surrounding whitespace (lowercased but not trimmed)", () => {
      const legWithWhitespace: BetLeg = {
        entities: ["  Player A  "],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const legWithoutWhitespace: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const whitespaceKeys = legKeysLoose(legWithWhitespace);
      const cleanKeys = legKeysLoose(legWithoutWhitespace);

      // Entities are lowercased but not trimmed in legKeysLoose
      // So whitespace is preserved after lowercasing
      expect(whitespaceKeys[0]).toBe("  player a  |pts|25.5");
      expect(cleanKeys[0]).toBe("player a|pts|25.5");
      // They produce different keys because entity trimming isn't done
      expect(whitespaceKeys).not.toEqual(cleanKeys);
    });

    it("should handle empty market string", () => {
      const leg: BetLeg = {
        entities: ["Player A"],
        market: "",
        target: "25.5",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      expect(keys[0]).toBe("player a||25.5");
      expect(keys.length).toBe(1);
    });

    it("should handle undefined market", () => {
      const leg: BetLeg = {
        entities: ["Player A"],
        target: "25.5",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      expect(keys[0]).toBe("player a||25.5");
      expect(keys.length).toBe(1);
    });

    it("should handle empty market with empty target", () => {
      const leg: BetLeg = {
        entities: ["Player A"],
        market: "",
        target: "",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      expect(keys).toContain("player a||");
      expect(keys).toContain("player a|");
      expect(keys.length).toBe(2);
    });

    it("should handle undefined market with empty target", () => {
      const leg: BetLeg = {
        entities: ["Player A"],
        target: "",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      expect(keys).toContain("player a||");
      expect(keys).toContain("player a|");
      expect(keys.length).toBe(2);
    });

    it("should handle empty entities array", () => {
      const leg: BetLeg = {
        entities: [],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      // Empty entities array defaults first entity to "" so keys start with "|"
      expect(keys[0]).toBe("|pts|25.5");
      expect(keys.length).toBe(1);
    });

    it("should handle undefined entities", () => {
      const leg: BetLeg = {
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      // Undefined entities defaults first entity to "" so keys start with "|"
      expect(keys[0]).toBe("|pts|25.5");
      expect(keys.length).toBe(1);
    });

    it("should handle undefined entities with empty target", () => {
      const leg: BetLeg = {
        market: "Pts",
        target: "",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      // Undefined entities defaults first entity to "", same behavior as empty array
      expect(keys).toContain("|pts|");
      expect(keys).toContain("|pts");
      expect(keys.length).toBe(2);
    });

    it("should handle empty entities array with empty target", () => {
      const leg: BetLeg = {
        entities: [],
        market: "Pts",
        target: "",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      // Empty entities array defaults first entity to ""
      expect(keys).toContain("|pts|");
      expect(keys).toContain("|pts");
      expect(keys.length).toBe(2);
    });

    it("should handle multiple entities by using only the first entity", () => {
      const leg: BetLeg = {
        entities: ["Player A", "Player B"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      // Only the first entity should be used in generated keys
      expect(keys[0]).toBe("player a|pts|25.5");
      expect(keys.length).toBe(1);
    });

    it("should handle multiple entities with empty target by using only the first entity", () => {
      const leg: BetLeg = {
        entities: ["Player A", "Player B"],
        market: "Pts",
        target: "",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      // Only the first entity should be used in generated keys
      expect(keys).toContain("player a|pts|");
      expect(keys).toContain("player a|pts");
      expect(keys.length).toBe(2);
    });

    it("should handle empty-string entity", () => {
      const leg: BetLeg = {
        entities: [""],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      // Empty-string entity should produce keys with empty entity segment (leading "|")
      expect(keys[0]).toBe("|pts|25.5");
      expect(keys.length).toBe(1);
    });

    it("should handle empty-string entity with empty target", () => {
      const leg: BetLeg = {
        entities: [""],
        market: "Pts",
        target: "",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      // Empty-string entity should produce keys with empty entity segment (leading "|")
      expect(keys).toContain("|pts|");
      expect(keys).toContain("|pts");
      expect(keys.length).toBe(2);
    });

    it("should handle empty-string entity with empty market", () => {
      const leg: BetLeg = {
        entities: [""],
        market: "",
        target: "25.5",
        result: "pending",
      };

      const keys = legKeysLoose(leg);
      // Empty-string entity with empty market produces keys starting with "||"
      expect(keys[0]).toBe("||25.5");
      expect(keys.length).toBe(1);
    });
  });

  describe("wildcard matching behavior", () => {
    it("should match leg with empty target to leg with non-empty target", () => {
      const legWithEmptyTarget: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "",
        result: "pending",
      };

      const legWithTarget: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      // Build key sets and verify end-to-end matching logic
      const emptyKeySet = new Set<string>(legKeysLoose(legWithEmptyTarget));
      const targetKeySet = new Set<string>(legKeysLoose(legWithTarget));

      // The empty target leg should have a wildcard key matching the target leg's entity+market
      const targetEntityMarket = getEntityMarketPart(legWithTarget);
      expect(emptyKeySet.has(targetEntityMarket)).toBe(true);
      expect(targetEntityMarket).toBe("player a|pts");

      // They should match because the empty leg's wildcard key matches the target leg's entity+market
      // Empty target leg should match the target key set (via wildcard matching)
      expect(legMatchesKeySet(legWithEmptyTarget, targetKeySet)).toBe(true);
      // Target leg should match the empty key set (via wildcard matching)
      expect(legMatchesKeySet(legWithTarget, emptyKeySet)).toBe(true);
    });

    it("should match leg with non-empty target to leg with empty target", () => {
      const legWithTarget: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "50+",
        result: "pending",
      };

      const legWithEmptyTarget: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "",
        result: "pending",
      };

      // Build key sets and verify end-to-end matching logic
      const targetKeySet = new Set<string>(legKeysLoose(legWithTarget));
      const emptyKeySet = new Set<string>(legKeysLoose(legWithEmptyTarget));

      // The empty target leg has a wildcard key matching the target leg's entity+market
      const targetEntityMarket = getEntityMarketPart(legWithTarget);
      expect(emptyKeySet.has(targetEntityMarket)).toBe(true);

      // Target leg should match the empty key set (via wildcard matching)
      expect(legMatchesKeySet(legWithTarget, emptyKeySet)).toBe(true);
      // Empty target leg should match the target key set (via wildcard matching)
      expect(legMatchesKeySet(legWithEmptyTarget, targetKeySet)).toBe(true);
    });

    it("should not match legs with different entities", () => {
      const leg1: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "",
        result: "pending",
      };

      const leg2: BetLeg = {
        entities: ["Player B"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const keySet1 = new Set<string>(legKeysLoose(leg1));
      const keySet2 = new Set<string>(legKeysLoose(leg2));

      // They should not match because entities are different
      expect(legMatchesKeySet(leg1, keySet2)).toBe(false);
      expect(legMatchesKeySet(leg2, keySet1)).toBe(false);
    });

    it("should not match legs with different markets", () => {
      const leg1: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "",
        result: "pending",
      };

      const leg2: BetLeg = {
        entities: ["Player A"],
        market: "Reb",
        target: "10.5",
        result: "pending",
      };

      const keySet1 = new Set<string>(legKeysLoose(leg1));
      const keySet2 = new Set<string>(legKeysLoose(leg2));

      // They should not match because markets are different
      expect(legMatchesKeySet(leg1, keySet2)).toBe(false);
      expect(legMatchesKeySet(leg2, keySet1)).toBe(false);
    });

    it("should match legs with same entity and market when one has empty target", () => {
      const leg1: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "",
        result: "pending",
      };

      const leg2: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "50+",
        result: "pending",
      };

      const keySet1 = new Set<string>(legKeysLoose(leg1));
      const keySet2 = new Set<string>(legKeysLoose(leg2));

      // leg1 has wildcard key "player a|pts" (2 parts)
      // leg2 has full key "player a|pts|50+" (3 parts)
      // They should match because leg1's wildcard matches leg2's entity+market
      const leg2EntityMarket = getEntityMarketPart(leg2);
      expect(keySet1.has(leg2EntityMarket)).toBe(true);
      expect(leg2EntityMarket).toBe("player a|pts");

      // Verify end-to-end matching
      expect(legMatchesKeySet(leg1, keySet2)).toBe(true);
      expect(legMatchesKeySet(leg2, keySet1)).toBe(true);
    });

    it("should not match legs with different non-empty targets", () => {
      const leg1: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const leg2: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "50+",
        result: "pending",
      };

      const keySet1 = new Set<string>(legKeysLoose(leg1));
      const keySet2 = new Set<string>(legKeysLoose(leg2));

      // They should not match because both have non-empty but different targets
      // and neither has a wildcard key
      expect(legMatchesKeySet(leg1, keySet2)).toBe(false);
      expect(legMatchesKeySet(leg2, keySet1)).toBe(false);
    });
  });

  describe("deduplication set behavior", () => {
    it("should correctly identify duplicates using key sets", () => {
      // Simulate the deduplication logic used in parlay.ts
      const groupChild: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const extraLeg: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "", // Empty target should match the group child
        result: "pending",
      };

      // Build child keys set (as done in parlay.ts)
      const childKeys = new Set<string>();
      legKeysLoose(groupChild).forEach((key) => childKeys.add(key));

      // Check if extra leg is a duplicate (using the matching helper)
      const isDuplicate = legMatchesKeySet(extraLeg, childKeys);

      expect(isDuplicate).toBe(true);
    });

    it("should correctly identify non-duplicates", () => {
      const groupChild: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const extraLeg: BetLeg = {
        entities: ["Player B"], // Different entity
        market: "Pts",
        target: "",
        result: "pending",
      };

      const childKeys = new Set<string>();
      legKeysLoose(groupChild).forEach((key) => childKeys.add(key));

      const isDuplicate = legMatchesKeySet(extraLeg, childKeys);

      expect(isDuplicate).toBe(false);
    });

    it("should match when group child has empty target and extra leg has target", () => {
      const groupChild: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "", // Empty target in group child
        result: "pending",
      };

      const extraLeg: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "50+", // Non-empty target in extra leg
        result: "pending",
      };

      const childKeys = new Set<string>();
      legKeysLoose(groupChild).forEach((key) => childKeys.add(key));

      const isDuplicate = legMatchesKeySet(extraLeg, childKeys);

      // The group child's wildcard key "player a|pts" should match
      // the extra leg's entity+market "player a|pts"
      expect(isDuplicate).toBe(true);
    });

    it("should handle pipe character in entity names without delimiter collision", () => {
      // Test that entities containing pipe characters produce distinct keys
      // and deduplication still works correctly
      const groupChild: BetLeg = {
        entities: ["Player A|B"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const duplicateLeg: BetLeg = {
        entities: ["Player A|B"],
        market: "Pts",
        target: "25.5", // Same target - should be duplicate
        result: "pending",
      };

      const differentLeg: BetLeg = {
        entities: ["Player A|B"],
        market: "Pts",
        target: "30", // Different target - should not be duplicate
        result: "pending",
      };

      const childKeys = new Set<string>();
      legKeysLoose(groupChild).forEach((key) => childKeys.add(key));

      // Verify keys contain the pipe character from entity name
      const keys = legKeysLoose(groupChild);
      expect(keys.length).toBeGreaterThan(0);
      // The key should contain the pipe from the entity name
      expect(keys[0]).toContain("player a|b");
      expect(keys[0]).toContain("pts");
      expect(keys[0]).toContain("25.5");

      // Same entity+market+target should be identified as duplicate
      const isDuplicate = legMatchesKeySet(duplicateLeg, childKeys);
      expect(isDuplicate).toBe(true);

      // Different target should not be duplicate
      const isNotDuplicate = legMatchesKeySet(differentLeg, childKeys);
      expect(isNotDuplicate).toBe(false);
    });

    it("should demonstrate delimiter collision where pipe in entity name causes key collision", () => {
      // This test documents the delimiter collision bug where a pipe character in an entity name
      // can cause two different legs to produce identical keys.
      //
      // Leg 1: entities: ["Player A"], market: "B", target: ""
      //   produces keys: ["player a|b|", "player a|b"]
      // Leg 2: entities: ["Player A|B"], market: "", target: ""
      //   produces keys: ["player a|b||", "player a|b|"]
      //
      // The key "player a|b|" appears in both, causing a false positive match.
      const leg1: BetLeg = {
        entities: ["Player A"],
        market: "B",
        target: "",
        result: "pending",
      };

      const leg2: BetLeg = {
        entities: ["Player A|B"],
        market: "",
        target: "",
        result: "pending",
      };

      const keys1 = legKeysLoose(leg1);
      const keys2 = legKeysLoose(leg2);

      // Find the colliding key(s)
      const keys1Set = new Set(keys1);
      const keys2Set = new Set(keys2);
      const collidingKeys = keys1.filter((key) => keys2Set.has(key));

      // Assert that at least one key is identical (the collision)
      expect(collidingKeys.length).toBeGreaterThan(0);
      // The specific colliding key should be "player a|b|"
      expect(collidingKeys).toContain("player a|b|");

      // Assert that legMatchesKeySet reports leg2 as a duplicate when using leg1's key set
      // This documents the bug: leg2 should NOT be a duplicate of leg1, but the collision
      // causes it to be incorrectly identified as one
      const leg1KeySet = new Set<string>(keys1);
      const isLeg2Duplicate = legMatchesKeySet(leg2, leg1KeySet);
      expect(isLeg2Duplicate).toBe(true); // This is the bug: they're different legs but match
    });

    it("should treat zero (0) as a real target value, not a wildcard", () => {
      // Test that numeric zero is treated as a specific target, not empty/wildcard
      // Zero should produce only the exact key (no wildcard), but empty targets
      // can still match zero targets due to wildcard behavior
      const groupChild: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "0", // Zero as string target
        result: "pending",
      };

      const duplicateLeg: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "0", // Same zero target - should be duplicate
        result: "pending",
      };

      const differentTargetLeg: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "25.5", // Different non-zero target - should not be duplicate
        result: "pending",
      };

      const emptyTargetLeg: BetLeg = {
        entities: ["Player A"],
        market: "Pts",
        target: "", // Empty target - should match zero target (wildcard behavior)
        result: "pending",
      };

      const childKeys = new Set<string>();
      legKeysLoose(groupChild).forEach((key) => childKeys.add(key));

      // Verify zero produces exact key only, not wildcard (zero is a real value)
      const keys = legKeysLoose(groupChild);
      expect(keys.length).toBe(1); // Should only have one key (no wildcard for non-empty target)
      expect(keys[0]).toBe("player a|pts|0"); // Exact key with "0" as target

      // Same zero target should be identified as duplicate
      const isDuplicate = legMatchesKeySet(duplicateLeg, childKeys);
      expect(isDuplicate).toBe(true);

      // Different non-zero target should not be duplicate
      const isNotDuplicate = legMatchesKeySet(differentTargetLeg, childKeys);
      expect(isNotDuplicate).toBe(false);

      // Empty target should match zero target (empty is wildcard that matches any target)
      const emptyMatchesZero = legMatchesKeySet(emptyTargetLeg, childKeys);
      expect(emptyMatchesZero).toBe(true);

      // Reverse: zero target should also match empty target keys (bidirectional wildcard)
      const emptyKeys = new Set<string>();
      legKeysLoose(emptyTargetLeg).forEach((key) => emptyKeys.add(key));
      const zeroMatchesEmpty = legMatchesKeySet(groupChild, emptyKeys);
      expect(zeroMatchesEmpty).toBe(true);
    });

    it("should preserve Unicode characters in entity names for consistent deduplication", () => {
      // Test that Unicode/accented characters are preserved consistently
      // so deduplication works correctly with international names
      const groupChild: BetLeg = {
        entities: ["Müller"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const duplicateLeg: BetLeg = {
        entities: ["Müller"], // Same Unicode name - should be duplicate
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const differentEntityLeg: BetLeg = {
        entities: ["José"], // Different Unicode name - should not be duplicate
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const childKeys = new Set<string>();
      legKeysLoose(groupChild).forEach((key) => childKeys.add(key));

      // Verify Unicode characters are preserved in keys (lowercased)
      const keys = legKeysLoose(groupChild);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys[0]).toContain("müller"); // Unicode preserved, lowercased
      expect(keys[0]).toContain("pts");
      expect(keys[0]).toContain("25.5");

      // Same Unicode entity+market+target should be identified as duplicate
      const isDuplicate = legMatchesKeySet(duplicateLeg, childKeys);
      expect(isDuplicate).toBe(true);

      // Different Unicode entity should not be duplicate
      const isNotDuplicate = legMatchesKeySet(differentEntityLeg, childKeys);
      expect(isNotDuplicate).toBe(false);

      // Test with another Unicode name to ensure consistency
      const joseGroupChild: BetLeg = {
        entities: ["José"],
        market: "Pts",
        target: "25.5",
        result: "pending",
      };

      const joseKeys = new Set<string>();
      legKeysLoose(joseGroupChild).forEach((key) => joseKeys.add(key));

      const joseKeysArray = legKeysLoose(joseGroupChild);
      expect(joseKeysArray[0]).toContain("josé"); // Unicode preserved, lowercased
      expect(joseKeysArray[0]).toContain("pts");
      expect(joseKeysArray[0]).toContain("25.5");

      // José should match itself
      const joseIsDuplicate = legMatchesKeySet(differentEntityLeg, joseKeys);
      expect(joseIsDuplicate).toBe(true);
    });
  });
});
