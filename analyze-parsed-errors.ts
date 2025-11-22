import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface BetLeg {
  entities?: string[];
  market: string;
  target?: number | string;
  ou?: "Over" | "Under";
  odds?: number;
  actual?: number | string;
  result: string;
}

interface Bet {
  id: string;
  book: string;
  betId: string;
  placedAt: string;
  betType: string;
  marketCategory: string;
  sport: string;
  description: string;
  name?: string;
  odds: number;
  stake: number;
  payout: number;
  result: string;
  type?: string;
  line?: string;
  ou?: "Over" | "Under";
  legs?: BetLeg[];
  tail?: string;
  raw?: string;
  isLive?: boolean;
  isSample?: boolean;
}

interface Error {
  betId: string;
  type: string;
  severity: "error" | "warning";
  message: string;
  details?: any;
}

const errors: Error[] = [];

function isSGPPlus(bet: Bet): boolean {
  const rawText = bet.raw?.toLowerCase() || "";
  return (
    rawText.includes("same game parlay plus") ||
    rawText.includes("same game parlay+") ||
    (rawText.includes("includes:") &&
      /includes:\s*\d+\s+same\s+game\s+parlay/i.test(bet.raw || ""))
  );
}

function analyzeBet(bet: Bet, index: number) {
  const isSGPPlusBet = isSGPPlus(bet);

  // Check 1: Missing odds in legs for parlay/SGP bets
  if (
    bet.legs &&
    bet.legs.length > 0 &&
    (bet.betType === "parlay" || bet.betType === "sgp")
  ) {
    bet.legs.forEach((leg, legIndex) => {
      if (leg.odds === undefined) {
        // Check if other legs in the same bet have odds
        const hasOtherOdds = bet.legs!.some(
          (l, i) => i !== legIndex && l.odds !== undefined
        );
        if (hasOtherOdds) {
          // For SGP+ bets, missing leg odds is expected (nested SGPs share combined odds)
          if (isSGPPlusBet) {
            errors.push({
              betId: bet.betId,
              type: "missing_leg_odds",
              severity: "warning",
              message: `Leg ${legIndex + 1} (${leg.entities?.[0] || "unknown"} ${
                leg.market
              }) missing odds while other legs have odds (EXPECTED for SGP+ structure)`,
              details: {
                legIndex: legIndex + 1,
                leg: leg,
                otherLegsWithOdds: bet.legs!.filter(
                  (l, i) => i !== legIndex && l.odds !== undefined
                ).length,
                isSGPPlus: true,
              },
            });
          } else {
            errors.push({
              betId: bet.betId,
              type: "missing_leg_odds",
              severity: "warning",
              message: `Leg ${legIndex + 1} (${leg.entities?.[0] || "unknown"} ${
                leg.market
              }) missing odds while other legs have odds`,
              details: {
                legIndex: legIndex + 1,
                leg: leg,
                otherLegsWithOdds: bet.legs!.filter(
                  (l, i) => i !== legIndex && l.odds !== undefined
                ).length,
              },
            });
          }
        }
      }
    });
  }

  // Check 2: Total bets missing line value
  if (bet.type === "Total" && !bet.line) {
    errors.push({
      betId: bet.betId,
      type: "missing_total_line",
      severity: "error",
      message: "Total bet missing line value",
      details: {
        description: bet.description,
        raw: bet.raw?.substring(0, 200),
      },
    });
  }

  // Check 3: Incorrect target values (e.g., "8+" for 3pt made)
  if (bet.legs) {
    bet.legs.forEach((leg, legIndex) => {
      if (leg.market === "3pt" && leg.target) {
        const targetStr = String(leg.target);
        // 3pt made should typically be 2+, 3+, 4+, etc., not 8+ or 10+
        if (targetStr.match(/^(\d{2,}|\d{1,2}\+)$/)) {
          const num = parseInt(targetStr.replace("+", ""));
          if (num >= 8) {
            errors.push({
              betId: bet.betId,
              type: "suspicious_3pt_target",
              severity: "warning",
              message: `Leg ${
                legIndex + 1
              } has suspicious 3pt target: ${targetStr} (likely should be assists or different market)`,
              details: { leg, target: targetStr },
            });
          }
        }
      }
    });
  }

  // Check 4: Malformed descriptions
  if (bet.description) {
    // Skip false positives for Total bets - "Over 232.5 Total Points" is correct
    const isTotalBet = bet.type === "Total";
    const isTotalDescription = /^(Over|Under)\s+\d+(?:\.\d+)?\s+Total\s+Points$/i.test(
      bet.description.trim()
    );
    
    if (isTotalBet && isTotalDescription) {
      // This is correct, skip
    } else {
      // Check for redundant text patterns (but not for Total bets with correct format)
      if (
        bet.name &&
        bet.description.includes(bet.name) &&
        bet.description.split(bet.name).length > 2 &&
        !isTotalDescription
      ) {
        errors.push({
          betId: bet.betId,
          type: "malformed_description",
          severity: "warning",
          message: "Description contains redundant player/team name",
          details: { description: bet.description, name: bet.name },
        });
      }

      // Check for "Over" followed by player name (should be "Over X.X")
      // But skip if it's a Total bet with correct format
      if (
        !isTotalDescription &&
        bet.description.match(/Over\s+[A-Z]/) &&
        !bet.description.match(/Over\s+\d/)
      ) {
        errors.push({
          betId: bet.betId,
          type: "malformed_description",
          severity: "warning",
          message:
            'Description has "Over" followed by name instead of line value',
          details: { description: bet.description },
        });
      }
    }
  }

  // Check 5: Missing required fields for single bets
  if (bet.betType === "single" && !bet.name && bet.marketCategory === "Props") {
    errors.push({
      betId: bet.betId,
      type: "missing_name",
      severity: "error",
      message: "Single prop bet missing player/team name",
      details: { description: bet.description },
    });
  }

  // Check 6: Inconsistent leg count vs description
  if (bet.legs && bet.description) {
    const descLegCount = (bet.description.match(/(\d+)\s*leg/i) || [])[1];
    if (descLegCount && parseInt(descLegCount) !== bet.legs.length) {
      errors.push({
        betId: bet.betId,
        type: "leg_count_mismatch",
        severity: "warning",
        message: `Description mentions ${descLegCount} legs but bet has ${bet.legs.length} legs`,
        details: { description: bet.description, legCount: bet.legs.length },
      });
    }
  }

  // Check 7: Missing line for Over/Under bets
  if (bet.ou && !bet.line && bet.betType === "single") {
    errors.push({
      betId: bet.betId,
      type: "missing_line",
      severity: "error",
      message: `Over/Under bet missing line value`,
      details: { ou: bet.ou, description: bet.description },
    });
  }

  // Check 8: Parlay with single leg (should probably be single bet)
  // But this is expected for SGP+ cases where nested SGP wasn't fully expanded
  if (bet.betType === "parlay" && bet.legs && bet.legs.length === 1) {
    if (isSGPPlusBet) {
      errors.push({
        betId: bet.betId,
        type: "parlay_single_leg",
        severity: "warning",
        message: "Parlay bet has only 1 leg (EXPECTED for SGP+ with nested SGP)",
        details: { leg: bet.legs[0], isSGPPlus: true },
      });
    } else {
      errors.push({
        betId: bet.betId,
        type: "parlay_single_leg",
        severity: "warning",
        message: "Parlay bet has only 1 leg (should probably be single bet)",
        details: { leg: bet.legs[0] },
      });
    }
  }
}

