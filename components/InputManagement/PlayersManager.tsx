import React, { useState, useMemo, useEffect } from "react";
import {
  useNormalizationData,
  PlayerData,
  getTeamById,
  TeamData,
} from "../../hooks/useNormalizationData";
import { SPORTS, Sport } from "../../data/referenceData";
import { Plus, X, Lock, Unlock } from "../../components/icons";
import DenseRow from "./DenseRow";
import SearchInput from "./SearchInput";
import { useEntitySearch } from "../../hooks/useEntitySearch";

// Sport sub-tab pills - Segmented control style
const SportPills: React.FC<{
  sports: readonly string[];
  selected: string;
  onSelect: (sport: string) => void;
  counts?: Record<string, number>;
}> = ({ sports, selected, onSelect, counts }) => (
  <div className="inline-flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 gap-1">
    <button
      onClick={() => onSelect("All")}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
        selected === "All"
          ? "bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm"
          : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
      }`}
    >
      All {counts && counts["All"] !== undefined && `(${counts["All"]})`}
    </button>
    {sports.map((sport) => (
      <button
        key={sport}
        onClick={() => onSelect(sport)}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
          selected === sport
            ? "bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm"
            : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
        }`}
      >
        {sport} {counts && counts[sport] !== undefined && `(${counts[sport]})`}
      </button>
    ))}
  </div>
);

