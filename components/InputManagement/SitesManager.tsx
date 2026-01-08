
import React, { useState, useMemo, useEffect } from "react";
import { useInputs } from "../../hooks/useInputs";
import { useBets } from "../../hooks/useBets";
import { Sportsbook } from "../../types";
import { Plus } from "../../components/icons";
import DenseRow from "./DenseRow";
import SearchInput from "./SearchInput";

const SitesManager: React.FC = () => {
  const { sportsbooks, addSportsbook, removeSportsbook } = useInputs();
  const { bets } = useBets();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSite, setExpandedSite] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newSite, setNewSite] = useState<Sportsbook>({ name: "", abbreviation: "", url: "" });
  const [visibleCount, setVisibleCount] = useState(50);

  // Filter sportsbooks based on search query
  const filteredSites = useMemo(() => {
    if (!searchQuery.trim()) return sportsbooks;
    const q = searchQuery.toLowerCase();
    return sportsbooks.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.abbreviation.toLowerCase().includes(q)
    );
  }, [sportsbooks, searchQuery]);

  // Reset windowing and expansion when filters change
  useEffect(() => {
    setVisibleCount(50);
    setExpandedSite(null);
  }, [searchQuery]);

  // Count bets using each site
  const getBetsUsingSite = useMemo(() => {
    const counts: Record<string, number> = {};
    bets.forEach((bet) => {
      if (bet.book) {
        counts[bet.book] = (counts[bet.book] || 0) + 1;
      }
    });
    return counts;
  }, [bets]);

  const handleAddSite = () => {
    const trimmedName = newSite.name.trim();
    const trimmedAbbr = newSite.abbreviation.trim();
    
    if (!trimmedName) {
      alert("Site name cannot be empty");
      return;
    }
    if (!trimmedAbbr) {
      alert("Abbreviation cannot be empty");
      return;
    }
    if (sportsbooks.some((s) => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      alert("A site with this name already exists");
      return;
    }
    if (sportsbooks.some((s) => s.abbreviation.toLowerCase() === trimmedAbbr.toLowerCase())) {
      alert("A site with this abbreviation already exists");
      return;
    }
    
    const siteToAdd: Sportsbook = {
      name: trimmedName,
      abbreviation: trimmedAbbr,
      url: newSite.url.trim() || "",
    };
    
    if (addSportsbook(siteToAdd)) {
      setNewSite({ name: "", abbreviation: "", url: "" });
      setIsAdding(false);
      setExpandedSite(null);
    }
  };

  const handleDeleteSite = (siteName: string) => {
    const betCount = getBetsUsingSite[siteName] || 0;
    if (betCount > 0) {
      alert(`Cannot remove: ${betCount} bet${betCount > 1 ? 's' : ''} currently use this site.`);
      return;
    }
    if (confirm(`Delete '${siteName}'? This action cannot be undone.`)) {
      removeSportsbook(siteName);
    }
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 50);
  };

  const handleRowClick = (siteName: string) => {
    const isExpanded = expandedSite === siteName;
    if (isExpanded) {
      setExpandedSite(null);
    } else {
      setExpandedSite(siteName);
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
              placeholder="Search sites..."
              className="max-w-xs"
            />
          </div>
          <button
            onClick={() => {
              setIsAdding(true);
              setNewSite({ name: "", abbreviation: "", url: "" });
              setExpandedSite("__new__");
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-md shadow-primary-600/20 hover:shadow-lg hover:shadow-primary-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Site</span>
          </button>
        </div>
      </div>

      {/* List Container - Card with shadow */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-md">
        <div className="p-2">
        {isAdding && (
          <div className="border-b border-neutral-200 dark:border-neutral-700 bg-blue-50 dark:bg-blue-950/30">
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Site Name *
                  </label>
                  <input
                    type="text"
                    value={newSite.name}
                    onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
                    placeholder="e.g., FanDuel"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                    Abbreviation *
                  </label>
                  <input
                    type="text"
                    value={newSite.abbreviation}
                    onChange={(e) => setNewSite({ ...newSite, abbreviation: e.target.value })}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
                    placeholder="e.g., FD"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                  URL (optional)
                </label>
                <input
                  type="text"
                  value={newSite.url}
                  onChange={(e) => setNewSite({ ...newSite, url: e.target.value })}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter" && newSite.name.trim() && newSite.abbreviation.trim()) {
                      e.preventDefault();
                      handleAddSite();
                    }
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
                  placeholder="https://www.fanduel.com/"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewSite({ name: "", abbreviation: "", url: "" });
                    setExpandedSite(null);
                  }}
                  className="px-3 py-1 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSite}
                  disabled={!newSite.name.trim() || !newSite.abbreviation.trim()}
                  className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400 transition-colors shadow-sm"
                >
                  Save Site
                </button>
              </div>
            </div>
          </div>
        )}

        {filteredSites.slice(0, visibleCount).map((site) => {
          const betCount = getBetsUsingSite[site.name] || 0;
          return (
            <DenseRow
              key={site.name}
              name={site.name}
              subtitle={`${site.abbreviation}${betCount > 0 ? ` • ${betCount} bet${betCount > 1 ? 's' : ''} using this site` : ''}`}
              aliasCount={0}
              expanded={expandedSite === site.name}
              onToggleExpand={() => handleRowClick(site.name)}
              onDisable={() => {}} // Sites don't have disable functionality
              onEnable={() => {}}
              onDelete={() => handleDeleteSite(site.name)}
            >
              {expandedSite === site.name && (
                <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400 space-y-2">
                  <div>
                    <span className="font-medium">Abbreviation:</span> {site.abbreviation}
                  </div>
                  {site.url && (
                    <div>
                      <span className="font-medium">URL:</span>{" "}
                      <a
                        href={site.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {site.url}
                      </a>
                    </div>
                  )}
                  {betCount > 0 ? (
                    <p className="text-yellow-600 dark:text-yellow-400 font-medium mt-2">
                      ⚠️ This site is currently used by {betCount} bet{betCount > 1 ? 's' : ''}. It cannot be deleted.
                    </p>
                  ) : (
                    <p className="mt-2">No bets currently use this site. It can be safely deleted.</p>
                  )}
                </div>
              )}
            </DenseRow>
          );
        })}

        {/* Load More / Empty State */}
        {filteredSites.length === 0 && !isAdding ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No sites found. Add sportsbooks you use!
          </div>
        ) : filteredSites.length > visibleCount ? (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors border-t border-neutral-100 dark:border-neutral-800"
          >
            Show {Math.min(50, filteredSites.length - visibleCount)} more... (
            {filteredSites.length - visibleCount} remaining)
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
};

export default SitesManager;

