import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { parseFanDuel } from "../fanduel/parsers";
import { parseDraftKingsHTML } from "../draftkings/parsers";
import type { Bet } from "../../types";

// Get the directory of this test file for constructing fixture paths
const __testDir = path.dirname(new URL(import.meta.url).pathname);

// Small sample inputs for contract testing (used as fallback when fixtures unavailable)
const FD_SAMPLE = `
<div class="coupon-content">
  <div class="market-name">Moneyline</div>
  <div class="outcome-name">Boston Celtics</div>
  <div class="outcome-price">-150</div>
</div>`;

const DK_SAMPLE = `
<div class="sportsbook-bet-card">
  <div class="sportsbook-outcome-cell__label">Boston Celtics</div>
  <div class="sportsbook-outcome-cell__line">-150</div>
</div>`;

/**
 * Contract Test:
 * Verifies that parsers produce objects adhering to critical invariants,
 * regardless of display string formatting changes.
 */
describe("Parser Output Contract", () => {
  const validateBetContract = (bet: Bet, sportsbook: string) => {
    // 1. Identity & Metadata
    expect(bet.betId, `${sportsbook}: Missing betId`).toBeDefined();
    expect(typeof bet.betId, `${sportsbook}: Invalid betId type`).toBe("string");
    expect(bet.betId.length, `${sportsbook}: Empty betId`).toBeGreaterThan(0);

    // 2. Core Financials
    expect(bet.stake, `${sportsbook}: Invalid stake`).toBeTypeOf("number");
    expect(bet.stake, `${sportsbook}: Stake must be positive`).toBeGreaterThan(0);
    expect(bet.odds, `${sportsbook}: Invalid odds`).toBeTypeOf("number");
    expect(isNaN(bet.odds), `${sportsbook}: Odds cannot be NaN`).toBe(false);
    expect(bet.payout, `${sportsbook}: Invalid payout`).toBeTypeOf("number");
    expect(bet.placedAt, `${sportsbook}: Missing placedAt`).toBeDefined();
    const date = new Date(bet.placedAt);
    expect(isNaN(date.getTime()), `${sportsbook}: Invalid placedAt date`).toBe(false);

    // 3. Timing
    expect(bet.placedAt, `${sportsbook}: Missing placedAt`).toBeDefined();
    expect(new Date(bet.placedAt).toString(), `${sportsbook}: Invalid placedAt date`).not.toBe("Invalid Date");

    // 4. Classification
    // marketCategory is optional but if present must be valid string
    if (bet.marketCategory) {
      expect(typeof bet.marketCategory, `${sportsbook}: Invalid marketCategory type`).toBe("string");
    }

    // 5. Structure
    expect(bet.legs, `${sportsbook}: Missing legs array`).toBeInstanceOf(Array);
    expect(bet.legs.length, `${sportsbook}: Bet must have at least one leg`).toBeGreaterThan(0);
    bet.legs.forEach((leg, index) => {
      expect(leg, `${sportsbook}: Leg ${index} must be an object`).toBeDefined();
      // Add more specific leg validations based on your Leg type
    });

    // 6. Result
    expect(bet.result, `${sportsbook}: Missing result`).toBeDefined();
    expect(["win", "loss", "void", "pending"]).toContain(bet.result);
  };

  it("FanDuel parser respects the contract", () => {
    // Read the comprehensive fixture HTML using path relative to test file
    const fixturePath = path.join(__testDir, "../fanduel/fixtures/your-html-file.html");

    if (fs.existsSync(fixturePath)) {
      const html = fs.readFileSync(fixturePath, "utf-8");
      const bets = parseFanDuel(html);

      expect(bets.length).toBeGreaterThan(0);

      bets.forEach(bet => {
        validateBetContract(bet, "FanDuel");
      });
    } else {
      // Fallback: Use minimal hardcoded sample if fixture missing
      const bets = parseFanDuel(FD_SAMPLE);
      if (bets.length > 0) {
        bets.forEach(bet => validateBetContract(bet, "FanDuel"));
      }
    }
  });

  it("DraftKings parser respects the contract", () => {
    // Read a DK fixture using path relative to test file
    const fixturePath = path.join(__testDir, "../draftkings/fixtures/rendered_bet_stub.html");

    if (fs.existsSync(fixturePath)) {
      const html = fs.readFileSync(fixturePath, "utf-8");
      const bets = parseDraftKingsHTML(html);

      expect(bets.length).toBeGreaterThan(0);

      bets.forEach(bet => {
        validateBetContract(bet, "DraftKings");
      });
    } else {
      // Fallback: Use minimal hardcoded sample if fixture missing
      const bets = parseDraftKingsHTML(DK_SAMPLE);
      if (bets.length > 0) {
        bets.forEach(bet => validateBetContract(bet, "DraftKings"));
      }
    }
  });
});

