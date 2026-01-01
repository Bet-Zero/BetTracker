/**
 * Phase 4: Input Management View with Tab-Based Layout
 *
 * Redesigned for dense, efficient admin-style UI:
 * - Top-level tabs: Unresolved, Teams, Players, Stat Types
 * - Sport sub-tabs within each entity type
 * - Dense row layout (~36px per row)
 * - Show Disabled toggle
 * - Inline editing with disable/enable actions
 */

import React, { useState, useMemo, useCallback } from "react";
import { useNormalizationData, TeamData, StatTypeData, PlayerData } from "../hooks/useNormalizationData";
import { SPORTS, Sport } from "../data/referenceData";
import { Trash2, Edit2, Plus, X, Check, ChevronDown, ChevronRight, AlertTriangle, Eye, EyeOff, Power, Search } from "../components/icons";
import UnresolvedQueueManager from "./UnresolvedQueueManager";
import { getUnresolvedQueueCount } from "../services/unresolvedQueue";

// ============================================================================
// TYPES
// ============================================================================

type EntityTab = "unresolved" | "teams" | "players" | "statTypes";
type StatCategory = "main" | "props";

// Main Market stat types (derived classification)
const MAIN_MARKET_CANONICALS = new Set(["Moneyline", "Spread", "Total", "Over", "Under"]);

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

