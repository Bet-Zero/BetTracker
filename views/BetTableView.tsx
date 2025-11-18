import React, { useState, useMemo, useCallback } from "react";
import { useBets } from "../hooks/useBets";
import { useInputs } from "../hooks/useInputs";
import {
  Bet,
  SportsbookName,
  BetResult,
  MarketCategory,
  BetLeg,
  BetType,
} from "../types";
import { Wifi } from "../components/icons";
import { MARKET_CATEGORIES } from "../constants";

interface FlatBet {
  id: string; // unique ID for the row, e.g., bet.id or bet.id-leg-index
  betId: string; // original bet ID, for updates
  date: string;
  site: SportsbookName;
  sport: string;
  type: string;
  category: MarketCategory;
  name: string;
  ou?: "Over" | "Under";
  line?: string | number;
  odds?: number;
  bet: number;
  toWin: number; // Potential Payout (stake + profit)
  result: BetResult;
  net: number;
  isLive: boolean;
  overallResult: BetResult;
  tail?: string;
}

// --- Calculation Helper ---
const calculateProfit = (stake: number, odds: number): number => {
  if (isNaN(stake) || isNaN(odds) || stake <= 0) return 0;
  if (odds > 0) {
    return stake * (odds / 100);
  } else if (odds < 0) {
    return stake / (Math.abs(odds) / 100);
  }
  return 0;
};

// --- Formatting Helpers ---
const formatDate = (isoString: string) => {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Invalid Date";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
};

const abbreviateMarket = (market: string): string => {
  if (!market) return "";
  const lowerMarket = market.toLowerCase();

  const abbreviations: { [key: string]: string } = {
    "player points": "Pts",
    points: "Pts",
    "player rebounds": "Reb",
    rebounds: "Reb",
    "player assists": "Ast",
    assists: "Ast",
    "passing touchdowns": "Pass TD",
    "receiving yards": "Rec Yds",
    moneyline: "ML",
    "player threes": "3pt",
    "to record a triple-double": "TD",
    "rushing yards": "Rush Yds",
    "anytime touchdown scorer": "ATTD",
    "home runs": "HR",
    "player home runs": "HR",
    "player strikeouts": "Ks",
    strikeouts: "Ks",
    "player hits": "Hits",
    hits: "Hits",
    "total points": "Total",
    "total goals": "Total",
    "run line": "RL",
    spread: "Sprd",
    "passing yards": "Pass Yds",
    "outright winner": "Future",
    "to win outright": "Future",
  };
  return abbreviations[lowerMarket] || market;
};

// --- Editable Cell Components ---

