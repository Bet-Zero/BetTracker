
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
import StatTypesManager from "@/components/InputManagement/StatTypesManager";

type EntityTab = "unresolved" | "teams" | "players" | "statTypes";

// Tab button component
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}> = ({ active, onClick, children, badge }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${
      active
        ? "border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400"
        : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
    }`}
  >
    {children}
    {badge !== undefined && badge > 0 && (
      <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full border border-red-200 dark:border-red-800">
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
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      {/* Top Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-700 mb-4 bg-neutral-50 dark:bg-neutral-900/50 -mx-6 px-6 pt-2 sticky top-0 z-10">
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
          active={activeTab === "statTypes"}
          onClick={() => setActiveTab("statTypes")}
        >
          Stat Types
        </TabButton>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "unresolved" && <UnresolvedQueueManager />}
        {activeTab === "teams" && <TeamsManager />}
        {activeTab === "players" && <PlayersManager />}
        {activeTab === "statTypes" && <StatTypesManager />}
      </div>
    </div>
  );
};

export default InputManagementView;
