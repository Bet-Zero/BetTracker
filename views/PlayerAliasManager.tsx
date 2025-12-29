/**
 * PlayerAliasManager - Manage players and their aliases
 *
 * Phase 3.1: Added to show stored players in Input Management,
 * consistent with TeamAliasManager and StatTypeAliasManager patterns.
 */

import React, { useState } from "react";
import {
  useNormalizationData,
  PlayerData,
} from "../hooks/useNormalizationData";
import { Trash2, Edit2, Plus, X, Search } from "../components/icons";
import { Sport, SPORTS } from "../data/referenceData";

const PlayerAliasManager: React.FC = () => {
  const { players, addPlayer, updatePlayer, removePlayer } =
    useNormalizationData();
  const [editingPlayer, setEditingPlayer] = useState<{
    canonical: string;
    sport: Sport;
  } | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSport, setFilterSport] = useState<string>("All");

  const [formData, setFormData] = useState<PlayerData>({
    canonical: "",
    sport: "NBA",
    team: "",
    aliases: [],
  });

  const [newAlias, setNewAlias] = useState("");

  const startEdit = (player: PlayerData) => {
    setEditingPlayer({ canonical: player.canonical, sport: player.sport });
    setFormData({ ...player });
    setNewAlias("");
  };

  const cancelEdit = () => {
    setEditingPlayer(null);
    setIsAdding(false);
    setFormData({ canonical: "", sport: "NBA", team: "", aliases: [] });
    setNewAlias("");
  };

  const savePlayer = () => {
    if (!formData.canonical.trim()) {
      alert("Canonical name is required");
      return;
    }

    if (isAdding) {
      if (addPlayer(formData)) {
        cancelEdit();
      } else {
        alert("Player already exists for this sport");
      }
    } else if (editingPlayer) {
      updatePlayer(editingPlayer.canonical, editingPlayer.sport, formData);
      cancelEdit();
    }
  };

  const addAlias = () => {
    if (newAlias.trim() && !formData.aliases.includes(newAlias.trim())) {
      setFormData({
        ...formData,
        aliases: [...formData.aliases, newAlias.trim()],
      });
      setNewAlias("");
    }
  };

  const removeAlias = (alias: string) => {
    setFormData({
      ...formData,
      aliases: formData.aliases.filter((a) => a !== alias),
    });
  };

  // Filter and group players
  const filteredPlayers = players.filter((player) => {
    // Sport filter
    if (filterSport !== "All" && player.sport !== filterSport) {
      return false;
    }
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesCanonical = player.canonical.toLowerCase().includes(query);
      const matchesTeam = player.team?.toLowerCase().includes(query);
      const matchesAlias = player.aliases.some((a) =>
        a.toLowerCase().includes(query)
      );
      return matchesCanonical || matchesTeam || matchesAlias;
    }
    return true;
  });

  const playersBySport = filteredPlayers.reduce((acc, player) => {
    if (!acc[player.sport]) acc[player.sport] = [];
    acc[player.sport].push(player);
    return acc;
  }, {} as Record<string, PlayerData[]>);

  // Get unique sports from players for filter
  const availableSports = Array.from(
    new Set(players.map((p) => p.sport))
  ).sort();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
          Players & Aliases
          <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
            ({players.length} total)
          </span>
        </h3>
        <button
          onClick={() => {
            setIsAdding(true);
            setFormData({ canonical: "", sport: "NBA", team: "", aliases: [] });
          }}
          className="flex items-center space-x-2 px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          <span>Add Player</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md text-sm"
          />
        </div>
        <select
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
          className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md px-3 py-2 text-sm"
        >
          <option value="All">All Sports</option>
          {availableSports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingPlayer) && (
        <div className="bg-neutral-100 dark:bg-neutral-800 p-4 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Canonical Name *
              </label>
              <input
                type="text"
                value={formData.canonical}
                onChange={(e) =>
                  setFormData({ ...formData, canonical: e.target.value })
                }
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
                placeholder="e.g., LeBron James"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sport *</label>
              <select
                value={formData.sport}
                onChange={(e) =>
                  setFormData({ ...formData, sport: e.target.value as Sport })
                }
                className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
              >
                {SPORTS.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Team (optional)
            </label>
            <input
              type="text"
              value={formData.team || ""}
              onChange={(e) =>
                setFormData({ ...formData, team: e.target.value })
              }
              className="w-full bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
              placeholder="e.g., Los Angeles Lakers"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Aliases</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addAlias()}
                className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-md p-2 text-sm"
                placeholder="e.g., L. James, James"
              />
              <button
                onClick={addAlias}
                className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.aliases.map((alias) => (
                <span
                  key={alias}
                  className="inline-flex items-center space-x-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded text-xs"
                >
                  <span>{alias}</span>
                  <button
                    onClick={() => removeAlias(alias)}
                    className="hover:text-green-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <button
              onClick={cancelEdit}
              className="px-4 py-2 bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-md hover:bg-neutral-400 dark:hover:bg-neutral-600"
            >
              Cancel
            </button>
            <button
              onClick={savePlayer}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Players List */}
      <div className="max-h-96 overflow-y-auto space-y-4">
        {Object.keys(playersBySport).length === 0 ? (
          <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
            {searchQuery || filterSport !== "All"
              ? "No players match your search/filter criteria."
              : "No players added yet. Add players or import bets to populate this list."}
          </div>
        ) : (
          Object.entries(playersBySport)
            .sort()
            .map(([sport, sportPlayers]) => (
              <div key={sport}>
                <h4 className="font-bold text-neutral-800 dark:text-neutral-200 mb-2">
                  {sport}
                  <span className="ml-2 text-sm font-normal text-neutral-500">
                    ({sportPlayers.length})
                  </span>
                </h4>
                <div className="space-y-2">
                  {sportPlayers.map((player) => (
                    <div
                      key={`${player.canonical}-${player.sport}`}
                      className="flex justify-between items-start p-3 bg-white dark:bg-neutral-800 rounded-md"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-neutral-900 dark:text-white">
                          {player.canonical}
                        </div>
                        {player.team && (
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            <span className="font-medium">Team:</span>{" "}
                            {player.team}
                          </div>
                        )}
                        {player.aliases.length > 0 && (
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            <span className="font-medium">Aliases:</span>{" "}
                            {player.aliases.slice(0, 5).join(", ")}
                            {player.aliases.length > 5 &&
                              ` (+${player.aliases.length - 5} more)`}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => startEdit(player)}
                          className="text-primary-500 hover:text-primary-700"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${player.canonical}?`)) {
                              removePlayer(player.canonical, player.sport);
                            }
                          }}
                          className="text-danger-500 hover:text-danger-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};

export default PlayerAliasManager;