const EditableCell: React.FC<{
  value: string | number;
  onSave: (newValue: string) => void;
  type?: "text" | "number";
  formatAsOdds?: boolean;
  suggestions?: string[];
  className?: string;
}> = ({
  value,
  onSave,
  type = "text",
  formatAsOdds = false,
  suggestions = [],
  className = "",
}) => {
  const [text, setText] = useState(value?.toString() || "");
  const listId = useMemo(() => `suggestions-${Math.random()}`, []);

  // Update internal state if the external value prop changes
  React.useEffect(() => {
    setText(value?.toString() || "");
  }, [value]);

  const handleBlur = () => {
    let formattedText = text;

    // Auto-format odds to add '+' for positive numbers if it's not there
    if (
      formatAsOdds &&
      type === "number" &&
      formattedText.match(/^[0-9]+(\.[0-9]+)?$/)
    ) {
      // It's a positive number without a sign
      formattedText = `+${formattedText}`;
    }

    // Always update the visual state to the formatted version
    setText(formattedText);

    // Only call onSave if the final formatted value is different from the original prop
    if (value?.toString() !== formattedText) {
      onSave(formattedText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setText(value?.toString() || "");
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <>
      <input
        type={type === "number" ? "text" : "text"} // Use text to allow for '+' sign
        inputMode={type === "number" ? "decimal" : "text"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none focus:bg-neutral-100 dark:focus:bg-neutral-800 rounded text-sm ${className}`}
        placeholder=""
        list={suggestions.length > 0 ? listId : undefined}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </>
  );
};

const ResultCell: React.FC<{
  value: BetResult;
  onSave: (newValue: BetResult) => void;
}> = ({ value, onSave }) => {
  return (
    <select
      value={value}
      onChange={(e) => onSave(e.target.value as BetResult)}
      className="bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none capitalize font-semibold rounded"
    >
      <option value="win">Win</option>
      <option value="loss">Loss</option>
      <option value="push">Push</option>
      <option value="pending">Pending</option>
    </select>
  );
};

const OUCell: React.FC<{
  value?: "Over" | "Under";
  onSave: (newValue: "Over" | "Under" | undefined) => void;
}> = ({ value, onSave }) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onSave(val === "Over" || val === "Under" ? val : undefined);
  };

  return (
    <select
      value={value || "none"}
      onChange={handleChange}
      className="bg-transparent w-full p-0 m-0 border-none focus:ring-0 focus:outline-none capitalize font-semibold rounded text-center focus:bg-neutral-100 dark:focus:bg-neutral-800 appearance-none"
    >
      <option value="none"></option>
      <option value="Over">O</option>
      <option value="Under">U</option>
    </select>
  );
};

const BetTableView: React.FC = () => {
  const { bets, loading, updateBet } = useBets();
  const {
    sportsbooks,
    sports,
    betTypes,
    players,
    teams,
    addSport,
    addBetType,
    addPlayer,
    addTeam,
  } = useInputs();
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{
    sport: string | "all";
    type: string | "all";
    result: BetResult | "all";
    category: MarketCategory | "all";
  }>({
    sport: "all",
    type: "all",
    result: "all",
    category: "all",
  });
  const [sortConfig, setSortConfig] = useState<{
    key: keyof FlatBet;
    direction: "asc" | "desc";
  } | null>({ key: "date", direction: "desc" });

  const siteShortNameMap = useMemo(() => {
    return sportsbooks.reduce((acc, book) => {
      acc[book.name] = book.abbreviation;
      return acc;
    }, {} as Record<SportsbookName, string>);
  }, [sportsbooks]);

  const flattenedBets = useMemo(() => {
    const flatBets: FlatBet[] = [];
    bets.forEach((bet) => {
      const isLive = bet.betType === "live";

      // Calculate potential profit from stake and odds.
      const potentialProfit = calculateProfit(bet.stake, bet.odds);

      // "To Win" is the total potential payout (stake + profit).
      // For a push, the payout is just the stake.
      const toWin =
        bet.result === "push" ? bet.stake : bet.stake + potentialProfit;

      // "Net" is the actualized profit or loss.
      let net = 0;
      if (bet.result === "win") {
        // For a win, the net profit is the calculated profit amount.
        net = potentialProfit;
      } else if (bet.result === "loss") {
        net = -bet.stake; // For a loss, the net is the stake lost.
      }
      // For 'push' or 'pending', net remains 0, which is correct.

      if (!bet.legs || bet.legs.length === 0) {
        // Handles single bets without leg data
        flatBets.push({
          id: bet.id,
          betId: bet.id,
          date: bet.placedAt,
          site: bet.book,
          sport: bet.sport,
          bet: bet.stake,
          toWin: toWin,
          net,
          overallResult: bet.result,
          type: isLive ? "live" : bet.betType,
          category: bet.marketCategory,
          name: bet.description,
          ou: undefined,
          line: undefined,
          odds: bet.odds,
          result: bet.result,
          isLive,
          tail: bet.tail,
        });
      } else {
        // Handles parlays, SGPs, and single bets with structured leg data
        bet.legs.forEach((leg, index) => {
          flatBets.push({
            id: `${bet.id}-leg-${index}`,
            betId: bet.id,
            date: bet.placedAt,
            site: bet.book,
            sport: bet.sport,
            bet: bet.stake,
            toWin: toWin, // Parlay payout is for the whole bet
            net, // Parlay net is for the whole bet
            overallResult: bet.result,
            type: leg.market,
            category: bet.marketCategory,
            name:
              leg.entities?.join(" / ") ||
              (bet.legs.length === 1 ? bet.description : "N/A"),
            ou: leg.ou,
            line: leg.target,
            odds: bet.odds, // All legs share bet-level odds for SGPs/parlays
            result: leg.result,
            isLive,
            tail: bet.tail,
          });
        });
      }
    });
    return flatBets;
  }, [bets]);

  const handleLegUpdate = useCallback(
    (betId: string, legIndex: number, updates: Partial<BetLeg>) => {
      const originalBet = bets.find((b) => b.id === betId);
      if (
        !originalBet ||
        !originalBet.legs ||
        legIndex >= originalBet.legs.length
      )
        return;

      const newLegs = originalBet.legs.map((leg, index) => {
        if (index === legIndex) {
          return { ...leg, ...updates };
        }
        return leg;
      });

      updateBet(betId, { legs: newLegs });
    },
    [bets, updateBet]
  );

  // Very basic entity detection for auto-add
  const autoAddEntity = (sport: string, entity: string, market: string) => {
    const lowerMarket = market.toLowerCase();
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
    const isTeamMarket = teamMarketKeywords.some((keyword) =>
      lowerMarket.includes(keyword)
    );
    const isPlayerMarket = playerMarketKeywords.some((keyword) =>
      lowerMarket.includes(keyword)
    );

    if (isPlayerMarket && !isTeamMarket) {
      addPlayer(sport, entity);
    } else if (isTeamMarket && !isPlayerMarket) {
      addTeam(sport, entity);
    } else {
      const teamSports = ["NFL", "NBA", "MLB", "NHL", "Soccer"];
      if (teamSports.includes(sport)) {
        addTeam(sport, entity);
      } else {
        addPlayer(sport, entity);
      }
    }
  };

  const availableTypes = useMemo(() => {
    if (filters.sport === "all") {
      return Array.from(new Set(Object.values(betTypes).flat())).sort();
    }
    return (betTypes[filters.sport] || []).sort();
  }, [betTypes, filters.sport]);

  const availableSites = useMemo(
    () => sportsbooks.map((b) => b.name).sort(),
    [sportsbooks]
  );
  const suggestionLists = useMemo(
    () => ({
      sports: sports,
      sites: availableSites,
      categories: MARKET_CATEGORIES,
      types: (sport: string) => betTypes[sport] || [],
      players: (sport: string) => players[sport] || [],
      teams: (sport: string) => teams[sport] || [],
    }),
    [sports, availableSites, betTypes, players, teams]
  );

  const filteredBets = useMemo(() => {
    return flattenedBets.filter(
      (bet) =>
        (filters.sport === "all" || bet.sport === filters.sport) &&
        (filters.type === "all" || bet.type === filters.type) &&
        (filters.result === "all" ||
          bet.result === filters.result ||
          bet.overallResult === filters.result) &&
        (filters.category === "all" || bet.category === filters.category) &&
        (searchTerm === "" ||
          bet.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bet.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bet.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bet.tail?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [flattenedBets, filters, searchTerm]);

  const sortedBets = useMemo(() => {
    let sortableBets = [...filteredBets];
    if (sortConfig !== null) {
      sortableBets.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (sortConfig.key === "date") {
          return sortConfig.direction === "asc"
            ? new Date(aValue as string).getTime() -
                new Date(bValue as string).getTime()
            : new Date(bValue as string).getTime() -
                new Date(aValue as string).getTime();
        }

        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableBets;
  }, [filteredBets, sortConfig]);

  const requestSort = (key: keyof FlatBet) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const FilterControl: React.FC<{
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    options: string[];
  }> = ({ label, value, onChange, options }) => (
    <div>
      <label className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mr-2">
        {label}:
      </label>
      <select
        value={value}
        onChange={onChange}
        className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md p-1 text-sm"
      >
        <option value="all">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );

  const headers: {
    key: keyof FlatBet;
    label: string;
    style: React.CSSProperties;
  }[] = [
    { key: "date", label: "Date", style: { width: "5%" } },
    { key: "site", label: "Site", style: { width: "4%" } },
    { key: "sport", label: "Sport", style: { width: "4%" } },
    { key: "category", label: "Category", style: { width: "8%" } },
    { key: "type", label: "Type", style: { width: "8%" } },
    { key: "name", label: "Name", style: {} }, // Flexible width
    { key: "ou", label: "O/U", style: { width: "4%", textAlign: "center" } },
    { key: "line", label: "Line", style: { width: "4%", textAlign: "center" } },
    { key: "odds", label: "Odds", style: { width: "5%" } },
    { key: "bet", label: "Bet", style: { width: "6%" } },
    { key: "toWin", label: "To Win", style: { width: "5%" } },
    { key: "result", label: "Result", style: { width: "7%" } },
    { key: "net", label: "Net", style: { width: "6%" } },
    {
      key: "isLive",
      label: "Live",
      style: { width: "3%", textAlign: "center" },
    },
    { key: "tail", label: "Tail", style: { width: "8%" } },
  ];

  const formatOdds = (odds: number | undefined): string => {
    if (odds === undefined || odds === null) return "";
    if (odds > 0) return `+${odds}`;
    return odds.toString();
  };

  return (
    <div className="p-6 h-full flex flex-col space-y-4 bg-neutral-100 dark:bg-neutral-950">
      <header>
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
          Bet Table
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          View, sort, and filter all your imported bets.
        </p>
      </header>

      <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg shadow-md flex items-center justify-between space-x-4">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow p-2 border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 placeholder-neutral-400 dark:placeholder-neutral-500"
        />
        <div className="flex items-center space-x-4">
          <FilterControl
            label="Sport"
            value={filters.sport}
            onChange={(e) =>
              setFilters({
                ...filters,
                sport: e.target.value as any,
                type: "all",
              })
            }
            options={sports}
          />
          <FilterControl
            label="Category"
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value as any })
            }
            options={MARKET_CATEGORIES}
          />
          <FilterControl
            label="Type"
            value={filters.type}
            onChange={(e) =>
              setFilters({ ...filters, type: e.target.value as any })
            }
            options={availableTypes}
          />
          <FilterControl
            label="Result"
            value={filters.result}
            onChange={(e) =>
              setFilters({ ...filters, result: e.target.value as any })
            }
            options={["win", "loss", "push", "pending"]}
          />
        </div>
      </div>

      <div className="flex-grow bg-white dark:bg-neutral-900 rounded-lg shadow-md overflow-auto">
        <table className="w-full text-sm text-left text-neutral-500 dark:text-neutral-400 table-fixed">
          <thead className="text-xs text-neutral-700 uppercase bg-neutral-50 dark:bg-neutral-800 dark:text-neutral-400 sticky top-0 z-10">
            <tr className="whitespace-nowrap">
              {headers.map((header) => (
                <th
                  key={header.key}
                  scope="col"
                  className="px-2 py-3"
                  style={header.style}
                >
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="text-center p-8">
                  Loading bets...
                </td>
              </tr>
            ) : sortedBets.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="text-center p-8">
                  No bets found matching your criteria.
                </td>
              </tr>
            ) : (
              sortedBets.map((row) => {
                const isLeg = row.id.includes("-leg-");
                const legIndex = isLeg
                  ? parseInt(row.id.split("-leg-").pop()!, 10)
                  : -1;
                const net = row.net;
                const resultColorClass =
                  net > 0
                    ? "bg-accent-500/10"
                    : net < 0
                    ? "bg-danger-500/10"
                    : "";
                const netColorClass =
                  net > 0
                    ? "text-accent-500"
                    : net < 0
                    ? "text-danger-500"
                    : "";

                return (
                  <tr
                    key={row.id}
                    className="border-b dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 odd:bg-white dark:odd:bg-neutral-900 even:bg-neutral-50 dark:even:bg-neutral-800/50 whitespace-nowrap"
                  >
                    <td className="px-2 py-2">{formatDate(row.date)}</td>
                    <td className="px-2 py-2 font-bold">
                      <EditableCell
                        value={siteShortNameMap[row.site] || row.site}
                        onSave={(val) => {
                          const book = sportsbooks.find(
                            (b) =>
                              b.name.toLowerCase() === val.toLowerCase() ||
                              b.abbreviation.toLowerCase() === val.toLowerCase()
                          );
                          updateBet(row.betId, {
                            book: book ? book.name : val,
                          });
                        }}
                        suggestions={suggestionLists.sites}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <EditableCell
                        value={row.sport}
                        onSave={(val) => {
                          addSport(val);
                          updateBet(row.betId, { sport: val });
                        }}
                        suggestions={suggestionLists.sports}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <EditableCell
                        value={row.category}
                        onSave={(val) =>
                          updateBet(row.betId, {
                            marketCategory: val as MarketCategory,
                          })
                        }
                        suggestions={suggestionLists.categories}
                      />
                    </td>
                    <td className="px-2 py-2 capitalize">
                      <EditableCell
                        value={row.type}
                        onSave={(val) => {
                          if (isLeg) {
                            addBetType(row.sport, val);
                            handleLegUpdate(row.betId, legIndex, {
                              market: val,
                            });
                          } else {
                            updateBet(row.betId, { betType: val as BetType });
                          }
                        }}
                        suggestions={
                          isLeg
                            ? suggestionLists.types(row.sport)
                            : ["single", "parlay", "sgp", "live", "other"]
                        }
                      />
                    </td>
                    <td className="px-2 py-2 font-medium text-neutral-900 dark:text-white truncate">
                      <EditableCell
                        value={row.name}
                        onSave={(val) => {
                          if (isLeg) {
                            autoAddEntity(row.sport, val, row.type);
                            handleLegUpdate(row.betId, legIndex, {
                              entities: [val],
                            });
                          } else {
                            autoAddEntity(row.sport, val, row.type);
                            updateBet(row.betId, { description: val });
                          }
                        }}
                        suggestions={[
                          ...suggestionLists.players(row.sport),
                          ...suggestionLists.teams(row.sport),
                        ]}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      {isLeg ? (
                        <OUCell
                          value={row.ou}
                          onSave={(val) =>
                            handleLegUpdate(row.betId, legIndex, { ou: val })
                          }
                        />
                      ) : row.ou ? (
                        row.ou[0]
                      ) : (
                        ""
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <EditableCell
                        value={row.line || ""}
                        type="text"
                        onSave={(val) => {
                          if (isLeg) {
                            handleLegUpdate(row.betId, legIndex, {
                              target: val,
                            });
                          }
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <EditableCell
                        value={formatOdds(row.odds)}
                        type="number"
                        formatAsOdds={true}
                        onSave={(val) => {
                          const numVal = parseInt(val.replace("+", ""), 10);
                          if (!isNaN(numVal)) {
                            // Always update the main bet's odds, which drives the "To Win" calculation.
                            updateBet(row.betId, { odds: numVal });
                          }
                        }}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                          $
                        </span>
                        <EditableCell
                          value={row.bet.toFixed(2)}
                          type="number"
                          onSave={(val) => {
                            const numVal = parseFloat(val);
                            if (!isNaN(numVal))
                              updateBet(row.betId, { stake: numVal });
                          }}
                          className="pl-5"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">${row.toWin.toFixed(2)}</td>
                    <td className={`px-2 py-2 capitalize ${resultColorClass}`}>
                      <div
                        className={
                          net > 0
                            ? "text-accent-600 dark:text-accent-400"
                            : net < 0
                            ? "text-danger-600 dark:text-danger-400"
                            : ""
                        }
                      >
                        <ResultCell
                          value={isLeg ? row.result : row.overallResult}
                          onSave={(val) => {
                            if (isLeg) {
                              handleLegUpdate(row.betId, legIndex, {
                                result: val,
                              });
                            } else {
                              updateBet(row.betId, { result: val });
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td
                      className={`px-2 py-2 font-bold ${resultColorClass} ${netColorClass}`}
                    >
                      {net < 0 ? "-" : ""}${Math.abs(net).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {row.isLive && (
                        <Wifi
                          className="w-5 h-5 text-primary-500 mx-auto"
                          title="Live Bet"
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <EditableCell
                        value={row.tail || ""}
                        onSave={(newValue) => {
                          updateBet(row.betId, { tail: newValue });
                        }}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BetTableView;
