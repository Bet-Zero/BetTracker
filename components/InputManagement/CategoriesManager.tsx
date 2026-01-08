
import React, { useState, useMemo, useEffect } from "react";
import { useBets } from "../../hooks/useBets";
import { MarketCategory } from "../../types";
import DenseRow from "./DenseRow";
import SearchInput from "./SearchInput";

const CATEGORIES: MarketCategory[] = ["Props", "Main Markets", "Futures", "Parlays"];

const CategoriesManager: React.FC = () => {
  const { bets } = useBets();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return CATEGORIES;
    const q = searchQuery.toLowerCase();
    return CATEGORIES.filter((c) => c.toLowerCase().includes(q));
  }, [searchQuery]);

  // Reset windowing and expansion when filters change
  useEffect(() => {
    setVisibleCount(50);
    setExpandedCategory(null);
  }, [searchQuery]);

  // Count bets using each category
  const getBetsUsingCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    bets.forEach((bet) => {
      if (bet.marketCategory) {
        counts[bet.marketCategory] = (counts[bet.marketCategory] || 0) + 1;
      }
    });
    return counts;
  }, [bets]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 50);
  };

  const handleRowClick = (category: string) => {
    const isExpanded = expandedCategory === category;
    if (isExpanded) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(category);
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
              placeholder="Search categories..."
              className="max-w-xs"
            />
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Categories are fixed enum values and cannot be modified
          </div>
        </div>
      </div>

      {/* List Container - Card with shadow */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-md">
        <div className="p-2">
        {filteredCategories.slice(0, visibleCount).map((category) => {
          const betCount = getBetsUsingCategory[category] || 0;
          return (
            <DenseRow
              key={category}
              name={category}
              subtitle={betCount > 0 ? `${betCount} bet${betCount > 1 ? 's' : ''} using this category` : undefined}
              aliasCount={0}
              expanded={expandedCategory === category}
              onToggleExpand={() => handleRowClick(category)}
              onDisable={() => {}} // Categories don't have disable functionality
              onEnable={() => {}}
              onDelete={() => {}} // Categories cannot be deleted
            >
              {expandedCategory === category && (
                <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <p className="mb-2">
                    <span className="font-medium">Category:</span> {category}
                  </p>
                  {betCount > 0 ? (
                    <p className="text-neutral-700 dark:text-neutral-300">
                      This category is currently used by {betCount} bet{betCount > 1 ? 's' : ''}.
                    </p>
                  ) : (
                    <p>No bets currently use this category.</p>
                  )}
                  <p className="mt-2 text-neutral-500 dark:text-neutral-400 italic">
                    Note: Categories are fixed enum values defined in the system and cannot be added or removed.
                  </p>
                </div>
              )}
            </DenseRow>
          );
        })}

        {/* Load More / Empty State */}
        {filteredCategories.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No categories found.
          </div>
        ) : filteredCategories.length > visibleCount ? (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors border-t border-neutral-100 dark:border-neutral-800"
          >
            Show {Math.min(50, filteredCategories.length - visibleCount)} more... (
            {filteredCategories.length - visibleCount} remaining)
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
};

export default CategoriesManager;

