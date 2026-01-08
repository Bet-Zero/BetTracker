
import React, { useState, useMemo, useEffect } from "react";
import { useInputs } from "../../hooks/useInputs";
import { useBets } from "../../hooks/useBets";
import { Plus } from "../../components/icons";
import DenseRow from "./DenseRow";
import SearchInput from "./SearchInput";

const SportsManager: React.FC = () => {
  const { sports, addSport, removeSport } = useInputs();
  const { bets } = useBets();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newSportName, setNewSportName] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);

  // Filter sports based on search query
  const filteredSports = useMemo(() => {
    if (!searchQuery.trim()) return sports;
    const q = searchQuery.toLowerCase();
    return sports.filter((s) => s.toLowerCase().includes(q));
  }, [sports, searchQuery]);

  // Reset windowing and expansion when filters change
  useEffect(() => {
    setVisibleCount(50);
    setExpandedSport(null);
  }, [searchQuery]);

  // Count bets using each sport
  const getBetsUsingSport = useMemo(() => {
    const counts: Record<string, number> = {};
    bets.forEach((bet) => {
      if (bet.sport) {
        counts[bet.sport] = (counts[bet.sport] || 0) + 1;
      }
    });
    return counts;
  }, [bets]);

  const handleAddSport = () => {
    const trimmed = newSportName.trim();
    if (!trimmed) {
      alert("Sport name cannot be empty");
      return;
    }
    if (sports.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      alert("This sport already exists");
      return;
    }
    if (addSport(trimmed)) {
      setNewSportName("");
      setIsAdding(false);
      setExpandedSport(null);
    }
  };

  const handleDeleteSport = (sport: string) => {
    const betCount = getBetsUsingSport[sport] || 0;
    if (betCount > 0) {
      alert(`Cannot remove: ${betCount} bet${betCount > 1 ? 's' : ''} currently use this sport.`);
      return;
    }
    if (confirm(`Delete '${sport}'? This action cannot be undone.`)) {
      removeSport(sport);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 50);
  };

  const handleRowClick = (sport: string) => {
    const isExpanded = expandedSport === sport;
    if (isExpanded) {
      setExpandedSport(null);
    } else {
      setExpandedSport(sport);
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Toolbar Section */}
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 mb-4 border border-neutral-200 dark:border-neutral-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search sports..."
              className="max-w-xs"
            />
          </div>
          <button
            onClick={() => {
              setIsAdding(true);
              setNewSportName("");
              setExpandedSport("__new__");
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-md shadow-primary-600/20 hover:shadow-lg hover:shadow-primary-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Sport</span>
          </button>
        </div>
      </div>

      {/* List Container - Card with shadow */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-md">
        <div className="p-2">
        {isAdding && (
          <div className="border-b border-neutral-200 dark:border-neutral-700 bg-blue-50 dark:bg-blue-950/30">
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  Sport Name
                </label>
                <input
                  type="text"
                  value={newSportName}
                  onChange={(e) => setNewSportName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && newSportName.trim()) {
                      e.preventDefault();
                      handleAddSport();
                    }
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
                  placeholder="e.g., PGA"
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewSportName("");
                    setExpandedSport(null);
                  }}
                  className="px-3 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSport}
                  disabled={!newSportName.trim()}
                  className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400 transition-colors shadow-sm"
                >
                  Save Sport
                </button>
              </div>
            </div>
          </div>
        )}

        {filteredSports.slice(0, visibleCount).map((sport) => {
          const betCount = getBetsUsingSport[sport] || 0;
          return (
            <DenseRow
              key={sport}
              name={sport}
              subtitle={betCount > 0 ? `${betCount} bet${betCount > 1 ? 's' : ''} using this sport` : undefined}
              aliasCount={0}
              expanded={expandedSport === sport}
              onToggleExpand={() => handleRowClick(sport)}
              onDisable={() => {}} // Sports don't have disable functionality
              onEnable={() => {}}
              onDelete={() => handleDeleteSport(sport)}
            >
              {expandedSport === sport && (
                <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400">
                  {betCount > 0 ? (
                    <p className="text-yellow-600 dark:text-yellow-400 font-medium">
                      ⚠️ This sport is currently used by {betCount} bet{betCount > 1 ? 's' : ''}. It cannot be deleted.
                    </p>
                  ) : (
                    <p>No bets currently use this sport. It can be safely deleted.</p>
                  )}
                </div>
              )}
            </DenseRow>
          );
        })}

        {/* Load More / Empty State */}
        {filteredSports.length === 0 && !isAdding ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No sports found. Add sports you bet on!
          </div>
        ) : filteredSports.length > visibleCount ? (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors border-t border-neutral-100 dark:border-neutral-800"
          >
            Show {Math.min(50, filteredSports.length - visibleCount)} more... (
            {filteredSports.length - visibleCount} remaining)
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
};

export default SportsManager;

