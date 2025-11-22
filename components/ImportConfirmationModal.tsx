import React, { useState, useMemo } from "react";
import { Bet, Sportsbook, MarketCategory, BetLeg } from "../types";
import { X, AlertTriangle, CheckCircle2 } from "./icons";

interface ImportConfirmationModalProps {
  bets: Bet[];
  onConfirm: () => void;
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

const formatOdds = (odds: number): string => {
  if (odds > 0) return `+${odds}`;
  return odds.toString();
};

const calculateToWin = (stake: number, odds: number): string => {
  let profit = 0;
  if (odds > 0) {
    profit = stake * (odds / 100);
  } else if (odds < 0) {
    profit = stake / (Math.abs(odds) / 100);
  }
  const toWin = stake + profit;
  return toWin.toFixed(2);
};

const calculateNet = (
  result: string,
  stake: number,
  odds: number,
  payout?: number
): string => {
  const resultLower = result.toLowerCase();
  if (resultLower === "win") {
    if (payout !== undefined && payout > 0) {
      const net = payout - stake;
      return net.toFixed(2);
    }
    let profit = 0;
    if (odds > 0) {
      profit = stake * (odds / 100);
    } else if (odds < 0) {
      profit = stake / (Math.abs(odds) / 100);
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

// Determine category for a leg based on its market
const getLegCategory = (market: string): string => {
  const lower = market.toLowerCase();
  if (lower.includes("prop")) return "Props";
  if (
    lower.includes("main") ||
    lower.includes("spread") ||
    lower.includes("total") ||
    lower.includes("moneyline")
  )
    return "Main";
  if (lower.includes("future")) return "Futures";
  return "Props"; // Default
};

export const ImportConfirmationModal: React.FC<
  ImportConfirmationModalProps
> = ({
  bets,
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

    if (!bet.sport || bet.sport.trim() === "") {
      issues.push({ field: "Sport", message: "Sport is missing" });
    } else if (!availableSports.includes(bet.sport)) {
      issues.push({
        field: "Sport",
        message: `Sport "${bet.sport}" not in database`,
      });
    }

    if (legIndex !== undefined && bet.legs) {
      // Checking leg-level issues
      const leg = bet.legs[legIndex];
      const legCategory = getLegCategory(leg.market);

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
      if (bet.betType === "single" || !bet.legs || bet.legs.length === 1) {
        const betName = bet.name || bet.legs?.[0]?.entities?.[0] || "";
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
      const isParlay = bet.legs && bet.legs.length > 1;
      if (isParlay) {
        // Check bet-level issues
        const betIssues = getBetIssues(bet);
        if (betIssues.length > 0) return true;
        // Check all leg issues
        return bet.legs!.some(
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

    if (legIndex !== undefined && bet.legs) {
      // Editing a leg field
      const newLegs = [...bet.legs];
      const leg = { ...newLegs[legIndex] };

      switch (field) {
        case "Name":
          leg.entities = [value];
          break;
        case "Type":
          leg.market = value;
          break;
        case "O/U":
          leg.ou =
            value === "Over" ? "Over" : value === "Under" ? "Under" : undefined;
          break;
        case "Line":
          leg.target = value;
          break;
        case "Result":
          leg.result = value as any;
          break;
      }

      newLegs[legIndex] = leg;
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
      }
    }

    if (Object.keys(updates).length > 0) {
      onEditBet(betIndex, updates);
    }
  };

  // Determine if a bet is a parlay/SGP
  const isParlay = (bet: Bet): boolean => {
    return !!(bet.legs && bet.legs.length > 1);
  };

  // Get parlay label
  const getParlayLabel = (bet: Bet): string => {
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
              bet{bets.length !== 1 ? "s" : ""} ready to import. Review and fix
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
                  const isEditing =
                    editingIndex === betIndex && editingLegIndex === null;

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
                  const name = isParlayBet
                    ? `${getParlayLabel(bet)} (${bet.legs!.length}) ${
                        isExpanded ? "▾" : "▸"
                      }`
                    : bet.name || bet.legs?.[0]?.entities?.[0] || "";
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
                  const toWin = `$${calculateToWin(bet.stake, bet.odds)}`;
                  const result = capitalizeFirstLetter(bet.result);
                  const net = calculateNet(
                    bet.result,
                    bet.stake,
                    bet.odds,
                    bet.payout
                  );
                  const netDisplay = net ? `$${net}` : "";
                  const live = bet.isLive ? "✓" : "";
                  const tail = bet.tail ? "✓" : "";

                  return (
                    <React.Fragment key={bet.id}>
                      {/* Main bet row */}
                      <tr
                        className={`border-b dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 ${
                          betIssues.length > 0
                            ? "bg-yellow-50 dark:bg-yellow-900/20"
                            : betIndex % 2 === 0
                            ? "bg-white dark:bg-neutral-900"
                            : "bg-neutral-50 dark:bg-neutral-800/50"
                        }`}
                      >
                        <td className="px-2 py-3 whitespace-nowrap">{date}</td>
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
                            parseFloat(net || "0") > 0
                              ? "text-accent-500"
                              : parseFloat(net || "0") < 0
                              ? "text-danger-500"
                              : ""
                          }`}
                        >
                          {netDisplay}
                        </td>
                        <td className="px-2 py-3 text-center whitespace-nowrap">
                          {live}
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
                      {isParlayBet && isExpanded && bet.legs && (
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
                                      Result
                                    </th>
                                    <th className="px-2 py-2 text-left">
                                      Edit
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {bet.legs.map((leg, legIndex) => {
                                    const legIssues = getBetIssues(
                                      bet,
                                      legIndex
                                    );
                                    const isEditingLeg =
                                      editingIndex === betIndex &&
                                      editingLegIndex === legIndex;
                                    const legName = leg.entities?.[0] || "";
                                    const legCategory = getLegCategory(
                                      leg.market
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

                                    return (
                                      <tr
                                        key={legIndex}
                                        className={`border-b dark:border-neutral-700 ${
                                          legIssues.length > 0
                                            ? "bg-yellow-50 dark:bg-yellow-900/20"
                                            : "bg-white dark:bg-neutral-900"
                                        }`}
                                      >
                                        <td className="px-2 py-2">
                                          {legIndex + 1}
                                        </td>
                                        <td className="px-2 py-2">{date}</td>
                                        <td className="px-2 py-2 font-bold">
                                          {site}
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
          <div className="text-sm text-neutral-600 dark:text-neutral-400">
            {hasAnyIssues && (
              <span className="text-yellow-600 dark:text-yellow-400">
                Some bets have issues that need attention
              </span>
            )}
            {!hasAnyIssues && (
              <span className="text-green-600 dark:text-green-400">
                All bets look good!
              </span>
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
              onClick={onConfirm}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Import {bets.length} Bet{bets.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
