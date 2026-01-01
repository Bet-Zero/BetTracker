
import React, { useState, useMemo, useEffect } from "react";
import { useNormalizationData, StatTypeData } from "../../hooks/useNormalizationData";
import { SPORTS, Sport } from "../../data/referenceData";
import { Plus, X } from "../../components/icons";
import DenseRow from "./DenseRow";
import SearchInput from "./SearchInput";
import { useEntitySearch } from "../../hooks/useEntitySearch";

import { 
  getBetTypeCategory, 
  StatCategory, 
  MAIN_MARKET_CANONICALS,
  PARLAY_CANONICALS,
  FUTURE_CANONICALS
} from "../../utils/betTypeUtils";

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

const StatTypesManager: React.FC = () => {
  const { statTypes, updateStatType, removeStatType, disableStatType, enableStatType, addStatType } = useNormalizationData();
  const [selectedCategory, setSelectedCategory] = useState<StatCategory>("props");
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [showDisabled, setShowDisabled] = useState(false);
  const [expandedStatType, setExpandedStatType] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<StatTypeData | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Pre-filter by Category
  const categoryFilteredEntities = useMemo(() => {
    return statTypes.filter(st => {
      const category = getBetTypeCategory(st.canonical);
      return category === selectedCategory;
    });
  }, [statTypes, selectedCategory]);

  // Use search hook on the category filtered list
  const { query, setQuery, filteredEntities: filteredStatTypes } = useEntitySearch(
    categoryFilteredEntities,
    "",
    selectedSport,
    showDisabled
  );

  // Reset windowing and expansion when filters change
  useEffect(() => {
    setVisibleCount(50);
    setExpandedStatType(null);
  }, [query, selectedSport, showDisabled, selectedCategory]);

  // Count by sport (for current category)
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    categoryFilteredEntities.forEach((st) => {
      if (!showDisabled && st.disabled) return;
      counts["All"]++;
      counts[st.sport] = (counts[st.sport] || 0) + 1;
    });
    return counts;
  }, [categoryFilteredEntities, showDisabled]);

  const handleSaveEdit = () => {
    if (!editForm) return;
    if (isAdding) {
      if (!addStatType(editForm)) {
        alert("Stat Type already exists");
        return;
      }
    } else {
      updateStatType(editForm.canonical, editForm);
    }
    setEditForm(null);
    setIsAdding(false);
    setExpandedStatType(null);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 50);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Category Tabs (Top Level for Bet Types) */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-4">
        {[
          { id: "props", label: "Props" },
          { id: "main", label: "Main Markets" },
          { id: "parlay", label: "Parlays" },
          { id: "future", label: "Futures" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id as StatCategory)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedCategory === tab.id
                ? "border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400"
                : "border-transparent text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center space-x-3 w-1/2">
          <SearchInput 
            value={query} 
            onChange={setQuery} 
            placeholder={`Search ${selectedCategory} types...`}
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
            setEditForm({ canonical: "", sport: "NBA", aliases: [] });
            setExpandedStatType("__new__");
          }}
          className="flex items-center space-x-1 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add Bet Type</span>
        </button>
      </div>

      <div className="px-1">
        <SportPills sports={SPORTS} selected={selectedSport} onSelect={setSelectedSport} counts={sportCounts} />
      </div>

      <div className="flex-1 overflow-y-auto border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 shadow-sm">
        {isAdding && editForm && (
          <div className="border-b border-neutral-200 dark:border-neutral-700">
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
          </div>
        )}
        
        {filteredStatTypes.slice(0, visibleCount).map((statType) => {
          const key = `${statType.canonical}::${statType.sport}`;
          return (
            <DenseRow
              key={key}
              name={statType.canonical}
              subtitle={statType.sport}
              aliasCount={statType.aliases.length}
              disabled={statType.disabled}
              expanded={expandedStatType === key}
              onToggleExpand={() => setExpandedStatType(expandedStatType === key ? null : key)}
              onDisable={() => disableStatType(statType.canonical, statType.sport)}
              onEnable={() => enableStatType(statType.canonical, statType.sport)}
              onDelete={() => removeStatType(statType.canonical)}
            >
              <StatTypeEditPanel
                statType={statType}
                onChange={(updated) => updateStatType(statType.canonical, updated)}
                onSave={() => setExpandedStatType(null)}
                onCancel={() => setExpandedStatType(null)}
              />
            </DenseRow>
          );
        })}

        {filteredStatTypes.length === 0 && !isAdding ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No bet types found in this category.
          </div>
        ) : filteredStatTypes.length > visibleCount ? (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors border-t border-neutral-100 dark:border-neutral-800"
          >
            Show {Math.min(50, filteredStatTypes.length - visibleCount)} more... ({filteredStatTypes.length - visibleCount} remaining)
          </button>
        ) : null}
      </div>
    </div>
  );
};

// Stat Type edit panel
const StatTypeEditPanel: React.FC<{
  statType: StatTypeData;
  onChange: (statType: StatTypeData) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}> = ({ statType, onChange, onSave, onCancel, isNew }) => {
  const [newAlias, setNewAlias] = useState("");

  return (
    <div className={`space-y-3 ${isNew ? "p-4 bg-blue-50 dark:bg-blue-900/10" : ""}`}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Canonical Name</label>
          <input
            type="text"
            value={statType.canonical}
            onChange={(e) => onChange({ ...statType, canonical: e.target.value })}
            disabled={!isNew}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="e.g., Points"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Sport</label>
          <select
            value={statType.sport}
            onChange={(e) => onChange({ ...statType, sport: e.target.value as Sport })}
            disabled={!isNew}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-100 dark:disabled:bg-neutral-900 focus:ring-1 focus:ring-primary-500 outline-none"
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
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
                if (!statType.aliases.includes(newAlias.trim())) {
                  onChange({ ...statType, aliases: [...statType.aliases, newAlias.trim()] });
                }
                setNewAlias("");
              }
            }}
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Add alias..."
          />
          <button
            onClick={() => {
              if (newAlias.trim() && !statType.aliases.includes(newAlias.trim())) {
                onChange({ ...statType, aliases: [...statType.aliases, newAlias.trim()] });
                setNewAlias("");
              }
            }}
            className="px-2 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium rounded hover:bg-neutral-300 dark:hover:bg-neutral-600"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {statType.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded"
            >
              {alias}
              <button
                onClick={() => onChange({ ...statType, aliases: statType.aliases.filter((a) => a !== alias) })}
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
            disabled={!statType.canonical.trim()}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400 transition-colors shadow-sm"
          >
            Save Bet Type
          </button>
        )}
      </div>
    </div>
  );
};

export default StatTypesManager;
