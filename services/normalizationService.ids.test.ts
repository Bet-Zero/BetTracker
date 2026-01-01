
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateTeamId,
  getTeamById,
  initializeLookupMaps,
  NORMALIZATION_STORAGE_KEYS,
  TeamData,
} from "./normalizationService";

describe("normalizationService - Team IDs", () => {
  describe("generateTeamId", () => {
    it("should use the first abbreviation if available", () => {
      expect(generateTeamId("NBA", ["LAL", "LAK"], "Lakers")).toBe("NBA:LAL");
      expect(generateTeamId("NFL", ["NYG"], "Giants")).toBe("NFL:NYG");
    });

    it("should derive ID from canonical if no abbreviations", () => {
      // Logic: remove non-alphanumeric, uppercase, slice 6
      expect(generateTeamId("NBA", [], "Lakers")).toBe("NBA:LAKERS");
      expect(generateTeamId("NBA", [], "Los Angeles Lakers")).toBe("NBA:LOSANG");
    });
  });

  describe("getTeamById", () => {
    beforeEach(() => {
      vi.resetModules();
      localStorage.clear();
      // Reset module state if possible, but since it's a singleton, we rely on re-initialization
    });

    it("should find a team by its ID", () => {
      const team: TeamData = {
        canonical: "Lakers",
        sport: "NBA",
        abbreviations: ["LAL"],
        aliases: [],
        id: "NBA:LAL",
      };

      // Mock storage
      localStorage.setItem(
        NORMALIZATION_STORAGE_KEYS.TEAMS,
        JSON.stringify([team])
      );

      // Re-init
      initializeLookupMaps();

      const found = getTeamById("NBA:LAL");
      expect(found).toBeDefined();
      expect(found?.canonical).toBe("Lakers");
    });

    it("should return undefined for missing ID", () => {
        initializeLookupMaps();
        expect(getTeamById("MISSING:ID")).toBeUndefined();
    });
  });
});
