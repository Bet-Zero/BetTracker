
import React, { useState, useMemo, useEffect } from "react";
import { useNormalizationData, TeamData } from "../../hooks/useNormalizationData";
import { SPORTS, Sport } from "../../data/referenceData";
import { Plus, X, Lock, Unlock } from "../../components/icons";
import DenseRow from "./DenseRow";
import SearchInput from "./SearchInput";
import { useEntitySearch } from "../../hooks/useEntitySearch";

// Sport sub-tab pills (Local component or could be shared)
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

const TeamsManager: React.FC = () => {
  const { teams, updateTeam, removeTeam, disableTeam, enableTeam, addTeam } = useNormalizationData();
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [showDisabled, setShowDisabled] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<TeamData | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Use search hook
  const { query, setQuery, filteredEntities: filteredTeams } = useEntitySearch(
    teams,
    "",
    selectedSport,
    showDisabled
  );

  // Reset windowing and expansion when filters change
  useEffect(() => {
    setVisibleCount(50);
    setExpandedTeam(null);
  }, [query, selectedSport, showDisabled]);

  // Count by sport (memoized)
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
            placeholder="Search teams..." 
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
            setEditForm({ canonical: "", sport: "NBA", abbreviations: [], aliases: [] });
            setExpandedTeam("__new__");
          }}
          className="flex items-center space-x-1 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Team</span>
        </button>
      </div>

      {/* Sport pills */}
      <div className="px-1">
        <SportPills sports={SPORTS} selected={selectedSport} onSelect={setSelectedSport} counts={sportCounts} />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 shadow-sm">
        {isAdding && editForm && (
          <div className="border-b border-neutral-200 dark:border-neutral-700">
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
          </div>
        )}
        
        {filteredTeams.slice(0, visibleCount).map((team) => {
          const rowKey = team.id || team.canonical;
          return (
            <DenseRow
              key={rowKey}
              name={team.canonical}
              subtitle={team.sport}
              aliasCount={team.aliases.length + team.abbreviations.length}
              disabled={team.disabled}
              expanded={expandedTeam === rowKey}
              onToggleExpand={() => setExpandedTeam(expandedTeam === rowKey ? null : rowKey)}
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
          );
        })}

        {/* Load More / Empty State */}
        {filteredTeams.length === 0 && !isAdding ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No teams found.
          </div>
        ) : filteredTeams.length > visibleCount ? (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors border-t border-neutral-100 dark:border-neutral-800"
          >
            Show {Math.min(50, filteredTeams.length - visibleCount)} more... ({filteredTeams.length - visibleCount} remaining)
          </button>
        ) : null}
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
  const [isLocked, setIsLocked] = useState(!isNew);

  return (
    <div className={`space-y-3 ${isNew ? "p-4 bg-blue-50 dark:bg-blue-950/50" : ""}`}>
      <div className="grid grid-cols-2 gap-3">
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
            value={team.canonical}
            onChange={(e) => onChange({ ...team, canonical: e.target.value })}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-50 dark:disabled:bg-neutral-800/50 disabled:text-neutral-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
            placeholder="e.g., Phoenix Suns"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Sport</label>
          <select
            value={team.sport}
            onChange={(e) => onChange({ ...team, sport: e.target.value as Sport })}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-50 dark:disabled:bg-neutral-800/50 disabled:text-neutral-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
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
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Add abbreviation..."
          />
          <button
            onClick={() => {
              if (newAbbr.trim() && !team.abbreviations.includes(newAbbr.trim())) {
                onChange({ ...team, abbreviations: [...team.abbreviations, newAbbr.trim()] });
                setNewAbbr("");
              }
            }}
            className="px-2 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium rounded hover:bg-neutral-300 dark:hover:bg-neutral-600"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {team.abbreviations.map((abbr) => (
            <span
              key={abbr}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded"
            >
              {abbr}
              <button
                onClick={() => onChange({ ...team, abbreviations: team.abbreviations.filter((a) => a !== abbr) })}
                className="hover:text-red-500"
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
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Add alias..."
          />
          <button
            onClick={() => {
              if (newAlias.trim() && !team.aliases.includes(newAlias.trim())) {
                onChange({ ...team, aliases: [...team.aliases, newAlias.trim()] });
                setNewAlias("");
              }
            }}
            className="px-2 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium rounded hover:bg-neutral-300 dark:hover:bg-neutral-600"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {team.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded"
            >
              {alias}
              <button
                onClick={() => onChange({ ...team, aliases: team.aliases.filter((a) => a !== alias) })}
                className="hover:text-red-500"
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
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400 transition-colors shadow-sm"
          >
            Save Team
          </button>
        )}
      </div>
    </div>
  );
};

export default TeamsManager;
