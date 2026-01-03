
import React, { useState, useMemo, useEffect } from "react";
import { useNormalizationData, PlayerData, getTeamById, TeamData } from "../../hooks/useNormalizationData";
import { SPORTS, Sport } from "../../data/referenceData";
import { Plus, X, Lock, Unlock } from "../../components/icons";
import DenseRow from "./DenseRow";
import SearchInput from "./SearchInput";
import { useEntitySearch } from "../../hooks/useEntitySearch";

// Sport sub-tab pills
const SportPills: React.FC<{
  sports: readonly string[];
  selected: string;
  onSelect: (sport: string) => void;
  counts?: Record<string, number>;
}> = ({ sports, selected, onSelect, counts }) => (
  <div className="flex items-center space-x-1 flex-wrap gap-y-1 mb-3">
    <button
      onClick={() => onSelect("All")}
      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
        selected === "All"
          ? "bg-primary-600 text-white"
          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
      }`}
    >
      All {counts && counts["All"] !== undefined && `(${counts["All"]})`}
    </button>
    {sports.map((sport) => (
      <button
        key={sport}
        onClick={() => onSelect(sport)}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
          selected === sport
            ? "bg-primary-600 text-white"
            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
        }`}
      >
        {sport} {counts && counts[sport] !== undefined && `(${counts[sport]})`}
      </button>
    ))}
  </div>
);

const PlayersManager: React.FC = () => {
  const { players, updatePlayer, removePlayer, disablePlayer, enablePlayer, addPlayer } = useNormalizationData();
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [showDisabled, setShowDisabled] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<PlayerData | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Use search hook
  const { query, setQuery, filteredEntities: filteredPlayers } = useEntitySearch(
    players,
    "",
    selectedSport,
    showDisabled
  );

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center space-x-3 w-1/2">
          <SearchInput 
            value={query} 
            onChange={setQuery} 
            placeholder="Search players..." 
            className="w-full max-w-xs"
          />
          <label className="flex items-center space-x-1.5 text-xs text-neutral-500 dark:text-neutral-400 select-none cursor-pointer">
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
          className="flex items-center space-x-1 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Player</span>
        </button>
      </div>

      <div className="px-1">
        <SportPills sports={SPORTS} selected={selectedSport} onSelect={setSelectedSport} counts={sportCounts} />
      </div>

      <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 shadow-sm">
        {isAdding && editForm && (
          <div className="border-b border-neutral-200 dark:border-neutral-700">
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
        
        {filteredPlayers.slice(0, visibleCount).map((player) => {
          const key = `${player.canonical}::${player.sport}`;
          // Resolve team name for display
          let teamDisplay = "";
          if (player.teamId) {
             const t = getTeamById(player.teamId);
             if (t) teamDisplay = t.canonical;
          } else if (player.team) {
             // Fallback for legacy
             teamDisplay = player.team;
          }

          return (
            <DenseRow
              key={player.id || key}
              name={player.canonical}
              subtitle={`${player.sport}${teamDisplay ? ` · ${teamDisplay}` : ""}`}
              aliasCount={player.aliases.length}
              disabled={player.disabled}
              expanded={expandedPlayer === key}
              onToggleExpand={() => setExpandedPlayer(expandedPlayer === key ? null : key)}
              onDisable={() => disablePlayer(player.canonical, player.sport)}
              onEnable={() => enablePlayer(player.canonical, player.sport)}
              onDelete={() => removePlayer(player.canonical, player.sport)}
            >
              <PlayerEditPanel
                player={player}
                onChange={(updated) => updatePlayer(player.canonical, player.sport, updated)}
                onSave={() => setExpandedPlayer(null)}
                onCancel={() => setExpandedPlayer(null)}
              />
            </DenseRow>
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
            Show {Math.min(50, filteredPlayers.length - visibleCount)} more... ({filteredPlayers.length - visibleCount} remaining)
          </button>
        ) : null}
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
       .filter(t => t.sport === player.sport)
       .sort((a,b) => a.canonical.localeCompare(b.canonical));
  }, [teams, player.sport]);
  
  // Handing change of sport -> clear team selection as it might match another sport
  const handleSportChange = (newSport: Sport) => {
     onChange({ 
        ...player, 
        sport: newSport, 
        teamId: undefined, 
        team: undefined // Clear legacy field too
     });
  };

  return (
    <div className={`space-y-3 ${isNew ? "p-4 bg-blue-50 dark:bg-blue-900/10" : ""}`}>
      <div className="grid grid-cols-3 gap-3">
        <div className="relative">
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Canonical Name</label>
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
              {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
          )}
          <input
            type="text"
            value={player.canonical}
            onChange={(e) => onChange({ ...player, canonical: e.target.value })}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
            placeholder="e.g., Kobe Bryant"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Sport</label>
          <select
            value={player.sport}
            onChange={(e) => handleSportChange(e.target.value as Sport)}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Team</label>
          <select
            value={player.teamId || ""}
            onChange={(e) => {
               const val = e.target.value;
               onChange({ ...player, teamId: val || undefined });
            }}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
          >
            <option value="">(No Team)</option>
            {sportTeams.map((t) => (
              <option key={t.id} value={t.id} disabled={t.disabled}>
                {t.canonical} {t.abbreviations[0] ? `(${t.abbreviations[0]})` : ""}
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
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Aliases</label>
        <div className="flex gap-2 mb-1.5">
          <input
            type="text"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newAlias.trim()) {
                e.preventDefault();
                if (!player.aliases.includes(newAlias.trim())) {
                  onChange({ ...player, aliases: [...player.aliases, newAlias.trim()] });
                }
                setNewAlias("");
              }
            }}
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Add alias..."
          />
          <button
            onClick={() => {
              if (newAlias.trim() && !player.aliases.includes(newAlias.trim())) {
                onChange({ ...player, aliases: [...player.aliases, newAlias.trim()] });
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
                onClick={() => onChange({ ...player, aliases: player.aliases.filter((a) => a !== alias) })}
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
            disabled={!player.canonical.trim()}
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
