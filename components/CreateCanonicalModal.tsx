/**
 * CreateCanonicalModal - Modal for creating a new canonical entry from an unresolved item
 *
 * Phase 3: Allows users to create a new team/player/stat type entry
 * with the unresolved raw value as the default alias.
 *
 * Phase 3.1: Supports group context - shows count badge when creating from a group
 */

import React, { useState, useEffect } from "react";
import { UnresolvedItem } from "../services/unresolvedQueue";
import { Sport, SPORTS } from "../data/referenceData";
import { X, Plus } from "./icons";

interface CreateCanonicalModalProps {
  item: UnresolvedItem;
  onConfirm: (
    item: UnresolvedItem,
    canonical: string,
    sport: Sport,
    additionalAliases: string[],
    extraData?: {
      team?: string;
      description?: string;
      abbreviations?: string[];
    }
  ) => void;
  onCancel: () => void;
  /** Number of items in the group (Phase 3.1) */
  groupCount?: number;
}

// Helper to convert string to title case
const toTitleCase = (str: string): string => {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const CreateCanonicalModal: React.FC<CreateCanonicalModalProps> = ({
  item,
  onConfirm,
  onCancel,
  groupCount,
}) => {
  // Form state
  const [canonical, setCanonical] = useState<string>(
    toTitleCase(item.rawValue)
  );
  const [sport, setSport] = useState<Sport>((item.sport as Sport) || "NBA");
  const [additionalAliases, setAdditionalAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState<string>("");

  // Extra data based on entity type
  const [team, setTeam] = useState<string>(""); // For players
  const [description, setDescription] = useState<string>(""); // For stat types
  const [abbreviations, setAbbreviations] = useState<string>(""); // For teams (comma-separated)

  // Update sport when item changes
  useEffect(() => {
    if (item.sport && SPORTS.includes(item.sport as Sport)) {
      setSport(item.sport as Sport);
    }
  }, [item.sport]);

  // Add alias handler
  const handleAddAlias = () => {
    const trimmed = newAlias.trim();
    if (
      trimmed &&
      !additionalAliases.includes(trimmed) &&
      trimmed !== item.rawValue
    ) {
      setAdditionalAliases([...additionalAliases, trimmed]);
      setNewAlias("");
    }
  };

  // Remove alias handler
  const handleRemoveAlias = (alias: string) => {
    setAdditionalAliases(additionalAliases.filter((a) => a !== alias));
  };

  // Handle confirm
  const handleConfirm = () => {
    if (!canonical.trim()) return;

    const extraData: {
      team?: string;
      description?: string;
      abbreviations?: string[];
    } = {};

    if (item.entityType === "player" && team.trim()) {
      extraData.team = team.trim();
    }
    if (item.entityType === "stat" && description.trim()) {
      extraData.description = description.trim();
    }
    if (item.entityType === "team" && abbreviations.trim()) {
      extraData.abbreviations = abbreviations
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a);
    }

    onConfirm(item, canonical.trim(), sport, additionalAliases, extraData);
  };

  const entityTypeLabel =
    item.entityType === "stat"
      ? "Stat Type"
      : item.entityType.charAt(0).toUpperCase() + item.entityType.slice(1);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5 text-accent-600 dark:text-accent-400" />
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                Create New {entityTypeLabel}
              </h2>
              {groupCount && groupCount > 1 && (
                <span className="px-2 py-0.5 text-sm font-medium bg-accent-100 dark:bg-accent-900/30 text-accent-800 dark:text-accent-300 rounded-full">
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
            Create a new {item.entityType} entry with "{item.rawValue}" as an
            alias.
            {groupCount && groupCount > 1 && (
              <span className="ml-1 text-accent-600 dark:text-accent-400">
                This will resolve {groupCount} queue items.
              </span>
            )}
          </p>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Canonical Name */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Canonical Name <span className="text-danger-500">*</span>
            </label>
            <input
              type="text"
              value={canonical}
              onChange={(e) => setCanonical(e.target.value)}
              placeholder={`Enter ${item.entityType} name`}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              This is the official display name for this {item.entityType}.
            </p>
          </div>

          {/* Sport */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Sport <span className="text-danger-500">*</span>
            </label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Team-specific: Abbreviations */}
          {item.entityType === "team" && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Abbreviations (optional)
              </label>
              <input
                type="text"
                value={abbreviations}
                onChange={(e) => setAbbreviations(e.target.value)}
                placeholder="e.g., PHX, PHO (comma-separated)"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
              />
            </div>
          )}

          {/* Player-specific: Team */}
          {item.entityType === "player" && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Team (optional)
              </label>
              <input
                type="text"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="e.g., Phoenix Suns"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
              />
            </div>
          )}

          {/* Stat-specific: Description */}
          {item.entityType === "stat" && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Points, Rebounds, Assists"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
              />
            </div>
          )}

          {/* Aliases */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Aliases
            </label>

            {/* Default alias (from raw value) */}
            <div className="mb-3">
              <span className="inline-flex items-center px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 text-sm rounded-md">
                {item.rawValue}
                <span className="ml-2 text-xs text-primary-600 dark:text-primary-400">
                  (from import)
                </span>
              </span>
            </div>

            {/* Additional aliases */}
            {additionalAliases.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {additionalAliases.map((alias) => (
                  <span
                    key={alias}
                    className="inline-flex items-center px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300 text-sm rounded-md"
                  >
                    {alias}
                    <button
                      onClick={() => handleRemoveAlias(alias)}
                      className="ml-2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add new alias */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAlias();
                  }
                }}
                placeholder="Add another alias"
                className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm"
              />
              <button
                onClick={handleAddAlias}
                disabled={!newAlias.trim()}
                className={`px-3 py-2 text-sm rounded-md ${
                  newAlias.trim()
                    ? "bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                }`}
              >
                Add
              </button>
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
            disabled={!canonical.trim()}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              canonical.trim()
                ? "bg-accent-600 text-white hover:bg-accent-700"
                : "bg-neutral-300 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
            }`}
          >
            Create {entityTypeLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateCanonicalModal;
