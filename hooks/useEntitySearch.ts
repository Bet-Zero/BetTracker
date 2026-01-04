import { useMemo, useState, useEffect } from "react";
import { TeamData, PlayerData, BetTypeData } from "./useNormalizationData";

type Entity = TeamData | PlayerData | BetTypeData;

export function useEntitySearch<T extends Entity>(
  entities: T[],
  initialQuery: string = "",
  sportFilter: string = "All",
  showDisabled: boolean = false
) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // Debounce query if list is large
  useEffect(() => {
    const timeoutId = setTimeout(
      () => {
        setDebouncedQuery(query);
      },
      entities.length > 500 ? 300 : 0
    ); // Instant for small lists, 300ms for large

    return () => clearTimeout(timeoutId);
  }, [query, entities.length]);

  const filteredEntities = useMemo(() => {
    let result = entities;

    // 1. Sport Filter (common to all, though BetTypes might have different logic handled by caller,
    // but usually they filter BEFORE passing here? No, let's handle it here if passed)
    if (sportFilter !== "All") {
      result = result.filter((e) => {
        // Check if entity has 'sport' property. BetTypes have sport.
        // Checking the types: TeamData (sport), PlayerData (sport), BetTypeData (sport).
        // So this hook should probably assume the caller handles sport filtering OR generics need to be smarter.
        // For simplicity/reusability, let's assume the caller filters primarily by sport/category
        // BEFORE passing 'entities' OR this hook handles it if the property exists.
        if ("sport" in e) {
          return (e as any).sport === sportFilter;
        }
        return true;
      });
    }

    // 2. Disabled Filter
    if (!showDisabled) {
      result = result.filter((e) => !e.disabled);
    }

    // 3. Search Filter
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter((e) => {
        // Canonical match
        if (e.canonical.toLowerCase().includes(q)) return true;

        // Alias match
        if (e.aliases.some((a) => a.toLowerCase().includes(q))) return true;

        // Team-specific: Abbreviations
        if ("abbreviations" in e && (e as any).abbreviations) {
          if (
            (e as any).abbreviations.some((a: string) =>
              a.toLowerCase().includes(q)
            )
          )
            return true;
        }

        // Player-specific: Team name
        if ("team" in e && (e as any).team) {
          if ((e as any).team.toLowerCase().includes(q)) return true;
        }

        return false;
      });
    }

    return result;
  }, [entities, sportFilter, showDisabled, debouncedQuery]);

  return {
    query,
    setQuery,
    filteredEntities,
    totalCount: entities.length,
    filteredCount: filteredEntities.length,
  };
}
