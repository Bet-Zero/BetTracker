import React, { useState, useMemo } from "react";
import { Bet, Sportsbook, MarketCategory, BetLeg } from "../types";
import { X, AlertTriangle, CheckCircle2, Wifi, XCircle, Info } from "./icons";
import { classifyLeg } from "../services/marketClassification";
import { validateBetsForImport } from "../utils/importValidation";

// Export summary type for parent components
export interface ImportSummary {
  totalParsed: number;
  blockers: number;
  warnings: number;
  duplicates: number;
  netNew: number;
}

interface ImportConfirmationModalProps {
  bets: Bet[];
  existingBetIds: Set<string>;
  onConfirm: (summary: ImportSummary) => void;
  onCancel: () => void;
  onEditBet: (index: number, updates: Partial<Bet>) => void;
  availableSports: string[];
  availablePlayers: Record<string, string[]>; // sport -> player names
  sportsbooks: Sportsbook[];
  onAddPlayer: (sport: string, playerName: string) => void;
  onAddSport: (sport: string) => void;
}

// Helper functions for formatting
const formatDate = (isoString: string): string => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  } catch {
    return "";
  }
};

const formatOdds = (odds?: number | null): string => {
  if (odds === undefined || odds === null || odds === 0) return "";
  if (odds > 0) return `+${odds}`;
  return odds.toString();
};

const calculateToWin = (
  stake: number,
  odds?: number | null,
  payout?: number
): string => {
  if (payout !== undefined && payout > 0) {
    return payout.toFixed(2);
  }

  if (odds === undefined || odds === null) {
    return "";
  }

  const numericOdds = Number(odds);
  if (Number.isNaN(numericOdds)) {
    return "";
  }

  let profit = 0;
  if (numericOdds > 0) {
    profit = stake * (numericOdds / 100);
  } else if (numericOdds < 0) {
    profit = stake / (Math.abs(numericOdds) / 100);
  }
  const toWin = stake + profit;
  return toWin.toFixed(2);
};

const calculateNet = (
  result: string,
  stake: number,
  odds?: number | null,
  payout?: number
): string => {
  const resultLower = result.toLowerCase();
  if (resultLower === "win") {
    if (payout !== undefined && payout > 0) {
      const net = payout - stake;
      return net.toFixed(2);
    }
    if (odds === undefined || odds === null) {
      return "";
    }
    const numericOdds = Number(odds);
    if (Number.isNaN(numericOdds)) {
      return "";
    }
    let profit = 0;
    if (numericOdds > 0) {
      profit = stake * (numericOdds / 100);
    } else if (numericOdds < 0) {
      profit = stake / (Math.abs(numericOdds) / 100);
    }
    return profit.toFixed(2);
  }
  if (resultLower === "loss") {
    return `-${stake.toFixed(2)}`;
  }
  if (resultLower === "push") {
    return "0.00";
  }
  return "";
};

const capitalizeFirstLetter = (str: string): string => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// NOTE: getLegCategory has been removed and replaced with the unified
// classifyLeg function from services/marketClassification.ts
// All classification logic is now in one place.

type VisibleLeg = {
  leg: BetLeg;
  parentIndex: number;
  childIndex?: number;
};

const getVisibleLegs = (bet: Bet): VisibleLeg[] => {
  if (!bet.legs) return [];
  const visible: VisibleLeg[] = [];

  bet.legs.forEach((leg, parentIndex) => {
    if (leg.isGroupLeg && leg.children?.length) {
      leg.children.forEach((child, childIndex) => {
        visible.push({ leg: child, parentIndex, childIndex });
      });
    } else {
      visible.push({ leg, parentIndex });
    }
  });

  return visible;
};

export const ImportConfirmationModal: React.FC<
  ImportConfirmationModalProps
