
import React, { useState, useMemo, useEffect } from "react";
import { useNormalizationData, BetTypeData } from "../../hooks/useNormalizationData";
import { SPORTS, Sport } from "../../data/referenceData";
import { Plus, X, Lock, Unlock } from "../../components/icons";
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

const BetTypesManager: React.FC = () => {
  const { betTypes, updateBetType, removeBetType, disableBetType, enableBetType, addBetType } = useNormalizationData();
  const [selectedCategory, setSelectedCategory] = useState<StatCategory>("props");
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [showDisabled, setShowDisabled] = useState(false);
  const [expandedBetType, setExpandedBetType] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<BetTypeData | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Pre-filter by Category
  const categoryFilteredEntities = useMemo(() => {
    return betTypes.filter(st => {
      const category = getBetTypeCategory(st.canonical);
      return category === selectedCategory;
    });
  }, [betTypes, selectedCategory]);

  // Use search hook on the category filtered list
  const { query, setQuery, filteredEntities: filteredBetTypes } = useEntitySearch(
    categoryFilteredEntities,
    "",
    selectedSport,
    showDisabled
  );

  // Reset windowing and expansion when filters change
  useEffect(() => {
    setVisibleCount(50);
    setExpandedBetType(null);
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
      if (!addBetType(editForm)) {
        alert("Bet Type already exists");
        return;
      }
    } else {
      updateBetType(editForm.canonical, editForm);
    }
    setEditForm(null);
    setIsAdding(false);
    setExpandedBetType(null);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 50);
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Category Tabs - Elevated pill style */}
      <div className="mb-4">
        <div className="inline-flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 gap-1">
          {[
            { id: "props", label: "Props" },
            { id: "main", label: "Main Markets" },
            { id: "parlay", label: "Parlays" },
            { id: "future", label: "Futures" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id as StatCategory)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                selectedCategory === tab.id
                  ? "bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-md"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar Section */}
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 mb-4 border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3 flex-1">
            <SearchInput 
              value={query} 
              onChange={setQuery} 
              placeholder={`Search ${selectedCategory} types...`}
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
              setEditForm({ canonical: "", sport: "NBA", aliases: [], description: "" });
              setExpandedBetType("__new__");
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-md shadow-primary-600/20 hover:shadow-lg hover:shadow-primary-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bet Type</span>
          </button>
        </div>

        {/* Sport pills */}
        <SportPills sports={SPORTS} selected={selectedSport} onSelect={setSelectedSport} counts={sportCounts} />
      </div>

      {/* List Container - Card with shadow */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-md">
        <div className="p-2">
        {isAdding && editForm && (
          <div className="border-b border-neutral-200 dark:border-neutral-700 bg-blue-50 dark:bg-blue-950/30">
            <BetTypeEditPanel
              betType={editForm}
              onChange={setEditForm}
              onSave={handleSaveEdit}
              onCancel={() => {
                setIsAdding(false);
                setEditForm(null);
                setExpandedBetType(null);
              }}
              isNew
            />
          </div>
        )}
        
        {filteredBetTypes.slice(0, visibleCount).map((betType) => {
          const rowKey = `${betType.canonical}::${betType.sport}`;
          // Note: betType doesn't have a stable id yet, so we use the original key
          // but wrap updates to preserve expansion. For now, key on canonical::sport.
          return (
            <DenseRow
              key={rowKey}
              name={betType.canonical}
              subtitle={betType.sport}
              aliasCount={betType.aliases.length}
              disabled={betType.disabled}
              expanded={expandedBetType === rowKey}
              onToggleExpand={() => setExpandedBetType(expandedBetType === rowKey ? null : rowKey)}
              onDisable={() => disableBetType(betType.canonical, betType.sport)}
              onEnable={() => enableBetType(betType.canonical, betType.sport)}
              onDelete={() => removeBetType(betType.canonical)}
            >
              <BetTypeEditPanel
                betType={betType}
                onChange={(updated) => updateBetType(betType.canonical, updated)}
                onSave={() => setExpandedBetType(null)}
                onCancel={() => setExpandedBetType(null)}
              />
            </DenseRow>
          );
        })}

        {filteredBetTypes.length === 0 && !isAdding ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No bet types found in this category.
          </div>
        ) : filteredBetTypes.length > visibleCount ? (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors border-t border-neutral-100 dark:border-neutral-800"
          >
            Show {Math.min(50, filteredBetTypes.length - visibleCount)} more... ({filteredBetTypes.length - visibleCount} remaining)
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
};

// Bet Type edit panel
const BetTypeEditPanel: React.FC<{
  betType: BetTypeData;
  onChange: (betType: BetTypeData) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}> = ({ betType, onChange, onSave, onCancel, isNew }) => {
  const [newAlias, setNewAlias] = useState("");
  const [isLocked, setIsLocked] = useState(!isNew);

  // Prevent keyboard events from bubbling up when editing
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div 
      className={`space-y-3 ${isNew ? "p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-900" : ""}`}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
    >
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
            value={betType.canonical}
            onChange={(e) => onChange({ ...betType, canonical: e.target.value })}
            onKeyDown={handleKeyDown}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-50 dark:disabled:bg-neutral-800/50 disabled:text-neutral-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
            placeholder="e.g., Points"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Sport</label>
          <select
            value={betType.sport}
            onChange={(e) => onChange({ ...betType, sport: e.target.value as Sport })}
            onKeyDown={handleKeyDown}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-50 dark:disabled:bg-neutral-800/50 disabled:text-neutral-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
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
              e.stopPropagation(); // Prevent bubbling first
              if (e.key === "Enter" && newAlias.trim()) {
                e.preventDefault();
                if (!betType.aliases.includes(newAlias.trim())) {
                  onChange({ ...betType, aliases: [...betType.aliases, newAlias.trim()] });
                }
                setNewAlias("");
              }
            }}
            className="flex-1 px-2 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Add alias..."
          />
          <button
            onClick={() => {
              if (newAlias.trim() && !betType.aliases.includes(newAlias.trim())) {
                onChange({ ...betType, aliases: [...betType.aliases, newAlias.trim()] });
                setNewAlias("");
              }
            }}
            className="px-2 py-1 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-medium rounded hover:bg-neutral-300 dark:hover:bg-neutral-600"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {betType.aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded"
            >
              {alias}
              <button
                onClick={() => onChange({ ...betType, aliases: betType.aliases.filter((a) => a !== alias) })}
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
            disabled={!betType.canonical.trim()}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400 transition-colors shadow-sm"
          >
            Save Bet Type
          </button>
        )}
      </div>
    </div>
  );
};

export default BetTypesManager;
