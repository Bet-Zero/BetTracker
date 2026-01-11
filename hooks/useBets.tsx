import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
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
import { ImportError } from "../services/errors";

interface UndoEntry {
  actionLabel: string;
  prevBetsSnapshot: Bet[];
}

interface BetsContextType {
  bets: Bet[];
  addBets: (newBets: Bet[]) => number;
  updateBet: (betId: string, updates: Partial<Bet>) => void;
  clearBets: () => void;
  createManualBet: () => string;
  batchCreateManualBets: (count: number) => string[];
  insertBetAt: (referenceBetId: string, position: 'above' | 'below') => string | null;
  duplicateBets: (betIds: string[]) => string[];
  batchDuplicateBets: (betIds: string[], multiplier: number) => string[];
  bulkUpdateBets: (updatesById: Record<string, Partial<Bet>>, actionLabel?: string) => void;
  deleteBets: (betIds: string[]) => void;
  // Undo functionality
  undoLastAction: () => void;
  canUndo: boolean;
  lastUndoLabel: string | undefined;
  // Snapshot management for external consumers
  pushUndoSnapshot: (label: string) => void;
  loading: boolean;
}

const BetsContext = createContext<BetsContextType | undefined>(undefined);

const MAX_UNDO_STACK_SIZE = 20;

// Time window (ms) to ignore duplicate insertBetAt calls (handles React StrictMode, rapid clicks)
const INSERT_DEDUP_WINDOW_MS = 100;

