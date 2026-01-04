
/**
 * Phase 5: Input Management View
 *
 * A high-performance, dense admin UI for managing normalization entities.
 *
 * key Features:
 * - Manual Windowing (50 items) for instant load/search
 * - Dense (~36px) rows for information density
 * - Inline Editors for quick CRUD
 * - Separated Managers for Teams, Players, Stat Types
 */

import React, { useState, useEffect } from "react";
import UnresolvedQueueManager from "./UnresolvedQueueManager";
import { getUnresolvedQueueCount } from "../services/unresolvedQueue";
import TeamsManager from "@/components/InputManagement/TeamsManager";
import PlayersManager from "@/components/InputManagement/PlayersManager";
import BetTypesManager from "@/components/InputManagement/BetTypesManager";
import TailsManager from "@/components/InputManagement/TailsManager";

type EntityTab = "unresolved" | "teams" | "players" | "betTypes" | "tails";

// Tab button component - Pill-style with elevated active state
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}> = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-semibold text-sm rounded-lg transition-all duration-200 ${
      active
        ? "bg-primary-600 text-white shadow-md shadow-primary-600/20 dark:shadow-primary-400/20"
        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-200"
    }`}
  >
    {children}
    {badge !== undefined && badge > 0 && (
      <span className={`ml-2 px-1.5 py-0.5 text-xs font-medium rounded-full border ${
        active
          ? "bg-white/20 text-white border-white/30"
          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
      }`}>
        {badge}
      </span>
    )}
  </button>
);

const InputManagementView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EntityTab>("unresolved");
  const [unresolvedCount, setUnresolvedCount] = useState(0);

  // Poll for unresolved count updates
  useEffect(() => {
    const updateCount = () => {
      setUnresolvedCount(getUnresolvedQueueCount());
    };
    
    updateCount();
    
    // Listen for custom event or poll (polling is safer if event not consistently fired)
    const interval = setInterval(updateCount, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-neutral-100 dark:bg-neutral-950 -mx-6 -my-6 px-6 py-6 min-h-full">
      {/* Elevated Card Container */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col h-[calc(100vh-80px)] min-h-[700px]">
        {/* Tab Bar - Elevated with subtle background */}
        <div className="px-6 pt-4 pb-2 bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex gap-2">
            <TabButton
              active={activeTab === "unresolved"}
              onClick={() => setActiveTab("unresolved")}
              badge={unresolvedCount}
            >
              Unresolved Queue
            </TabButton>
            <TabButton
              active={activeTab === "teams"}
              onClick={() => setActiveTab("teams")}
            >
              Teams
            </TabButton>
            <TabButton
              active={activeTab === "players"}
              onClick={() => setActiveTab("players")}
            >
              Players
            </TabButton>
            <TabButton
              active={activeTab === "betTypes"}
              onClick={() => setActiveTab("betTypes")}
            >
              Bet Types
            </TabButton>
            <TabButton
              active={activeTab === "tails"}
              onClick={() => setActiveTab("tails")}
            >
              Tails
            </TabButton>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative bg-white dark:bg-neutral-900">
          {activeTab === "unresolved" && <UnresolvedQueueManager />}
          {activeTab === "teams" && <TeamsManager />}
          {activeTab === "players" && <PlayersManager />}
          {activeTab === "betTypes" && <BetTypesManager />}
          {activeTab === "tails" && <TailsManager />}
        </div>
      </div>
    </div>
  );
};

export default InputManagementView;
