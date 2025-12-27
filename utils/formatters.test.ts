import { describe, it, expect } from "vitest";
import {
  formatDateShort,
  formatDateChartKey,
  formatDateShortWithYear,
  formatOdds,
  formatCurrency,
  formatPercentage,
  formatNet,
} from "./formatters";

describe("utils/formatters", () => {
  describe("formatDateShort", () => {
    // Note: Using Date objects for deterministic tests; ISO strings may vary by timezone

    it("formats ISO string as MM/DD", () => {
      const date = new Date(2024, 11, 26, 12, 0, 0);
      expect(formatDateShort(date)).toBe("12/26");
    });

    it("handles ISO string in UTC", () => {
      const result = formatDateShort("2024-12-26T12:00:00Z");
      expect(result).toBe("12/26");
    });

    it("returns empty string for null/undefined", () => {
      expect(formatDateShort(null)).toBe("");
      expect(formatDateShort(undefined)).toBe("");
    });
  });

  describe("formatDateChartKey", () => {
    it("formats as YYYY-MM-DD", () => {
      const date = new Date(2024, 11, 26);
      expect(formatDateChartKey(date)).toBe("2024-12-26");
    });

    it("handles ISO string input", () => {
      expect(formatDateChartKey("2024-12-26T12:00:00")).toBe("2024-12-26");
    });

    it("returns empty string for null/undefined/invalid", () => {
      expect(formatDateChartKey(null)).toBe("");
      expect(formatDateChartKey(undefined)).toBe("");
      expect(formatDateChartKey("invalid-date")).toBe("");
    });
  });

  describe("formatDateShortWithYear", () => {
    it("formats as MM/DD/YY", () => {
      const date = new Date(2024, 11, 26);
      expect(formatDateShortWithYear(date)).toBe("12/26/24");
    });

    it("handles ISO string input", () => {
      const result = formatDateShortWithYear("2024-12-26T12:00:00");
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{2}/);
    });
  });

  describe("formatOdds", () => {
    it("formats positive odds with +", () => {
      expect(formatOdds(150)).toBe("+150");
      expect(formatOdds("150")).toBe("+150");
    });

    it("formats negative odds with -", () => {
      expect(formatOdds(-110)).toBe("-110");
      expect(formatOdds("-110")).toBe("-110");
    });

    it("rounds to integer", () => {
      expect(formatOdds(149.9)).toBe("+150");
    });

    it("handles zero", () => {
      expect(formatOdds(0)).toBe("");
    });

    it("handles null/undefined gracefully", () => {
      expect(formatOdds(null)).toBe("");
      expect(formatOdds(undefined)).toBe("");
    });
  });

  describe("formatCurrency", () => {
    it("formats with $ and commas", () => {
      expect(formatCurrency(1234.56)).toBe("$1,234.56");
      expect(formatCurrency(100)).toBe("$100.00");
    });

    it("formats zero as $0.00", () => {
      expect(formatCurrency(0)).toBe("$0.00");
    });

    it("formats negative amounts with -$ prefix", () => {
      expect(formatCurrency(-1234.56)).toBe("-$1,234.56");
    });
  });

  describe("formatPercentage", () => {
    it("formats with % suffix", () => {
      expect(formatPercentage(65.5)).toBe("65.5%");
      expect(formatPercentage(100)).toBe("100.0%");
    });

    it("formats zero", () => {
      expect(formatPercentage(0)).toBe("0.0%");
    });

    it("formats negative percentages", () => {
      expect(formatPercentage(-15.5)).toBe("-15.5%");
    });
  });

  describe("formatNet", () => {
    it("formats to 2 decimal places without currency symbol", () => {
      expect(formatNet(10.5)).toBe("10.50");
      expect(formatNet(-5)).toBe("-5.00");
    });
  });
});
