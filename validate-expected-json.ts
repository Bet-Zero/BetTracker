#!/usr/bin/env npx tsx

import fs from "fs";
import path from "path";

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalBets: number;
    pendingResults: number;
    entityNameIssues: number;
    marketTypeMismatches: number;
    grammaticalErrors: number;
  };
}

function validateExpectedJson(): ValidationResult {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
    summary: {
      totalBets: 0,
      pendingResults: 0,
      entityNameIssues: 0,
      marketTypeMismatches: 0,
      grammaticalErrors: 0,
    },
  };

  try {
    // Read the expected JSON
    const expectedPath = path.join(
      process.cwd(),
      "parsing",
      "fixtures",
      "fanduel",
      "expected_fanduel_comprehensive.json"
    );
    const expectedJson = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
    result.summary.totalBets = expectedJson.length;

    for (const bet of expectedJson) {
      // Check for PENDING results
      if (
        bet.result === "PENDING" ||
        JSON.stringify(bet).includes('"PENDING"')
      ) {
        result.errors.push(`Bet ${bet.betId}: Contains PENDING results`);
        result.summary.pendingResults++;
        result.success = false;
      }

      // Check for entity name issues
      if (bet.legs) {
        for (const leg of bet.legs) {
          if (leg.entities) {
            for (const entity of leg.entities) {
              if (
                entity.includes("Alt Rushing Yds") ||
                entity.includes("Alt Receiving Yds") ||
                entity.includes("Alt Receptions") ||
                entity.includes("Points Void")
              ) {
                result.errors.push(
                  `Bet ${bet.betId}: Entity name not cleaned: "${entity}"`
                );
                result.summary.entityNameIssues++;
                result.success = false;
              }
            }
          }

          // Check children too
          if (leg.children) {
            for (const child of leg.children) {
              if (child.entities) {
                for (const entity of child.entities) {
                  if (
                    entity.includes("Alt Rushing Yds") ||
                    entity.includes("Alt Receiving Yds") ||
                    entity.includes("Alt Receptions") ||
                    entity.includes("Points Void")
                  ) {
                    result.errors.push(
                      `Bet ${bet.betId}: Child entity name not cleaned: "${entity}"`
                    );
                    result.summary.entityNameIssues++;
                    result.success = false;
                  }
                }
              }
            }
          }
        }
      }

      // Check for date fragments
      if (bet.description && bet.description.includes("Nov")) {
        result.warnings.push(
          `Bet ${bet.betId}: Description contains 'Nov' date fragment`
        );
      }

      // Check for grammatical errors in bet names
      if (bet.name && bet.name.includes("(1 legs)")) {
        result.errors.push(
          `Bet ${bet.betId}: Grammar error - should be "(1 leg)" not "(1 legs)"`
        );
        result.summary.grammaticalErrors++;
        result.success = false;
      }

      // Check for market type consistency (basic validation)
      if (bet.raw && bet.legs) {
        const raw = bet.raw.toLowerCase();
        for (const leg of bet.legs) {
          if (leg.children) {
            for (const child of leg.children) {
              // Check if "Made Threes" in raw but marked as something else
              if (
                raw.includes("made threes") &&
                child.market === "Ast" &&
                child.entities &&
                child.entities.some((e) => raw.includes(e.toLowerCase()))
              ) {
                result.warnings.push(
                  `Bet ${bet.betId}: Possible market mismatch - raw shows "Made Threes" but leg shows "${child.market}"`
                );
                result.summary.marketTypeMismatches++;
              }
            }
          }
        }
      }
    }

    console.log("🔍 Expected JSON Validation Complete!");
    console.log(`✅ Total bets validated: ${result.summary.totalBets}`);

    if (result.success) {
      console.log("🎉 All validations passed!");
    } else {
      console.log(`❌ ${result.errors.length} errors found:`);
      result.errors.forEach((error) => console.log(`   - ${error}`));
    }

    if (result.warnings.length > 0) {
      console.log(`⚠️  ${result.warnings.length} warnings:`);
      result.warnings.forEach((warning) => console.log(`   - ${warning}`));
    }

    console.log("\n📊 Summary:");
    console.log(`   Pending Results: ${result.summary.pendingResults}`);
    console.log(`   Entity Name Issues: ${result.summary.entityNameIssues}`);
    console.log(
      `   Market Type Mismatches: ${result.summary.marketTypeMismatches}`
    );
    console.log(`   Grammar Errors: ${result.summary.grammaticalErrors}`);

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(`Failed to read or parse expected JSON: ${error}`);
    return result;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  validateExpectedJson();
}

export { validateExpectedJson };