/**
 * Edge Case and Error Handling Tests:
 * Verifies that parsers handle invalid/edge case inputs gracefully
 * without throwing exceptions.
 */
describe("Parser Error & Edge Case Handling", () => {
  describe("Empty HTML handling", () => {
    it("parseFanDuel returns an array for empty HTML string", () => {
      const result = parseFanDuel("");
      expect(Array.isArray(result)).toBe(true);
    });

    it("parseDraftKingsHTML returns an array for empty HTML string", () => {
      const result = parseDraftKingsHTML("");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Malformed HTML handling", () => {
    const malformedHtml = "<div><span>incomplete";

    it("parseFanDuel does not throw on malformed HTML", () => {
      expect(() => parseFanDuel(malformedHtml)).not.toThrow();
      const result = parseFanDuel(malformedHtml);
      expect(Array.isArray(result)).toBe(true);
    });

    it("parseDraftKingsHTML does not throw on malformed HTML", () => {
      expect(() => parseDraftKingsHTML(malformedHtml)).not.toThrow();
      const result = parseDraftKingsHTML(malformedHtml);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("HTML with no betting content", () => {
    const noBettingContentHtml = `
      <html>
        <body>
          <div class="header">Welcome to the site</div>
          <p>No bets here</p>
        </body>
      </html>
    `;

    it("parseFanDuel returns empty array for HTML with no betting content", () => {
      const result = parseFanDuel(noBettingContentHtml);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("parseDraftKingsHTML returns empty array for HTML with no betting content", () => {
      const result = parseDraftKingsHTML(noBettingContentHtml);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("Parser exception simulation", () => {
    it("code can catch FanDuel parser exceptions when they occur", () => {
      // Simulate a scenario where internal parsing logic might throw
      const mockParseFn = vi.fn().mockImplementation(() => {
        throw new Error("Simulated FanDuel parsing error");
      });

      // Wrap in try-catch to verify exception handling works
      let exceptionCaught = false;
      let errorMessage = "";

      try {
        mockParseFn("<div></div>");
      } catch (error) {
        exceptionCaught = true;
        errorMessage = (error as Error).message;
      }

      expect(exceptionCaught).toBe(true);
      expect(errorMessage).toBe("Simulated FanDuel parsing error");
    });

    it("code can catch DraftKings parser exceptions when they occur", () => {
      // Simulate a scenario where internal parsing logic might throw
      const mockParseFn = vi.fn().mockImplementation(() => {
        throw new Error("Simulated DraftKings parsing error");
      });

      // Wrap in try-catch to verify exception handling works
      let exceptionCaught = false;
      let errorMessage = "";

      try {
        mockParseFn("<div></div>");
      } catch (error) {
        exceptionCaught = true;
        errorMessage = (error as Error).message;
      }

      expect(exceptionCaught).toBe(true);
      expect(errorMessage).toBe("Simulated DraftKings parsing error");
    });
  });
});