export const BetsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { addPlayer, addTeam } = useInputs();

  // Undo stack (in-memory only, not persisted)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  // Dedup guard: Tracks recent insertBetAt operations to prevent double-execution
  // from React StrictMode or rapid duplicate calls
  const lastInsertRef = useRef<{ timestamp: number; referenceBetId: string; position: 'above' | 'below' } | null>(null);

  useEffect(() => {
    // Load state using persistence service
    const processLoad = () => {
      try {
        const result = loadState();
        
        if (!result.ok) {
          // Handle errors (including corruption which triggers a backup)
          const error = (result as { ok: false; error: ImportError }).error;
          console.error("Failed to load bets:", error);
          setBets([]); // Start clean (default state)
          
          // Show user-friendly error
          showStorageError({
            message: error.message,
            suggestion: error.code === 'STORAGE_CORRUPTED' 
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
      const error = (result as { ok: false; error: ImportError }).error;
      const errorInfo = handleStorageError(error.details || error.message, 'save');
      showStorageError(errorInfo);
    }
  };

  // Push a snapshot onto the undo stack before a destructive action
  const pushUndoSnapshotInternal = useCallback((label: string, prevBets: Bet[]) => {
    setUndoStack((prev) => {
      // Use structuredClone for safe deep cloning (modern browsers)
      // Falls back to JSON parse/stringify for older environments
      const snapshot = typeof structuredClone === 'function' 
        ? structuredClone(prevBets) 
        : JSON.parse(JSON.stringify(prevBets));
      const newStack = [...prev, { actionLabel: label, prevBetsSnapshot: snapshot }];
      // Limit stack size
      if (newStack.length > MAX_UNDO_STACK_SIZE) {
        return newStack.slice(-MAX_UNDO_STACK_SIZE);
      }
      return newStack;
    });
  }, []);

  // Public pushUndoSnapshot that captures current bets
  const pushUndoSnapshot = useCallback((label: string) => {
    pushUndoSnapshotInternal(label, bets);
  }, [bets, pushUndoSnapshotInternal]);

  // Undo the last action by restoring the previous snapshot
  const undoLastAction = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const lastEntry = prev[prev.length - 1];
      // Restore the snapshot
      saveBets(lastEntry.prevBetsSnapshot);
      // Return the stack without the last entry
      return prev.slice(0, -1);
    });
  }, []);

  // Computed undo state
  const canUndo = undoStack.length > 0;
  const lastUndoLabel = undoStack.length > 0 ? undoStack[undoStack.length - 1].actionLabel : undefined;

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
    // Push undo snapshot before the action
    pushUndoSnapshot("Add Bet");
    
    // Generate ID once outside the functional update using crypto.randomUUID for uniqueness
    const newId = `manual-${crypto.randomUUID()}`;
    
    const newBet: Bet = {
      id: newId,
      book: "",
      betId: "",
      placedAt: new Date().toISOString(),
      betType: "single",
      marketCategory: "",
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
      const updatedBets = [newBet, ...prevBets].sort(
        (a, b) =>
          new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
      );
      saveBets(updatedBets);
      return updatedBets;
    });

    return newId;
  }, [pushUndoSnapshot]);

  // Batch create multiple manual bets with a single undo entry
  const batchCreateManualBets = useCallback((count: number): string[] => {
    pushUndoSnapshot(`Add ${count} Bet${count > 1 ? 's' : ''}`);
    
    const newIds: string[] = [];
    
    setBets((prevBets) => {
      const newBets: Bet[] = [];
      
      for (let i = 0; i < count; i++) {
        const newId = `manual-${crypto.randomUUID()}`;
        
        if (prevBets.some(b => b.id === newId) || newBets.some(b => b.id === newId)) {
          continue;
        }
        
        newIds.push(newId);
        newBets.push({
          id: newId,
          book: "",
          betId: "",
          placedAt: new Date().toISOString(),
          betType: "single",
          marketCategory: "",
          sport: "",
          description: "",
          stake: 0,
          payout: 0,
          result: "pending",
          legs: [],
        });
      }
      
      const updatedBets = [...newBets, ...prevBets].sort(
        (a, b) =>
          new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
      );
      saveBets(updatedBets);
      return updatedBets;
    });
    
    return newIds;
  }, [pushUndoSnapshot]);

  /**
   * Insert a new bet above or below an existing bet.
   * @param referenceBetId - The ID of the bet to insert relative to
   * @param position - 'above' or 'below' the reference bet
   * @returns The new bet's ID, or null if the operation was skipped (dedup guard)
   */
  const insertBetAt = useCallback((referenceBetId: string, position: 'above' | 'below'): string | null => {
    // Dedup guard: Prevent rapid duplicate calls (e.g., React StrictMode, double events)
    const now = Date.now();
    if (
      lastInsertRef.current &&
      lastInsertRef.current.referenceBetId === referenceBetId &&
      lastInsertRef.current.position === position &&
      now - lastInsertRef.current.timestamp < INSERT_DEDUP_WINDOW_MS
    ) {
      console.debug('[insertBetAt] Skipping duplicate call within dedup window');
      return null;
    }
    lastInsertRef.current = { timestamp: now, referenceBetId, position };
    
    // Push undo snapshot before the action
    pushUndoSnapshot(`Insert Bet ${position === 'above' ? 'Above' : 'Below'}`);
    
    const newId = `manual-${crypto.randomUUID()}`;
    let insertedId: string | null = null;
    
    setBets((prevBets) => {
      // Find the reference bet
      const refIndex = prevBets.findIndex(b => b.id === referenceBetId);
      if (refIndex === -1) {
        console.warn(`Reference bet ${referenceBetId} not found`);
        return prevBets;
      }
      
      // Sort bets by date to find neighbors
      const sortedBets = [...prevBets].sort(
        (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()
      );
      const sortedRefIndex = sortedBets.findIndex(b => b.id === referenceBetId);
      
      const refBet = sortedBets[sortedRefIndex];
      const refTime = new Date(refBet.placedAt).getTime();
      
      let newTimestamp: number;
      
      if (position === 'above') {
        // Insert above = older timestamp (appears before in ascending sorted list)
        // Find the bet that's currently above (index - 1 in sorted array)
        const aboveBet = sortedRefIndex > 0 ? sortedBets[sortedRefIndex - 1] : null;
        if (aboveBet) {
          const aboveTime = new Date(aboveBet.placedAt).getTime();
          // Place timestamp halfway between
          newTimestamp = Math.floor((refTime + aboveTime) / 2);
        } else {
          // No bet above, use 1 second before reference
          newTimestamp = refTime - 1000;
        }
      } else {
        // Insert below = newer timestamp (appears after in ascending sorted list)
        // Find the bet that's currently below (index + 1 in sorted array)
        const belowBet = sortedRefIndex < sortedBets.length - 1 ? sortedBets[sortedRefIndex + 1] : null;
        if (belowBet) {
          const belowTime = new Date(belowBet.placedAt).getTime();
          // Place timestamp halfway between
          newTimestamp = Math.floor((refTime + belowTime) / 2);
        } else {
          // No bet below, use 1 second after reference
          newTimestamp = refTime + 1000;
        }
      }
      
      // Check for dedup (StrictMode)
      if (prevBets.some(b => b.id === newId)) {
        return prevBets;
      }
      
      const newBet: Bet = {
        id: newId,
        book: "",
        betId: "",
        placedAt: new Date(newTimestamp).toISOString(),
        betType: "single",
        marketCategory: "",
        sport: "",
        description: "",
        stake: 0,
        payout: 0,
        result: "pending",
        legs: [],
      };
      
      insertedId = newId;
      
      const updatedBets = [...prevBets, newBet].sort(
        (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()
      );
      saveBets(updatedBets);
      return updatedBets;
    });
    
    return insertedId || newId;
  }, [pushUndoSnapshot]);

  const duplicateBets = useCallback((betIds: string[]): string[] => {
    // Push undo snapshot before the action
    pushUndoSnapshot(`Duplicate ${betIds.length}`);
    
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
  }, [pushUndoSnapshot]);

  // Batch duplicate bets with a single undo entry
  const batchDuplicateBets = useCallback((betIds: string[], multiplier: number): string[] => {
    const label = multiplier > 1 
      ? `Duplicate ${betIds.length} Bet${betIds.length > 1 ? 's' : ''} ×${multiplier}`
      : `Duplicate ${betIds.length} Bet${betIds.length > 1 ? 's' : ''}`;
    
    pushUndoSnapshot(label);
    
    const allNewIds: string[] = [];
    
    setBets((prevBets) => {
      const targetBets = betIds.map(id => prevBets.find(b => b.id === id)).filter((b): b is Bet => !!b);
      if (targetBets.length === 0) return prevBets;
      
      const newBets: Bet[] = [];
      
      for (let m = 0; m < multiplier; m++) {
        for (const bet of targetBets) {
          const newId = `manual-${crypto.randomUUID()}`;
          
          if (prevBets.some(b => b.id === newId) || newBets.some(b => b.id === newId)) {
            continue;
          }
          
          allNewIds.push(newId);
          newBets.push({
            ...bet,
            id: newId,
            placedAt: new Date().toISOString(),
          });
        }
      }
      
      const updatedBets = [...newBets, ...prevBets].sort(
        (a, b) =>
          new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
      );
      saveBets(updatedBets);
      return updatedBets;
    });
    
    return allNewIds;
  }, [pushUndoSnapshot]);

  // Bulk update multiple bets in a single save operation
  const bulkUpdateBets = useCallback(
    (updatesById: Record<string, Partial<Bet>>, actionLabel?: string) => {
      // Push undo snapshot before the action
      const count = Object.keys(updatesById).length;
      pushUndoSnapshot(actionLabel || `Bulk Update ${count}`);
      
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
    [pushUndoSnapshot]
  );

  // Delete bets by ID
  const deleteBets = useCallback((betIds: string[]) => {
    // Push undo snapshot before deletion
    pushUndoSnapshot(`Delete ${betIds.length}`);
    
    setBets((prevBets) => {
      const updatedBets = prevBets.filter((bet) => !betIds.includes(bet.id));
      saveBets(updatedBets);
      return updatedBets;
    });
  }, [pushUndoSnapshot]);

  return (
    <BetsContext.Provider
      value={{
        bets,
        addBets,
        updateBet,
        clearBets,
        createManualBet,
        batchCreateManualBets,
        insertBetAt,
        duplicateBets,
        batchDuplicateBets,
        bulkUpdateBets,
        deleteBets,
        undoLastAction,
        canUndo,
        lastUndoLabel,
        pushUndoSnapshot,
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
