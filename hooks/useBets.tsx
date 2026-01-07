import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { Bet } from "../types";
import { useInputs } from "./useInputs";
import { classifyBet } from "../services/marketClassification";
import { calculateProfit, recalculatePayout } from "../utils/betCalculations";
import { validateBet } from "../utils/validation";
import { validateBetForImport } from "../utils/importValidation";
import { handleStorageError, showStorageError } from "../utils/storageErrorHandler";
import { 
  loadState, 
  saveState, 
  createManualBackup, 
  STORAGE_VERSION, 
  STORAGE_KEY 
} from "../services/persistence";

interface BetsContextType {
  bets: Bet[];
  addBets: (newBets: Bet[]) => number;
  updateBet: (betId: string, updates: Partial<Bet>) => void;
  clearBets: () => void;
  createManualBet: () => string;
  duplicateBets: (betIds: string[]) => string[];
  bulkUpdateBets: (updatesById: Record<string, Partial<Bet>>) => void;
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
    // Load state using persistence service
    const processLoad = () => {
      try {
        const result = loadState();
        
        if (!result.ok) {
          // Handle errors (including corruption which triggers a backup)
          console.error("Failed to load bets:", result.error);
          setBets([]); // Start clean (default state)
          
          // Show user-friendly error
          showStorageError({
            message: result.error.message,
            suggestion: result.error.code === 'STORAGE_CORRUPTED' 
              ? 'Your previous data was corrupted and has been backed up. The application has been reset to a clean state.' 
              : 'Please check your browser console for details.'
          });
          return;
        }

        
        // Self-healing: Fix misclassified Main Markets bets (e.g. Player Props with "Over" keywords)
        // This addresses the regression where "LeBron Over 25.5" was classified as Main Markets
        let betsToSet = result.value.bets;
        let hasChanges = false;
        
        const healedBets = betsToSet.map(bet => {
          // Only re-check Main Markets to be efficient/safe
          if (bet.marketCategory === 'Main Markets') {
            const correctCategory = classifyBet(bet);
            if (correctCategory !== 'Main Markets') {
              hasChanges = true;
              return { ...bet, marketCategory: correctCategory };
            }
          }
          return bet;
        });

        if (hasChanges) {
          console.log('[useBets] Self-healing: Corrected misclassified bets', 
            healedBets.filter((b, i) => b !== betsToSet[i]).length
          );
          betsToSet = healedBets;
          
          // Persist the correction immediately
          saveState({
             ...result.value,
             bets: healedBets,
             updatedAt: new Date().toISOString() 
          });
        }

        setBets(betsToSet);
      } catch (err) {
        // Defensive catch for unexpected errors during load
        console.error("Unexpected error in processLoad:", err);
        setBets([]);
        showStorageError({
          message: "An unexpected error occurred while loading your bets.",
          suggestion: "Please refresh the page. If this persists, clear your browser data."
        });
      } finally {
        setLoading(false);
      }
    };

