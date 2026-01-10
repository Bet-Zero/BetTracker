
import React, { useState, useMemo, useEffect } from "react";
import { useInputs } from "../../hooks/useInputs";
import { Tail } from "../../types";
import { Plus, X, Lock, Unlock } from "../../components/icons";
import DenseRow from "./DenseRow";
import SearchInput from "./SearchInput";

const MAX_DISPLAY_NAME_LENGTH = 6;

const TailsManager: React.FC = () => {
  const { tails, addTail, updateTail, removeTail } = useInputs();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTail, setExpandedTail] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editForm, setEditForm] = useState<Tail | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  // Filter tails based on search query
  const filteredTails = useMemo(() => {
    if (!searchQuery.trim()) return tails;
    const q = searchQuery.toLowerCase();
    return tails.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.displayName.toLowerCase().includes(q)
    );
  }, [tails, searchQuery]);

  // Reset windowing and expansion when filters change
  useEffect(() => {
    setVisibleCount(50);
    setExpandedTail(null);
  }, [searchQuery]);

  const handleSaveEdit = () => {
    if (!editForm) return;
    if (!editForm.name.trim()) {
      alert("Full name is required");
      return;
    }
    if (!editForm.displayName.trim()) {
      alert("Display name is required");
      return;
    }
    if (editForm.displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      alert(`Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or less`);
      return;
    }

    if (isAdding) {
      if (!addTail(editForm)) {
        alert("A tail with this name already exists");
        return;
      }
    } else {
      // Get the original name to update
      const originalName = expandedTail;
      if (originalName) {
        updateTail(originalName, editForm);
      }
    }
    setEditForm(null);
    setIsAdding(false);
    setExpandedTail(null);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 50);
  };

  const handleRowClick = (tail: Tail) => {
    const isExpanded = expandedTail === tail.name;
    if (isExpanded) {
      setExpandedTail(null);
      setEditForm(null);
    } else {
      setExpandedTail(tail.name);
      setEditForm({ ...tail });
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
              placeholder="Search tails..."
              className="max-w-xs"
            />
          </div>
          <button
            onClick={() => {
              setIsAdding(true);
              setEditForm({ name: "", displayName: "" });
              setExpandedTail("__new__");
            }}
            className="flex items-center space-x-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-md shadow-primary-600/20 hover:shadow-lg hover:shadow-primary-600/30"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tail</span>
          </button>
        </div>
      </div>

      {/* List Container - Card with shadow */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-md">
        <div className="p-2">
        {isAdding && editForm && (
          <div className="border-b border-neutral-200 dark:border-neutral-700 bg-blue-50 dark:bg-blue-950/30">
            <TailEditPanel
              tail={editForm}
              onChange={setEditForm}
              onSave={handleSaveEdit}
              onCancel={() => {
                setIsAdding(false);
                setEditForm(null);
                setExpandedTail(null);
              }}
              isNew
            />
          </div>
        )}

        {filteredTails.slice(0, visibleCount).map((tail) => (
          <DenseRow
            key={tail.name}
            name={tail.name}
            subtitle={tail.displayName}
            aliasCount={0}
            expanded={expandedTail === tail.name}
            onToggleExpand={() => handleRowClick(tail)}
            onDisable={() => {}} // Tails don't have disable functionality
            onEnable={() => {}}
            onDelete={() => removeTail(tail.name)}
          >
            {editForm && expandedTail === tail.name && (
              <TailEditPanel
                tail={editForm}
                onChange={setEditForm}
                onSave={handleSaveEdit}
                onCancel={() => {
                  setExpandedTail(null);
                  setEditForm(null);
                }}
              />
            )}
          </DenseRow>
        ))}

        {/* Load More / Empty State */}
        {filteredTails.length === 0 && !isAdding ? (
          <div className="p-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No tails found. Add people whose picks you follow!
          </div>
        ) : filteredTails.length > visibleCount ? (
          <button
            onClick={handleLoadMore}
            className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-medium transition-colors border-t border-neutral-100 dark:border-neutral-800"
          >
            Show {Math.min(50, filteredTails.length - visibleCount)} more... (
            {filteredTails.length - visibleCount} remaining)
          </button>
        ) : null}
        </div>
      </div>
    </div>
  );
};

// Tail edit panel (inline)
const TailEditPanel: React.FC<{
  tail: Tail;
  onChange: (tail: Tail) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}> = ({ tail, onChange, onSave, onCancel, isNew }) => {
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
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
            Full Name
          </label>
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
            value={tail.name}
            onChange={(e) => onChange({ ...tail, name: e.target.value })}
            onKeyDown={handleKeyDown}
            disabled={!isNew && isLocked}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 disabled:bg-neutral-50 dark:disabled:bg-neutral-800/50 disabled:text-neutral-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
            placeholder="e.g., Tony's Picks"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">
            Display Name{" "}
            <span className="text-neutral-400 dark:text-neutral-500">
              (max {MAX_DISPLAY_NAME_LENGTH} chars)
            </span>
          </label>
          <input
            type="text"
            value={tail.displayName}
            onChange={(e) => {
              const value = e.target.value.slice(0, MAX_DISPLAY_NAME_LENGTH);
              onChange({ ...tail, displayName: value });
            }}
            onKeyDown={handleKeyDown}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            className="w-full px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
            placeholder="e.g., Tony"
          />
          <div className="text-xs text-neutral-400 mt-0.5">
            {tail.displayName?.length || 0}/{MAX_DISPLAY_NAME_LENGTH}
          </div>
        </div>
      </div>

      {/* Actions */}
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
            disabled={!tail.name.trim() || !tail.displayName.trim()}
            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:bg-neutral-400 transition-colors shadow-sm"
          >
            Save Tail
          </button>
        )}
      </div>
    </div>
  );
};

export default TailsManager;
