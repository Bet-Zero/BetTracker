/**
 * EntityCombobox - Inline combobox for Name/Type field editing with resolution actions
 *
 * Features:
 * - Typable dropdown with suggestions from normalization data
 * - Sport-scoped suggestions (players + teams for Name, bet types for Type)
 * - Inline resolution status indicator (resolved ✓, unresolved ⚠)
 * - Action buttons for unresolved values: Map / Create / Defer
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { AlertTriangle, Check, X, ChevronDown, Link, Plus, Clock } from "./icons";

export type EntityType = "player" | "team" | "betType";
export type ResolutionAction = "map" | "create" | "defer";

interface Suggestion {
  value: string;
  label: string;
  type?: EntityType;
}

interface EntityComboboxProps {
  value: string;
  entityType: EntityType;
  suggestions: Suggestion[];
  isResolved: boolean;
  resolutionDecision?: ResolutionAction | null;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onResolve: (action: ResolutionAction) => void;
  onClearResolution?: () => void;
}

export const EntityCombobox: React.FC<EntityComboboxProps> = ({
  value,
  entityType,
  suggestions,
  isResolved,
  resolutionDecision,
  placeholder = "Type to search...",
  disabled = false,
  onChange,
  onResolve,
  onClearResolution,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal state with prop
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter suggestions based on input
  const filteredSuggestions = useMemo(() => {
    if (!inputValue.trim()) return suggestions.slice(0, 10);
    const lowerInput = inputValue.toLowerCase();
    return suggestions
      .filter((s) => s.label.toLowerCase().includes(lowerInput))
      .slice(0, 10);
  }, [inputValue, suggestions]);

  // Check if current value matches any suggestion exactly
  const matchesSuggestion = useMemo(() => {
    const lowerValue = inputValue.toLowerCase().trim();
    return suggestions.some((s) => s.label.toLowerCase() === lowerValue);
  }, [inputValue, suggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        // Commit value on blur if changed
        if (inputValue !== value) {
          onChange(inputValue);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue, value, onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setInputValue(suggestion.value);
    onChange(suggestion.value);
    setIsOpen(false);
    // Clear any previous resolution decision since value now matches
    if (onClearResolution) {
      onClearResolution();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) =>
        prev < filteredSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredSuggestions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        handleSelectSuggestion(filteredSuggestions[highlightedIndex]);
      } else {
        // Commit current value
        onChange(inputValue);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setInputValue(value); // Reset to original
    }
  };

  const handleBlur = () => {
    // Small delay to allow button clicks
    setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, 150);
  };

  // Determine status display
  const showActions = !isResolved && !resolutionDecision && inputValue.trim();
  const showDeferredBadge = resolutionDecision === "defer";

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        {/* Input with dropdown */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsOpen(true)}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholder}
            className={`w-full p-1 pr-6 text-sm border rounded bg-white dark:bg-neutral-800 ${
              !isResolved && !resolutionDecision && inputValue.trim()
                ? "border-yellow-400 dark:border-yellow-600"
                : isResolved || matchesSuggestion
                ? "border-green-400 dark:border-green-600"
                : "border-neutral-300 dark:border-neutral-600"
            }`}
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            tabIndex={-1}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Status indicators */}
        {isResolved && (
          <span
            className="text-green-600 dark:text-green-400 flex-shrink-0"
            title="Resolved"
          >
            <Check className="w-4 h-4" />
          </span>
        )}

        {showDeferredBadge && (
          <span
            className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-0.5"
            title="Will be added to Unresolved Queue"
          >
            <Clock className="w-3 h-3" />
            Deferred
          </span>
        )}

        {!isResolved && !resolutionDecision && inputValue.trim() && (
          <span
            className="text-yellow-600 dark:text-yellow-400 flex-shrink-0"
            title="Unresolved - needs action"
          >
            <AlertTriangle className="w-4 h-4" />
          </span>
        )}
      </div>

      {/* Dropdown suggestions */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.value}`}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 ${
                index === highlightedIndex
                  ? "bg-primary-50 dark:bg-primary-900/20"
                  : ""
              }`}
            >
              <span className="text-neutral-900 dark:text-white">
                {suggestion.label}
              </span>
              {suggestion.type && (
                <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                  ({suggestion.type})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Action buttons for unresolved values */}
      {showActions && (
        <div className="flex gap-1 mt-1">
          <button
            type="button"
            onClick={() => onResolve("map")}
            className="flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
            title="Map to existing canonical"
          >
            <Link className="w-3 h-3" />
            Map
          </button>
          <button
            type="button"
            onClick={() => onResolve("create")}
            className="flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/50"
            title="Create new canonical"
          >
            <Plus className="w-3 h-3" />
            Create
          </button>
          <button
            type="button"
            onClick={() => onResolve("defer")}
            className="flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
            title="Defer to Unresolved Queue"
          >
            <Clock className="w-3 h-3" />
            Defer
          </button>
        </div>
      )}
    </div>
  );
};

export default EntityCombobox;
