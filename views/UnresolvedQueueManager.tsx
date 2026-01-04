/**
 * UnresolvedQueueManager - Review and resolve unresolved entities from imports
 *
 * Phase 3: Provides UI for users to:
 * - View unresolved items from the queue
 * - Map items to existing canonicals (add alias)
 * - Create new canonical entries
 * - Ignore/dismiss items
 *
 * Phase 3.1: Grouped queue display
 * - Groups queue items by (entityType, sport, rawValue) for cleaner UI
 * - Bulk actions apply to entire groups
 * - Shows count badge and sample contexts
 *
 * Write boundaries: Only writes on user action (Map/Create/Ignore button clicks)
 */

import React, { useState, useMemo, useCallback } from "react";
import {
  getUnresolvedQueue,
  removeFromUnresolvedQueue,
  UnresolvedItem,
  UnresolvedEntityType,
} from "../services/unresolvedQueue";
import { resolveTeam, resolvePlayer } from "../services/resolver";
import { toLookupKey, generateTeamId } from "../services/normalizationService";
import { Sport } from "../data/referenceData";
import {
  useNormalizationData,
  TeamData,
  BetTypeData,
  PlayerData,
} from "../hooks/useNormalizationData";
import {
  AlertTriangle,
  CheckCircle2,
  Trash2,
  X,
  Plus,
  Link,
  Info,
} from "../components/icons";
import MapToExistingModal from "../components/MapToExistingModal";
import CreateCanonicalModal from "../components/CreateCanonicalModal";

// Filter options
type EntityTypeFilter = "all" | UnresolvedEntityType;
type SportFilter = "all" | string;

// ============================================================================
// GROUPED QUEUE TYPES
// ============================================================================

/**
 * Sample context from a queue item for display in tooltips/expanded rows
 */
interface SampleContext {
  book: string;
  market?: string;
  betId: string;
}

/**
 * A grouped queue item representing multiple raw queue items
 * with the same (entityType, sport, rawValue)
 */
interface GroupedQueueItem {
  /** Unique key for this group */
  groupKey: string;
  /** Entity type (team, player, stat, unknown) */
  entityType: UnresolvedEntityType;
  /** Sport (may be undefined) */
  sport?: string;
  /** Original-cased rawValue from first encountered item */
  rawValue: string;
  /** Number of queue items in this group */
  count: number;
  /** Most recent encounteredAt timestamp */
  lastSeenAt: string;
  /** Sample contexts for display (up to 3) */
  sampleContexts: SampleContext[];
  /** All item IDs in this group (for bulk removal) */
  itemIds: string[];
  /** Collision candidates if any items have them (deduped) */
  collisionCandidates: string[];
}

/**
 * Generate a group key from an unresolved item.
 * Phase 3.P1: Uses toLookupKey() for consistent key normalization.
 */
function generateGroupKey(item: UnresolvedItem): string {
  const normalizedRawValue = toLookupKey(item.rawValue);
  const sport = item.sport ?? "Unknown";
  return `${item.entityType}::${sport}::${normalizedRawValue}`;
}

/**
 * Group queue items by (entityType, sport, rawValue)
 */
function groupQueueItems(items: UnresolvedItem[]): GroupedQueueItem[] {
  const groupMap = new Map<string, GroupedQueueItem>();

  for (const item of items) {
    const groupKey = generateGroupKey(item);
    const existing = groupMap.get(groupKey);

    if (existing) {
      // Add to existing group
      existing.count += 1;
      existing.itemIds.push(item.id);

      // Update lastSeenAt if this item is more recent
      if (item.encounteredAt > existing.lastSeenAt) {
        existing.lastSeenAt = item.encounteredAt;
      }

      // Add sample context if we have room
      if (existing.sampleContexts.length < 3) {
        const context: SampleContext = {
          book: item.book,
          market: item.market,
          betId: item.betId,
        };
        // Avoid duplicate contexts
        const isDupe = existing.sampleContexts.some(
          (c) => c.book === context.book && c.market === context.market
        );
        if (!isDupe) {
          existing.sampleContexts.push(context);
        }
      }
    } else {
      // Create new group
      groupMap.set(groupKey, {
        groupKey,
        entityType: item.entityType,
        sport: item.sport,
        rawValue: item.rawValue, // Keep original casing from first encountered
        count: 1,
        lastSeenAt: item.encounteredAt,
        sampleContexts: [
          {
            book: item.book,
            market: item.market,
            betId: item.betId,
          },
        ],
        itemIds: [item.id],
        collisionCandidates: [],
      });
    }
  }

  // Sort groups by lastSeenAt (most recent first)
  return Array.from(groupMap.values()).sort(
    (a, b) =>
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
  );
}