// Read and parse the JSON file
const jsonPath = join(process.cwd(), "your-html-file_parsed.json");
const bets: Bet[] = JSON.parse(readFileSync(jsonPath, "utf-8"));

console.log(`Analyzing ${bets.length} bets...\n`);

bets.forEach((bet, index) => {
  analyzeBet(bet, index);
});

// Group errors by type
const errorsByType = errors.reduce((acc, err) => {
  if (!acc[err.type]) acc[err.type] = [];
  acc[err.type].push(err);
  return acc;
}, {} as Record<string, Error[]>);

// Generate report
const report: string[] = [];
report.push("# Parsed HTML Error Report\n");
report.push(`Generated: ${new Date().toISOString()}\n`);
report.push(`Total bets analyzed: ${bets.length}\n`);
report.push(`Total errors found: ${errors.length}\n`);

const errorCount = errors.filter((e) => e.severity === "error").length;
const warningCount = errors.filter((e) => e.severity === "warning").length;

report.push(`- Errors: ${errorCount}`);
report.push(`- Warnings: ${warningCount}\n`);

report.push("## Summary by Error Type\n");
Object.entries(errorsByType).forEach(([type, errs]) => {
  const severityCounts = errs.reduce((acc, e) => {
    acc[e.severity] = (acc[e.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  report.push(`### ${type} (${errs.length} occurrences)`);
  report.push(`- Errors: ${severityCounts.error || 0}`);
  report.push(`- Warnings: ${severityCounts.warning || 0}\n`);
});

report.push("## Detailed Errors\n");
report.push("### Critical Errors\n");
const criticalErrors = errors.filter((e) => e.severity === "error");
if (criticalErrors.length === 0) {
  report.push("No critical errors found.\n");
} else {
  criticalErrors.forEach((err, idx) => {
    report.push(`\n#### Error ${idx + 1}: ${err.type}`);
    report.push(`- **Bet ID**: ${err.betId}`);
    report.push(`- **Message**: ${err.message}`);
    if (err.details) {
      report.push(`- **Details**: \`${JSON.stringify(err.details, null, 2)}\``);
    }
  });
}

report.push("\n### Warnings\n");
const warnings = errors.filter((e) => e.severity === "warning");
if (warnings.length === 0) {
  report.push("No warnings found.\n");
} else {
  // Group warnings by type for readability
  const warningsByType = warnings.reduce((acc, w) => {
    if (!acc[w.type]) acc[w.type] = [];
    acc[w.type].push(w);
    return acc;
  }, {} as Record<string, Error[]>);

  Object.entries(warningsByType).forEach(([type, warns]) => {
    report.push(`\n#### ${type} (${warns.length} occurrences)`);
    warns.slice(0, 10).forEach((warn, idx) => {
      report.push(`\n**Warning ${idx + 1}**:`);
      report.push(`- Bet ID: ${warn.betId}`);
      report.push(`- Message: ${warn.message}`);
      if (warn.details) {
        report.push(`- Details: \`${JSON.stringify(warn.details, null, 2)}\``);
      }
    });
    if (warns.length > 10) {
      report.push(`\n... and ${warns.length - 10} more warnings of this type`);
    }
  });
}

const reportText = report.join("\n");
writeFileSync(join(process.cwd(), "parsed-html-error-report.md"), reportText);
console.log(reportText);
console.log(`\n\nReport saved to parsed-html-error-report.md`);
