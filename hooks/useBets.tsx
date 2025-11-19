import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { Bet, BetResult } from "../types";
import { useInputs } from "./useInputs";
import { classifyBet } from "../services/classificationService";

interface BetsContextType {
  bets: Bet[];
  addBets: (newBets: Bet[]) => number;
  updateBet: (betId: string, updates: Partial<Bet>) => void;
  clearBets: () => void;
  loading: boolean;
}

const BetsContext = createContext<BetsContextType | undefined>(undefined);

// --- Calculation Helpers ---
const calculateProfit = (stake: number, odds: number): number => {
  if (isNaN(stake) || isNaN(odds)) return 0;
  if (odds > 0) {
    return stake * (odds / 100);
  } else if (odds < 0) {
    return stake / (Math.abs(odds) / 100);
  }
  return 0;
};

const recalculatePayout = (
  stake: number,
  odds: number,
  result: BetResult
): number => {
  switch (result) {
    case "win":
      return stake + calculateProfit(stake, odds);
    case "loss":
      return 0;
    case "push":
      return stake;
    case "pending":
      return 0;
    default:
      return 0;
  }
};

export const BetsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { addPlayer, addTeam } = useInputs();

  useEffect(() => {
    try {
      const storedBets = localStorage.getItem("bettracker-bets");
      if (storedBets) {
        const parsedBets: Bet[] = JSON.parse(storedBets);

        // Check if this is sample data by looking for known sample bet IDs
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
        const containsSampleData = parsedBets.some((bet) =>
          sampleBetIds.includes(bet.id)
        );

        if (containsSampleData) {
          // Clear sample data from localStorage
          localStorage.removeItem("bettracker-bets");
          setBets([]);
        } else {
          // Migrate old bets: ensure all bets have legs array (unified legs model)
          // Also retroactively classify bets that don't have a category
          const migratedBets = parsedBets.map((bet) => {
            let migratedBet = { ...bet };
            
            // Migration: If bet doesn't have legs but has top-level fields, create a leg from them
            if (!bet.legs || bet.legs.length === 0) {
              if (bet.name || bet.type || bet.line) {
                migratedBet.legs = [{
                  entities: bet.name ? [bet.name] : undefined,
                  market: bet.type || '',
                  target: bet.line,
                  ou: bet.ou,
                  result: bet.result,
                }];
              }
            }
            
            // Migration: Ensure single bets have exactly one leg (if they have legs but more than one, keep as-is)
            // This handles edge cases where a single bet might have been incorrectly parsed with multiple legs
            
            // Migration: Backfill isLive from betType for existing bets
            if (migratedBet.isLive === undefined && migratedBet.betType === 'live') {
              migratedBet.isLive = true;
            }
            
            // Retroactively classify bets that don't have a category
            // Also fix any bets that somehow got "Other" as category
            if (!migratedBet.marketCategory || migratedBet.marketCategory === 'Other') {
              migratedBet.marketCategory = classifyBet(migratedBet);
            }
            
            return migratedBet;
          });
          
          // Save migrated bets back to localStorage
          if (JSON.stringify(parsedBets) !== JSON.stringify(migratedBets)) {
            localStorage.setItem("bettracker-bets", JSON.stringify(migratedBets));
          }
          
          setBets(migratedBets);
        }
      } else {
        // No bets in storage - start with empty array
        setBets([]);
      }
    } catch (error) {
      console.error("Failed to load bets from localStorage", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveBets = (updatedBets: Bet[]) => {
    try {
      localStorage.setItem("bettracker-bets", JSON.stringify(updatedBets));
      setBets(updatedBets);
    } catch (error) {
      console.error("Failed to save bets to localStorage", error);
    }
  };

  const addBets = useCallback(
    (newBets: Bet[]) => {
      // Keywords to help identify if a market is for a team or a player
      const teamMarketKeywords = [
        "moneyline",
        "ml",
        "spread",
        "total",
        "run line",
        "money line",
        "outright winner",
        "to win",
      ];
      const playerMarketKeywords = [
        "player",
        "prop",
        "yards",
        "points",
        "rebounds",
        "assists",
        "touchdown",
        "strikeouts",
        "hits",
        "goals",
        "scorer",
        "triple-double",
        "threes",
      ];

      newBets.forEach((bet) => {
        const processEntities = (entities: string[], market: string) => {
          const lowerMarket = market.toLowerCase();
          const isTeamMarket = teamMarketKeywords.some((keyword) =>
            lowerMarket.includes(keyword)
          );
          const isPlayerMarket = playerMarketKeywords.some((keyword) =>
            lowerMarket.includes(keyword)
          );

          entities.forEach((entity) => {
            if (isPlayerMarket && !isTeamMarket) {
              addPlayer(bet.sport, entity);
            } else if (isTeamMarket && !isPlayerMarket) {
              addTeam(bet.sport, entity);
            } else {
              // Ambiguous case. Let's infer from the sport type.
              const teamSports = ["NFL", "NBA", "MLB", "NHL", "Soccer"];
              if (teamSports.includes(bet.sport)) {
                // For team sports, ambiguous markets are more likely to be for teams.
                addTeam(bet.sport, entity);
              } else {
                // For individual sports (e.g., Tennis), default to player.
                addPlayer(bet.sport, entity);
              }
            }
          });
        };

        // Process entities from structured legs first
        bet.legs?.forEach((leg) => {
          if (leg.entities && leg.market) {
            processEntities(leg.entities, leg.market);
          }
        });

        // For single bets without structured legs, use bet.name if available
        if ((!bet.legs || bet.legs.length === 0) && bet.name) {
          // Check if this is a main market bet by category
          if (bet.marketCategory.toLowerCase().includes('main')) {
            addTeam(bet.sport, bet.name);
          } else {
            // For props, it's likely a player name
            addPlayer(bet.sport, bet.name);
          }
        }
      });

      let importedCount = 0;
      setBets((prevBets) => {
        const existingBetIds = new Set(prevBets.map((b) => b.id));
        const trulyNewBets = newBets.filter(
          (newBet) => !existingBetIds.has(newBet.id)
        );

        // Don't re-classify bets - they already have the correct category from the parser
        // Only classify if category is missing (shouldn't happen, but safety check)
        const classifiedNewBets = trulyNewBets.map((bet) => {
          if (!bet.marketCategory || bet.marketCategory === 'Other') {
            return {
              ...bet,
              marketCategory: classifyBet(bet),
            };
          }
          return bet;
        });
        importedCount = classifiedNewBets.length;

        if (importedCount > 0) {
          const updatedBets = [...prevBets, ...classifiedNewBets].sort(
            (a, b) =>
              new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
          );
          saveBets(updatedBets);
          return updatedBets;
        }
        return prevBets;
      });
      return importedCount;
    },
    [addPlayer, addTeam]
  );

  const updateBet = useCallback((betId: string, updates: Partial<Bet>) => {
    setBets((prevBets) => {
      const betIndex = prevBets.findIndex((b) => b.id === betId);
      if (betIndex === -1) {
        console.warn(`Bet with id ${betId} not found for update.`);
        return prevBets;
      }
      const updatedBets = [...prevBets];
      const originalBet = updatedBets[betIndex];
      const updatedBet = { ...originalBet, ...updates };

      // If tail is an empty string, remove the property
      if (updatedBet.tail === "") {
        delete updatedBet.tail;
      }

      // Automatically recalculate payout if a relevant field changed
      const needsPayoutRecalc =
        "stake" in updates || "odds" in updates || "result" in updates;
      if (needsPayoutRecalc) {
        updatedBet.payout = recalculatePayout(
          updatedBet.stake,
          updatedBet.odds,
          updatedBet.result
        );
      }

      updatedBets[betIndex] = updatedBet;
      saveBets(updatedBets);
      return updatedBets;
    });
  }, []);

  const clearBets = useCallback(() => {
    try {
      console.log("clearBets called - clearing localStorage and state");
      localStorage.removeItem("bettracker-bets");
      setBets([]);
      console.log("clearBets completed - bets should now be empty");
    } catch (error) {
      console.error("Failed to clear bets from localStorage", error);
      alert("Failed to clear bets. Check console for details.");
    }
  }, []);

  return (
    <BetsContext.Provider
      value={{ bets, addBets, updateBet, clearBets, loading }}
    >
      {children}
    </BetsContext.Provider>
  );
};

export const useBets = (): BetsContextType => {
  const context = useContext(BetsContext);
  if (context === undefined) {
    throw new Error("useBets must be used within a BetsProvider");
  }
  return context;
};