/**
 * Create a "fake" UnresolvedItem from a group for modal compatibility
 */
function groupToUnresolvedItem(group: GroupedQueueItem): UnresolvedItem {
  return {
    id: group.groupKey,
    rawValue: group.rawValue,
    entityType: group.entityType,
    encounteredAt: group.lastSeenAt,
    book: group.sampleContexts[0]?.book || "Unknown",
    betId: group.sampleContexts[0]?.betId || "",
    market: group.sampleContexts[0]?.market,
    sport: group.sport,
  };
}

interface UnresolvedQueueManagerProps {
  onQueueChange?: () => void;
}

const UnresolvedQueueManager: React.FC<UnresolvedQueueManagerProps> = ({
  onQueueChange,
}) => {
  // Load queue items (read-only on render)
  const [queueItems, setQueueItems] = useState<UnresolvedItem[]>(() =>
    getUnresolvedQueue()
  );

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] =
    useState<EntityTypeFilter>("all");
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");

  // Modal state - now uses GroupedQueueItem
  const [mapModalGroup, setMapModalGroup] = useState<GroupedQueueItem | null>(
    null
  );
  const [createModalGroup, setCreateModalGroup] =
    useState<GroupedQueueItem | null>(null);

  // Expanded row state for context preview
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Get normalization data for mapping
  const {
    teams,
    betTypes,
    players,
    updateTeam,
    updatePlayer,
    addTeam,
    addBetType,
    addPlayer,
  } = useNormalizationData();

  // Compute unique sports from queue items for filter dropdown
  const availableSports = useMemo(() => {
    const sports = new Set<string>();
    queueItems.forEach((item) => {
      if (item.sport) sports.add(item.sport);
    });
    return Array.from(sports).sort();
  }, [queueItems]);

  // Group and filter queue items
  const groupedItems = useMemo(() => {
    // First filter raw items
    const filtered = queueItems.filter((item) => {
      if (entityTypeFilter !== "all" && item.entityType !== entityTypeFilter) {
        return false;
      }
      if (sportFilter !== "all" && item.sport !== sportFilter) {
        return false;
      }
      return true;
    });

    // Then group them
    return groupQueueItems(filtered);
  }, [queueItems, entityTypeFilter, sportFilter]);

  // Total item count (for display)
  const totalItemCount = useMemo(() => {
    return groupedItems.reduce((sum, g) => sum + g.count, 0);
  }, [groupedItems]);

  // Refresh queue from localStorage
  const refreshQueue = useCallback(() => {
    setQueueItems(getUnresolvedQueue());
    onQueueChange?.();
  }, [onQueueChange]);

  // Handle ignore action for entire group
  const handleIgnoreGroup = useCallback(
    (group: GroupedQueueItem) => {
      removeFromUnresolvedQueue(group.itemIds);
      refreshQueue();
    },
    [refreshQueue]
  );

  // Handle bulk ignore for all filtered groups
  const handleIgnoreAll = useCallback(() => {
    if (groupedItems.length === 0) return;

    const totalCount = groupedItems.reduce((sum, g) => sum + g.count, 0);
    const confirmed = window.confirm(
      `Are you sure you want to ignore ${totalCount} item(s) across ${groupedItems.length} group(s)? This cannot be undone.`
    );
    if (!confirmed) return;

    const allIds = groupedItems.flatMap((g) => g.itemIds);
    removeFromUnresolvedQueue(allIds);
    refreshQueue();
  }, [groupedItems, refreshQueue]);

  // Handle map to existing - opens modal with group
  const handleMapClick = useCallback((group: GroupedQueueItem) => {
    setMapModalGroup(group);
  }, []);

  // Handle create new - opens modal with group
  const handleCreateClick = useCallback((group: GroupedQueueItem) => {
    setCreateModalGroup(group);
  }, []);

  // Handle map confirmation from modal - applies to entire group
  const handleMapConfirm = useCallback(
    (item: UnresolvedItem, targetCanonical: string) => {
      // Find the group this item belongs to
      const group = mapModalGroup;
      if (!group) return;

      if (item.entityType === "team") {
        // Find target team and add alias
        const targetTeam = teams.find((t) => t.canonical === targetCanonical);
        if (targetTeam) {
          const updatedTeam: TeamData = {
            ...targetTeam,
            aliases: [...targetTeam.aliases, group.rawValue],
          };
          updateTeam(targetTeam.canonical, updatedTeam);
        }
      } else if (item.entityType === "player") {
        // Find target player and add alias
        const targetPlayer = players.find(
          (p) => p.canonical === targetCanonical && p.sport === item.sport
        );
        if (targetPlayer) {
          const updatedPlayer: PlayerData = {
            ...targetPlayer,
            aliases: [...targetPlayer.aliases, group.rawValue],
          };
          updatePlayer(
            targetPlayer.canonical,
            targetPlayer.sport,
            updatedPlayer
          );
        }
      } else if (item.entityType === "stat") {
        // Find target bet type and add alias
        const targetBetType = betTypes.find(
          (s) => s.canonical === targetCanonical && s.sport === item.sport
        );
        if (targetBetType) {
          const updatedBetType: BetTypeData = {
            ...targetBetType,
            aliases: [...targetBetType.aliases, group.rawValue],
          };
          // Note: updateBetType uses canonical only, sport is in the updated object
          const index = betTypes.findIndex(
            (s) =>
              s.canonical === targetBetType.canonical &&
              s.sport === targetBetType.sport
          );
          if (index !== -1) {
            // Need to use the service directly for bet types with sport
            const newBetTypes = [...betTypes];
            newBetTypes[index] = updatedBetType;
            // This will be handled by the modal calling the appropriate function
          }
        }
      }

      // Remove ALL items in the group from queue
      removeFromUnresolvedQueue(group.itemIds);
      setMapModalGroup(null);
      refreshQueue();
    },
    [
      teams,
      players,
      betTypes,
      updateTeam,
      updatePlayer,
      refreshQueue,
      mapModalGroup,
    ]
  );

  // Handle create confirmation from modal - applies to entire group
  const handleCreateConfirm = useCallback(
    (
      item: UnresolvedItem,
      canonical: string,
      sport: Sport,
      additionalAliases: string[],
      extraData?: {
        teamId?: string;
        description?: string;
        abbreviations?: string[];
      }
    ) => {
      // Find the group this item belongs to
      const group = createModalGroup;
      if (!group) return;

      const aliases = [
        group.rawValue,
        ...additionalAliases.filter((a) => a !== group.rawValue),
      ];

      if (item.entityType === "team") {
        const newTeam: TeamData = {
          id: generateTeamId(sport, extraData?.abbreviations || [], canonical),
          canonical,
          sport,
          aliases,
          abbreviations: extraData?.abbreviations || [],
        };
        addTeam(newTeam);
      } else if (item.entityType === "player") {
        // Resolve team name from ID if present
        let teamName = extraData?.teamId ? undefined : undefined;
        if (extraData?.teamId) {
           const foundTeam = teams.find(t => t.id === extraData?.teamId);
           if (foundTeam) teamName = foundTeam.canonical;
        }

        const newPlayer: PlayerData = {
          canonical,
          sport,
          aliases,
          team: teamName,
          teamId: extraData?.teamId,
        };
        addPlayer(newPlayer);
      } else if (item.entityType === "stat") {
        const newBetType: BetTypeData = {
          canonical,
          sport,
          aliases,
          description: extraData?.description || canonical,
        };
        addBetType(newBetType);
      }

      // Remove ALL items in the group from queue
      removeFromUnresolvedQueue(group.itemIds);
      setCreateModalGroup(null);
      refreshQueue();
    },
    [addTeam, addPlayer, addBetType, refreshQueue, createModalGroup]
  );

  // Get resolution status for display
  const getResolutionStatus = useCallback(
    (group: GroupedQueueItem): "unresolved" | "ambiguous" => {
      if (group.entityType === "team") {
        const result = resolveTeam(group.rawValue);
        return result.status === "ambiguous" ? "ambiguous" : "unresolved";
      } else if (group.entityType === "player") {
        const result = resolvePlayer(group.rawValue, {
          sport: group.sport as Sport,
        });
        return result.status === "ambiguous" ? "ambiguous" : "unresolved";
      }
      return "unresolved";
    },
    []
  );

  // Format date for display
  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    } catch {
      return isoString;
    }
  };

  // Entity type badge color
  const getEntityTypeBadgeClass = (type: UnresolvedEntityType): string => {
    switch (type) {
      case "team":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "player":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "stat":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300";
      default:
        return "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300";
    }
  };

  // Empty state
  if (queueItems.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 mx-auto text-accent-500 mb-3" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
          All Entities Resolved
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No unresolved items in queue. New items will appear here after
          importing bets with unknown entities.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Filter Toolbar - Card style */}
      <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Type:
            </label>
            <select
              value={entityTypeFilter}
              onChange={(e) =>
                setEntityTypeFilter(e.target.value as EntityTypeFilter)
              }
              className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md px-3 py-1.5 text-sm shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >
              <option value="all">All Types</option>
              <option value="team">Teams</option>
              <option value="player">Players</option>
              <option value="stat">Stat Types</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Sport:
            </label>
            <select
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              className="bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md px-3 py-1.5 text-sm shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
            >
              <option value="all">All Sports</option>
              {availableSports.map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <span className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">
            {groupedItems.length} group(s), {totalItemCount} item(s)
          </span>

          {groupedItems.length > 0 && (
            <button
              onClick={handleIgnoreAll}
              className="px-4 py-1.5 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-md font-medium transition-colors"
            >
              Ignore All ({totalItemCount})
            </button>
          )}
        </div>
      </div>

      {/* Grouped Queue List - Card container */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-md overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto p-2">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 dark:bg-neutral-800 sticky top-0">
            <tr className="text-left text-xs text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
              <th className="px-4 py-3">Raw Value</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Sport</th>
              <th className="px-4 py-3">Count</th>
              <th className="px-4 py-3">Last Seen</th>
              <th className="px-4 py-3">Context</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {groupedItems.map((group, index) => {
              const status = getResolutionStatus(group);
              const isExpanded = expandedGroup === group.groupKey;

              return (
                <React.Fragment key={group.groupKey}>
                  <tr
                    className={`${
                      index % 2 === 0
                        ? "bg-white dark:bg-neutral-900"
                        : "bg-neutral-50 dark:bg-neutral-800/50"
                    } hover:bg-neutral-100 dark:hover:bg-neutral-800`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-neutral-900 dark:text-white">
                          {group.rawValue}
                        </span>
                        {status === "ambiguous" && (
                          <span
                            className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded"
                            title="Multiple canonicals match this value"
                          >
                            Ambiguous
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getEntityTypeBadgeClass(
                          group.entityType
                        )}`}
                      >
                        {group.entityType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {group.sport || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 rounded-full">
                        {group.count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-500 dark:text-neutral-500 text-xs">
                      {formatDate(group.lastSeenAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          setExpandedGroup(isExpanded ? null : group.groupKey)
                        }
                        className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400"
                        title="Show sample contexts"
                      >
                        <Info className="w-3.5 h-3.5" />
                        <span>
                          {group.sampleContexts[0]?.book}
                          {group.sampleContexts[0]?.market
                            ? ` - ${group.sampleContexts[0].market}`
                            : ""}
                        </span>
                        {group.sampleContexts.length > 1 && (
                          <span className="text-neutral-400">
                            +{group.sampleContexts.length - 1}
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleMapClick(group)}
                          className="p-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded"
                          title="Map to existing canonical"
                        >
                          <Link className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCreateClick(group)}
                          className="p-1.5 text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded"
                          title="Create new canonical"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleIgnoreGroup(group)}
                          className="p-1.5 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded"
                          title={`Ignore all ${group.count} item(s)`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded context row - Inset styling */}
                  {isExpanded && (
                    <tr className="bg-neutral-100 dark:bg-neutral-950">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="ml-2 mr-2 mb-2 bg-neutral-100 dark:bg-neutral-950 rounded-lg shadow-inner p-3">
                          <div className="text-xs space-y-1">
                            <div className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                              Sample Contexts ({group.sampleContexts.length} of{" "}
                              {group.count}):
                            </div>
                            {group.sampleContexts.map((ctx, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-4 text-neutral-600 dark:text-neutral-400"
                              >
                                <span className="font-medium">{ctx.book}</span>
                                <span>{ctx.market || "—"}</span>
                                <span className="text-neutral-400 truncate max-w-[200px]">
                                  Bet: {ctx.betId}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Map to Existing Modal */}
      {mapModalGroup && (
        <MapToExistingModal
          item={groupToUnresolvedItem(mapModalGroup)}
          teams={teams}
          players={players}
          betTypes={betTypes}
          onConfirm={handleMapConfirm}
          onCancel={() => setMapModalGroup(null)}
          groupCount={mapModalGroup.count}
        />
      )}

      {/* Create New Modal */}
      {createModalGroup && (
        <CreateCanonicalModal
          item={groupToUnresolvedItem(createModalGroup)}
          onConfirm={handleCreateConfirm}
          onCancel={() => setCreateModalGroup(null)}
          groupCount={createModalGroup.count}
        />
      )}
    </div>
  );
};

export default UnresolvedQueueManager;