    processLoad();
  }, []);

  const saveBets = (updatedBets: Bet[]) => {
    // Construct the full persisted state
    const stateToSave = {
      version: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      bets: updatedBets,
    };

    const result = saveState(stateToSave);
    
    // Always update React state so UI reflects changes immediately
    setBets(updatedBets);

    if (!result.ok) {
      const errorInfo = handleStorageError(result.error.details || result.error.message, 'save');
      showStorageError(errorInfo);
    }
  };

  const addBets = useCallback(
    (newBets: Bet[]) => {
      // Process entities from legs using entityType set by parsers
      newBets.forEach((bet) => {
        bet.legs?.forEach((leg) => {
          if (!leg.entities || !leg.entities.length) return;

          leg.entities.forEach((entity) => {
            if (!entity || typeof entity !== 'string' || entity.trim().length === 0) return;
            if (!bet.sport) return;
            
            if (leg.entityType === 'player') {
              addPlayer(bet.sport, entity);
            } else if (leg.entityType === 'team') {
              addTeam(bet.sport, entity);
            }
          });
        });
      });

      let importedCount = 0;
      setBets((prevBets) => {
        const existingBetIds = new Set(prevBets.map((b) => b.id));
        const trulyNewBets = newBets.filter(
          (newBet) => !existingBetIds.has(newBet.id)
        );

        const validBets = trulyNewBets.filter((bet) => {
          const validation = validateBetForImport(bet);
          if (!validation.valid) {
            console.warn(
              `[Import] Blocked bet ${bet.id}: ${validation.blockers.map(b => b.message).join(', ')}`
            );
          }
          return validation.valid;
        });

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

      const validation = validateBet(updatedBet);
      if (!validation.valid) {
        console.warn(`Bet validation failed: ${validation.errors.join(', ')}`);
      }

      if (updatedBet.tail === "") {
        delete updatedBet.tail;
      }

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
      console.log("clearBets called - creating backup and clearing");
      
      // Load current state for backup
      // We read from localStorage directly via persistence load to ensure we have latest on disk
      // or use current memory state? Memory state is safer if saving happened recently.
      // But persistence load is safer if we want to backup EXACTLY what is on disk.
      // Let's use memory state 'bets' captured in closure? No, stale closure risk if not careful.
      // Actually, 'bets' from state might be stale in this callback if dependencies are []
      // But we can use functional update or... wait. 'bets' is not in dependency array.
      // Better to rely on what's in local storage for the backup essentially.
      
      const currentLoad = loadState();
      
      if (currentLoad.ok && currentLoad.value.bets.length > 0) {
         createManualBackup(currentLoad.value, 'clear');
      }

      // Clear the main key
      localStorage.removeItem(STORAGE_KEY);
      // Also clear legacy key just in case
      localStorage.removeItem("bettracker-bets");
      
      setBets([]);
      console.log("clearBets completed");
    } catch (error) {
      const errorInfo = handleStorageError(error, 'clear');
      showStorageError(errorInfo);
    }
  }, []);

  // Create a new manual bet with safe defaults
  const createManualBet = useCallback((): string => {
    // Generate ID once outside the functional update using crypto.randomUUID for uniqueness
    const newId = `manual-${crypto.randomUUID()}`;
    
    const newBet: Bet = {
      id: newId,
      book: "",
      betId: "",
      placedAt: new Date().toISOString(),
      betType: "single",
      marketCategory: "Props",
      sport: "",
      description: "",
      stake: 0,
      payout: 0,
      result: "pending",
      legs: [],
    };

    setBets((prevBets) => {
      // Check if bet already exists (dedup for StrictMode double invocations)
      if (prevBets.some(b => b.id === newId)) {
        return prevBets;
      }
      const updatedBets = [newBet, ...prevBets];
      saveBets(updatedBets);
      return updatedBets;
    });

    return newId;
  }, []);

  // Duplicate selected bets with new IDs
  const duplicateBets = useCallback((betIds: string[]): string[] => {
    // Generate new IDs outside the functional update using crypto.randomUUID for uniqueness
    const idMap = new Map<string, string>();
    betIds.forEach((betId) => {
      idMap.set(betId, `dup-${crypto.randomUUID()}`);
    });
    const newIds = Array.from(idMap.values());

    setBets((prevBets) => {
      // Check if any of the new IDs already exist (dedup for StrictMode)
      if (newIds.some(newId => prevBets.some(b => b.id === newId))) {
        return prevBets;
      }

      const toDuplicate = prevBets.filter((b) => betIds.includes(b.id));
      if (toDuplicate.length === 0) return prevBets;

      const duplicated = toDuplicate.map((bet) => {
        const newId = idMap.get(bet.id) || `dup-${crypto.randomUUID()}`;
        return {
          ...bet,
          id: newId,
          betId: "", // Clear sportsbook-provided ID for duplicates
          placedAt: new Date().toISOString(),
          result: "pending" as const, // Reset result for duplicate
          payout: 0, // Clear payout
        };
      });

      const updatedBets = [...duplicated, ...prevBets].sort(
        (a, b) =>
          new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
      );
      saveBets(updatedBets);
      return updatedBets;
    });

    return newIds;
  }, []);

  // Bulk update multiple bets in a single save operation
  const bulkUpdateBets = useCallback(
    (updatesById: Record<string, Partial<Bet>>) => {
      setBets((prevBets) => {
        const updatedBets = prevBets.map((bet) => {
          const updates = updatesById[bet.id];
          if (!updates) return bet;

          const updatedBet = { ...bet, ...updates };

          // Handle tail field deletion
          if (updatedBet.tail === "") {
            delete updatedBet.tail;
          }

          // Auto-recalculate payout if stake/odds/result change
          const needsPayoutRecalc =
            "stake" in updates || "odds" in updates || "result" in updates;
          if (needsPayoutRecalc) {
            updatedBet.payout = recalculatePayout(
              updatedBet.stake,
              updatedBet.odds,
              updatedBet.result
            );
          }

          return updatedBet;
        });

        saveBets(updatedBets);
        return updatedBets;
      });
    },
    []
  );

  return (
    <BetsContext.Provider
      value={{
        bets,
        addBets,
        updateBet,
        clearBets,
        createManualBet,
        duplicateBets,
        bulkUpdateBets,
        loading,
      }}
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
