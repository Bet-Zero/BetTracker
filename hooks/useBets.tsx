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
import { classifyBet } from "../services/marketClassification";
import { calculateProfit, recalculatePayout } from "../utils/betCalculations";
import { isSampleData, migrateBets } from "../utils/migrations";
import { validateBet } from "../utils/validation";
import { validateBetForImport } from "../utils/importValidation";
import { handleStorageError, showStorageError } from "../utils/storageErrorHandler";

interface BetsContextType {
  bets: Bet[];
  addBets: (newBets: Bet[]) => number;
  updateBet: (betId: string, updates: Partial<Bet>) => void;
  clearBets: () => void;
  loading: boolean;
}

const BetsContext = createContext<BetsContextType | undefined>(undefined);

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

        // Check if this is sample data
        if (isSampleData(parsedBets)) {
          // Clear sample data from localStorage
          localStorage.removeItem("bettracker-bets");
          setBets([]);
        } else {
          // Migrate old bets to current format
          const migratedBets = migrateBets(parsedBets);
          
          // Save migrated bets back to localStorage if changes were made
          if (JSON.stringify(parsedBets) !== JSON.stringify(migratedBets)) {
            try {
              localStorage.setItem("bettracker-bets", JSON.stringify(migratedBets));
            } catch (storageError) {
              console.error("Failed to save migrated bets to localStorage", storageError);
              // Continue with migrated bets in memory even if save fails
            }
          }
          
          setBets(migratedBets);
        }
      } else {
        // No bets in storage - start with empty array
        setBets([]);
      }
    } catch (error) {
      const errorInfo = handleStorageError(error, 'load');
      console.error("Failed to load bets from localStorage", error);
      // Show error but don't block app initialization
      showStorageError(errorInfo);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveBets = (updatedBets: Bet[]) => {
    try {
      localStorage.setItem("bettracker-bets", JSON.stringify(updatedBets));
      setBets(updatedBets);
    } catch (error) {
      const errorInfo = handleStorageError(error, 'save');
      showStorageError(errorInfo);
      // Still update state so UI reflects changes, even if localStorage failed
      setBets(updatedBets);
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

        // Validate bets - filter out bets with blockers (critical issues)
        const validBets = trulyNewBets.filter((bet) => {
          const validation = validateBetForImport(bet);
          if (!validation.valid) {
            console.warn(
              `[Import] Blocked bet ${bet.id}: ${validation.blockers.map(b => b.message).join(', ')}`
            );
          }
          return validation.valid;
        });

        // Don't re-classify bets - they already have the correct category from the parser
        // Only classify if category is missing (shouldn't happen, but safety check)
        const classifiedNewBets = validBets.map((bet) => {
          if (!bet.marketCategory) {
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

      // Validate the updated bet
      const validation = validateBet(updatedBet);
      if (!validation.valid) {
        console.warn(`Bet validation failed: ${validation.errors.join(', ')}`);
        // For now, we'll still allow the update but log the warning
        // In the future, this could show a toast notification or prevent the update
        // TODO: Show validation errors to user via toast/notification system
      }

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
      const errorInfo = handleStorageError(error, 'clear');
      showStorageError(errorInfo);
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
