import { Bet, MarketCategory } from "../types";
import { classifyBet } from "../services/marketClassification";

/**
 * Valid market categories - bets with any other value will be reclassified
 */
const VALID_MARKET_CATEGORIES: MarketCategory[] = [
  "Props",
  "Main Markets",
  "Futures",
  "Parlays",
];

/**
 * Checks if the given bets array contains sample data
 * @param bets - Array of bets to check
 * @returns true if sample data is detected
 */
export const isSampleData = (bets: Bet[]): boolean => {
  // Check for isSample flag first (new method)
  if (bets.some((bet) => bet.isSample === true)) {
    return true;
  }

  // Fallback to hardcoded IDs for backward compatibility
  const sampleBetIds = [
    "DK-PENDING-NFL-2025-11-15-1",
    "FD-PENDING-NBA-2025-11-15-2",
    "FD-SGP1-NBA-2025-11-14",
    "DK-SINGLE1-NBA-2025-11-14",
    "FD-PARLAY1-NBA-2025-11-13",
    "DK-LIVE-NBA-2025-11-13",
    "FD-PROP-NBA-2025-11-12",
    "DK-PUSH-NBA-2025-11-12",
    "DK-SINGLE1-NFL-2025-11-09",
    "FD-PROP-NFL-2025-11-09",
    "DK-SGP-NFL-2025-11-09",
    "FD-PARLAY-NFL-2025-11-02",
    "DK-FUTURE-NFL-2025-08-01",
    "FD-FUTURE1-TENNIS-2025-08-20",
    "DK-PROP-NHL-2025-10-25",
    "FD-TOTAL-SOCCER-2025-10-18",
    "DK-PARLAY-MLB-2025-09-10",
    "FD-SGP-MLB-2025-09-05",
    "FD-LIVE-NBA-2025-11-01",
  ];

  return bets.some((bet) => sampleBetIds.includes(bet.id));
};

/**
 * Migrates old bet formats to the current format
 * - Ensures all bets have legs array (unified legs model)
 * - Backfills isLive from betType
 * - Retroactively classifies bets that don't have a category
 * @param bets - Array of bets to migrate
 * @returns Migrated array of bets
 */
export const migrateBets = (bets: Bet[]): Bet[] => {
  return bets.map((bet) => {
    let migratedBet = { ...bet };

    // Migration: If bet doesn't have legs but has top-level fields, create a leg from them
    if (!bet.legs || bet.legs.length === 0) {
      if (bet.name || bet.type || bet.line) {
        migratedBet.legs = [
          {
            entities: bet.name ? [bet.name] : undefined,
            market: bet.type || "",
            target: bet.line,
            ou: bet.ou,
            result: bet.result,
          },
        ];
      }
    }

    // Migration: Backfill isLive from betType for existing bets
    if (migratedBet.isLive === undefined && migratedBet.betType === "live") {
      migratedBet.isLive = true;
    }

    // Retroactively classify bets that don't have a category OR have an invalid category
    if (
      !migratedBet.marketCategory ||
      !VALID_MARKET_CATEGORIES.includes(migratedBet.marketCategory)
    ) {
      migratedBet.marketCategory = classifyBet(migratedBet);
    }

    return migratedBet;
  });
};
