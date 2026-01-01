
import React, { memo } from "react";
import { ChevronDown, ChevronRight, EyeOff, Power, Trash2 } from "../../components/icons";

interface DenseRowProps {
  name: string;
  subtitle?: string;
  aliasCount: number;
  disabled?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}

const DenseRow: React.FC<DenseRowProps> = ({
  name,
  subtitle,
  aliasCount,
  disabled = false,
  expanded = false,
  onToggleExpand,
  onDisable,
  onEnable,
  onDelete,
  children,
}) => {
  return (
    <div
      className={`border-b border-neutral-200 dark:border-neutral-700 ${
        disabled ? "opacity-50 bg-neutral-50 dark:bg-neutral-900/50" : ""
      }`}
    >
      <div className="group flex items-center px-3 py-1.5 h-9 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 mr-1"
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Name */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`font-medium text-sm truncate ${disabled ? "line-through text-neutral-500" : "text-neutral-900 dark:text-neutral-100"}`}>
            {name}
          </span>
          
          {subtitle && (
            <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate hidden sm:inline-block">
              {subtitle}
            </span>
          )}

          {aliasCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 rounded-full border border-neutral-200 dark:border-neutral-700">
              +{aliasCount}
            </span>
          )}

          {disabled && (
            <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded uppercase font-bold tracking-wider">
              Disabled
            </span>
          )}
        </div>

        {/* Actions - Visible on group hover or if disabled (so you know how to enable) */}
        <div className={`flex items-center space-x-1 ${disabled ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {disabled ? (
            <button
              onClick={(e) => { e.stopPropagation(); onEnable(); }}
              className="p-1 text-neutral-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
              title="Enable"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onDisable(); }}
              className="p-1 text-neutral-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
              title="Disable"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete '${name}'? This action cannot be undone.`)) {
                onDelete();
              }
            }}
            className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expansion panel */}
      {expanded && children && (
        <div className="px-3 py-3 bg-neutral-50 dark:bg-neutral-800/30 border-t border-neutral-200 dark:border-neutral-700 shadow-inner">
          {children}
        </div>
      )}
    </div>
  );
};

export default memo(DenseRow);