// Tab button component
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}> = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${
      active
        ? "border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400"
        : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
    }`}
  >
    {children}
    {badge !== undefined && badge > 0 && (
      <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full">
        {badge}
      </span>
    )}
  </button>
);

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

// Dense entity row component
const DenseRow: React.FC<{
  name: string;
  subtitle?: string;
  aliasCount: number;
  disabled?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}> = ({
  name,
  subtitle,
  aliasCount,
  disabled = false,
  expanded = false,
  onToggleExpand,
  onDisable,
  onEnable,
  onDelete,
  children,
}) => (
  <div
    className={`border-b border-neutral-200 dark:border-neutral-700 ${
      disabled ? "opacity-50 bg-neutral-50 dark:bg-neutral-900/50" : ""
    }`}
  >
    <div className="flex items-center px-3 py-2 h-9 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
      {/* Expand toggle */}
      <button
        onClick={onToggleExpand}
        className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Name */}
      <div className="flex-1 ml-2 min-w-0 flex items-center gap-2">
        <span className={`font-medium text-sm truncate ${disabled ? "line-through" : ""}`}>
          {name}
        </span>
        {subtitle && (
          <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
            {subtitle}
          </span>
        )}
        {aliasCount > 0 && (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            ({aliasCount} alias{aliasCount !== 1 ? "es" : ""})
          </span>
        )}
        {disabled && (
          <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
            Disabled
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-1">
        {disabled ? (
          <button
            onClick={onEnable}
            className="p-1 text-green-500 hover:text-green-700 dark:hover:text-green-400"
            title="Enable"
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onDisable}
            className="p-1 text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400"
            title="Disable"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => {
            if (confirm(`Delete "${name}"?`)) {
              onDelete();
            }
          }}
          className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-400"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    {/* Expansion panel */}
    {expanded && children && (
      <div className="px-8 py-3 bg-neutral-50 dark:bg-neutral-800/30 border-t border-neutral-200 dark:border-neutral-700">
        {children}
      </div>
    )}
  </div>
);

// Search input
const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder = "Search..." }) => (
  <div className="relative">
    <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
    />
  </div>
);

// ============================================================================
// TEAMS TAB
// ============================================================================

const TeamsTab: React.FC = () => {
  const { teams, updateTeam, removeTeam, disableTeam, enableTeam, addTeam } = useNormalizationData();
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [showDisabled, setShowDisabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<TeamData | null>(null);

  // Filter teams
  const filteredTeams = useMemo(() => {
    let result = [...teams];

    // Filter by sport
    if (selectedSport !== "All") {
      result = result.filter((t) => t.sport === selectedSport);
    }

    // Filter by disabled state
    if (!showDisabled) {
      result = result.filter((t) => !t.disabled);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.canonical.toLowerCase().includes(q) ||
          t.aliases.some((a) => a.toLowerCase().includes(q)) ||
          t.abbreviations.some((a) => a.toLowerCase().includes(q))
      );
    }

    return result;
  }, [teams, selectedSport, showDisabled, searchQuery]);

  // Count by sport
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    teams.forEach((t) => {
      if (!showDisabled && t.disabled) return;
      counts["All"]++;
      counts[t.sport] = (counts[t.sport] || 0) + 1;
    });
    return counts;
  }, [teams, showDisabled]);

  const handleSaveEdit = () => {
    if (!editForm) return;
    if (isAdding) {
      if (!addTeam(editForm)) {
        alert("Team already exists");
        return;
      }
    } else {
      updateTeam(editForm.canonical, editForm);
    }
    setEditForm(null);
    setIsAdding(false);
    setExpandedTeam(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search teams..." />
          <label className="flex items-center space-x-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded border-neutral-300 dark:border-neutral-600"
            />
            <span>Show disabled</span>
          </label>
        </div>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditForm({ canonical: "", sport: "NBA", abbreviations: [], aliases: [] });
            setExpandedTeam("__new__");
          }}
          className="flex items-center space-x-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Team</span>
        </button>
      </div>

      {/* Sport pills */}
      <SportPills sports={SPORTS} selected={selectedSport} onSelect={setSelectedSport} counts={sportCounts} />

      {/* List */}
      <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900">
        {isAdding && editForm && (
          <TeamEditPanel
            team={editForm}
            onChange={setEditForm}
            onSave={handleSaveEdit}
            onCancel={() => {
              setIsAdding(false);
              setEditForm(null);
              setExpandedTeam(null);
            }}
            isNew
          />
        )}
        {filteredTeams.map((team) => (
          <DenseRow
            key={team.canonical}
            name={team.canonical}
            subtitle={team.sport}
            aliasCount={team.aliases.length + team.abbreviations.length}
            disabled={team.disabled}
            expanded={expandedTeam === team.canonical}
            onToggleExpand={() => setExpandedTeam(expandedTeam === team.canonical ? null : team.canonical)}
            onDisable={() => disableTeam(team.canonical)}
            onEnable={() => enableTeam(team.canonical)}
            onDelete={() => removeTeam(team.canonical)}
          >
            <TeamEditPanel
              team={team}
              onChange={(updated) => updateTeam(team.canonical, updated)}
              onSave={() => setExpandedTeam(null)}
              onCancel={() => setExpandedTeam(null)}
            />
          </DenseRow>
        ))}
        {filteredTeams.length === 0 && !isAdding && (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No teams found.
          </div>
        )}
      </div>
    </div>
  );
};

// Team edit panel (inline)
const TeamEditPanel: React.FC<{
  team: TeamData;
  onChange: (team: TeamData) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}> = ({ team, onChange, onSave, onCancel, isNew }) => {
  const [newAbbr, setNewAbbr] = useState("");
  const [newAlias, setNewAlias] = useState("");

  return (
    <div className={`space-y-3 ${isNew ? "p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800" : ""}`}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Canonical Name</label>
          <input
            type="text"
            value={team.canonical}
            onChange={(e) => onChange({ ...team, canonical: e.target.value })}
            disabled={!isNew}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900"
            placeholder="e.g., Phoenix Suns"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Sport</label>
          <select
            value={team.sport}
            onChange={(e) => onChange({ ...team, sport: e.target.value as Sport })}
            disabled={!isNew}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Abbreviations */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Abbreviations</label>
        <div className="flex gap-2 mb-1.5">
          <input
            type="text"
            value={newAbbr}
            onChange={(e) => setNewAbbr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newAbbr.trim()) {
                e.preventDefault();
                if (!team.abbreviations.includes(newAbbr.trim())) {
                  onChange({ ...team, abbreviations: [...team.abbreviations, newAbbr.trim()] });
                }
                setNewAbbr("");
              }
            }}
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800"
            placeholder="Add abbreviation..."
          />
          <button
            onClick={() => {
              if (newAbbr.trim() && !team.abbreviations.includes(newAbbr.trim())) {
                onChange({ ...team, abbreviations: [...team.abbreviations, newAbbr.trim()] });
                setNewAbbr("");
              }
            }}
            className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {team.abbreviations.map((abbr) => (
            <span
              key={abbr}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
            >
              {abbr}
              <button
                onClick={() => onChange({ ...team, abbreviations: team.abbreviations.filter((a) => a !== abbr) })}
                className="hover:text-blue-900 dark:hover:text-blue-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Aliases */}
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
                if (!team.aliases.includes(newAlias.trim())) {
                  onChange({ ...team, aliases: [...team.aliases, newAlias.trim()] });
                }
                setNewAlias("");
              }
            }}
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800"
            placeholder="Add alias..."
          />
          <button
            onClick={() => {
              if (newAlias.trim() && !team.aliases.includes(newAlias.trim())) {
                onChange({ ...team, aliases: [...team.aliases, newAlias.trim()] });
                setNewAlias("");
              }
            }}
            className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {team.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded"
            >
              {alias}
              <button
                onClick={() => onChange({ ...team, aliases: team.aliases.filter((a) => a !== alias) })}
                className="hover:text-green-900 dark:hover:text-green-100"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
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
            disabled={!team.canonical.trim()}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400"
          >
            Save Team
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// PLAYERS TAB
// ============================================================================

const PlayersTab: React.FC = () => {
  const { players, updatePlayer, removePlayer, disablePlayer, enablePlayer, addPlayer } = useNormalizationData();
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [showDisabled, setShowDisabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<PlayerData | null>(null);

  // Filter players
  const filteredPlayers = useMemo(() => {
    let result = [...players];

    if (selectedSport !== "All") {
      result = result.filter((p) => p.sport === selectedSport);
    }

    if (!showDisabled) {
      result = result.filter((p) => !p.disabled);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.canonical.toLowerCase().includes(q) ||
          p.aliases.some((a) => a.toLowerCase().includes(q)) ||
          (p.team && p.team.toLowerCase().includes(q))
      );
    }

    return result;
  }, [players, selectedSport, showDisabled, searchQuery]);

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search players..." />
          <label className="flex items-center space-x-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded border-neutral-300 dark:border-neutral-600"
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
          className="flex items-center space-x-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Player</span>
        </button>
      </div>

      <SportPills sports={SPORTS} selected={selectedSport} onSelect={setSelectedSport} counts={sportCounts} />

      <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900">
        {isAdding && editForm && (
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
        )}
        {filteredPlayers.map((player) => {
          const key = `${player.canonical}::${player.sport}`;
          return (
            <DenseRow
              key={key}
              name={player.canonical}
              subtitle={`${player.sport}${player.team ? ` · ${player.team}` : ""}`}
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
        {filteredPlayers.length === 0 && !isAdding && (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No players found.
          </div>
        )}
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

  return (
    <div className={`space-y-3 ${isNew ? "p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800" : ""}`}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Canonical Name</label>
          <input
            type="text"
            value={player.canonical}
            onChange={(e) => onChange({ ...player, canonical: e.target.value })}
            disabled={!isNew}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900"
            placeholder="e.g., Kobe Bryant"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Sport</label>
          <select
            value={player.sport}
            onChange={(e) => onChange({ ...player, sport: e.target.value as Sport })}
            disabled={!isNew}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Team (optional)</label>
          <input
            type="text"
            value={player.team || ""}
            onChange={(e) => onChange({ ...player, team: e.target.value || undefined })}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800"
            placeholder="e.g., Los Angeles Lakers"
          />
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
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800"
            placeholder="Add alias..."
          />
          <button
            onClick={() => {
              if (newAlias.trim() && !player.aliases.includes(newAlias.trim())) {
                onChange({ ...player, aliases: [...player.aliases, newAlias.trim()] });
                setNewAlias("");
              }
            }}
            className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {player.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded"
            >
              {alias}
              <button
                onClick={() => onChange({ ...player, aliases: player.aliases.filter((a) => a !== alias) })}
                className="hover:text-green-900 dark:hover:text-green-100"
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
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400"
          >
            Save Player
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// STAT TYPES TAB
// ============================================================================

const StatTypesTab: React.FC = () => {
  const { statTypes, updateStatType, removeStatType, disableStatType, enableStatType, addStatType } = useNormalizationData();
  const [selectedCategory, setSelectedCategory] = useState<StatCategory>("props");
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [showDisabled, setShowDisabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedStatType, setExpandedStatType] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<StatTypeData | null>(null);

  // Derive category for each stat type
  const getCategory = (st: StatTypeData): StatCategory =>
    MAIN_MARKET_CANONICALS.has(st.canonical) ? "main" : "props";

  // Filter stat types
  const filteredStatTypes = useMemo(() => {
    let result = [...statTypes];

    // Filter by category
    result = result.filter((st) => getCategory(st) === selectedCategory);

    if (selectedSport !== "All") {
      result = result.filter((st) => st.sport === selectedSport);
    }

    if (!showDisabled) {
      result = result.filter((st) => !st.disabled);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (st) =>
          st.canonical.toLowerCase().includes(q) ||
          st.description.toLowerCase().includes(q) ||
          st.aliases.some((a) => a.toLowerCase().includes(q))
      );
    }

    return result;
  }, [statTypes, selectedCategory, selectedSport, showDisabled, searchQuery]);

  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    statTypes.forEach((st) => {
      if (getCategory(st) !== selectedCategory) return;
      if (!showDisabled && st.disabled) return;
      counts["All"]++;
      counts[st.sport] = (counts[st.sport] || 0) + 1;
    });
    return counts;
  }, [statTypes, selectedCategory, showDisabled]);

  const handleSaveEdit = () => {
    if (!editForm) return;
    if (isAdding) {
      if (!addStatType(editForm)) {
        alert("Stat type already exists");
        return;
      }
    } else {
      updateStatType(editForm.canonical, editForm);
    }
    setEditForm(null);
    setIsAdding(false);
    setExpandedStatType(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search stat types..." />
          <label className="flex items-center space-x-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={showDisabled}
              onChange={(e) => setShowDisabled(e.target.checked)}
              className="rounded border-neutral-300 dark:border-neutral-600"
            />
            <span>Show disabled</span>
          </label>
        </div>
        <button
          onClick={() => {
            setIsAdding(true);
            setEditForm({ canonical: "", sport: "NBA", description: "", aliases: [] });
            setExpandedStatType("__new__");
          }}
          className="flex items-center space-x-1 px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Stat Type</span>
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex space-x-4 mb-2 border-b border-neutral-200 dark:border-neutral-700">
        <TabButton active={selectedCategory === "main"} onClick={() => setSelectedCategory("main")}>
          Main Markets
        </TabButton>
        <TabButton active={selectedCategory === "props"} onClick={() => setSelectedCategory("props")}>
          Props
        </TabButton>
      </div>

      <SportPills sports={SPORTS} selected={selectedSport} onSelect={setSelectedSport} counts={sportCounts} />

      <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900">
        {isAdding && editForm && (
          <StatTypeEditPanel
            statType={editForm}
            onChange={setEditForm}
            onSave={handleSaveEdit}
            onCancel={() => {
              setIsAdding(false);
              setEditForm(null);
              setExpandedStatType(null);
            }}
            isNew
          />
        )}
        {filteredStatTypes.map((st) => {
          const key = `${st.canonical}::${st.sport}`;
          return (
            <DenseRow
              key={key}
              name={st.canonical}
              subtitle={`${st.sport} · ${st.description}`}
              aliasCount={st.aliases.length}
              disabled={st.disabled}
              expanded={expandedStatType === key}
              onToggleExpand={() => setExpandedStatType(expandedStatType === key ? null : key)}
              onDisable={() => disableStatType(st.canonical, st.sport)}
              onEnable={() => enableStatType(st.canonical, st.sport)}
              onDelete={() => removeStatType(st.canonical)}
            >
              <StatTypeEditPanel
                statType={st}
                onChange={(updated) => updateStatType(st.canonical, updated)}
                onSave={() => setExpandedStatType(null)}
                onCancel={() => setExpandedStatType(null)}
              />
            </DenseRow>
          );
        })}
        {filteredStatTypes.length === 0 && !isAdding && (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No stat types found.
          </div>
        )}
      </div>
    </div>
  );
};

// Stat type edit panel
const StatTypeEditPanel: React.FC<{
  statType: StatTypeData;
  onChange: (statType: StatTypeData) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}> = ({ statType, onChange, onSave, onCancel, isNew }) => {
  const [newAlias, setNewAlias] = useState("");

  return (
    <div className={`space-y-3 ${isNew ? "p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800" : ""}`}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Canonical Name</label>
          <input
            type="text"
            value={statType.canonical}
            onChange={(e) => onChange({ ...statType, canonical: e.target.value })}
            disabled={!isNew}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900"
            placeholder="e.g., Pts"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Sport</label>
          <select
            value={statType.sport}
            onChange={(e) => onChange({ ...statType, sport: e.target.value as Sport })}
            disabled={!isNew}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Description</label>
          <input
            type="text"
            value={statType.description}
            onChange={(e) => onChange({ ...statType, description: e.target.value })}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800"
            placeholder="e.g., Points"
          />
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
                if (!statType.aliases.includes(newAlias.trim())) {
                  onChange({ ...statType, aliases: [...statType.aliases, newAlias.trim()] });
                }
                setNewAlias("");
              }
            }}
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800"
            placeholder="Add alias..."
          />
          <button
            onClick={() => {
              if (newAlias.trim() && !statType.aliases.includes(newAlias.trim())) {
                onChange({ ...statType, aliases: [...statType.aliases, newAlias.trim()] });
                setNewAlias("");
              }
            }}
            className="px-2 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {statType.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded"
            >
              {alias}
              <button
                onClick={() => onChange({ ...statType, aliases: statType.aliases.filter((a) => a !== alias) })}
                className="hover:text-green-900 dark:hover:text-green-100"
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
            disabled={!statType.canonical.trim()}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400"
          >
            Save Stat Type
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// UNRESOLVED TAB
// ============================================================================

const UnresolvedTab: React.FC<{ onQueueChange: () => void }> = ({ onQueueChange }) => {
  return (
    <div className="h-full overflow-y-auto">
      <UnresolvedQueueManager onQueueChange={onQueueChange} />
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const InputManagementSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EntityTab>("unresolved");
  const [queueCount, setQueueCount] = useState(() => getUnresolvedQueueCount());

  const handleQueueChange = useCallback(() => {
    setQueueCount(getUnresolvedQueueCount());
  }, []);

  return (
    <div className="flex flex-col h-full min-h-[600px]">
      {/* Tab bar */}
      <div className="flex space-x-1 border-b border-neutral-200 dark:border-neutral-700 mb-4">
        <TabButton
          active={activeTab === "unresolved"}
          onClick={() => setActiveTab("unresolved")}
          badge={queueCount}
        >
          {queueCount > 0 && <AlertTriangle className="w-4 h-4 inline mr-1 text-yellow-500" />}
          Unresolved
        </TabButton>
        <TabButton active={activeTab === "teams"} onClick={() => setActiveTab("teams")}>
          Teams
        </TabButton>
        <TabButton active={activeTab === "players"} onClick={() => setActiveTab("players")}>
          Players
        </TabButton>
        <TabButton active={activeTab === "statTypes"} onClick={() => setActiveTab("statTypes")}>
          Stat Types
        </TabButton>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "unresolved" && <UnresolvedTab onQueueChange={handleQueueChange} />}
        {activeTab === "teams" && <TeamsTab />}
        {activeTab === "players" && <PlayersTab />}
        {activeTab === "statTypes" && <StatTypesTab />}
      </div>
    </div>
  );
};

export default InputManagementSection;