const PlayersManager: React.FC = () => {
  const {
    players,
    teams,
    updatePlayer,
    removePlayer,
    disablePlayer,
    enablePlayer,
    addPlayer,
  } = useNormalizationData();
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [showDisabled, setShowDisabled] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<PlayerData | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Use search hook
  const {
    query,
    setQuery,
    filteredEntities: filteredPlayers,
  } = useEntitySearch(players, "", selectedSport, showDisabled);

  // Reset windowing and expansion when filters change
  useEffect(() => {
    setVisibleCount(50);
    setExpandedPlayer(null);
  }, [query, selectedSport, showDisabled]);

  // Count by sport (memoized)
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    players.forEach((p) => {
      if (!showDisabled && p.disabled) return;
      counts["All"]++;
      counts[p.sport] = (counts[p.sport] || 0) + 1;
    });
    return counts;
  }, [players, showDisabled]);

  // Sort players by Team then Name
  const sortedPlayers = useMemo(() => {
    // Create a map for fast team lookup
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    const getTeamName = (p: PlayerData): string => {
      if (p.teamId) {
        const t = teamMap.get(p.teamId);
        return t ? t.canonical : "(Unknown Team)";
      }
      if (p.team) return p.team;
      return "zzz_No Team"; // Sort at bottom
    };

    return [...filteredPlayers].sort((a, b) => {
      const teamA = getTeamName(a);
      const teamB = getTeamName(b);

      if (teamA < teamB) return -1;
      if (teamA > teamB) return 1;
      return a.canonical.localeCompare(b.canonical);
    });
  }, [filteredPlayers, teams]);

  const handleSaveEdit = () => {
    if (!editForm) return;
    if (isAdding) {
      if (!addPlayer(editForm)) {
        alert("Player already exists");
        return;
      }
    } else {
      updatePlayer(editForm.canonical, editForm.sport, editForm);
    }
    setEditForm(null);
    setIsAdding(false);
    setExpandedPlayer(null);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 50);
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Toolbar Section */}
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 mb-4 border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3 flex-1">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search players..."
              className="max-w-xs"
            />
            <label className="flex items-center space-x-1.5 text-xs text-neutral-600 dark:text-neutral-400 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showDisabled}
                onChange={(e) => setShowDisabled(e.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-600 text-primary-600 focus:ring-primary-500"
              />
              <span>Show disabled</span>
            </label>
          </div>
          <button
            onClick={() => {
              setIsAdding(true);
              setEditForm({ canonical: "", sport: "NBA", aliases: [], team: "" });
              setExpandedPlayer("__new__");
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-md shadow-primary-600/20 hover:shadow-lg hover:shadow-primary-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Player</span>
          </button>
        </div>

        {/* Sport pills */}
        <SportPills
          sports={SPORTS}
          selected={selectedSport}
          onSelect={setSelectedSport}
          counts={sportCounts}
        />
      </div>

      {/* List Container - Card with shadow */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-md">
        <div className="p-2">
        {isAdding && editForm && (
          <div className="border-b border-neutral-200 dark:border-neutral-700 bg-blue-50 dark:bg-blue-950/30">
            <PlayerEditPanel
              player={editForm}
              onChange={setEditForm}
              onSave={handleSaveEdit}
              onCancel={() => {
                setIsAdding(false);
                setEditForm(null);
                setExpandedPlayer(null);
              }}
              isNew
            />
          </div>
        )}

        {sortedPlayers.slice(0, visibleCount).map((player, index, arr) => {
          const rowKey = player.id || `${player.canonical}::${player.sport}`;
          // Resolve team name for display
          let teamDisplay = "";
          let rawTeamName = "zzz_No Team"; // For header comparison

          if (player.teamId) {
            const t = getTeamById(player.teamId);
            if (t) {
              teamDisplay = t.canonical;
              rawTeamName = t.canonical;
            }
          } else if (player.team) {
            // Fallback for legacy
            teamDisplay = player.team;
            rawTeamName = player.team;
          }

          // Determine if we need a header
          let showHeader = false;
          if (index === 0) {
            showHeader = true;
          } else {
            const prevPlayer = arr[index - 1];
            let prevTeamName = "zzz_No Team";
            if (prevPlayer.teamId) {
              const t = getTeamById(prevPlayer.teamId);
              if (t) prevTeamName = t.canonical;
            } else if (prevPlayer.team) {
              prevTeamName = prevPlayer.team;
            }
            if (rawTeamName !== prevTeamName) {
              showHeader = true;
            }
          }

          return (
            <React.Fragment key={rowKey}>
              {showHeader && (
                <div className="sticky top-0 z-10 px-4 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-y border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                  {rawTeamName === "zzz_No Team" ? "(No Team)" : rawTeamName}
                </div>
              )}
              <DenseRow
                key={rowKey}
                name={player.canonical}
                subtitle={`${player.sport}${
                  teamDisplay ? ` · ${teamDisplay}` : ""
                }`}
                aliasCount={player.aliases.length}
                disabled={player.disabled}
                expanded={expandedPlayer === rowKey}
                onToggleExpand={() =>
                  setExpandedPlayer(expandedPlayer === rowKey ? null : rowKey)
                }
                onDisable={() => disablePlayer(player.canonical, player.sport)}
                onEnable={() => enablePlayer(player.canonical, player.sport)}
                onDelete={() => removePlayer(player.canonical, player.sport)}
              >
                <PlayerEditPanel
                  player={player}
                  onChange={(updated) =>
                    updatePlayer(player.canonical, player.sport, updated)
                  }
                  onSave={() => setExpandedPlayer(null)}
                  onCancel={() => setExpandedPlayer(null)}
                />
              </DenseRow>
            </React.Fragment>
          );
        })}

        {filteredPlayers.length === 0 && !isAdding ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No players found.
          </div>
        ) : filteredPlayers.length > visibleCount ? (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors border-t border-neutral-100 dark:border-neutral-800"
          >
            Show {Math.min(50, filteredPlayers.length - visibleCount)} more... (
            {filteredPlayers.length - visibleCount} remaining)
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
};

// Player edit panel
const PlayerEditPanel: React.FC<{
  player: PlayerData;
  onChange: (player: PlayerData) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}> = ({ player, onChange, onSave, onCancel, isNew }) => {
  const [newAlias, setNewAlias] = useState("");
  const { teams } = useNormalizationData();
  const [isLocked, setIsLocked] = useState(!isNew);

  // Filter teams by sport for the selector
  const sportTeams = useMemo(() => {
    return teams
      .filter((t) => t.sport === player.sport)
      .sort((a, b) => a.canonical.localeCompare(b.canonical));
  }, [teams, player.sport]);

  // Handing change of sport -> clear team selection as it might match another sport
  const handleSportChange = (newSport: Sport) => {
    onChange({
      ...player,
      sport: newSport,
      teamId: undefined,
      team: undefined, // Clear legacy field too
    });
  };

  // Prevent keyboard events from bubbling up when editing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className={`space-y-3 ${
        isNew ? "p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-900" : ""
      }`}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="relative">
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
            Canonical Name
          </label>
          {!isNew && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsLocked(!isLocked);
              }}
              className={`absolute top-0 right-0 p-0.5 rounded border transition-colors ${
                isLocked
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-transparent hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  : "bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-700"
              }`}
              title={isLocked ? "Unlock to edit" : "Lock to prevent changes"}
            >
              {isLocked ? (
                <Lock className="w-3 h-3" />
              ) : (
                <Unlock className="w-3 h-3" />
              )}
            </button>
          )}
          <input
            type="text"
            value={player.canonical}
            onChange={(e) => onChange({ ...player, canonical: e.target.value })}
            onKeyDown={handleKeyDown}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-50 dark:disabled:bg-neutral-800/50 disabled:text-neutral-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
            placeholder="e.g., Kobe Bryant"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
            Sport
          </label>
          <select
            value={player.sport}
            onChange={(e) => handleSportChange(e.target.value as Sport)}
            onKeyDown={handleKeyDown}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-50 dark:disabled:bg-neutral-800/50 disabled:text-neutral-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
            Team
          </label>
          <select
            value={player.teamId || ""}
            onChange={(e) => {
              const val = e.target.value;
              onChange({ ...player, teamId: val || undefined });
            }}
            onKeyDown={handleKeyDown}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-50 dark:disabled:bg-neutral-800/50 disabled:text-neutral-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
          >
            {!isNew && <option value="">(No Team)</option>}
            {isNew && !player.teamId && (
              <option value="" disabled>
                Select a team...
              </option>
            )}
            {sportTeams.map((t) => (
              <option key={t.id} value={t.id} disabled={t.disabled}>
                {t.canonical}{" "}
                {t.abbreviations[0] ? `(${t.abbreviations[0]})` : ""}
                {t.disabled ? " [Disabled]" : ""}
              </option>
            ))}
            {/* If player has a current teamId that is NOT in the list (e.g. disabled and hidden, though we just showed them disabled), ensure it shows?
                The generic filter includes disabled teams if they are in the list.
                Wait, filtering for dropdown: 'sportTeams' includes disabled teams? 
                Yes, existing teams list includes all.
                So we just render them. 
                What if the teamId is from a different sport? (Shouldn't happen due to logic).
            */}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
          Aliases
        </label>
        <div className="flex gap-2 mb-1.5">
          <input
            type="text"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation(); // Prevent bubbling first
              if (e.key === "Enter" && newAlias.trim()) {
                e.preventDefault();
                if (!player.aliases.includes(newAlias.trim())) {
                  onChange({
                    ...player,
                    aliases: [...player.aliases, newAlias.trim()],
                  });
                }
                setNewAlias("");
              }
            }}
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Add alias..."
          />
          <button
            onClick={() => {
              if (
                newAlias.trim() &&
                !player.aliases.includes(newAlias.trim())
              ) {
                onChange({
                  ...player,
                  aliases: [...player.aliases, newAlias.trim()],
                });
                setNewAlias("");
              }
            }}
            className="px-2 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium rounded hover:bg-neutral-300 dark:hover:bg-neutral-600"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {player.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded"
            >
              {alias}
              <button
                onClick={() =>
                  onChange({
                    ...player,
                    aliases: player.aliases.filter((a) => a !== alias),
                  })
                }
                className="hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          {isNew ? "Cancel" : "Close"}
        </button>
        {isNew && (
          <button
            onClick={onSave}
            disabled={!player.canonical.trim() || !player.teamId}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400 transition-colors shadow-sm"
          >
            Save Player
          </button>
        )}
      </div>
    </div>
  );
};

export default PlayersManager;
