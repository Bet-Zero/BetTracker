import React from "react";
import { X, Plus, Check } from "./icons";

interface AddTailModalProps {
  tailName: string;
  onConfirm: (finalName: string, finalDisplayName: string) => void;
  onCancel: () => void;
}

const AddTailModal: React.FC<AddTailModalProps> = ({
  tailName,
  onConfirm,
  onCancel,
}) => {
  const [name, setName] = React.useState(tailName);
  const [displayName, setDisplayName] = React.useState(tailName.slice(0, 6));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.select();
    }
  }, []);
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                <Plus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                Add New Tail
              </h2>
            </div>
            <button
              onClick={onCancel}
              className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-neutral-600 dark:text-neutral-300 mb-4">
            Do you want to add this tail to your saved list?
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Full Name
              </label>
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-md p-4 flex items-center justify-between border border-neutral-200 dark:border-neutral-700">
                <input
                    ref={inputRef}
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setName(newName);
                      // Auto-update display name if it hasn't been manually edited? 
                      // For now, let's keep them independent or user can just type.
                    }}
                    className="bg-transparent border-none focus:ring-0 text-lg font-semibold text-neutral-900 dark:text-white w-full mr-4 p-0"
                    placeholder="Enter tail name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const finalName = name.trim();
                        const finalDisplay = displayName.trim() || finalName.slice(0, 6);
                        if (finalName) onConfirm(finalName, finalDisplay);
                      } else if (e.key === "Escape") {
                        onCancel();
                      }
                    }}
                />
                <span className="px-2 py-1 text-xs font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded flex-shrink-0">
                    New
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Display Name (max 6 chars)
              </label>
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-md p-4 border border-neutral-200 dark:border-neutral-700">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 6))}
                  maxLength={6}
                  className="bg-transparent border-none focus:ring-0 text-lg font-semibold text-neutral-900 dark:text-white w-full p-0"
                  placeholder="Short name (e.g. Tony)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        const finalName = name.trim();
                        const finalDisplay = displayName.trim() || finalName.slice(0, 6);
                        if (finalName) onConfirm(finalName, finalDisplay);
                    } else if (e.key === "Escape") {
                      onCancel();
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            Once added, it will appear in suggestion dropdowns and can be reused.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3 bg-neutral-50 dark:bg-neutral-800/30">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
               const finalName = name.trim();
               const finalDisplay = displayName.trim() || finalName.slice(0, 6);
               if (finalName) onConfirm(finalName, finalDisplay);
            }}
            disabled={!name.trim()}
            autoFocus
            className="px-4 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md shadow flex items-center gap-2 transition-colors"
          >
            <Check className="w-4 h-4" />
            Add Tail
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTailModal;
