/**
 * MapToExistingModal - Modal for mapping an unresolved entity to an existing canonical
 *
 * Phase 3: Allows users to select an existing canonical entry and add the
 * unresolved raw value as an alias to it.
 *
 * Phase 3.1: Supports group context - shows count badge when mapping a group
 */

import React, { useState, useMemo } from "react";
import { UnresolvedItem } from "../services/unresolvedQueue";
import { resolveTeam, resolvePlayer } from "../services/resolver";
import { Sport } from "../data/referenceData";
import {
  TeamData,
  StatTypeData,
  PlayerData,
} from "../hooks/useNormalizationData";
import { X, AlertTriangle, Link, Check } from "./icons";

interface MapToExistingModalProps {
  item: UnresolvedItem;
  teams: TeamData[];
  players: PlayerData[];
  statTypes: StatTypeData[];
  onConfirm: (item: UnresolvedItem, targetCanonical: string) => void;
  onCancel: () => void;
  /** Number of items in the group (Phase 3.1) */
  groupCount?: number;
}

const MapToExistingModal: React.FC<MapToExistingModalProps> = ({
  item,
  teams,
  players,
  statTypes,
  onConfirm,
  onCancel,
  groupCount,
}) => {
  const [selectedCanonical, setSelectedCanonical] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Get suggestions based on collision candidates (if ambiguous)
  const collisionCandidates = useMemo(() => {
    if (item.entityType === "team") {
      const result = resolveTeam(item.rawValue);
      if (result.status === "ambiguous" && result.collision) {
        return result.collision.candidates;
      }
    } else if (item.entityType === "player") {
      const result = resolvePlayer(item.rawValue, {
        sport: item.sport as Sport,
      });
      if (result.status === "ambiguous" && result.collision) {
        return result.collision.candidates;
      }
    }
    return [];
  }, [item]);

  // Get list of canonicals to choose from based on entity type
  const availableCanonicals = useMemo(() => {
    let list: { canonical: string; sport: Sport; extra?: string }[] = [];

    if (item.entityType === "team") {
      // Filter teams by sport if available
      const filtered = item.sport
        ? teams.filter((t) => t.sport === item.sport)
        : teams;
      list = filtered.map((t) => ({ canonical: t.canonical, sport: t.sport }));
    } else if (item.entityType === "player") {
      // Filter players by sport
      const filtered = item.sport
        ? players.filter((p) => p.sport === item.sport)
        : players;
      list = filtered.map((p) => ({
        canonical: p.canonical,
        sport: p.sport,
        extra: p.team,
      }));
    } else if (item.entityType === "stat") {
      // Filter stat types by sport
      const filtered = item.sport
        ? statTypes.filter((s) => s.sport === item.sport)
        : statTypes;
      list = filtered.map((s) => ({
        canonical: s.canonical,
        sport: s.sport,
        extra: s.description,
      }));
    }

    // Sort with collision candidates first
    return list.sort((a, b) => {
      const aIsCandidate = collisionCandidates.includes(a.canonical);
      const bIsCandidate = collisionCandidates.includes(b.canonical);
      if (aIsCandidate && !bIsCandidate) return -1;
      if (!aIsCandidate && bIsCandidate) return 1;
      return a.canonical.localeCompare(b.canonical);
    });
  }, [item, teams, players, statTypes, collisionCandidates]);

  // Filter by search query
  const filteredCanonicals = useMemo(() => {
    if (!searchQuery.trim()) return availableCanonicals;
    const query = searchQuery.toLowerCase();
    return availableCanonicals.filter(
      (c) =>
        c.canonical.toLowerCase().includes(query) ||
        c.extra?.toLowerCase().includes(query)
    );
  }, [availableCanonicals, searchQuery]);

  const handleConfirm = () => {
    if (selectedCanonical) {
      onConfirm(item, selectedCanonical);
    }
  };

  const entityTypeLabel =
    item.entityType === "stat"
      ? "Stat Type"
      : item.entityType.charAt(0).toUpperCase() + item.entityType.slice(1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                Map to Existing {entityTypeLabel}
              </h2>
              {groupCount && groupCount > 1 && (
                <span className="px-2 py-0.5 text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 rounded-full">
                  {groupCount} items
                </span>
              )}
            </div>
            <button
              onClick={onCancel}
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Select an existing {item.entityType} to add "{item.rawValue}" as an
            alias.
            {groupCount && groupCount > 1 && (
              <span className="ml-1 text-primary-600 dark:text-primary-400">
                This will resolve {groupCount} queue items.
              </span>
            )}
          </p>
        </div>

        {/* Item Info */}
        <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">
                Raw Value:
              </span>
              <span className="ml-2 font-medium text-neutral-900 dark:text-white">
                {item.rawValue}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">
                Sport:
              </span>
              <span className="ml-2 font-medium text-neutral-900 dark:text-white">
                {item.sport || "Unknown"}
              </span>
            </div>
          </div>

          {collisionCandidates.length > 0 && (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-300">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  This value matches multiple {item.entityType}s. Suggested
                  candidates are highlighted below.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Search & Selection */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Search {entityTypeLabel}s
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search by name...`}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Select Target {entityTypeLabel}
            </label>
            <div className="max-h-60 overflow-y-auto border border-neutral-300 dark:border-neutral-700 rounded-md">
              {filteredCanonicals.length === 0 ? (
                <div className="p-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  No {item.entityType}s found
                  {item.sport ? ` for ${item.sport}` : ""}.
                </div>
              ) : (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {filteredCanonicals.map((c) => {
                    const isCandidate = collisionCandidates.includes(
                      c.canonical
                    );
                    const isSelected = selectedCanonical === c.canonical;

                    return (
                      <button
                        key={`${c.canonical}-${c.sport}`}
                        onClick={() => setSelectedCanonical(c.canonical)}
                        className={`w-full px-4 py-3 text-left text-sm transition-colors ${
                          isSelected
                            ? "bg-primary-100 dark:bg-primary-900/30"
                            : isCandidate
                            ? "bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                            : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span
                              className={`font-medium ${
                                isSelected
                                  ? "text-primary-700 dark:text-primary-300"
                                  : "text-neutral-900 dark:text-white"
                              }`}
                            >
                              {c.canonical}
                            </span>
                            {c.extra && (
                              <span className="ml-2 text-neutral-500 dark:text-neutral-400">
                                ({c.extra})
                              </span>
                            )}
                            {isCandidate && (
                              <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded">
                                Suggested
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedCanonical}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              selectedCanonical
                ? "bg-primary-600 text-white hover:bg-primary-700"
                : "bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
            }`}
          >
            Add as Alias
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapToExistingModal;