> = ({
  bets,
  existingBetIds,
  onConfirm,
  onCancel,
  onEditBet,
  availableSports,
  availablePlayers,
  sportsbooks,
  onAddPlayer,
  onAddSport,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingLegIndex, setEditingLegIndex] = useState<number | null>(null);
  const [expandedBets, setExpandedBets] = useState<Set<string>>(new Set());

  // Map sportsbook names to abbreviations
  const siteShortNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    sportsbooks.forEach((book) => {
      map[book.name] = book.abbreviation;
    });
    return map;
  }, [sportsbooks]);

  // Compute import validation summary (blockers vs warnings)
  const validationSummary = useMemo(() => {
    return validateBetsForImport(bets);
  }, [bets]);
  
  // Compute duplicate count based on existingBetIds
  const duplicateCount = useMemo(() => {
    return bets.filter(bet => existingBetIds.has(bet.id)).length;
  }, [bets, existingBetIds]);
  
  // Compute the full import summary for the "What Will Happen" section
  const importSummary: ImportSummary = useMemo(() => {
    const totalParsed = bets.length;
    const blockers = validationSummary.betsWithBlockers;
    const duplicates = duplicateCount;
    // Net-new = total - duplicates - blocked
    const netNew = Math.max(0, totalParsed - duplicates - blockers);
    
    return {
      totalParsed,
      blockers,
      warnings: validationSummary.totalWarnings, // Total warning issues across all bets
      duplicates,
      netNew,
    };
  }, [bets, validationSummary, duplicateCount]);

  const hasBlockers = validationSummary.totalBlockers > 0;
  const hasWarnings = validationSummary.totalWarnings > 0;
  
  // Get warning hints for tooltip display
  const getWarningHints = (): string => {
    const hints: string[] = [];
    const seenFields = new Set<string>();
    
    // Collect unique warning hints from all bets
    for (const [_, result] of validationSummary.validationResults) {
      for (const warning of result.warnings) {
        if (!seenFields.has(warning.field) && warning.hint) {
          hints.push(`• ${warning.message}: ${warning.hint}`);
          seenFields.add(warning.field);
        }
      }
      // Limit to top 4 warning types
      if (hints.length >= 4) break;
    }
    
    return hints.length > 0 
      ? `Common warnings:\n${hints.join('\n')}`
      : 'Review warnings before importing';
  };

  // Toggle expansion for a parlay bet
  const toggleExpansion = (betId: string) => {
    setExpandedBets((prev) => {
      const next = new Set(prev);
      if (next.has(betId)) {
        next.delete(betId);
      } else {
        next.add(betId);
      }
      return next;
    });
  };

  // Check for issues in a Bet (for main row) or a leg (for expanded leg rows)
  const getBetIssues = (
    bet: Bet,
    legIndex?: number
  ): { field: string; message: string }[] => {
    const issues: { field: string; message: string }[] = [];
    const visibleLegs = getVisibleLegs(bet);

    if (!bet.sport || bet.sport.trim() === "") {
      issues.push({ field: "Sport", message: "Sport is missing" });
    } else if (!availableSports.includes(bet.sport)) {
      issues.push({
        field: "Sport",
        message: `Sport "${bet.sport}" not in database`,
      });
    }

    if (legIndex !== undefined) {
      // Checking leg-level issues
      const legMeta = visibleLegs[legIndex];
      if (!legMeta) return issues;
      const leg = legMeta.leg;
      const legCategory = classifyLeg(leg.market, bet.sport);

      if (!legCategory || legCategory.trim() === "") {
        issues.push({
          field: "Category",
          message: "Category is missing or invalid",
        });
      }

      const legName = leg.entities?.[0] || "";
      if (legName && legName.trim()) {
        const sportPlayers = availablePlayers[bet.sport] || [];
        if (!sportPlayers.includes(legName)) {
          issues.push({
            field: "Name",
            message: `Player "${legName}" not in database`,
          });
        }
      }

      if (!leg.market && legCategory === "Props") {
        issues.push({ field: "Type", message: "Stat type is missing" });
      }
    } else {
      // Checking bet-level issues for singles
      if (bet.betType === "single" || !bet.legs || visibleLegs.length === 1) {
        const betName =
          bet.name ||
          visibleLegs[0]?.leg.entities?.[0] ||
          bet.legs?.[0]?.entities?.[0] ||
          "";
        if (betName && betName.trim()) {
          const sportPlayers = availablePlayers[bet.sport] || [];
          if (!sportPlayers.includes(betName)) {
            issues.push({
              field: "Name",
              message: `Player "${betName}" not in database`,
            });
          }
        }

        if (!bet.type && bet.marketCategory?.toLowerCase().includes("prop")) {
          issues.push({ field: "Type", message: "Stat type is missing" });
        }
      }
    }

    return issues;
  };

  const handleAddPlayer = (sport: string, playerName: string) => {
    if (sport && playerName) {
      onAddPlayer(sport, playerName);
    }
  };

  const handleAddSport = (sport: string) => {
    if (sport) {
      onAddSport(sport);
    }
  };

  // Check if any bets have issues
  const hasAnyIssues = useMemo(() => {
    return bets.some((bet) => {
      const isParlay =
        bet.betType === "sgp" ||
        bet.betType === "sgp_plus" ||
        getVisibleLegs(bet).length > 1;
      if (isParlay) {
        // Check bet-level issues
        const betIssues = getBetIssues(bet);
        if (betIssues.length > 0) return true;
        // Check all leg issues
        const visibleLegs = getVisibleLegs(bet);
        return visibleLegs.some(
          (_, legIndex) => getBetIssues(bet, legIndex).length > 0
        );
      } else {
        return getBetIssues(bet).length > 0;
      }
    });
  }, [bets, availableSports, availablePlayers]);

  // Handle editing a bet field or leg field
  const handleEditBet = (
    betIndex: number,
    field: string,
    value: string,
    legIndex?: number
  ) => {
    const bet = bets[betIndex];
    const updates: Partial<Bet> = {};

    if (legIndex !== undefined) {
      // Editing a leg field
      const visibleLegs = getVisibleLegs(bet);
      const target = visibleLegs[legIndex];
      if (!target || !bet.legs) return;

      const newLegs = [...bet.legs];
      const parentLeg = { ...newLegs[target.parentIndex] };

      switch (field) {
        case "Name":
          if (target.childIndex !== undefined) {
            const children = parentLeg.children ? [...parentLeg.children] : [];
            const child = { ...(children[target.childIndex] || {}) };
            child.entities = [value];
            children[target.childIndex] = child;
            parentLeg.children = children;
          } else {
            parentLeg.entities = [value];
          }
          break;
        case "Type":
          if (target.childIndex !== undefined) {
            const children = parentLeg.children ? [...parentLeg.children] : [];
            const child = { ...(children[target.childIndex] || {}) };
            child.market = value;
            children[target.childIndex] = child;
            parentLeg.children = children;
          } else {
            parentLeg.market = value;
          }
          break;
        case "O/U":
          if (target.childIndex !== undefined) {
            const children = parentLeg.children ? [...parentLeg.children] : [];
            const child = { ...(children[target.childIndex] || {}) };
            child.ou =
              value === "Over"
                ? "Over"
                : value === "Under"
                ? "Under"
                : undefined;
            children[target.childIndex] = child;
            parentLeg.children = children;
          } else {
            parentLeg.ou =
              value === "Over"
                ? "Over"
                : value === "Under"
                ? "Under"
                : undefined;
          }
          break;
        case "Line":
          if (target.childIndex !== undefined) {
            const children = parentLeg.children ? [...parentLeg.children] : [];
            const child = { ...(children[target.childIndex] || {}) };
            child.target = value;
            children[target.childIndex] = child;
            parentLeg.children = children;
          } else {
            parentLeg.target = value;
          }
          break;
        case "Result":
          if (target.childIndex !== undefined) {
            const children = parentLeg.children ? [...parentLeg.children] : [];
            const child = { ...(children[target.childIndex] || {}) };
            child.result = value as any;
            children[target.childIndex] = child;
            parentLeg.children = children;
          } else {
            parentLeg.result = value as any;
          }
          break;
        case "Odds":
          const numVal = parseInt(value.replace("+", ""), 10);
          if (!isNaN(numVal)) {
            if (target.childIndex !== undefined) {
              const children = parentLeg.children
                ? [...parentLeg.children]
                : [];
              const child = { ...(children[target.childIndex] || {}) };
              child.odds = numVal;
              children[target.childIndex] = child;
              parentLeg.children = children;
            } else {
              parentLeg.odds = numVal;
            }
          }
          break;
      }

      newLegs[target.parentIndex] = parentLeg;
      updates.legs = newLegs;
    } else {
      // Editing a bet-level field
      switch (field) {
        case "Sport":
          updates.sport = value;
          break;
        case "Category":
          updates.marketCategory = value as MarketCategory;
          break;
        case "Type":
          updates.type = value;
          break;
        case "Name":
          updates.name = value;
          break;
        case "O/U":
          updates.ou =
            value === "Over" ? "Over" : value === "Under" ? "Under" : undefined;
          break;
        case "Line":
          updates.line = value;
          break;
        case "Result":
          updates.result = value as any;
          break;
        case "Odds":
          const numVal = parseInt(value.replace("+", ""), 10);
          if (!isNaN(numVal)) {
            updates.odds = numVal;
          }
          break;
        case "isLive":
          updates.isLive = value === "true";
          break;
      }
    }

    if (Object.keys(updates).length > 0) {
      onEditBet(betIndex, updates);
    }
  };

  // Determine if a bet is a parlay/SGP
  const isParlay = (bet: Bet): boolean => {
    if (bet.betType === "sgp" || bet.betType === "sgp_plus") return true;
    return getVisibleLegs(bet).length > 1;
  };

  // Get parlay label
  const getParlayLabel = (bet: Bet): string => {
    if (bet.betType === "sgp_plus") return "SGP+";
    if (bet.betType === "sgp") return "SGP";
    return "Parlay";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-[95vw] w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Review Bets Before Import
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              <span className="font-semibold text-neutral-900 dark:text-white">
                {bets.length}
              </span>{" "}
              bet{bets.length !== 1 ? "s" : ""} parsed. Review and fix
              any issues before importing.
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* "What Will Happen" Summary - updates live */}
        <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">What Will Happen</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            {/* Total Parsed */}
            <div className="bg-white dark:bg-neutral-900 rounded-lg p-3 border border-neutral-200 dark:border-neutral-700">
              <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total Parsed</div>
              <div className="text-xl font-bold text-neutral-900 dark:text-white">{importSummary.totalParsed}</div>
            </div>
            
            {/* Blockers */}
            <div className={`rounded-lg p-3 border ${
              importSummary.blockers > 0 
                ? 'bg-danger-50 dark:bg-danger-900/20 border-danger-200 dark:border-danger-800' 
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
            }`}>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                Blockers
                {importSummary.blockers > 0 && <XCircle className="w-3 h-3 text-danger-500" />}
              </div>
              <div className={`text-xl font-bold ${
                importSummary.blockers > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-neutral-900 dark:text-white'
              }`}>
                {importSummary.blockers}
              </div>
              {importSummary.blockers > 0 && (
                <div className="text-xs text-danger-600 dark:text-danger-400 mt-1">Must be 0 to import</div>
              )}
            </div>
            
            {/* Warnings */}
            <div 
              className={`rounded-lg p-3 border ${
                importSummary.warnings > 0 
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' 
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
              }`}
              title={importSummary.warnings > 0 ? getWarningHints() : undefined}
            >
              <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                Warnings
                {importSummary.warnings > 0 && <AlertTriangle className="w-3 h-3 text-yellow-500" />}
              </div>
              <div className={`text-xl font-bold ${
                importSummary.warnings > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-neutral-900 dark:text-white'
              }`}>
                {importSummary.warnings}
              </div>
              {importSummary.warnings > 0 && (
                <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Won't block import
                  <span className="text-neutral-500 dark:text-neutral-400 ml-1">(hover for details)</span>
                </div>
              )}
            </div>
            
            {/* Duplicates */}
            <div className={`rounded-lg p-3 border ${
              importSummary.duplicates > 0 
                ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600' 
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
            }`}>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Duplicates</div>
              <div className="text-xl font-bold text-neutral-600 dark:text-neutral-300">{importSummary.duplicates}</div>
              {importSummary.duplicates > 0 && (
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Already in database</div>
              )}
            </div>
            
            {/* Net New */}
            <div className={`rounded-lg p-3 border ${
              importSummary.netNew > 0 
                ? 'bg-accent-50 dark:bg-accent-900/20 border-accent-200 dark:border-accent-800' 
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700'
            }`}>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                Will Import
                {importSummary.netNew > 0 && <CheckCircle2 className="w-3 h-3 text-accent-500" />}
              </div>
              <div className={`text-xl font-bold ${
                importSummary.netNew > 0 ? 'text-accent-600 dark:text-accent-400' : 'text-neutral-900 dark:text-white'
              }`}>
                {importSummary.netNew}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Net-new bets</div>
            </div>
          </div>
        </div>

        {/* Bets Table */}
        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-neutral-500 dark:text-neutral-400">
              <thead className="text-xs text-neutral-700 uppercase bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-400 sticky top-0 z-10">
                <tr className="whitespace-nowrap">
                  <th className="px-2 py-3">Date</th>
                  <th className="px-2 py-3">Site</th>
                  <th className="px-2 py-3">Sport</th>
                  <th className="px-2 py-3">Category</th>
                  <th className="px-2 py-3">Type</th>
                  <th className="px-2 py-3">Name</th>
                  <th className="px-2 py-3 text-center">O/U</th>
                  <th className="px-2 py-3 text-center">Line</th>
                  <th className="px-2 py-3">Odds</th>
                  <th className="px-2 py-3">Bet</th>
                  <th className="px-2 py-3">To Win</th>
                  <th className="px-2 py-3">Result</th>
                  <th className="px-2 py-3">Net</th>
                  <th className="px-2 py-3 text-center">Live</th>
                  <th className="px-2 py-3">Tail</th>
                  <th className="px-2 py-3">Edit</th>
                </tr>
              </thead>
              <tbody>
                {bets.map((bet, betIndex) => {
                  const isParlayBet = isParlay(bet);
                  const isExpanded = expandedBets.has(bet.id);
                  const betIssues = getBetIssues(bet);
                  const isDuplicate = existingBetIds.has(bet.id);
                  const isEditing =
                    editingIndex === betIndex && editingLegIndex === null;
                  const visibleLegs = getVisibleLegs(bet);

                  // Format values for bet row
                  const date = formatDate(bet.placedAt);
                  const site = siteShortNameMap[bet.book] || bet.book;
                  const sport = bet.sport || "";
                  const category = isParlayBet
                    ? "Parlay"
                    : bet.marketCategory?.includes("Prop")
                    ? "Props"
                    : bet.marketCategory?.includes("Main")
                    ? "Main"
                    : bet.marketCategory?.includes("Future")
                    ? "Futures"
                    : "Props";
                  const type = isParlayBet ? "—" : bet.type || "";
                  // For Total bets with two entities, show "Team1 / Team2"
                  const isTotalBet = type.toLowerCase() === "total";
                  const entities = visibleLegs[0]?.leg.entities || bet.legs?.[0]?.entities || [];
                  const name = isParlayBet
                    ? `${getParlayLabel(bet)} (${visibleLegs.length}) ${
                        isExpanded ? "▾" : "▸"
                      }`
                    : isTotalBet && entities.length >= 2
                    ? `${entities[0]} / ${entities[1]}`
                    : bet.name || entities[0] || "";
                  const ou = isParlayBet
                    ? "—"
                    : bet.ou === "Over"
                    ? "O"
                    : bet.ou === "Under"
                    ? "U"
                    : "";
                  const line = isParlayBet ? "—" : bet.line || "";
                  const odds = formatOdds(bet.odds);
                  const betAmount = `$${bet.stake.toFixed(2)}`;
                  const toWinValue = calculateToWin(
                    bet.stake,
                    bet.odds,
                    bet.payout
                  );
                  const toWin = toWinValue ? `$${toWinValue}` : "";
                  const result = capitalizeFirstLetter(bet.result);
                  const netValue = calculateNet(
                    bet.result,
                    bet.stake,
                    bet.odds,
                    bet.payout
                  );
                  const netDisplay = netValue ? `$${netValue}` : "";
                  const live = bet.isLive ? "✓" : "";
                  const tail = bet.tail ? "✓" : "";

                  return (
                    <React.Fragment key={bet.id}>
                      {/* Main bet row */}
                      <tr
                        className={`border-b dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 ${
                          isDuplicate
                            ? "bg-neutral-200 dark:bg-neutral-700/50 opacity-60"
                            : betIssues.length > 0
                            ? "bg-yellow-50 dark:bg-yellow-900/20"
                            : betIndex % 2 === 0
                            ? "bg-white dark:bg-neutral-900"
                            : "bg-neutral-50 dark:bg-neutral-800/50"
                        }`}
                      >
                        <td className="px-2 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {isDuplicate && (
                              <span className="text-xs bg-neutral-400 dark:bg-neutral-600 text-white px-1.5 py-0.5 rounded" title="Already in database">
                                DUP
                              </span>
                            )}
                            {date}
                          </div>
                        </td>
                        <td className="px-2 py-3 font-bold">{site}</td>
                        <td className="px-2 py-3">
                          {isEditing ? (
                            <div className="flex gap-1">
                              <select
                                value={sport}
                                onChange={(e) =>
                                  handleEditBet(
                                    betIndex,
                                    "Sport",
                                    e.target.value
                                  )
                                }
                                className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                              >
                                <option value="">Select</option>
                                {availableSports.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              {sport && !availableSports.includes(sport) && (
                                <button
                                  onClick={() => handleAddSport(sport)}
                                  className="px-1 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                                  title="Add Sport"
                                >
                                  +
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className={!sport ? "text-red-500" : ""}>
                                {sport || "(missing)"}
                              </span>
                              {betIssues.find((i) => i.field === "Sport") && (
                                <button
                                  onClick={() => {
                                    const issue = betIssues.find(
                                      (i) => i.field === "Sport"
                                    );
                                    if (
                                      issue?.message.includes(
                                        "not in database"
                                      ) &&
                                      sport
                                    ) {
                                      handleAddSport(sport);
                                    } else {
                                      setEditingIndex(betIndex);
                                      setEditingLegIndex(null);
                                    }
                                  }}
                                  className="flex-shrink-0"
                                  title={
                                    betIssues.find((i) => i.field === "Sport")
                                      ?.message
                                  }
                                >
                                  <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          {isParlayBet ? (
                            <span>Parlay</span>
                          ) : (
                            <>
                              {isEditing ? (
                                <select
                                  value={category}
                                  onChange={(e) =>
                                    handleEditBet(
                                      betIndex,
                                      "Category",
                                      e.target.value
                                    )
                                  }
                                  className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                                >
                                  <option value="">Select</option>
                                  <option value="Props">Props</option>
                                  <option value="Main">Main</option>
                                  <option value="Futures">Futures</option>
                                </select>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span
                                    className={!category ? "text-red-500" : ""}
                                  >
                                    {category || "(missing)"}
                                  </span>
                                  {betIssues.find(
                                    (i) => i.field === "Category"
                                  ) && (
                                    <button
                                      onClick={() => {
                                        setEditingIndex(betIndex);
                                        setEditingLegIndex(null);
                                      }}
                                      className="flex-shrink-0"
                                      title={
                                        betIssues.find(
                                          (i) => i.field === "Category"
                                        )?.message
                                      }
                                    >
                                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td
                          className={`px-2 py-3 ${
                            !type && !isParlayBet
                              ? "bg-yellow-100 dark:bg-yellow-900/30"
                              : ""
                          }`}
                        >
                          {isParlayBet ? (
                            <span>—</span>
                          ) : (
                            <>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={type}
                                  onChange={(e) =>
                                    handleEditBet(
                                      betIndex,
                                      "Type",
                                      e.target.value
                                    )
                                  }
                                  className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                                  placeholder="e.g., 3pt, Pts"
                                />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span
                                    className={
                                      !type
                                        ? "text-yellow-700 dark:text-yellow-400 font-semibold"
                                        : ""
                                    }
                                  >
                                    {type || "(needs review)"}
                                  </span>
                                  {betIssues.find(
                                    (i) => i.field === "Type"
                                  ) && (
                                    <button
                                      onClick={() => {
                                        setEditingIndex(betIndex);
                                        setEditingLegIndex(null);
                                      }}
                                      className="flex-shrink-0"
                                      title={
                                        betIssues.find(
                                          (i) => i.field === "Type"
                                        )?.message
                                      }
                                    >
                                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-2 py-3 font-medium text-neutral-900 dark:text-white truncate">
                          {isParlayBet ? (
                            <button
                              onClick={() => toggleExpansion(bet.id)}
                              className="flex items-center gap-1 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer"
                            >
                              <span>{name}</span>
                            </button>
                          ) : (
                            <>
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={name}
                                    onChange={(e) =>
                                      handleEditBet(
                                        betIndex,
                                        "Name",
                                        e.target.value
                                      )
                                    }
                                    className="flex-1 p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                                    placeholder="Player/Team name only"
                                  />
                                  {name &&
                                    sport &&
                                    !(availablePlayers[sport] || []).includes(
                                      name
                                    ) && (
                                      <button
                                        onClick={() =>
                                          handleAddPlayer(sport, name)
                                        }
                                        className="px-1 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                                        title="Add Player"
                                      >
                                        +
                                      </button>
                                    )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span
                                    className={
                                      name &&
                                      sport &&
                                      !(availablePlayers[sport] || []).includes(
                                        name
                                      )
                                        ? "text-yellow-600"
                                        : ""
                                    }
                                  >
                                    {name || ""}
                                  </span>
                                  {betIssues.find(
                                    (i) => i.field === "Name"
                                  ) && (
                                    <button
                                      onClick={() => {
                                        const issue = betIssues.find(
                                          (i) => i.field === "Name"
                                        );
                                        if (
                                          issue?.message.includes(
                                            "not in database"
                                          ) &&
                                          name &&
                                          sport
                                        ) {
                                          handleAddPlayer(sport, name);
                                        } else {
                                          setEditingIndex(betIndex);
                                          setEditingLegIndex(null);
                                        }
                                      }}
                                      className="flex-shrink-0"
                                      title={
                                        betIssues.find(
                                          (i) => i.field === "Name"
                                        )?.message
                                      }
                                    >
                                      <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-2 py-3 text-center">
                          {isParlayBet ? (
                            <span>—</span>
                          ) : (
                            <>
                              {isEditing ? (
                                <select
                                  value={bet.ou || ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    handleEditBet(
                                      betIndex,
                                      "O/U",
                                      value === "Over"
                                        ? "Over"
                                        : value === "Under"
                                        ? "Under"
                                        : ""
                                    );
                                  }}
                                  className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                                >
                                  <option value="">—</option>
                                  <option value="Over">O</option>
                                  <option value="Under">U</option>
                                </select>
                              ) : (
                                <span>{ou}</span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-2 py-3 text-center">
                          {isParlayBet ? (
                            <span>—</span>
                          ) : (
                            <>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={line}
                                  onChange={(e) =>
                                    handleEditBet(
                                      betIndex,
                                      "Line",
                                      e.target.value
                                    )
                                  }
                                  className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                                  placeholder="Line"
                                />
                              ) : (
                                <span>{line}</span>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-2 py-3">{odds}</td>
                        <td className="px-2 py-3">{betAmount}</td>
                        <td className="px-2 py-3">{toWin}</td>
                        <td className="px-2 py-3 capitalize">
                          {isEditing ? (
                            <select
                              value={bet.result}
                              onChange={(e) =>
                                handleEditBet(
                                  betIndex,
                                  "Result",
                                  e.target.value
                                )
                              }
                              className="w-full p-1 text-sm border rounded bg-white dark:bg-neutral-800"
                            >
                              <option value="win">Win</option>
                              <option value="loss">Loss</option>
                              <option value="push">Push</option>
                              <option value="pending">Pending</option>
                            </select>
                          ) : (
                            <span>{result}</span>
                          )}
                        </td>
                        <td
                          className={`px-2 py-3 ${
                            parseFloat(netValue || "0") > 0
                              ? "text-accent-500"
                              : parseFloat(netValue || "0") < 0
                              ? "text-danger-500"
                              : ""
                          }`}
                        >
                          {netDisplay}
                        </td>
                        <td 
                          className="px-2 py-3 text-center whitespace-nowrap cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700"
                          onClick={() => handleEditBet(betIndex, "isLive", (!bet.isLive).toString())}
                        >
                          {bet.isLive ? (
                             <Wifi className="w-5 h-5 text-primary-500 mx-auto" />
                          ) : (
                             <div className="w-5 h-5 mx-auto" />
                          )}
                        </td>
                        <td className="px-2 py-3 text-center whitespace-nowrap">
                          {tail}
                        </td>
                        <td className="px-2 py-3">
                          {isEditing ? (
                            <button
                              onClick={() => {
                                setEditingIndex(null);
                                setEditingLegIndex(null);
                              }}
                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              Done
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingIndex(betIndex);
                                setEditingLegIndex(null);
                              }}
                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Expanded legs section for parlays */}
                      {isParlayBet && isExpanded && visibleLegs.length > 0 && (
                        <tr>
                          <td
                            colSpan={16}
                            className="px-2 py-0 bg-neutral-100 dark:bg-neutral-800/30"
                          >
                            <div className="pl-8 pr-2 py-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-neutral-600 dark:text-neutral-400 border-b dark:border-neutral-700">
                                    <th className="px-2 py-2 text-left">#</th>
                                    <th className="px-2 py-2 text-left">
                                      Date
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                      Site
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                      Sport
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                      Category
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                      Name
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                      Type
                                    </th>
                                    <th className="px-2 py-2 text-center">
                                      O/U
                                    </th>
                                    <th className="px-2 py-2 text-center">
                                      Line
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                      Odds
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                      Result
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                      Edit
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleLegs.map((visibleLeg, legIndex) => {
                                    const leg = visibleLeg.leg;
                                    const legIssues = getBetIssues(
                                      bet,
                                      legIndex
                                    );
                                    const isEditingLeg =
                                      editingIndex === betIndex &&
                                      editingLegIndex === legIndex;
                                    const isLegTotal = (leg.market || "").toLowerCase() === "total";
                                    const legEntities = leg.entities || [];
                                    const legName = isLegTotal && legEntities.length >= 2
                                      ? `${legEntities[0]} / ${legEntities[1]}`
                                      : legEntities[0] || "";
                                    const legCategory = classifyLeg(
                                      leg.market,
                                      sport
                                    );
                                    const legType = leg.market || "";
                                    const legOu =
                                      leg.ou === "Over"
                                        ? "O"
                                        : leg.ou === "Under"
                                        ? "U"
                                        : "";
                                    const legLine =
                                      leg.target?.toString() || "";
                                    const legResult = capitalizeFirstLetter(
                                      leg.result
                                    );
                                    const legOdds =
                                      leg.odds !== undefined
                                        ? formatOdds(leg.odds)
                                        : "";

                                    return (
                                      <tr
                                        key={`${visibleLeg.parentIndex}-${
                                          visibleLeg.childIndex ?? "root"
                                        }`}
                                        className={`border-b dark:border-neutral-700 ${
                                          legIssues.length > 0
                                            ? "bg-yellow-50 dark:bg-yellow-900/20"
                                            : "bg-white dark:bg-neutral-900"
                                        }`}
                                      >
                                        <td className="px-2 py-2">
                                          {legIndex + 1}
                                        </td>
                                        <td className="px-2 py-2 text-neutral-400 dark:text-neutral-500">
                                          ↳
                                        </td>
                                        <td className="px-2 py-2 font-bold text-neutral-400 dark:text-neutral-500 text-center">
                                          —
                                        </td>
                                        <td className="px-2 py-2">{sport}</td>
                                        <td className="px-2 py-2">
                                          {isEditingLeg ? (
                                            <select
                                              value={legCategory}
                                              onChange={(e) => {
                                                // Category is derived from market, so we'd need to update market
                                                // For now, just show the category
                                              }}
                                              className="w-full p-1 text-xs border rounded bg-white dark:bg-neutral-800"
                                              disabled
                                            >
                                              <option value={legCategory}>
                                                {legCategory}
                                              </option>
                                            </select>
                                          ) : (
                                            <span>{legCategory}</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-2">
                                          {isEditingLeg ? (
                                            <div className="flex gap-1">
                                              <input
                                                type="text"
                                                value={legName}
                                                onChange={(e) =>
                                                  handleEditBet(
                                                    betIndex,
                                                    "Name",
                                                    e.target.value,
                                                    legIndex
                                                  )
                                                }
                                                className="flex-1 p-1 text-xs border rounded bg-white dark:bg-neutral-800"
                                                placeholder="Player/Team name"
                                              />
                                              {legName &&
                                                sport &&
                                                !(
                                                  availablePlayers[sport] || []
                                                ).includes(legName) && (
                                                  <button
                                                    onClick={() =>
                                                      handleAddPlayer(
                                                        sport,
                                                        legName
                                                      )
                                                    }
                                                    className="px-1 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
                                                    title="Add Player"
                                                  >
                                                    +
                                                  </button>
                                                )}
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-1">
                                              <span
                                                className={
                                                  legName &&
                                                  sport &&
                                                  !(
                                                    availablePlayers[sport] ||
                                                    []
                                                  ).includes(legName)
                                                    ? "text-yellow-600"
                                                    : ""
                                                }
                                              >
                                                {legName || ""}
                                              </span>
                                              {legIssues.find(
                                                (i) => i.field === "Name"
                                              ) && (
                                                <button
                                                  onClick={() => {
                                                    const issue =
                                                      legIssues.find(
                                                        (i) =>
                                                          i.field === "Name"
                                                      );
                                                    if (
                                                      issue?.message.includes(
                                                        "not in database"
                                                      ) &&
                                                      legName &&
                                                      sport
                                                    ) {
                                                      handleAddPlayer(
                                                        sport,
                                                        legName
                                                      );
                                                    } else {
                                                      setEditingIndex(betIndex);
                                                      setEditingLegIndex(
                                                        legIndex
                                                      );
                                                    }
                                                  }}
                                                  className="flex-shrink-0"
                                                  title={
                                                    legIssues.find(
                                                      (i) => i.field === "Name"
                                                    )?.message
                                                  }
                                                >
                                                  <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-2 py-2">
                                          {isEditingLeg ? (
                                            <input
                                              type="text"
                                              value={legType}
                                              onChange={(e) =>
                                                handleEditBet(
                                                  betIndex,
                                                  "Type",
                                                  e.target.value,
                                                  legIndex
                                                )
                                              }
                                              className="w-full p-1 text-xs border rounded bg-white dark:bg-neutral-800"
                                              placeholder="e.g., 3pt, Pts"
                                            />
                                          ) : (
                                            <div className="flex items-center gap-1">
                                              <span
                                                className={
                                                  !legType
                                                    ? "text-yellow-700 dark:text-yellow-400 font-semibold"
                                                    : ""
                                                }
                                              >
                                                {legType || "(needs review)"}
                                              </span>
                                              {legIssues.find(
                                                (i) => i.field === "Type"
                                              ) && (
                                                <button
                                                  onClick={() => {
                                                    setEditingIndex(betIndex);
                                                    setEditingLegIndex(
                                                      legIndex
                                                    );
                                                  }}
                                                  className="flex-shrink-0"
                                                  title={
                                                    legIssues.find(
                                                      (i) => i.field === "Type"
                                                    )?.message
                                                  }
                                                >
                                                  <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {isEditingLeg ? (
                                            <select
                                              value={leg.ou || ""}
                                              onChange={(e) => {
                                                const value = e.target.value;
                                                handleEditBet(
                                                  betIndex,
                                                  "O/U",
                                                  value === "Over"
                                                    ? "Over"
                                                    : value === "Under"
                                                    ? "Under"
                                                    : "",
                                                  legIndex
                                                );
                                              }}
                                              className="w-full p-1 text-xs border rounded bg-white dark:bg-neutral-800"
                                            >
                                              <option value="">—</option>
                                              <option value="Over">O</option>
                                              <option value="Under">U</option>
                                            </select>
                                          ) : (
                                            <span>{legOu}</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          {isEditingLeg ? (
                                            <input
                                              type="text"
                                              value={legLine}
                                              onChange={(e) =>
                                                handleEditBet(
                                                  betIndex,
                                                  "Line",
                                                  e.target.value,
                                                  legIndex
                                                )
                                              }
                                              className="w-full p-1 text-xs border rounded bg-white dark:bg-neutral-800"
                                              placeholder="Line"
                                            />
                                          ) : (
                                            <span>{legLine}</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-2">
                                          {isEditingLeg ? (
                                            <input
                                              type="text"
                                              value={legOdds}
                                              onChange={(e) =>
                                                handleEditBet(
                                                  betIndex,
                                                  "Odds",
                                                  e.target.value,
                                                  legIndex
                                                )
                                              }
                                              className="w-full p-1 text-xs border rounded bg-white dark:bg-neutral-800"
                                              placeholder="e.g., +100, -200"
                                            />
                                          ) : (
                                            <span>{legOdds}</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-2 capitalize">
                                          {isEditingLeg ? (
                                            <select
                                              value={leg.result}
                                              onChange={(e) =>
                                                handleEditBet(
                                                  betIndex,
                                                  "Result",
                                                  e.target.value,
                                                  legIndex
                                                )
                                              }
                                              className="w-full p-1 text-xs border rounded bg-white dark:bg-neutral-800"
                                            >
                                              <option value="win">Win</option>
                                              <option value="loss">Loss</option>
                                              <option value="push">Push</option>
                                              <option value="pending">
                                                Pending
                                              </option>
                                            </select>
                                          ) : (
                                            <span>{legResult}</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-2">
                                          {isEditingLeg ? (
                                            <button
                                              onClick={() => {
                                                setEditingIndex(null);
                                                setEditingLegIndex(null);
                                              }}
                                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                            >
                                              Done
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                setEditingIndex(betIndex);
                                                setEditingLegIndex(legIndex);
                                              }}
                                              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                                            >
                                              Edit
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="text-sm">
            {/* Blocker status - RED - blocks import */}
            {hasBlockers && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="w-4 h-4" />
                <span className="font-medium">
                  {validationSummary.betsWithBlockers} bet{validationSummary.betsWithBlockers !== 1 ? 's' : ''} cannot be imported
                </span>
                <span className="text-neutral-500 dark:text-neutral-400 text-xs">
                  ({validationSummary.totalBlockers} blocking issue{validationSummary.totalBlockers !== 1 ? 's' : ''})
                </span>
              </div>
            )}
            {/* Warning status - YELLOW - allows import */}
            {!hasBlockers && hasWarnings && (
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {validationSummary.totalWarnings} warning{validationSummary.totalWarnings !== 1 ? 's' : ''} (can still import)
                </span>
              </div>
            )}
            {/* All good - GREEN */}
            {!hasBlockers && !hasWarnings && duplicateCount === 0 && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>All bets look good!</span>
              </div>
            )}
            {/* Duplicates info */}
            {duplicateCount > 0 && !hasBlockers && (
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 mt-1">
                <Info className="w-4 h-4" />
                <span>
                  {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} will be skipped
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(importSummary)}
              disabled={hasBlockers || importSummary.netNew === 0}
              type="button"
              className={`px-4 py-2 rounded-lg ${
                hasBlockers || importSummary.netNew === 0
                  ? 'bg-neutral-400 text-neutral-200 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
              title={
                hasBlockers 
                  ? 'Fix blocking issues before importing' 
                  : importSummary.netNew === 0 
                  ? 'No new bets to import' 
                  : undefined
              }
            >
              {hasBlockers
                ? `Cannot Import (${validationSummary.betsWithBlockers} blocked)`
                : importSummary.netNew === 0
                ? 'No New Bets'
                : `Import ${importSummary.netNew} Bet${importSummary.netNew !== 1 ? 's' : ''}`
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
